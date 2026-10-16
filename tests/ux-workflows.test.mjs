import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveRoute, routeHash, notificationDestination } from '../src/utils/navigation.ts';
import { reportRange } from '../src/utils/reportPeriod.ts';
import { leaveDayBreakdown } from '../src/utils/workingDays.ts';
import { canReviewRequest, reviewBatch } from '../src/utils/reviewQueue.ts';
import { HRDatabase } from '../server/db.ts';

test('routes: bookmarked employee and request destinations round-trip with role boundaries',()=>{
  const route=resolveRoute('admin','personal','#/administration/employees?employee=person%20one');
  assert.deepEqual(route,{mode:'administration',tab:'employees',query:'employee=person+one'});
  assert.deepEqual(resolveRoute('admin','personal',routeHash(route)),route);
  assert.deepEqual(resolveRoute('employee','personal','#/administration/employees'),{mode:'personal',tab:'dashboard',query:''});
  assert.equal(resolveRoute('admin','administration','personal/announcements?id=a&secret=discard').query,'id=a');
  assert.equal(resolveRoute('employee','personal','leave?request='+ 'a'.repeat(181)).query,'');
});
test('notifications: entity links distinguish an admin review from personal leave and announcements',()=>{
  assert.equal(notificationDestination({request_id:'request/1',link_tab:'leave-requests'}),'leave-requests?request=request%2F1');
  assert.equal(notificationDestination({request_id:'request-1',link_tab:'leave'}),'leave?request=request-1');
  assert.equal(notificationDestination({announcement_id:'update-1',link_tab:'announcements'}),'personal/announcements?id=update-1');
  assert.equal(notificationDestination({link_tab:'holidays'}),'holidays');
});
test('reports: YTD stops at today and all quarters work across years',()=>{
  assert.deepEqual(reportRange('ytd','2027-02-05'),['2027-01-01','2027-02-05']);
  assert.deepEqual(reportRange('quarter:2028:1','2028-03-01'),['2028-01-01','2028-03-31']);
  assert.deepEqual(reportRange('quarter:2026:4','2026-10-15'),['2026-10-01','2026-12-31']);
  assert.deepEqual(reportRange('year:2025','2026-10-15'),['2025-01-01','2025-12-31']);
  assert.equal(reportRange('all','2026-10-15'),null);
});
test('leave breakdown: holidays on non-working days are not subtracted twice',()=>{
  const holidays=[{date:'2026-10-13',country:'Philippines'},{date:'2026-10-17',country:'Philippines'},{date:'2026-10-14',country:'Canada'}];
  assert.deepEqual(leaveDayBreakdown('2026-10-12','2026-10-18',holidays,'Philippines'),{selected:7,nonWorking:2,holidays:1,charged:4});
  assert.deepEqual(leaveDayBreakdown('2026-10-17','2026-10-17',[],'Philippines',undefined,'Monday to Saturday'),{selected:1,nonWorking:0,holidays:0,charged:1});
  assert.throws(()=>leaveDayBreakdown('2026-10-18','2026-10-12',[]));
});
test('review eligibility: self-approval and already reviewed items cannot be selected',()=>{
  assert.equal(canReviewRequest({status:'Pending',employee_id:'self'},'self'),false);
  assert.equal(canReviewRequest({status:'Approved',employee_id:'other'},'self'),false);
  assert.equal(canReviewRequest({status:'Pending',employee_id:'other'},'self'),true);
  assert.equal(canReviewRequest({status:'Pending',employee_id:'other'}),false);
});
test('batch review: reports each outcome and bounds concurrency without retrying successful writes',async()=>{
  let inFlight=0,max=0;const calls=[];
  const ids=Array.from({length:11},(_,i)=>String(i));
  const outcome=await reviewBatch(ids,async id=>{calls.push(id);inFlight++;max=Math.max(max,inFlight);await new Promise(r=>setTimeout(r,2));inFlight--;if(id==='2'||id==='7')throw new Error('Already processed');});
  assert.equal(max,4);assert.deepEqual(calls,ids);assert.equal(outcome.filter(r=>r.success).length,9);
  assert.deepEqual(outcome.filter(r=>!r.success).map(r=>r.id),['2','7']);assert.equal(outcome[2].error,'Already processed');
});
process.env.INITIAL_ADMIN_EMAIL='ux-admin@example.test';process.env.INITIAL_ADMIN_PASSWORD='Synthetic-UX-Admin-938!';
const seed=HRDatabase.bootstrap(),admin=seed.getAllEmployees()[0];
const employee=seed.createEmployee({full_name:'UX employee',email:'ux-employee@example.test',password:'Synthetic-UX-Employee-938!',department:'Technology',country:'Philippines'},admin);
const other=seed.createEmployee({full_name:'Other employee',email:'ux-other@example.test',password:'Synthetic-UX-Other-938!',department:'HR',country:'Canada'},admin);
const baseline=seed.exportState();
test('document metadata: own/admin boundaries, no embedded data, original-file availability and disabled users',()=>{
  const d=new HRDatabase(baseline);
  const doc=d.addEmployeeDocument({employee_id:employee.id,name:'test.txt',category:'Other',file_size:'5 Bytes',file_data:'data:text/plain;base64,aGVsbG8=',uploaded_by_name:admin.full_name});
  d.addEmployeeDocument({employee_id:other.id,name:'missing.pdf',category:'Contract',file_size:'Unknown',uploaded_by_name:admin.full_name});
  assert.equal(d.listDocuments(employee).length,1);assert.equal(d.listDocuments(admin,true).length,2);
  assert.equal(d.listDocuments(employee)[0].file_data,undefined);assert.equal(d.listDocuments(employee)[0].file_available,true);
  assert.equal(d.listDocuments(employee)[0].file_url,`/api/documents/${doc.id}/file`);
  assert.equal(d.listDocuments(other)[0].file_available,false);
  assert.throws(()=>d.listDocuments(employee,true),e=>e.status===403);
  assert.throws(()=>d.listDocuments({...employee,role:'admin'},false,other.id),e=>e.status===403);
  assert.throws(()=>d.documentFile(other,doc.id),e=>e.status===404);
  assert.equal(d.documentFile(employee,doc.id).file_data,'data:text/plain;base64,aGVsbG8=');
  assert.throws(()=>d.documentFile(other,d.listDocuments(other)[0].id),e=>e.status===404);
  const state=d.exportState();state.users.find(u=>u.id===employee.id).profile.status='disabled';
  assert.throws(()=>new HRDatabase(state).documentFile(employee,doc.id),e=>e.status===403);
});
test('audience preview: count matches active audience intersection and cannot be read by employees',()=>{
  const d=new HRDatabase(baseline);
  assert.equal(d.previewAnnouncementAudience(admin,{departments:['Technology'],countries:['Philippines']}).count,1);
  assert.equal(d.previewAnnouncementAudience(admin,{departments:['Technology'],countries:['Canada']}).count,0);
  assert.throws(()=>d.previewAnnouncementAudience(employee,{departments:[],countries:[]}),e=>e.status===403);
  assert.throws(()=>d.previewAnnouncementAudience(admin,{departments:'HR',countries:[]}),e=>e.status===400);
  const input={title:'Synthetic preview',message:'Test only',category:'Company news',departments:['HR'],countries:['Canada'],pinned:false,requires_acknowledgment:false,expires_at:null,status:'published'};
  const a=d.saveAnnouncement(admin,input);
  assert.equal(d.previewAnnouncementAudience(admin,input).count,d.announcementReport(admin,a.id).recipients.length);
});
test('leave notifications: submission and review preserve the exact request target',()=>{
  const d=new HRDatabase(baseline),r=d.submitLeaveRequest(employee,{leave_type:'Vacation Leave',start_date:'2026-10-19',end_date:'2026-10-19',reason:'Synthetic UX test'});
  assert.ok(d.getNotifications(admin.id).some(n=>n.request_id===r.id&&n.link_tab==='leave-requests'));
  d.reviewLeaveRequest(r.id,'Approved',admin);
  assert.ok(d.getNotifications(employee.id).some(n=>n.request_id===r.id&&n.link_tab==='leave'));
});

import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
test('document and audience HTTP: authenticated metadata, binary preview/download and cross-account denial',async()=>{
 const dir=await mkdtemp(tmpdir()+'/hr-ux-http-');
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const child=spawn(process.execPath,['build/server.cjs'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,NODE_ENV:'test',HR_TEST_STORE:dir+'/store.json',PORT:String(port),INITIAL_ADMIN_EMAIL:'ux-http-admin@example.test',INITIAL_ADMIN_PASSWORD:'Synthetic-HTTP-Admin-938!'},stdio:'ignore'});
 async function call(path,method='GET',body,cookie){const res=await fetch(`http://127.0.0.1:${port}/api${path}`,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await res.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:res.status,headers:res.headers,cookie:res.headers.get('set-cookie')?.split(';')[0],data};}
 async function login(email,password){const res=await call('/auth/login','POST',{email,password});assert.equal(res.status,200);return res.cookie;}
 try{
  for(let i=0;i<100;i++){try{if((await call('/health')).status===200)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  let admin=await login('ux-http-admin@example.test','Synthetic-HTTP-Admin-938!');
  await call('/auth/change-password','POST',{new_password:'Personal-HTTP-Admin-938!'},admin);admin=await login('ux-http-admin@example.test','Personal-HTTP-Admin-938!');
  const created=await call('/employees','POST',{full_name:'Synthetic file owner',email:'ux-http-owner@example.test',password:'Synthetic-HTTP-Owner-938!',department:'Technology',country:'Philippines'},admin);assert.equal(created.status,201);
  let owner=await login('ux-http-owner@example.test','Synthetic-HTTP-Owner-938!');await call('/auth/change-password','POST',{new_password:'Personal-HTTP-Owner-938!'},owner);owner=await login('ux-http-owner@example.test','Personal-HTTP-Owner-938!');
  const outsider=await call('/employees','POST',{full_name:'Synthetic outsider',email:'ux-http-other@example.test',password:'Synthetic-HTTP-Other-938!',department:'HR',country:'Canada'},admin);assert.equal(outsider.status,201);
  let other=await login('ux-http-other@example.test','Synthetic-HTTP-Other-938!');await call('/auth/change-password','POST',{new_password:'Personal-HTTP-Other-938!'},other);other=await login('ux-http-other@example.test','Personal-HTTP-Other-938!');
  assert.equal((await call('/documents')).status,401);
  assert.equal((await call('/documents?scope=all','GET',undefined,owner)).status,403);
  assert.equal((await call('/documents?employee='+created.data.id,'GET',undefined,other)).status,403);
  const content='%PDF-1.4\nSynthetic test content',file='data:application/pdf;base64,'+Buffer.from(content).toString('base64');
  const upload=await call('/admin/employees/'+created.data.id+'/documents','POST',{name:'test.pdf',category:'Contract',file_data:file},admin);assert.equal(upload.status,201);
  const listing=await call('/documents','GET',undefined,owner);assert.equal(listing.status,200);assert.equal(listing.data.length,1);assert.equal(listing.data[0].file_data,undefined);assert.equal(listing.data[0].mime_type,'application/pdf');
  assert.equal((await call('/documents?scope=all','GET',undefined,admin)).data.length,1);
  const filePath='/documents/'+upload.data.id+'/file';
  assert.equal((await call(filePath)).status,401);assert.equal((await call(filePath,'GET',undefined,other)).status,404);
  const download=await call(filePath,'GET',undefined,owner);assert.equal(download.data,content);assert.match(download.headers.get('content-disposition'),/^attachment/);assert.match(download.headers.get('cache-control'),/no-store/);
  const preview=await call(filePath+'?preview=1','GET',undefined,owner);assert.equal(preview.data,content);assert.match(preview.headers.get('content-disposition'),/^inline/);assert.match(preview.headers.get('content-type'),/application\/pdf/);
  assert.equal((await call('/announcements/audience-preview','POST',{departments:[],countries:[]},owner)).status,403);
  const audience=await call('/announcements/audience-preview','POST',{departments:['Technology'],countries:['Philippines']},admin);assert.equal(audience.status,200);assert.equal(audience.data.count,1);
  assert.equal((await call('/announcements/audience-preview','POST',{departments:['Invalid'],countries:[]},admin)).status,400);
 }finally{const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;await rm(dir,{recursive:true,force:true});}
});
