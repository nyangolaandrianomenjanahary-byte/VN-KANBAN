/**
 * Routes d'authentification :
 *   GET  /api/config                     état public de l'application
 *   POST /api/auth/register              création de compte (e-mail + mot de passe)
 *   POST /api/auth/login                 connexion
 *   POST /api/auth/logout                déconnexion
 *   GET  /api/auth/me                    session courante
 *   POST /api/auth/password              changement de mot de passe
 *   GET  /api/auth/google/start          démarrage OAuth Google
 *   GET  /api/auth/google/callback       retour OAuth Google
 *   POST /api/auth/forgot                demande de réinitialisation
 *   POST /api/auth/reset                 réinitialisation par jeton
 */

import {
  HttpError,
  clientIp,
  json,
  normalizeEmail,
  readJson,
  redirect,
  safeNextPath,
  validateClientPassword,
  validateEmail,
  validateName
} from '../lib/utils.js';
import {
  CLIENT_KDF_VERSION,
  randomToken,
  sha256Hex,
  hashPassword,
  verifyPassword,
  verifyGoogleIdToken,
  stringToB64url,
  b64urlToString,
  bytesToB64url
} from '../lib/crypto.js';
import {
  audit,
  clearRateLimit,
  countUsers,
  createPasswordReset,
  consumePasswordReset,
  createUser,
  getUserByEmail,
  getUserById,
  getUserByGoogleSub,
  publicUser,
  rateLimit,
  updateUser
} from '../lib/db.js';
import {
  clearedCookie,
  cookieFor,
  createSession,
  currentSession,
  isRoot,
  revokeAllSessions,
  revokeSession
} from '../lib/session.js';
import { buildGoogleAuthUrl, exchangeGoogleCode, googleConfigured, googleJwksUrl } from '../lib/google.js';

const STATE_COOKIE = 'vn_oauth_state';
const ITERATIONS = (env) => Number(env.PBKDF2_ITERATIONS) || 25_000;
const PEPPER = (env) => env.PASSWORD_PEPPER || '';
const ALLOW_SIGNUP = (env) => (env.ALLOW_SIGNUP || 'true') !== 'false';
const FIRST_USER_IS_ROOT = (env) => (env.FIRST_USER_IS_ROOT || 'true') !== 'false';

/* ------------------------------------------------------------------ */
/*  État public                                                        */
/* ------------------------------------------------------------------ */

export async function getConfig(env) {
  const total = await countUsers(env);
  const roots = total ? await countRootsSafe(env) : 0;
  return json({
    appName: env.APP_NAME || 'VN Kanban',
    auth: {
      google: googleConfigured(env),
      email: true,
      allowSignup: ALLOW_SIGNUP(env),
      kdf: { version: CLIENT_KDF_VERSION, iterations: 210_000, hash: 'SHA-256' },
      minPasswordLength: 8,
      firstUserIsRoot: FIRST_USER_IS_ROOT(env) && total === 0,
      hasRoot: roots > 0,
      mailer: !!(env.RESEND_API_KEY || env.MAIL_WEBHOOK_URL)
    }
  });
}

async function countRootsSafe(env) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'root'").first();
  return row ? row.n : 0;
}

/* ------------------------------------------------------------------ */
/*  Inscription                                                        */
/* ------------------------------------------------------------------ */

export async function register(env, request) {
  if (!ALLOW_SIGNUP(env)) {
    throw new HttpError(403, 'signup_closed', 'Les inscriptions sont fermées. Contactez l’administrateur.');
  }

  const body = await readJson(request);
  const email = validateEmail(body.email);
  const password = validateClientPassword(body.password);
  const name = validateName(body.name);
  const kdf = body.kdf || CLIENT_KDF_VERSION;

  if (kdf !== CLIENT_KDF_VERSION) {
    throw new HttpError(400, 'kdf_outdated', 'Version de chiffrement obsolète : rechargez la page (Ctrl/Cmd + Maj + R).');
  }

  const ip = clientIp(request);
  const limit = await rateLimit(env, `register:ip:${ip}`, { max: 10, windowMs: 60 * 60 * 1000, blockMs: 30 * 60 * 1000 });
  if (!limit.allowed) {
    throw new HttpError(429, 'too_many_requests', 'Trop de tentatives. Réessayez plus tard.');
  }

  const existing = await getUserByEmail(env, email);
  if (existing) {
    throw new HttpError(409, 'email_taken', 'Un compte existe déjà avec cette adresse e-mail. Connectez-vous.');
  }

  const total = await countUsers(env);
  const becomesRoot = total === 0 && FIRST_USER_IS_ROOT(env);

  const passwordHash = await hashPassword(password, { iterations: ITERATIONS(env), pepper: PEPPER(env) });

  const user = await createUser(env, {
    email,
    name,
    role: becomesRoot ? 'root' : 'user',
    status: 'active',
    provider: 'email',
    emailVerified: false,
    passwordHash,
    passwordKdf: CLIENT_KDF_VERSION
  });

  const session = await createSession(env, request, user.id);
  await updateUser(env, user.id, { last_login_at: Date.now(), last_login_ip: ip });
  await audit(env, {
    actorId: user.id,
    actorEmail: user.email,
    action: 'auth.register',
    target: user.id,
    details: becomesRoot ? 'Premier compte : rôle ROOT attribué' : 'Compte créé',
    ip
  });

  return json(
    { user: publicUser(user), root: isRoot(user), created: true },
    201,
    { 'Set-Cookie': cookieFor(session.token, request, session.expiresAt) }
  );
}

/* ------------------------------------------------------------------ */
/*  Connexion                                                          */
/* ------------------------------------------------------------------ */

// Calcul factice : garde un temps de réponse comparable quand l'e-mail
// n'existe pas (évite de révéler quels comptes existent).
async function dummyVerify(password) {
  await hashPassword(password, { iterations: ITERATIONS({}), pepper: 'factice' });
}

export async function login(env, request) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const kdf = body.kdf || CLIENT_KDF_VERSION;
  const ip = clientIp(request);

  const ipLimit = await rateLimit(env, `login:ip:${ip}`, { max: 30, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 });
  if (!ipLimit.allowed) {
    throw new HttpError(429, 'too_many_requests', 'Trop de tentatives depuis cette connexion. Réessayez dans quelques minutes.');
  }
  if (email) {
    const accountLimit = await rateLimit(env, `login:account:${email}`, { max: 10, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 });
    if (!accountLimit.allowed) {
      await audit(env, { actorEmail: email, action: 'auth.login.blocked', details: 'Limitation de débit', ip });
      throw new HttpError(429, 'too_many_requests', 'Compte temporairement verrouillé après plusieurs échecs. Réessayez dans 15 minutes.');
    }
  }

  if (kdf !== CLIENT_KDF_VERSION) {
    throw new HttpError(400, 'kdf_outdated', 'Version de chiffrement obsolète : rechargez la page (Ctrl/Cmd + Maj + R).');
  }

  const user = email ? await getUserByEmail(env, email) : null;

  if (!user) {
    await dummyVerify(password || 'vide');
    throw new HttpError(401, 'invalid_credentials', 'Adresse e-mail ou mot de passe incorrect.');
  }

  if (user.status === 'suspended') {
    await audit(env, { actorId: user.id, actorEmail: user.email, action: 'auth.login.suspended', ip });
    throw new HttpError(403, 'account_suspended', 'Ce compte est suspendu. Contactez l’administrateur.');
  }

  if (user.locked_until && user.locked_until > Date.now()) {
    const minutes = Math.ceil((user.locked_until - Date.now()) / 60000);
    throw new HttpError(423, 'account_locked', `Compte verrouillé pendant encore ${minutes} minute(s).`);
  }

  if (!user.password_hash) {
    throw new HttpError(
      409,
      'google_only',
      'Ce compte a été créé avec Google. Utilisez le bouton « Continuer avec Google ».'
    );
  }

  const { ok, needsUpgrade } = await verifyPassword(user.password_hash, password, {
    iterations: ITERATIONS(env),
    pepper: PEPPER(env)
  });

  if (!ok) {
    const attempts = (user.failed_attempts || 0) + 1;
    const lockedUntil = attempts >= 8 ? Date.now() + 15 * 60 * 1000 : null;
    await updateUser(env, user.id, { failed_attempts: attempts, locked_until: lockedUntil });
    await audit(env, {
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.login.failed',
      details: `Tentative n°${attempts}`,
      ip
    });
    throw new HttpError(401, 'invalid_credentials', 'Adresse e-mail ou mot de passe incorrect.');
  }

  if (needsUpgrade) {
    const upgraded = await hashPassword(password, { iterations: ITERATIONS(env), pepper: PEPPER(env) });
    await updateUser(env, user.id, { password_hash: upgraded, password_kdf: CLIENT_KDF_VERSION });
  }

  await updateUser(env, user.id, {
    failed_attempts: 0,
    locked_until: null,
    last_login_at: Date.now(),
    last_login_ip: ip
  });
  await clearRateLimit(env, `login:account:${user.email}`);

  const session = await createSession(env, request, user.id);
  await audit(env, { actorId: user.id, actorEmail: user.email, action: 'auth.login', ip });

  const fresh = await getUserById(env, user.id);
  return json(
    {
      user: publicUser(fresh),
      root: isRoot(fresh),
      mustReset: !!fresh.must_reset
    },
    200,
    { 'Set-Cookie': cookieFor(session.token, request, session.expiresAt) }
  );
}

/* ------------------------------------------------------------------ */
/*  Session courante / déconnexion                                     */
/* ------------------------------------------------------------------ */

export async function me(env, request) {
  const session = await currentSession(env, request);
  if (!session) return json({ authenticated: false }, 401);

  const board = await env.DB.prepare('SELECT revision, updated_at, size_bytes FROM boards WHERE user_id = ?')
    .bind(session.user.id)
    .first();

  const headers = session.renewed ? { 'Set-Cookie': cookieFor(session.token, request, session.expiresAt) } : {};
  return json(
    {
      authenticated: true,
      user: publicUser(session.user),
      root: isRoot(session.user),
      mustReset: !!session.user.must_reset,
      board: board
        ? { exists: true, revision: board.revision, updatedAt: board.updated_at, size: board.size_bytes }
        : { exists: false },
      google: googleConfigured(env),
      serverTime: Date.now()
    },
    200,
    headers
  );
}

export async function logout(env, request) {
  const session = await currentSession(env, request);
  if (session) {
    await revokeSession(env, session.sessionId);
    await audit(env, { actorId: session.user.id, actorEmail: session.user.email, action: 'auth.logout', ip: clientIp(request) });
  }
  return json({ ok: true }, 200, { 'Set-Cookie': clearedCookie(request) });
}

/* ------------------------------------------------------------------ */
/*  Changement de mot de passe                                         */
/* ------------------------------------------------------------------ */

export async function changePassword(env, request) {
  const session = await currentSession(env, request);
  if (!session) throw new HttpError(401, 'unauthenticated', 'Vous devez être connecté.');

  const body = await readJson(request);
  const current = validateClientPassword(body.currentPassword, 'currentPassword');
  const next = validateClientPassword(body.newPassword, 'newPassword');
  if (current === next) {
    throw new HttpError(400, 'same_password', 'Le nouveau mot de passe doit être différent de l’ancien.');
  }

  const user = session.user;
  if (!user.password_hash) {
    const hash = await hashPassword(next, { iterations: ITERATIONS(env), pepper: PEPPER(env) });
    await updateUser(env, user.id, { password_hash: hash, password_kdf: CLIENT_KDF_VERSION, password_at: Date.now() });
  } else {
    const { ok } = await verifyPassword(user.password_hash, current, { iterations: ITERATIONS(env), pepper: PEPPER(env) });
    if (!ok) throw new HttpError(401, 'invalid_credentials', 'Mot de passe actuel incorrect.');
    const hash = await hashPassword(next, { iterations: ITERATIONS(env), pepper: PEPPER(env) });
    await updateUser(env, user.id, {
      password_hash: hash,
      password_kdf: CLIENT_KDF_VERSION,
      password_at: Date.now(),
      must_reset: 0
    });
  }

  await revokeAllSessions(env, user.id, session.sessionId);
  await audit(env, { actorId: user.id, actorEmail: user.email, action: 'auth.password.changed', ip: clientIp(request) });
  return json({ ok: true, message: 'Mot de passe mis à jour. Les autres appareils ont été déconnectés.' });
}

/* ------------------------------------------------------------------ */
/*  Mot de passe oublié / réinitialisation                             */
/* ------------------------------------------------------------------ */

function resetLink(env, request, token) {
  const origin = env.APP_URL ? env.APP_URL.replace(/\/+$/, '') : new URL(request.url).origin;
  return `${origin}/reset?token=${encodeURIComponent(token)}`;
}

async function sendResetEmail(env, { to, link, name }) {
  const subject = `${env.APP_NAME || 'VN Kanban'} — réinitialisation de votre mot de passe`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1d1d1f">
      <h2 style="font-size:20px">Réinitialisation du mot de passe</h2>
      <p>Bonjour ${name ? name : ''},</p>
      <p>Une demande de réinitialisation a été faite pour votre compte <strong>${to}</strong>.</p>
      <p><a href="${link}" style="display:inline-block;background:#0071E3;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none">Choisir un nouveau mot de passe</a></p>
      <p style="color:#6e6e73;font-size:13px">Ce lien expire dans une heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
    </div>`;

  if (env.RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM || 'VN Kanban <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
        text: `Réinitialisation du mot de passe : ${link}`
      })
    });
    if (!response.ok) throw new Error(`Envoi Resend refusé (${response.status})`);
    return true;
  }

  if (env.MAIL_WEBHOOK_URL) {
    const response = await fetch(env.MAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html, text: `Réinitialisation : ${link}` })
    });
    if (!response.ok) throw new Error(`Webhook e-mail refusé (${response.status})`);
    return true;
  }

  return false;
}

export async function forgotPassword(env, request) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const ip = clientIp(request);

  const limit = await rateLimit(env, `forgot:ip:${ip}`, { max: 8, windowMs: 60 * 60 * 1000, blockMs: 30 * 60 * 1000 });
  if (!limit.allowed) throw new HttpError(429, 'too_many_requests', 'Trop de demandes. Réessayez plus tard.');

  // Réponse toujours identique : on ne révèle pas l'existence d'un compte.
  const generic = {
    ok: true,
    message: 'Si un compte existe avec cette adresse, un lien de réinitialisation vient d’être envoyé.'
  };

  if (!email) return json(generic);

  const user = await getUserByEmail(env, email);
  if (!user || user.status === 'suspended') return json(generic);

  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  await createPasswordReset(env, user.id, { tokenHash, ip });

  const link = resetLink(env, request, token);
  let sent = false;
  try {
    sent = await sendResetEmail(env, { to: user.email, link, name: user.name });
  } catch (error) {
    console.error('Envoi e-mail impossible :', error && error.message);
  }

  await audit(env, {
    actorId: user.id,
    actorEmail: user.email,
    action: 'auth.password.reset_requested',
    details: sent ? 'E-mail envoyé' : 'Aucun service e-mail configuré — lien à transmettre par le ROOT',
    ip
  });

  return json(generic);
}

export async function resetPassword(env, request) {
  const body = await readJson(request);
  const token = typeof body.token === 'string' ? body.token : '';
  const password = validateClientPassword(body.password);
  const kdf = body.kdf || CLIENT_KDF_VERSION;
  if (kdf !== CLIENT_KDF_VERSION) {
    throw new HttpError(400, 'kdf_outdated', 'Version de chiffrement obsolète : rechargez la page.');
  }
  if (!token) throw new HttpError(400, 'invalid_token', 'Lien invalide ou incomplet.');

  const ip = clientIp(request);
  const limit = await rateLimit(env, `reset:ip:${ip}`, { max: 20, windowMs: 60 * 60 * 1000, blockMs: 30 * 60 * 1000 });
  if (!limit.allowed) throw new HttpError(429, 'too_many_requests', 'Trop de tentatives. Réessayez plus tard.');

  const tokenHash = await sha256Hex(token);
  const row = await consumePasswordReset(env, tokenHash);
  if (!row) throw new HttpError(400, 'invalid_token', 'Ce lien a expiré ou a déjà été utilisé.');

  const user = await getUserById(env, row.user_id);
  if (!user) throw new HttpError(400, 'invalid_token', 'Compte introuvable.');

  const hash = await hashPassword(password, { iterations: ITERATIONS(env), pepper: PEPPER(env) });
  await updateUser(env, user.id, {
    password_hash: hash,
    password_kdf: CLIENT_KDF_VERSION,
    password_at: Date.now(),
    must_reset: 0,
    failed_attempts: 0,
    locked_until: null
  });
  await revokeAllSessions(env, user.id);
  await audit(env, { actorId: user.id, actorEmail: user.email, action: 'auth.password.reset', ip });

  return json({ ok: true, message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' });
}

/* ------------------------------------------------------------------ */
/*  Google OAuth                                                       */
/* ------------------------------------------------------------------ */

function stateCookie(request, payload) {
  const value = stringToB64url(JSON.stringify(payload));
  return `${STATE_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${
    new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  }`;
}

function clearStateCookie() {
  return `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function readStateCookie(request) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === STATE_COOKIE) {
      try {
        return JSON.parse(b64urlToString(rest.join('=')));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Démarrage OAuth : génère l'état + PKCE puis redirige vers Google. */
export async function googleStart(env, request) {
  if (!googleConfigured(env)) {
    return redirect(`/login?error=${encodeURIComponent('google_not_configured')}`);
  }
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get('next'), '/');

  const state = randomToken(24);
  const verifier = randomToken(32);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const codeChallenge = bytesToB64url(new Uint8Array(digest));

  const authUrl = buildGoogleAuthUrl(env, request, { state, codeChallenge, next });
  return redirect(authUrl, { 'Set-Cookie': stateCookie(request, { s: state, v: verifier, n: next }) });
}

export async function googleCallback(env, request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const ip = clientIp(request);

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error)}`, { 'Set-Cookie': clearStateCookie() });
  }
  if (!googleConfigured(env)) {
    return redirect('/login?error=google_not_configured', { 'Set-Cookie': clearStateCookie() });
  }

  const cookieState = readStateCookie(request);
  if (!code || !state || !cookieState || state !== cookieState.s) {
    return redirect('/login?error=oauth_state', { 'Set-Cookie': clearStateCookie() });
  }

  let payload;
  try {
    const tokens = await exchangeGoogleCode(env, request, { code, codeVerifier: cookieState.v });
    payload = await verifyGoogleIdToken(tokens.id_token, env.GOOGLE_CLIENT_ID, { jwksUrl: googleJwksUrl(env) });
  } catch (err) {
    console.error('Google OAuth :', err && err.message);
    await audit(env, { action: 'auth.google.failed', details: err && err.message, ip });
    return redirect('/login?error=google_failed', { 'Set-Cookie': clearStateCookie() });
  }

  const email = normalizeEmail(payload.email);
  if (!email) {
    return redirect('/login?error=google_no_email', { 'Set-Cookie': clearStateCookie() });
  }

  let user = payload.sub ? await getUserByGoogleSub(env, payload.sub) : null;

  if (!user) {
    const byEmail = await getUserByEmail(env, email);
    if (byEmail) {
      // Liaison automatique : compte e-mail existant + connexion Google.
      if (byEmail.status === 'suspended') {
        return redirect('/login?error=account_suspended', { 'Set-Cookie': clearStateCookie() });
      }
      user = await updateUser(env, byEmail.id, {
        google_sub: payload.sub,
        provider: byEmail.password_hash ? 'email+google' : 'google',
        email_verified: 1,
        picture: byEmail.picture || payload.picture || null,
        name: byEmail.name || payload.name || null
      });
      await audit(env, { actorId: user.id, actorEmail: user.email, action: 'auth.google.linked', ip });
    } else {
      const total = await countUsers(env);
      const becomesRoot = total === 0 && FIRST_USER_IS_ROOT(env);
      user = await createUser(env, {
        email,
        name: payload.name || null,
        picture: payload.picture || null,
        role: becomesRoot ? 'root' : 'user',
        status: 'active',
        provider: 'google',
        googleSub: payload.sub,
        emailVerified: true
      });
      await audit(env, {
        actorId: user.id,
        actorEmail: user.email,
        action: 'auth.google.register',
        details: becomesRoot ? 'Premier compte : rôle ROOT attribué' : 'Compte créé via Google',
        ip
      });
    }
  } else if (user.status === 'suspended') {
    return redirect('/login?error=account_suspended', { 'Set-Cookie': clearStateCookie() });
  }

  await updateUser(env, user.id, {
    last_login_at: Date.now(),
    last_login_ip: ip,
    failed_attempts: 0,
    locked_until: null,
    ...(user.picture ? {} : { picture: payload.picture || null })
  });

  const session = await createSession(env, request, user.id);
  await audit(env, { actorId: user.id, actorEmail: user.email, action: 'auth.google.login', ip });

  const destination = safeNextPath(cookieState.n, '/');
  const response = redirect(destination);
  response.headers.append('Set-Cookie', cookieFor(session.token, request, session.expiresAt));
  response.headers.append('Set-Cookie', clearStateCookie());
  return response;
}


