import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export const randomValue = () => crypto.randomBytes(32).toString('base64url');
export interface MicrosoftConfig { tenant: string; client: string; secret: string; redirect: string }
export interface MicrosoftAttempt { id: string; nonce: string; verifier: string; expiresAt: number }

export function microsoftConfig(): MicrosoftConfig | null {
  const tenant = (process.env.MICROSOFT_TENANT_ID || '').trim().toLowerCase();
  const client = (process.env.MICROSOFT_CLIENT_ID || '').trim().toLowerCase();
  const secret = process.env.MICROSOFT_CLIENT_SECRET || '';
  const origin = process.env.APP_ORIGIN || '';
  if (!GUID.test(tenant) || !GUID.test(client) || !secret || !origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) return null;
  } catch { return null; }
  return { tenant, client, secret, redirect: origin + '/api/auth/microsoft/callback' };
}

export function beginMicrosoft(config: MicrosoftConfig) {
  const state = randomValue();
  const attempt: MicrosoftAttempt = { id: digest(state), nonce: randomValue(), verifier: randomValue(), expiresAt: Date.now() + 10 * 60 * 1000 };
  const url = new URL(`https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/authorize`);
  url.search = new URLSearchParams({ client_id: config.client, redirect_uri: config.redirect,
    response_type: 'code', response_mode: 'query', scope: 'openid profile', state,
    nonce: attempt.nonce, code_challenge: crypto.createHash('sha256').update(attempt.verifier).digest('base64url'),
    code_challenge_method: 'S256', prompt: 'select_account' }).toString();
  return { state, attempt, url: url.toString() };
}

export function matchingState(state: unknown, cookie: string): state is string {
  return typeof state === 'string' && /^[A-Za-z0-9_-]{43}$/.test(state) && cookie.length === state.length
    && crypto.timingSafeEqual(Buffer.from(state), Buffer.from(cookie));
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function verifyMicrosoftToken(token: string, config: MicrosoftConfig, nonce: string, testKey?: JWTVerifyGetKey) {
  let key = testKey;
  if (!key) {
    if (!keySets.has(config.tenant)) keySets.set(config.tenant, createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${config.tenant}/discovery/v2.0/keys`), { timeoutDuration: 10000 }));
    key = keySets.get(config.tenant)!;
  }
  const { payload } = await jwtVerify(token, key, { algorithms: ['RS256'], audience: config.client,
    issuer: `https://login.microsoftonline.com/${config.tenant}/v2.0`, requiredClaims: ['exp', 'iat', 'sub', 'nonce', 'tid', 'oid'] });
  if (payload.nonce !== nonce || payload.tid !== config.tenant || payload.ver !== '2.0'
    || typeof payload.oid !== 'string' || !GUID.test(payload.oid) || typeof payload.iat !== 'number'
    || payload.iat > Date.now() / 1000 + 60) throw new Error('Microsoft identity could not be verified.');
  return { tenant: config.tenant, objectId: payload.oid.toLowerCase() };
}

export async function completeMicrosoft(code: string, config: MicrosoftConfig, attempt: MicrosoftAttempt) {
  const response = await fetch(`https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/token`, {
    method: 'POST', signal: AbortSignal.timeout(15000), redirect: 'error',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.client, client_secret: config.secret,
      redirect_uri: config.redirect, grant_type: 'authorization_code', code, code_verifier: attempt.verifier,
      scope: 'openid profile' }),
  });
  if (!response.ok) throw new Error('Microsoft sign-in failed.');
  const data = await response.json() as { id_token?: unknown };
  if (typeof data.id_token !== 'string') throw new Error('Microsoft sign-in failed.');
  // Microsoft tokens stay server-side and are discarded after identity verification.
  return verifyMicrosoftToken(data.id_token, config, attempt.nonce);
}
