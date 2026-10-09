import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HRDatabase } from '../server/db.ts';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';

function seed() {
  process.env.INITIAL_ADMIN_EMAIL = 'security-admin@example.test';
  process.env.INITIAL_ADMIN_PASSWORD = 'Synthetic-password-938!';
  const db = HRDatabase.bootstrap();
  return { db, admin: db.getAllEmployees()[0] };
}
test('roles reject unknown values and confidential reads fail closed', () => {
  const {db, admin} = seed();
  const owner = db.createEmployee({ full_name:'Owner', email:'owner@example.test', role:'employee' }, admin);
  assert.throws(() => db.createEmployee({full_name:'Invalid',email:'invalid@example.test',role:'viewer'},admin), /Role/);
  assert.throws(() => db.updateEmployee(owner.id,{role:'viewer'},admin), /Role/);
  assert.throws(() => db.updateEmployee(owner.id,{id:admin.id},admin), /cannot/);
  assert.throws(() => db.updateEmployee(owner.id,{status:'anything'},admin), /Status/);
  db.submitLeaveRequest(owner,{leave_type:'Vacation Leave',start_date:'2026-10-12',end_date:'2026-10-12',reason:'PRIVATE'});
  assert.throws(()=>db.getLeaveRequests({id:'invalid',role:'viewer'}), /Access denied/);
  const login = db.authenticate(admin.email, process.env.INITIAL_ADMIN_PASSWORD);
  const state = db.exportState();
  state.users.find(u=>u.id===admin.id).profile.role = 'viewer';
  const reloaded = new HRDatabase(state);
  assert.equal(reloaded.getUserByToken(login.token), null);
  assert.throws(()=>reloaded.authenticate(admin.email, process.env.INITIAL_ADMIN_PASSWORD));
});
test('login limits survive rehydration, span IPs and expire', () => {
  let {db, admin} = seed();
  for (let i=0;i<20;i++) {
    assert.throws(()=>db.authenticate('unknown@example.test','incorrect','ip-'+i));
    db = new HRDatabase(db.exportState());
  }
  assert.throws(()=>db.authenticate('unknown@example.test','incorrect','another-ip'), e=>e.code==='LOGIN_THROTTLED');
  const state = db.exportState();
  assert.ok(state.loginAttempts.every(row=>/^[a-f0-9]{64}$/.test(row.id)));
  state.loginAttempts.forEach(row=>row.expiresAt=0);
  db = new HRDatabase(state);
  assert.throws(()=>db.authenticate('unknown@example.test','incorrect'), e=>e.code!=='LOGIN_THROTTLED');
  assert.throws(()=>db.authenticate(admin.email,'incorrect'));
  db.authenticate(admin.email, process.env.INITIAL_ADMIN_PASSWORD);
  assert.ok(db.getAuditLogs().some(row=>row.action==='Signed in'));
  assert.ok(db.getAuditLogs().some(row=>row.action==='Sign-in failed'));
  assert.equal(JSON.stringify(db.getAuditLogs()).includes(process.env.INITIAL_ADMIN_PASSWORD), false);
});
test('HTTP security headers, asset boundaries, persisted throttling and office logins', async () => {
  const dir = await mkdtemp(tmpdir()+'/hr-security-');
  const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
  let child;
  const root='http://127.0.0.1:'+port;
  async function start() {
    child=spawn(process.execPath,['build/server.cjs'],{env:{...process.env,NODE_ENV:'test',HR_TEST_STORE:dir+'/store.json',PORT:String(port),INITIAL_ADMIN_EMAIL:'security-admin@example.test',INITIAL_ADMIN_PASSWORD:'Synthetic-password-938!'},stdio:'ignore'});
    for(let i=0;i<100;i++){try{if((await fetch(root+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
    throw new Error('Server startup failed');
  }
  async function stop(){if(child && child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended;}}
  const login=(identifier,password='incorrect')=>fetch(root+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,password})});
  try {
    await start();
    const page=await fetch(root);const policy=page.headers.get('content-security-policy');
    assert.match(policy,/script-src 'self'/);assert.match(policy,/frame-ancestors 'none'/);assert.match(policy,/object-src 'none'/);assert.equal(page.headers.get('x-frame-options'),'DENY');
    assert.equal(policy.includes("script-src 'self' 'unsafe-inline'"),false);
    assert.equal((await fetch(root+'/browser-compat.js')).status,200);
    for(const route of ['/server.cjs','/server.cjs.map','/build/server.cjs','/assets/server.cjs.map','/server%2Ecjs']) assert.equal((await fetch(root+route)).status,404,route);
    assert.equal((await fetch(root+'/api/employees')).status,401);
    for(let i=0;i<10;i++) assert.equal((await login('blocked@example.test')).status,401);
    await stop();await start();
    for(let i=0;i<10;i++) assert.equal((await login('blocked@example.test')).status,401);
    assert.equal((await login('blocked@example.test')).status,429);
    const raced = await Promise.all(Array.from({length:21},()=>login('concurrent@example.test')));
    assert.equal(raced.filter(r=>r.status===401).length,20);
    assert.equal(raced.filter(r=>r.status===429).length,1);
    // Different accounts sharing one IP aren't subject to the old 20-login IP cap.
    for(let i=0;i<25;i++) assert.equal((await login('person-'+i+'@example.test')).status,401);
    const signed=await login('security-admin@example.test','Synthetic-password-938!');assert.equal(signed.status,200);
    const cookie=signed.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);
  } finally {await stop();await rm(dir,{recursive:true,force:true});}
});
