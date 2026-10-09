import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { HRDatabase } from '../server/db.ts';
import { beginMicrosoft, matchingState, microsoftConfig, verifyMicrosoftToken } from '../server/microsoft.ts';
import { microsoftRouter } from '../server/microsoft-routes.ts';
import { transact } from '../server/persistence.ts';

const tenant = '5435dd0c-e8ac-49f5-a4de-ed8654c4672e';
const client = 'e9f5bd46-dcfc-4d66-9199-2482af5a09eb';
const oid = '11111111-2222-4333-8444-555555555555';
function setup() {
  process.env.MICROSOFT_TENANT_ID = tenant;
  process.env.MICROSOFT_CLIENT_ID = client;
  process.env.MICROSOFT_CLIENT_SECRET = 'Synthetic-only-client-secret';
  process.env.APP_ORIGIN = 'https://hr.example.test';
  process.env.INITIAL_ADMIN_EMAIL = 'admin@example.test';
  process.env.INITIAL_ADMIN_PASSWORD = 'Synthetic-admin-password-938!';
  const db = HRDatabase.bootstrap();
  const admin = db.getAllEmployees()[0];
  const employee = db.createEmployee({ full_name: 'Synthetic employee', email: 'employee@example.test', password: 'Synthetic-employee-temp-938!' }, admin);
  return { db, admin, employee };
}

test('Microsoft links require administrator approval; no email matching or account creation', () => {
  const {db, admin, employee} = setup();
  assert.equal(db.authenticateMicrosoft(tenant, oid), null);
  assert.equal(db.getAllEmployees().length, 2);
  assert.throws(() => db.updateEmployee(employee.id, { microsoft_object_id: oid }, employee), /administrator/);
  assert.throws(() => db.updateEmployee(employee.id, { microsoft_tenant_id: tenant }, admin), /cannot/);
  assert.throws(() => db.updateEmployee(employee.id, { microsoft_object_id: 'wrong' }, admin), /valid/);
  db.updateEmployee(employee.id, { microsoft_object_id: oid.toUpperCase() }, admin);
  assert.throws(() => db.updateEmployee(admin.id, { microsoft_object_id: oid }, admin), /already linked/);
  assert.equal(db.authenticateMicrosoft('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', oid), null);
  const signed = db.authenticateMicrosoft(tenant, oid);
  assert.equal(signed.user.id, employee.id);
  assert.equal(db.sessionRequiresPasswordChange(signed.token), false);
  const passwordSession = db.authenticate(employee.email, 'Synthetic-employee-temp-938!');
  assert.equal(db.sessionRequiresPasswordChange(passwordSession.token), true);
  let reloaded = new HRDatabase(db.exportState());
  assert.equal(reloaded.getUserByToken(signed.token).id, employee.id);
  reloaded.updateEmployee(employee.id, { status: 'disabled' }, admin);
  assert.equal(reloaded.authenticateMicrosoft(tenant, oid), null);
  assert.equal(reloaded.getUserByToken(signed.token), null);
  reloaded.updateEmployee(employee.id, { status: 'active' }, admin);
  const beforeUnlink = reloaded.authenticateMicrosoft(tenant, oid);
  reloaded.updateEmployee(employee.id, { microsoft_object_id: '' }, admin);
  assert.equal(reloaded.getUserByToken(beforeUnlink.token), null);
  assert.equal(reloaded.authenticateMicrosoft(tenant, oid), null);
  const invalid = db.exportState();
  invalid.users.find(u => u.id === employee.id).profile.role = 'viewer';
  assert.equal(new HRDatabase(invalid).authenticateMicrosoft(tenant, oid), null);
  const duplicate = db.exportState();
  Object.assign(duplicate.users.find(u => u.id === admin.id).profile, { microsoft_tenant_id: tenant, microsoft_object_id: oid });
  assert.equal(new HRDatabase(duplicate).authenticateMicrosoft(tenant, oid), null);
});

test('Microsoft authorization flow uses fixed callback, PKCE and nonce; configuration fails closed', () => {
  setup();
  const config = microsoftConfig();
  const flow = beginMicrosoft(config);
  const url = new URL(flow.url);
  assert.equal(url.origin, 'https://login.microsoftonline.com');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://hr.example.test/api/auth/microsoft/callback');
  assert.equal(url.searchParams.get('scope'), 'openid profile');
  assert.equal(url.searchParams.get('nonce'), flow.attempt.nonce);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), crypto.createHash('sha256').update(flow.attempt.verifier).digest('base64url'));
  assert.equal(url.searchParams.has('client_secret'), false);
  assert.equal(matchingState(flow.state, flow.state), true);
  assert.equal(matchingState(flow.state, 'x'.repeat(43)), false);
  assert.equal(matchingState([flow.state], flow.state), false);
  process.env.APP_ORIGIN = 'https://hr.example.test/untrusted';
  assert.equal(microsoftConfig(), null);
  process.env.APP_ORIGIN = 'https://hr.example.test';
  delete process.env.MICROSOFT_CLIENT_SECRET;
  assert.equal(microsoftConfig(), null);
});

test('Microsoft ID token checks signature, expiration, audience, issuer, tenant and nonce', async () => {
  setup();
  const config = microsoftConfig();
  const {publicKey, privateKey} = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'synthetic' };
  const key = createLocalJWKSet({ keys: [jwk] });
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: `https://login.microsoftonline.com/${tenant}/v2.0`, aud: client, sub: 'synthetic-user', tid: tenant, oid, ver: '2.0', nonce: 'expected-nonce', exp: now + 300, iat: now };
  const sign = (updates = {}, signingKey = privateKey) => new SignJWT({...payload, ...updates}).setProtectedHeader({alg: 'RS256', kid: 'synthetic'}).sign(signingKey);
  assert.deepEqual(await verifyMicrosoftToken(await sign(), config, payload.nonce, key), {tenant, objectId: oid});
  for (const updates of [{ aud: 'other-client' }, { iss: 'https://evil.example' }, { tid: 'other-tenant' }, { nonce: 'wrong' }, { oid: '' }, { exp: now - 1 }, { iat: now + 3600 }, { ver: '1.0' }]) {
    await assert.rejects(() => sign(updates).then(token => verifyMicrosoftToken(token, config, payload.nonce, key)));
  }
  const other = await generateKeyPair('RS256');
  await assert.rejects(() => sign({}, other.privateKey).then(token => verifyMicrosoftToken(token, config, payload.nonce, key)));
});

test('OAuth HTTP callback is browser-bound, single-use across instances and creates only approved sessions', async () => {
  setup();
  const dir = await mkdtemp(tmpdir() + '/hr-microsoft-');
  process.env.NODE_ENV = 'test';
  process.env.HR_TEST_STORE = dir + '/store.json';
  let exchangeCount = 0;
  let identity = {tenant, objectId: oid};
  const exchange = async () => { exchangeCount++; return identity; };
  const app = express();
  app.use('/api/auth/microsoft', microsoftRouter({httpOnly: true, sameSite: 'lax', path: '/'}, exchange));
  const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const call = (path, cookie) => fetch(origin + '/api/auth/microsoft' + path, {redirect: 'manual', headers: cookie ? {Cookie: cookie} : {}});
  const begin = async () => {
    const response = await call('/start');
    assert.equal(response.status, 302);
    const state = new URL(response.headers.get('location')).searchParams.get('state');
    return {state, cookie: response.headers.get('set-cookie').split(';')[0]};
  };
  const finish = flow => call('/callback?code=synthetic-code&state=' + flow.state, flow.cookie);
  try {
    assert.equal((await (await call('/config')).json()).enabled, true);
    let flow = await begin();
    assert.equal((await call('/callback?code=synthetic&state=' + flow.state)).headers.get('location'), '/?ms_error=failed');
    assert.equal(exchangeCount, 0);
    assert.equal((await finish(flow)).headers.get('location'), '/?ms_error=not_approved');
    assert.equal((await finish(flow)).headers.get('location'), '/?ms_error=failed');
    assert.equal(exchangeCount, 1);
    const employeeId = await transact(async db => {
      const admin = db.getAllEmployees()[0];
      const employee = db.createEmployee({full_name: 'HTTP synthetic', email: 'http@example.test'}, admin);
      db.updateEmployee(employee.id, {microsoft_object_id: oid}, admin);
      return {result: employee.id, commit: true};
    });
    flow = await begin();
    const replies = await Promise.all([finish(flow), finish(flow)]);
    assert.equal(replies.filter(r => r.headers.get('location') === '/').length, 1);
    assert.equal(exchangeCount, 2);
    const success = replies.find(r => r.headers.get('location') === '/');
    assert.match(success.headers.get('set-cookie'), /__session=hr_sess_/);
    const session = success.headers.get('set-cookie').match(/__session=([^;]+)/)[1];
    await transact(async db => { assert.equal(db.getUserByToken(session).id, employeeId); assert.equal(db.sessionRequiresPasswordChange(session), false); return {result: null, commit: false}; });
    flow = await begin();
    await transact(async db => { const state = db.exportState(); state.microsoftAttempts.forEach(row => row.expiresAt = 0); const expired = new HRDatabase(state); assert.equal(expired.consumeMicrosoftAttempt(flow.state), null); return {result: null, commit: false}; });
    // Provider cancellation consumes the flow without exchanging a code.
    assert.equal((await call('/callback?error=access_denied&state=' + flow.state, flow.cookie)).headers.get('location'), '/?ms_error=failed');
    assert.equal((await finish(flow)).headers.get('location'), '/?ms_error=failed');
    identity = { tenant, objectId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' };
    flow = await begin();
    assert.equal((await finish(flow)).headers.get('location'), '/?ms_error=not_approved');
    const stored = await readFile(process.env.HR_TEST_STORE, 'utf8');
    assert.equal(stored.includes(session), false);
    assert.equal(stored.includes('Synthetic-only-client-secret'), false);
    const state = JSON.parse(stored);
    assert.equal(state.users.length, 2);
    assert.equal(JSON.stringify(state.auditLogs).includes('synthetic-code'), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    delete process.env.HR_TEST_STORE;
    await rm(dir, {recursive: true, force: true});
  }
});
