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
