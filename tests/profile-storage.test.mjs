import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateProfileStorage } from '../server/profile-validation.ts';
import { HRDatabase } from '../server/db.ts';
import { MAX_PROFILE_PHOTO_BYTES, prepareProfilePhoto, normalizeProfilePhoto } from '../src/utils/profilePhoto.ts';

test('oversized inline photos are rejected before reaching Firestore', () => {
  assert.throws(()=>validateProfileStorage({avatar_url:'data:image/png;base64,'+'A'.repeat(1024*1024)}),/photo is too large/);
  assert.doesNotThrow(()=>validateProfileStorage({avatar_url:'data:image/jpeg;base64,'+'A'.repeat(100000)}));
  assert.ok(MAX_PROFILE_PHOTO_BYTES < 1048487);
});
test('invalid nested and oversized employee fields produce clear validation errors', () => {
  assert.throws(()=>validateProfileStorage({country:{nested:{bad:true}}}),/country/);
  assert.throws(()=>validateProfileStorage({avatar_url:{data:'invalid'}}),/image URL/);
  assert.throws(()=>validateProfileStorage({full_name:'a'.repeat(5000)}),/full_name/);
});
test('home address is optional, limited to 500 characters and must be text', () => {
  assert.doesNotThrow(()=>validateProfileStorage({}));
  assert.doesNotThrow(()=>validateProfileStorage({home_address:''}));
  assert.doesNotThrow(()=>validateProfileStorage({home_address:'12 Sample Street\nUnit 4\nMakati City 1200\nPhilippines'}));
  assert.doesNotThrow(()=>validateProfileStorage({home_address:'a'.repeat(500)}));
  assert.throws(()=>validateProfileStorage({home_address:'a'.repeat(501)}),/500 characters or fewer/);
  assert.throws(()=>validateProfileStorage({home_address:{street:'nested'}}),/Invalid contact details/);
  assert.throws(()=>validateProfileStorage({home_address:null}),/Invalid contact details/);
});
test('HR can save and clear a home address, and unknown fields are still ignored', () => {
  process.env.INITIAL_ADMIN_EMAIL='address-admin@example.test';
  process.env.INITIAL_ADMIN_PASSWORD='Synthetic-Address-Admin-938!';
  const db=HRDatabase.bootstrap();
  const admin=db.getAllEmployees()[0];
  const saved=db.updateEmployee(admin.id,{home_address:'12 Sample Street\nMakati City',shoe_size:'9'},admin);
  assert.equal(saved.home_address,'12 Sample Street\nMakati City');
  assert.equal('shoe_size' in saved,false);
  assert.equal(db.getAllEmployees()[0].home_address,'12 Sample Street\nMakati City');
  assert.equal(JSON.stringify(db.getAuditLogs()).includes('Sample Street'),false);
  assert.throws(()=>db.updateEmployee(admin.id,{home_address:'a'.repeat(501)},admin),/500 characters/);
  assert.equal(db.getAllEmployees()[0].home_address,'12 Sample Street\nMakati City');
  assert.equal(db.updateEmployee(admin.id,{home_address:''},admin).home_address,'');
});
test('invalid photo update cannot partially change employee email', () => {
  process.env.INITIAL_ADMIN_EMAIL='profile-admin@example.test';
  process.env.INITIAL_ADMIN_PASSWORD='Synthetic-Profile-Admin-938!';
  const db=HRDatabase.bootstrap();
  const admin=db.getAllEmployees()[0];
  const before=JSON.stringify(db.exportState());
  assert.throws(()=>db.updateEmployee(admin.id,{email:'changed@example.test',avatar_url:'A'.repeat(300000)},admin),/photo is too large/);
  assert.equal(JSON.stringify(db.exportState()),before);
});
test('unsupported uploads and files over 2MB are rejected before image decoding',async()=>{
  await assert.rejects(prepareProfilePhoto({type:'image/svg+xml',size:100}),/JPG, PNG/);
  await assert.rejects(prepareProfilePhoto({type:'image/png',size:3*1024*1024}),/under 2MB/);
  assert.equal(await normalizeProfilePhoto('https://example.test/photo.jpg'),'https://example.test/photo.jpg');
});
