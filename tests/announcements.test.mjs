import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HRDatabase } from '../server/db.ts';
import { navigateWorkspace } from '../src/utils/workspace.ts';
process.env.INITIAL_ADMIN_EMAIL='ann-admin@example.test';
process.env.INITIAL_ADMIN_PASSWORD='Test-Announcement-Admin-938!';
const seed=HRDatabase.bootstrap();
const admin=seed.getAllEmployees()[0];
const employee=seed.createEmployee({full_name:'Announcement Employee',email:'ann-employee@example.test',password:'Test-Announcement-Employee-938!',department:'Technology',country:'Philippines'},admin);
const other=seed.createEmployee({full_name:'Other Employee',email:'ann-other@example.test',password:'Test-Announcement-Employee-938!',department:'HR',country:'Canada'},admin);
const baseline=seed.exportState();
const input=(extra={})=>({title:'Synthetic company update',message:'Read this synthetic test policy.',category:'Policy update',departments:[],countries:[],pinned:false,requires_acknowledgment:true,expires_at:null,status:'published',...extra});
const scenario=(name,fn)=>test(name,()=>fn(new HRDatabase(baseline)));
const pngData='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=';
const imageInput={image_upload:{data:pngData,name:'Reminder.png'},image_alt:'A meeting reminder poster'};
scenario('announcement images: metadata-only lists, protected reads and reload',d=>{
 const a=d.saveAnnouncement(admin,input({...imageInput,status:'draft',departments:['Technology']}));
 assert.equal(d.getAnnouncementImage(admin,a.id,a.image.id).mime,'image/png');
 assert.throws(()=>d.getAnnouncementImage(employee,a.id,a.image.id),e=>e.status===404);
 const published=d.saveAnnouncement(admin,input({departments:['Technology']}),a.id,a.revision);
 assert.equal(published.image.id,a.image.id);assert.equal(published.image_alt,imageInput.image_alt);
 assert.equal(JSON.stringify(published).includes('base64'),false);
 assert.equal(JSON.stringify(d.getAnnouncements(employee)).includes('base64'),false);
 assert.deepEqual(d.getAnnouncementImage(employee,a.id,a.image.id).bytes,Buffer.from(pngData.split(',')[1],'base64'));
 assert.throws(()=>d.getAnnouncementImage(other,a.id,a.image.id),e=>e.status===404);
 assert.throws(()=>d.getAnnouncementImage({...other,role:'admin'},a.id,a.image.id),e=>e.status===404);
 const restored=new HRDatabase(d.exportState());assert.equal(restored.getAnnouncementImage(employee,a.id,a.image.id).name,'Reminder.png');
 const state=d.exportState();state.users.find(u=>u.id===employee.id).profile.status='inactive';
 assert.throws(()=>new HRDatabase(state).getAnnouncementImage(employee,a.id,a.image.id),e=>e.status===403);
 state.users.find(u=>u.id===employee.id).profile.status='active';state.announcements[0].expires_at=new Date(Date.now()-1000).toISOString();
 assert.throws(()=>new HRDatabase(state).getAnnouncementImage(employee,a.id,a.image.id),e=>e.status===404);
 d.archiveAnnouncement(admin,published.id,published.revision);
 assert.throws(()=>d.getAnnouncementImage(employee,a.id,a.image.id),e=>e.status===404);
 assert.equal(d.getAnnouncementImage(admin,a.id,a.image.id).mime,'image/png');
});
scenario('announcement images: replace and remove revoke old URLs and stale edits cannot erase images',d=>{
 const a=d.saveAnnouncement(admin,input(imageInput));
 d.readAnnouncement(employee,a.id,a.revision);d.readAnnouncement(employee,a.id,a.revision,true);
 const b=d.saveAnnouncement(admin,input({...imageInput,image_alt:'Replacement poster'}),a.id,a.revision);
 assert.notEqual(b.image.id,a.image.id);assert.equal(d.exportState().announcementImages.length,1);
 assert.throws(()=>d.getAnnouncementImage(employee,a.id,a.image.id),e=>e.status===404);
 assert.equal(d.getAnnouncements(employee)[0].acknowledged_at,null);
 assert.throws(()=>d.saveAnnouncement(admin,input({image_upload:null}),b.id,a.revision),e=>e.status===409);
 assert.equal(d.getAnnouncementImage(employee,b.id,b.image.id).mime,'image/png');
 const otherPost=d.saveAnnouncement(admin,input());
 assert.throws(()=>d.getAnnouncementImage(employee,otherPost.id,b.image.id),e=>e.status===404);
 const removed=d.saveAnnouncement(admin,input({image_upload:null}),b.id,b.revision);
 assert.equal(removed.image,null);assert.equal(d.exportState().announcementImages.length,0);
 assert.throws(()=>d.getAnnouncementImage(employee,b.id,b.image.id),e=>e.status===404);
});
scenario('announcement images: invalid, oversized and non-image uploads fail without mutation',d=>{
 for(const change of [{image_upload:{}},{image_upload:[]},{image_upload:{data:'bad',name:'x.png'}},{image_upload:{data:'data:image/svg+xml;base64,PHN2Zy8+',name:'x.svg'}},{image_upload:{data:'data:image/jpeg;base64,'+Buffer.from('<script>not an image</script>').toString('base64'),name:'x.jpg'}},{image_upload:{data:pngData,name:'x'.repeat(181)}},{image_upload:{data:'data:image/png;base64,'+Buffer.alloc(450001).toString('base64'),name:'x.png'}},{image_alt:''},{image_alt:'x'.repeat(301)}]) {
  assert.throws(()=>d.saveAnnouncement(admin,input({...imageInput,...change})),e=>e.status===400);
 }
 assert.equal(d.exportState().announcementImages.length,0);assert.equal(d.getAnnouncements(admin,true).length,0);
 assert.throws(()=>d.saveAnnouncement(employee,input(imageInput)),e=>e.status===403);
});
scenario('announcement audience: all departments and countries include every active account; country filters still apply',d=>{
 const all=d.saveAnnouncement(admin,input());assert.equal(d.announcementReport(admin,all.id).recipients.length,3);
 assert.equal(d.previewAnnouncementAudience(admin,{departments:[],countries:[]}).count,3);
 const selected=d.saveAnnouncement(admin,input({departments:[],countries:['Canada']}));
 assert.ok(d.getAnnouncements(other).some(a=>a.id===selected.id));assert.ok(!d.getAnnouncements(employee).some(a=>a.id===selected.id));
 const companyWide=d.saveAnnouncement(admin,input(),selected.id,selected.revision);
 assert.ok(d.getAnnouncements(employee).some(a=>a.id===companyWide.id));
});

scenario('announcements: drafts are private and publication only notifies the matching audience',d=>{
 const draft=d.saveAnnouncement(admin,input({status:'draft',departments:['Technology'],countries:['Philippines']}));
 assert.equal(d.getAnnouncements(employee).length,0);assert.equal(d.getAnnouncements(admin).length,0);
 assert.equal(d.getAnnouncements(admin,true).length,1);assert.equal(d.getNotifications(employee.id).filter(n=>n.announcement_id).length,0);
 const published=d.saveAnnouncement(admin,input({departments:['Technology'],countries:['Philippines']}),draft.id,draft.revision);
 assert.equal(d.getAnnouncements(employee).length,1);assert.equal(d.getAnnouncements(other).length,0);
 assert.throws(()=>d.readAnnouncement(other,published.id,published.revision),e=>e.status===404);
 assert.equal(d.getNotifications(employee.id).filter(n=>n.announcement_id).length,1);
 assert.equal(d.getNotifications(other.id).filter(n=>n.announcement_id).length,0);
});
scenario('announcements: employees cannot manage drafts, publish, archive, or read tracking reports',d=>{
 const a=d.saveAnnouncement(admin,input());
 for(const fn of [()=>d.getAnnouncements(employee,true),()=>d.saveAnnouncement(employee,input()),()=>d.saveAnnouncement({...employee,role:'admin'},input()),()=>d.archiveAnnouncement(employee,a.id,a.revision),()=>d.announcementReport(employee,a.id)]) assert.throws(fn,e=>e.status===403);
 assert.equal(d.getAnnouncements(employee)[0].read_at,null);
 assert.equal(JSON.stringify(d.getAnnouncements(employee)).includes('recipients'),false);
});
scenario('announcements: reading and acknowledgment are separate, idempotent and persistent',d=>{
 const a=d.saveAnnouncement(admin,input());
 assert.throws(()=>d.readAnnouncement(employee,a.id,a.revision,true),e=>e.status===400);
 const read=d.readAnnouncement(employee,a.id,a.revision);assert.ok(read.read_at);assert.equal(read.acknowledged_at,null);
 const ack=d.readAnnouncement(employee,a.id,a.revision,true);assert.ok(ack.acknowledged_at);
 assert.equal(d.readAnnouncement(employee,a.id,a.revision,true).acknowledged_at,ack.acknowledged_at);
 const restored=new HRDatabase(d.exportState());assert.equal(restored.getAnnouncements(employee)[0].acknowledged_at,ack.acknowledged_at);
 const report=restored.announcementReport(admin,a.id);assert.ok(report.recipients.find(r=>r.user_id===employee.id).acknowledged_at);
 assert.equal(report.recipients.find(r=>r.user_id===other.id).read_at,null);
 assert.equal(d.getAuditLogs().filter(a=>a.action==='Acknowledge Announcement').length,1);
});
scenario('announcements: edits reset receipts and reject stale saves and acknowledgments',d=>{
 const a=d.saveAnnouncement(admin,input());d.readAnnouncement(employee,a.id,a.revision);d.readAnnouncement(employee,a.id,a.revision,true);
 const changed=d.saveAnnouncement(admin,input({message:'A new revision'}),a.id,a.revision);
 assert.equal(changed.revision,a.revision+1);assert.equal(d.getAnnouncements(employee)[0].read_at,null);
 assert.equal(d.announcementReport(admin,a.id).recipients.find(r=>r.user_id===employee.id).acknowledged_at,null);
 assert.throws(()=>d.readAnnouncement(employee,a.id,a.revision,true),e=>e.status===409);
 assert.throws(()=>d.saveAnnouncement(admin,input(),a.id,a.revision),e=>e.status===409);
 assert.equal(d.getNotifications(employee.id).filter(n=>n.announcement_id===a.id).length,1);
 assert.throws(()=>d.readAnnouncement(employee,a.id,changed.revision,true),e=>e.status===400);
});
scenario('announcements: archive removes employee access and notifications but preserves the report',d=>{
 const a=d.saveAnnouncement(admin,input());d.readAnnouncement(employee,a.id,a.revision);d.readAnnouncement(employee,a.id,a.revision,true);
 d.archiveAnnouncement(admin,a.id,a.revision);
 assert.equal(d.getAnnouncements(employee).length,0);assert.equal(d.getNotifications(employee.id).filter(n=>n.announcement_id).length,0);
 assert.throws(()=>d.readAnnouncement(employee,a.id,a.revision),e=>e.status===404);
 assert.ok(d.announcementReport(admin,a.id).recipients.find(r=>r.user_id===employee.id).acknowledged_at);
 assert.equal(d.getAnnouncements(admin,true)[0].status,'archived');
 assert.throws(()=>d.saveAnnouncement(admin,input(),a.id,a.revision));
});
scenario('announcements: expiry and changed employee location revoke access, including notifications',d=>{
 const a=d.saveAnnouncement(admin,input({countries:['Philippines']}));
 const state=d.exportState();state.users.find(u=>u.id===employee.id).profile.country='Canada';
 const moved=new HRDatabase(state);assert.equal(moved.getAnnouncements(employee).length,0);assert.equal(moved.getNotifications(employee.id).filter(n=>n.announcement_id).length,0);
 state.announcements[0].expires_at=new Date(Date.now()-1000).toISOString();
 const expired=new HRDatabase(state);assert.equal(expired.getAnnouncements(employee).length,0);assert.equal(expired.getAnnouncements(admin,true).length,1);
 assert.throws(()=>expired.readAnnouncement(employee,a.id,a.revision),e=>e.status===404);
});
scenario('announcements: validation rejects malformed input without mutation',d=>{
 const invalid=[{title:''},{message:' '},{title:'x'.repeat(161)},{message:'x'.repeat(10001)},{message:{nested:'invalid'}},{category:'unknown'},{departments:['No department']},{countries:['Unknown']},{countries:'Philippines'},{pinned:'true'},{requires_acknowledgment:1},{expires_at:'bad'},{expires_at:new Date(Date.now()-1000).toISOString()},{status:'archived'}];
 for(const patch of invalid)assert.throws(()=>d.saveAnnouncement(admin,input(patch)));
 assert.equal(d.getAnnouncements(admin,true).length,0);
});
scenario('announcements: pinned items sort first and all-company includes admins as employees',d=>{
 d.saveAnnouncement(admin,input({title:'Unpinned'}));d.saveAnnouncement(admin,input({title:'Pinned',pinned:true}));
 assert.equal(d.getAnnouncements(employee)[0].title,'Pinned');assert.equal(d.getAnnouncements(admin).length,2);
 const a=d.getAnnouncements(admin)[0];assert.ok(d.readAnnouncement(admin,a.id,a.revision).read_at);
 assert.deepEqual(navigateWorkspace('admin','personal','announcements'),{mode:'personal',tab:'announcements'});
 assert.deepEqual(navigateWorkspace('employee','administration','announcements'),{mode:'personal',tab:'announcements'});
});
scenario('announcements: old databases hydrate with empty announcement collections',d=>{
 const state=d.exportState();delete state.announcements;delete state.announcementReceipts;
 assert.equal(new HRDatabase(state).getAnnouncements(employee).length,0);
});

import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
test('announcements HTTP: cookies, permissions, persistence, concurrency, notifications and archive',async()=>{
 const dir=await mkdtemp(tmpdir()+'/hr-announcements-');
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const child=spawn(process.execPath,['build/server.cjs'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,NODE_ENV:'test',HR_TEST_STORE:dir+'/store.json',PORT:String(port),INITIAL_ADMIN_EMAIL:'http-ann-admin@example.test',INITIAL_ADMIN_PASSWORD:'Test-HTTP-Announcement-938!'},stdio:'ignore'});
 async function call(path,method='GET',body,cookie){const res=await fetch(`http://127.0.0.1:${port}/api${path}`,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:res.status,cookie:res.headers.get('set-cookie')?.split(';')[0],data:await res.json()};}
 async function login(email,password){const res=await call('/auth/login','POST',{email,password});assert.equal(res.status,200);return res.cookie;}
 try {
  for(let i=0;i<100;i++){try{if((await call('/health')).status===200)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  let admin=await login('http-ann-admin@example.test','Test-HTTP-Announcement-938!');
  assert.equal((await call('/auth/change-password','POST',{new_password:'Personal-HTTP-Admin-938!'},admin)).status,200);admin=await login('http-ann-admin@example.test','Personal-HTTP-Admin-938!');
  assert.equal((await call('/employees','POST',{full_name:'Synthetic reader',email:'http-ann-reader@example.test',password:'Test-HTTP-Reader-938!',department:'Technology',country:'Philippines'},admin)).status,201);
  let employee=await login('http-ann-reader@example.test','Test-HTTP-Reader-938!');await call('/auth/change-password','POST',{new_password:'Personal-HTTP-Reader-938!'},employee);employee=await login('http-ann-reader@example.test','Personal-HTTP-Reader-938!');
  assert.equal((await call('/announcements')).status,401);
  assert.equal((await call('/announcements?view=manage','GET',undefined,employee)).status,403);
  assert.equal((await call('/announcements','POST',input(),employee)).status,403);
  assert.equal((await call('/announcements','POST',input({message:{bad:true}}),admin)).status,400);
  const draft=await call('/announcements','POST',input({...imageInput,status:'draft',author_name:'Forged author'}),admin);assert.equal(draft.status,201);assert.notEqual(draft.data.author_name,'Forged author');
  assert.equal((await call('/announcements','GET',undefined,employee)).data.length,0);
  const path='/announcements/'+draft.data.id;
  const assetPath=path+'/images/'+draft.data.image.id;
  async function imageResponse(cookie,route=assetPath){return fetch(`http://127.0.0.1:${port}/api${route}`,{headers:cookie?{Cookie:cookie}:{}});}
  assert.equal((await imageResponse()).status,401);
  assert.equal((await imageResponse(employee)).status,404);
  assert.equal((await imageResponse(admin)).status,200);
  assert.equal((await call(path+'/report','GET',undefined,employee)).status,403);
  assert.equal((await call(path+'/read','POST',{revision:draft.data.revision},employee)).status,404);
  const published=await call(path,'PATCH',{...input({departments:['Technology'],countries:['Philippines']}),expected_revision:draft.data.revision},admin);assert.equal(published.status,200);
  assert.equal((await call('/announcements','GET',undefined,employee)).data.length,1);
  const image=await imageResponse(employee);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.match(image.headers.get('cache-control'),/no-store/);
  assert.equal(image.headers.get('x-content-type-options'),'nosniff');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()),Buffer.from(pngData.split(',')[1],'base64'));
  assert.equal(JSON.stringify((await call('/announcements','GET',undefined,employee)).data).includes('base64'),false);
  assert.equal((await call(path,'PATCH',{...input({...imageInput,image_upload:{name:'bad.png',data:'bad'}}),expected_revision:published.data.revision},admin)).status,400);
  assert.equal((await imageResponse(employee)).status,200);
  assert.equal((await call('/announcements','GET',undefined,admin)).data.length,0);
  assert.ok((await call('/notifications','GET',undefined,employee)).data.some(n=>n.announcement_id===draft.data.id));
  assert.equal((await call(path+'/acknowledge','POST',{revision:published.data.revision},employee)).status,400);
  assert.equal((await call(path+'/read','POST',{revision:published.data.revision},employee)).status,200);
  assert.equal((await call(path+'/acknowledge','POST',{revision:published.data.revision},employee)).status,200);
  assert.ok((await call(path+'/report','GET',undefined,admin)).data.recipients[0].acknowledged_at);
  const writes=await Promise.all([1,2].map(n=>call(path,'PATCH',{...input({title:'Concurrent '+n}),expected_revision:published.data.revision},admin)));
  assert.deepEqual(writes.map(r=>r.status).sort(),[200,409]);
  const current=writes.find(r=>r.status===200).data;
  assert.equal((await call(path+'/acknowledge','POST',{revision:published.data.revision},employee)).status,409);
  assert.equal((await call(path+'/archive','POST',{expected_revision:current.revision},employee)).status,403);
  assert.equal((await call(path+'/archive','POST',{expected_revision:current.revision},admin)).status,200);
  assert.equal((await call('/announcements','GET',undefined,employee)).data.length,0);
  assert.equal((await call('/notifications','GET',undefined,employee)).data.filter(n=>n.announcement_id===draft.data.id).length,0);
  assert.equal((await call(path+'/read','POST',{revision:current.revision},employee)).status,404);
  assert.equal((await call('/announcements?view=manage','GET',undefined,admin)).data[0].status,'archived');
  assert.equal((await imageResponse(employee)).status,404);assert.equal((await imageResponse(admin)).status,200);
 } finally {const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;await rm(dir,{recursive:true,force:true});}
});
