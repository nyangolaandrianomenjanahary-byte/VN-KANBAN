/**
 * Connexion Google (OAuth 2.0 « Authorization Code » + PKCE).
 * Aucune dépendance : appels fetch directs aux points d'entrée Google.
 */

import { appOrigin } from './utils.js';

export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_SCOPE = 'openid email profile';

/** Points d'entrée Google (surchargeables pour les tests automatisés). */
export function googleTokenEndpoint(env) {
  return env.GOOGLE_TOKEN_ENDPOINT || GOOGLE_TOKEN_ENDPOINT;
}

export function googleJwksUrl(env) {
  return env.GOOGLE_JWKS_URL || 'https://www.googleapis.com/oauth2/v3/certs';
}

export function googleConfigured(env) {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(env, request) {
  if (env.GOOGLE_REDIRECT_URI) return env.GOOGLE_REDIRECT_URI;
  return `${appOrigin(request, env)}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl(env, request, { state, codeChallenge, next = '/' }) {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', googleRedirectUri(env, request));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPE);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'select_account');
  // `next` ne part jamais chez Google : il reste dans notre cookie d'état.
  void next;
  return url.toString();
}

export async function exchangeGoogleCode(env, request, { code, codeVerifier }) {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: googleRedirectUri(env, request),
    grant_type: 'authorization_code',
    code_verifier: codeVerifier
  });

  const response = await fetch(googleTokenEndpoint(env), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Réponse Google illisible (${response.status})`);
  }
  if (!response.ok) {
    const reason = payload.error_description || payload.error || `HTTP ${response.status}`;
    throw new Error(`Échange du code Google refusé : ${reason}`);
  }
  if (!payload.id_token) throw new Error('Google n’a pas renvoyé d’id_token');
  return payload;
}
