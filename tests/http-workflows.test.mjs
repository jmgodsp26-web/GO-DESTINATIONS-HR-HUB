import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
test('HTTP workflow lifecycle, privacy, attachments and persistence', async () => {
const repo=fileURLToPath(new URL('..',import.meta.url));
const dir=await mkdtemp(tmpdir()+'/hr-http-audit-');
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const child=spawn(process.execPath,['build/server.cjs'],{cwd:repo,env:{...process.env,NODE_ENV:'test',HR_TEST_STORE:dir+'/store.json',PORT:String(port),INITIAL_ADMIN_EMAIL:'admin@example.test',INITIAL_ADMIN_PASSWORD:'Isolated-Audit-Temporary-938!'},stdio:'ignore'});
const results=[];
async function check(name,fn){await fn();results.push({name,status:'PASS'});}
async function call(path,method='GET',body,cookie){const r=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],data:await r.json()};}
async function sign(email,password){const r=await call('/api/auth/login','POST',{identifier:email,password});assert.equal(r.status,200);return r.cookie;}
const request=(date='2026-10-12',extra={})=>({leave_type:'Vacation Leave',start_date:date,end_date:date,reason:'Synthetic audit only',...extra});
try{
 for(let i=0;i<100;i++){try{if((await call('/api/health')).status===200)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 let admin=await sign('admin@example.test','Isolated-Audit-Temporary-938!');
 await call('/api/auth/change-password','POST',{new_password:'Personal-Isolated-Admin-938!'},admin);admin=await sign('admin@example.test','Personal-Isolated-Admin-938!');
 const employees=[];
 for(const email of ['employee@example.test','other@example.test']){const created=await call('/api/employees','POST',{full_name:'Synthetic '+email,email,password:'Isolated-Employee-Temp-938!',department:'Technology',job_title:'Employee',country:'Philippines'},admin);assert.equal(created.status,201);let cookie=await sign(email,'Isolated-Employee-Temp-938!');assert.equal((await call('/api/auth/change-password','POST',{new_password:'Personal-Isolated-Employee-938!'},cookie)).status,200);cookie=await sign(email,'Personal-Isolated-Employee-938!');employees.push({id:created.data.id,cookie});}
 const [employee,other]=employees;
 await check('admin personal leave is scoped, another admin approves and cancellation restores balance',async()=>{
   const myLeave=await call('/api/leave-requests','POST',request('2026-10-14'),admin);assert.equal(myLeave.status,201);const adminId=myLeave.data.employee_id;
   assert.equal((await call(`/api/leave-requests/${myLeave.data.id}/review`,'PATCH',{action:'Approved'},admin)).status,400);
   const second=await call('/api/employees','POST',{full_name:'Synthetic second admin',email:'second-admin@example.test',password:'Second-admin-temporary-938!',role:'admin'},admin);assert.equal(second.status,201);
   let reviewer=await sign('second-admin@example.test','Second-admin-temporary-938!');await call('/api/auth/change-password','POST',{new_password:'Second-admin-personal-938!'},reviewer);reviewer=await sign('second-admin@example.test','Second-admin-personal-938!');
   assert.equal((await call(`/api/leave-requests/${myLeave.data.id}/review`,'PATCH',{action:'Approved'},reviewer)).status,200);
   const own=await call('/api/leave-requests?scope=mine&employee='+employee.id,'GET',undefined,admin);assert.ok(own.data.length>0);assert.ok(own.data.every(r=>r.employee_id===adminId));
   const balances=await call('/api/leave-balances?scope=mine&employee_id='+employee.id,'GET',undefined,admin);assert.ok(balances.data.every(b=>b.employee_id===adminId));assert.equal(balances.data.find(b=>b.leave_type==='Vacation Leave').used_days,1);
   const ledger=await call('/api/leave-transactions?scope=mine&employee_id='+employee.id,'GET',undefined,admin);assert.ok(ledger.data.length>0);assert.ok(ledger.data.every(t=>t.employee_id===adminId));
   assert.equal((await call(`/api/leave-requests/${myLeave.data.id}/cancel`,'PATCH',{},admin)).status,200);
   assert.equal((await call('/api/leave-balances','GET',undefined,admin)).data.find(b=>b.leave_type==='Vacation Leave').used_days,0);
   assert.equal((await call('/api/auth/me','GET',undefined,admin)).data.user.role,'admin');
 });
 await check('anonymous employee directory denied',async()=>assert.equal((await call('/api/employees')).status,401));
 await check('employee administration denied',async()=>assert.equal((await call('/api/settings','PATCH',{company_name:'Unauthorized'},employee.cookie)).status,403));
 let created;
 await check('HTTP leave submission persists Pending',async()=>{created=await call('/api/leave-requests','POST',request(),employee.cookie);assert.equal(created.status,201);assert.equal(created.data.status,'Pending');assert.equal((await call('/api/leave-requests','GET',undefined,employee.cookie)).data.length,1);});
 await check('HTTP approval deducts one day',async()=>{assert.equal((await call(`/api/leave-requests/${created.data.id}/review`,'PATCH',{action:'Approved'},admin)).status,200);assert.equal((await call('/api/leave-balances','GET',undefined,employee.cookie)).data.find(b=>b.leave_type==='Vacation Leave').used_days,1);});
 await check('HTTP cancellation refunds one day',async()=>{assert.equal((await call(`/api/leave-requests/${created.data.id}/cancel`,'PATCH',{},employee.cookie)).status,200);assert.equal((await call('/api/leave-balances','GET',undefined,employee.cookie)).data.find(b=>b.leave_type==='Vacation Leave').used_days,0);});
 await check('HTTP invalid review action denied',async()=>assert.equal((await call(`/api/leave-requests/${created.data.id}/review`,'PATCH',{action:'Invalid'},admin)).status,400));
 await check('HTTP concurrent duplicate submission commits only once',async()=>{const responses=await Promise.all([1,2].map(()=>call('/api/leave-requests','POST',request('2026-10-15'),employee.cookie)));assert.deepEqual(responses.map(r=>r.status).sort(),[201,400]);});
 await check('employee cannot read others balances',async()=>{const r=await call(`/api/leave-balances?employee_id=${other.id}`,'GET',undefined,employee.cookie);assert.ok(r.data.every(b=>b.employee_id===employee.id));});
 await check('employee cannot read others documents',async()=>assert.equal((await call(`/api/admin/employees/${other.id}/documents`,'GET',undefined,employee.cookie)).status,403));
 await check('employee cannot read audit logs',async()=>assert.equal((await call('/api/audit-logs','GET',undefined,employee.cookie)).status,403));
 await check('small document upload and retrieval',async()=>{const r=await call(`/api/admin/employees/${employee.id}/documents`,'POST',{name:'synthetic.txt',category:'Other',file_size:'5 Bytes',file_data:'data:text/plain;base64,aGVsbG8='},admin);assert.equal(r.status,201);const own=await call('/api/my-documents','GET',undefined,employee.cookie);assert.equal(own.data[0].file_data,'data:text/plain;base64,aGVsbG8=');});
 await check('oversized document fails clearly',async()=>{const r=await call(`/api/admin/employees/${employee.id}/documents`,'POST',{name:'synthetic-large.pdf',file_data:'x'.repeat(600001)},admin);assert.equal(r.status,400);assert.match(r.data.error,/450 KB/);});
 await check('settings save and reload',async()=>{assert.equal((await call('/api/settings','PATCH',{company_name:'Synthetic audit company'},admin)).status,200);assert.equal((await call('/api/settings','GET',undefined,admin)).data.company_name,'Synthetic audit company');});
 const privateLeave=await call('/api/leave-requests','POST',request('2026-10-19',{leave_type:'Medical Leave',end_date:'2026-10-21',reason:'SYNTHETIC_PRIVATE_MEDICAL_REASON',attachment_url:'https://example.test/private-medical'}),other.cookie);
 assert.equal(privateLeave.status,201);assert.equal((await call(`/api/leave-requests/${privateLeave.data.id}/review`,'PATCH',{action:'Approved',admin_note:'SYNTHETIC_PRIVATE_ADMIN_NOTE'},admin)).status,200);
 const holiday=await call('/api/holidays','POST',{name:'Synthetic audit holiday',date:'2026-10-20',country:'Philippines'},admin);assert.equal(holiday.status,201);
 await check('calendar redacts others medical reason',async()=>{const r=await call('/api/calendar','GET',undefined,employee.cookie);assert.equal(JSON.stringify(r.data).includes('SYNTHETIC_PRIVATE_MEDICAL_REASON'),false);});
 await check('admin personal calendar and holiday coverage use employee privacy while admin view stays available',async()=>{
   for(const route of ['/api/calendar?view=personal','/api/holiday-coverage?upcoming_only=false&view=personal','/api/holiday-coverage/'+holiday.data.id+'?view=personal']){
     const r=await call(route,'GET',undefined,admin);assert.equal(r.status,200);assert.equal(JSON.stringify(r.data).includes('SYNTHETIC_PRIVATE_MEDICAL_REASON'),false);assert.equal(JSON.stringify(r.data).includes('SYNTHETIC_PRIVATE_ADMIN_NOTE'),false);
   }
   const all=await call('/api/leave-requests','GET',undefined,admin);assert.ok(all.data.some(r=>r.employee_id===other.id));assert.ok(all.data.some(r=>r.reason==='SYNTHETIC_PRIVATE_MEDICAL_REASON'));
   const docs=await call('/api/my-documents','GET',undefined,admin);assert.ok(docs.data.every(d=>d.employee_id!==employee.id));
 });
 await check('single holiday coverage redacts others medical reason',async()=>{const r=await call('/api/holiday-coverage/'+holiday.data.id,'GET',undefined,employee.cookie);assert.equal(r.status,200);assert.equal(JSON.stringify(r.data).includes('SYNTHETIC_PRIVATE_MEDICAL_REASON'),false);});
 await check('bulk holiday coverage redacts others medical reason',async()=>{const r=await call('/api/holiday-coverage?upcoming_only=false','GET',undefined,employee.cookie);assert.equal(r.status,200);assert.equal(JSON.stringify(r.data).includes('SYNTHETIC_PRIVATE_MEDICAL_REASON'),false);});
 await check('half-day weekend rejected through HTTP',async()=>assert.equal((await call('/api/leave-requests','POST',request('2026-10-24',{is_half_day:true,half_day_period:'morning'}),employee.cookie)).status,400));
 await check('notification ownership and read update',async()=>{const r=await call('/api/notifications','GET',undefined,other.cookie);assert.ok(r.data.some(n=>n.title==='Leave Approved'));const n=r.data[0];assert.equal((await call('/api/notifications/'+n.id+'/read','PATCH',{},other.cookie)).status,200);assert.equal((await call('/api/notifications','GET',undefined,other.cookie)).data.find(x=>x.id===n.id).read,true);});
 await check('private attachment binary download and authorization',async()=>{
   const r=await call('/api/leave-requests','POST',request('2026-10-27',{attachment_name:'note.txt',attachment_data:'data:text/plain;base64,aGVsbG8='}),employee.cookie);assert.equal(r.status,201);assert.match(r.data.attachment_url,/^\/api\/leave-attachments\//);
   for(const cookie of [employee.cookie,admin]){const response=await fetch(`http://127.0.0.1:${port}${r.data.attachment_url}`,{headers:{Cookie:cookie}});assert.equal(response.status,200);assert.equal(await response.text(),'hello');assert.match(response.headers.get('content-disposition'),/^attachment;/);}
   assert.equal((await call(r.data.attachment_url,'GET',undefined,other.cookie)).status,404);assert.equal((await call(r.data.attachment_url)).status,401);
 });
 await check('missing or unsafe document rejected',async()=>{for(const file_data of [undefined,{},'data:text/html;base64,aGVsbG8='])assert.equal((await call(`/api/admin/employees/${employee.id}/documents`,'POST',{name:'bad-file',file_data},admin)).status,400);});
 await check('bodyless logout works and invalidates session',async()=>{assert.equal((await call('/api/auth/logout','POST',undefined,employee.cookie)).status,200);assert.equal((await call('/api/auth/me','GET',undefined,employee.cookie)).status,401);});
}finally{const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;await rm(dir,{recursive:true,force:true});}
assert.equal(results.length,23);
});
