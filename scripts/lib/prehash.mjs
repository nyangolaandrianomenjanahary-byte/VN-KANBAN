/**
 * Pré-hachage identique à celui du navigateur (public/js/vn-auth.js).
 * Utilisé par les tests pour se comporter exactement comme un vrai client.
 */

const SALT = new TextEncoder().encode('vn-kanban-auth-v1|prehash');
const DEFAULT_ITERATIONS = 210000;

function toB64url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function prehashFor(password, iterations = DEFAULT_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: SALT, iterations },
    key,
    256
  );
  return toB64url(bits);
}

export default prehashFor;
