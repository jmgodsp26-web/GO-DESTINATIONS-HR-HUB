import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvCell, csvRow } from '../src/utils/csv.ts';
import { visibleCoverage } from '../server/coverage.ts';
import { decodeUpload } from '../server/files.ts';
import { HRDatabase } from '../server/db.ts';

process.env.INITIAL_ADMIN_EMAIL='audit-admin@example.test';
process.env.INITIAL_ADMIN_PASSWORD='Isolated-Audit-Temporary-938!';
const seed=HRDatabase.bootstrap();
const a=seed.getAllEmployees()[0];
const e=seed.createEmployee({full_name:'Isolated Audit Employee',email:'audit-employee@example.test',password:'Isolated-Employee-Temp-938!',phone:'',department:'Technology',job_title:'Employee',country:'Philippines',region:'Metro Manila',date_joined:'2026-01-01'},a);
const other=seed.createEmployee({full_name:'Other Isolated Employee',email:'other@example.test',password:'Isolated-Other-Temp-938!',phone:'',department:'Technology',job_title:'Employee',country:'Philippines',region:'Cebu',date_joined:'2026-01-01'},a);
const baseline=seed.exportState();
function scenario(name,fn){test(name,()=>fn(new HRDatabase(baseline)));}
// Fixed date before the synthetic leave, so refund rules do not depend on the real calendar.
const BEFORE_LEAVE='2026-10-01';
const leave=(overrides={})=>({leave_type:'Vacation Leave',start_date:'2026-10-12',end_date:'2026-10-12',reason:'Synthetic audit only',...overrides});
const balance=(d,type='Vacation Leave')=>d.getLeaveBalances(e.id).find(b=>b.leave_type===type);
const holiday=(d,overrides={})=>d.addHoliday({name:'Synthetic audit holiday',date:'2026-10-12',country:'Philippines',...overrides},a);

scenario('fresh database contains only bootstrap administrator',()=>assert.equal(HRDatabase.bootstrap().getAllEmployees().length,1));
scenario('weekday request creates Pending without spending balance',d=>{const r=d.submitLeaveRequest(e,leave());assert.equal(r.status,'Pending');assert.equal(r.total_days,1);assert.equal(balance(d).used_days,0);});
scenario('full-day weekends rejected',d=>assert.throws(()=>d.submitLeaveRequest(e,leave({start_date:'2026-10-10',end_date:'2026-10-11'}))));
scenario('Friday to Monday charges two working days',d=>assert.equal(d.submitLeaveRequest(e,leave({start_date:'2026-10-09'})).total_days,2));
scenario('country holiday excluded',d=>{holiday(d);assert.equal(d.submitLeaveRequest(e,leave({end_date:'2026-10-13'})).total_days,1);});
scenario('company-wide holiday excluded',d=>{holiday(d,{country:'Global',scope:'Company-wide'});assert.equal(d.calculateWorkingDays('2026-10-12','2026-10-13',e.country),1);});
scenario('other-country holiday does not reduce days',d=>{holiday(d,{country:'United States'});assert.equal(d.calculateWorkingDays('2026-10-12','2026-10-13',e.country),2);});
scenario('inactive holiday does not reduce days',d=>{holiday(d,{is_active:false});assert.equal(d.calculateWorkingDays('2026-10-12','2026-10-13',e.country),2);});
scenario('reversed date range rejected',d=>assert.throws(()=>d.submitLeaveRequest(e,leave({end_date:'2026-10-09'}))));
scenario('missing reason rejected',d=>assert.throws(()=>d.submitLeaveRequest(e,leave({reason:' '}))));
scenario('duplicate Pending request rejected',d=>{d.submitLeaveRequest(e,leave());assert.throws(()=>d.submitLeaveRequest(e,leave()));});
scenario('Approved overlap rejected',d=>{const r=d.submitLeaveRequest(e,leave());d.reviewLeaveRequest(r.id,'Approved',a);assert.throws(()=>d.submitLeaveRequest(e,leave()));});
scenario('opposite half-day periods can coexist',d=>{d.submitLeaveRequest(e,leave({is_half_day:true,half_day_period:'morning'}));d.submitLeaveRequest(e,leave({is_half_day:true,half_day_period:'afternoon'}));assert.equal(d.getLeaveRequests(e).length,2);});
scenario('same half-day period overlap rejected',d=>{d.submitLeaveRequest(e,leave({is_half_day:true,half_day_period:'morning'}));assert.throws(()=>d.submitLeaveRequest(e,leave({is_half_day:true,half_day_period:'morning'})));});
scenario('full-day cannot overlap half-day',d=>{d.submitLeaveRequest(e,leave({is_half_day:true}));assert.throws(()=>d.submitLeaveRequest(e,leave()));});
scenario('insufficient paid balance rejected',d=>{d.adjustLeaveBalance(e.id,'Vacation Leave',0,a);assert.throws(()=>d.submitLeaveRequest(e,leave()));});
scenario('approval spends exact working days and records ledger',d=>{const r=d.submitLeaveRequest(e,leave({end_date:'2026-10-13'}));d.reviewLeaveRequest(r.id,'Approved',a);assert.equal(balance(d).used_days,2);assert.equal(d.getLeaveTransactions(e.id)[0].amount,-2);});
scenario('repeated approval cannot deduct twice',d=>{const r=d.submitLeaveRequest(e,leave());d.reviewLeaveRequest(r.id,'Approved',a);assert.throws(()=>d.reviewLeaveRequest(r.id,'Approved',a));assert.equal(balance(d).used_days,1);});
scenario('approval rechecks balance after another approval',d=>{d.adjustLeaveBalance(e.id,'Vacation Leave',1,a);const r=d.submitLeaveRequest(e,leave());const r2=d.submitLeaveRequest(e,leave({start_date:'2026-10-13',end_date:'2026-10-13'}));d.reviewLeaveRequest(r.id,'Approved',a);assert.throws(()=>d.reviewLeaveRequest(r2.id,'Approved',a));assert.equal(r2.status,'Pending');});
scenario('rejection leaves balance untouched',d=>{const r=d.submitLeaveRequest(e,leave());d.reviewLeaveRequest(r.id,'Rejected',a,'Audit');assert.equal(balance(d).used_days,0);});
scenario('approved cancellation restores balance once',d=>{const r=d.submitLeaveRequest(e,leave());d.reviewLeaveRequest(r.id,'Approved',a);d.cancelLeaveRequest(r.id,e,BEFORE_LEAVE);assert.equal(balance(d).used_days,0);assert.throws(()=>d.cancelLeaveRequest(r.id,e,BEFORE_LEAVE));assert.equal(balance(d).used_days,0);});
scenario('other employee cannot cancel request',d=>{const r=d.submitLeaveRequest(e,leave());assert.throws(()=>d.cancelLeaveRequest(r.id,other));});
scenario('employee sees only own requests',d=>{d.submitLeaveRequest(e,leave());d.submitLeaveRequest(other,leave());assert.equal(d.getLeaveRequests(e).length,1);});
scenario('admin cannot approve own leave',d=>{const r=d.submitLeaveRequest(a,leave());assert.throws(()=>d.reviewLeaveRequest(r.id,'Approved',a));});
scenario('unpaid approval does not charge paid balance',d=>{const r=d.submitLeaveRequest(e,leave({leave_type:'Unpaid Leave'}));d.reviewLeaveRequest(r.id,'Approved',a);assert.equal(balance(d).used_days,0);assert.equal(d.getLeaveTransactions(e.id)[0].amount,0);});
scenario('submission and review create notifications and audit trail',d=>{const r=d.submitLeaveRequest(e,leave());assert.ok(d.getNotifications(a.id).some(n=>n.title==='New Leave Request'));d.reviewLeaveRequest(r.id,'Approved',a);assert.ok(d.getNotifications(e.id).some(n=>n.title==='Leave Approved'));assert.ok(d.getAuditLogs().some(l=>l.action==='Leave approved'));});
scenario('other employees calendar hides leave type and reason',d=>{d.adjustLeaveBalance(e.id,'Medical Leave',10,a);const r=d.submitLeaveRequest(e,leave({leave_type:'Medical Leave',reason:'Synthetic private reason'}));d.reviewLeaveRequest(r.id,'Approved',a);const event=d.getCalendarEvents(other).find(x=>x.id===r.id);assert.equal(event.leave_type,'Out of Office');assert.equal(JSON.stringify(event).includes('Synthetic private reason'),false);});
scenario('state reload preserves requests and balances',d=>{const r=d.submitLeaveRequest(e,leave());d.reviewLeaveRequest(r.id,'Approved',a);const restarted=new HRDatabase(JSON.parse(JSON.stringify(d.exportState())));assert.equal(restarted.getLeaveRequests(e)[0].status,'Approved');assert.equal(balance(restarted).used_days,1);});
scenario('notification read flag persists',d=>{d.submitLeaveRequest(e,leave());const n=d.getNotifications(a.id)[0];d.markNotificationRead(n.id,a.id);assert.equal(new HRDatabase(d.exportState()).getNotifications(a.id)[0].read,true);});
scenario('sole active admin cannot be disabled',d=>assert.throws(()=>d.updateEmployee(a.id,{status:'disabled'},a)));
scenario('holiday approval credits only once',d=>{const h=holiday(d);const s=d.submitHolidayShiftRequest(e,{holiday_id:h.id,working_hours:'09:00-17:00'});d.reviewHolidayShiftRequest(s.id,'Approved',a);d.reviewHolidayShiftRequest(s.id,'Approved',a);assert.equal(balance(d,'Holiday Shift Credit').allocated_days,1);});
scenario('holiday cancellation reverses credit',d=>{const h=holiday(d);const s=d.submitHolidayShiftRequest(e,{holiday_id:h.id,working_hours:'09:00-17:00'});d.reviewHolidayShiftRequest(s.id,'Approved',a);d.cancelHolidayShiftRequest(s.id,e);assert.equal(balance(d,'Holiday Shift Credit').allocated_days,0);});

// Expected invariants: failures are reproducible audit findings, not test regressions introduced here.
scenario('half-day weekend must be rejected',d=>assert.throws(()=>d.submitLeaveRequest(e,leave({start_date:'2026-10-10',is_half_day:true}))));
scenario('half-day public holiday must be rejected',d=>{holiday(d);assert.throws(()=>d.submitLeaveRequest(e,leave({is_half_day:true})));});
scenario('impossible full-day date must be rejected',d=>assert.throws(()=>d.submitLeaveRequest(e,leave({start_date:'2026-02-30',end_date:'2026-02-30'}))));
scenario('invalid half-day date must be rejected',d=>assert.throws(()=>d.submitLeaveRequest(e,leave({start_date:'not-a-date',is_half_day:true}))));
scenario('invalid half-day period must be rejected',d=>assert.throws(()=>d.submitLeaveRequest(e,leave({is_half_day:true,half_day_period:'night'}))));
scenario('region-specific holiday does not reduce another regions days',d=>{holiday(d,{region:'Cebu',scope:'Region-specific'});assert.equal(d.calculateWorkingDays('2026-10-12','2026-10-13',e.country,e.region),2);});
scenario('holiday reapproval after rejection restores credit',d=>{const h=holiday(d);const s=d.submitHolidayShiftRequest(e,{holiday_id:h.id,working_hours:'09:00-17:00'});d.reviewHolidayShiftRequest(s.id,'Approved',a);d.reviewHolidayShiftRequest(s.id,'Rejected',a);d.reviewHolidayShiftRequest(s.id,'Approved',a);assert.equal(balance(d,'Holiday Shift Credit').allocated_days,1);});
scenario('company leave defaults apply to employee creation',d=>{d.updateCompanySettings({annual_leave_default:25,sick_leave_default:12});const n=d.createEmployee({full_name:'Defaults test',email:'defaults@example.test',phone:'',department:'Technology',job_title:'Employee',date_joined:'2026-01-01'},a);assert.equal(d.getLeaveBalances(n.id).find(b=>b.leave_type==='Vacation Leave')?.allocated_days,25);});
scenario('configured holiday credit rate is honored',d=>{d.updateCompanySettings({holiday_credit_rate:2});const h=holiday(d);const s=d.submitHolidayShiftRequest(e,{holiday_id:h.id,working_hours:'09:00-17:00'});d.reviewHolidayShiftRequest(s.id,'Approved',a);assert.equal(balance(d,'Holiday Shift Credit').allocated_days,2);});
scenario('employee display IDs remain unique after deletion',d=>{d.deleteEmployee(e.id,a);const n=d.createEmployee({full_name:'ID test',email:'id-test@example.test',phone:'',department:'Technology',job_title:'Employee',date_joined:'2026-01-01'},a);assert.notEqual(n.employee_id,other.employee_id);});
scenario('manual adjustment ledger equals actual allocation change',d=>{const before=balance(d).allocated_days;const r=d.manualBalanceAdjustment(e.id,'Vacation Leave',-100,'Synthetic audit',a);assert.equal(r.transaction.amount,r.balance.allocated_days-before);});


scenario('unsupported leave type rejected',d=>assert.throws(()=>d.submitLeaveRequest(e,leave({leave_type:'not-a-type'}))));
scenario('unbounded dates rejected',d=>assert.throws(()=>d.calculateWorkingDays('2026-01-01','2099-01-01')));
scenario('employee ID sequence persists across restarts',d=>{d.deleteEmployee(other.id,a);const reloaded=new HRDatabase(d.exportState());const n=reloaded.createEmployee({full_name:'Sequence',email:'sequence@example.test'},a);assert.equal(n.employee_id,'HR-103');});
scenario('holiday reversal uses historical rate, not updated policy',d=>{d.updateCompanySettings({holiday_credit_rate:2});const h=holiday(d);const s=d.submitHolidayShiftRequest(e,{holiday_id:h.id,working_hours:'9-5'});d.reviewHolidayShiftRequest(s.id,'Approved',a);d.updateCompanySettings({holiday_credit_rate:3});d.cancelHolidayShiftRequest(s.id,e);assert.equal(balance(d,'Holiday Shift Credit').allocated_days,0);assert.equal(d.getLeaveTransactions(e.id)[0].amount,-2);});
scenario('earned credit leave can be redeemed and refunded',d=>{const h=holiday(d);const s=d.submitHolidayShiftRequest(e,{holiday_id:h.id,working_hours:'9-5'});d.reviewHolidayShiftRequest(s.id,'Approved',a);const r=d.submitLeaveRequest(e,leave({leave_type:'Holiday Shift Credit',start_date:'2026-10-13',end_date:'2026-10-13'}));d.reviewLeaveRequest(r.id,'Approved',a);assert.equal(balance(d,'Holiday Shift Credit').used_days,1);assert.throws(()=>d.cancelHolidayShiftRequest(s.id,e));assert.equal(s.status,'Approved');d.cancelLeaveRequest(r.id,e,BEFORE_LEAVE);d.cancelHolidayShiftRequest(s.id,e);assert.equal(balance(d,'Holiday Shift Credit').allocated_days,0);});
scenario('assignment downgrade reverses credit and retains pending shift',d=>{const h=holiday(d);const s=d.assignHolidayShift(a,{employee_id:e.id,holiday_id:h.id,working_hours:'9-5'});d.assignHolidayShift(a,{employee_id:e.id,holiday_id:h.id,working_hours:'9-5',status:'Pending'});assert.equal(d.getHolidayShifts({holiday_id:h.id})[0].status,'Pending');assert.equal(balance(d,'Holiday Shift Credit').allocated_days,0);d.reviewHolidayShiftRequest(s.id,'Approved',a);assert.equal(balance(d,'Holiday Shift Credit').allocated_days,1);});
scenario('deleted holiday reverses outstanding credit',async d=>{const h=holiday(d);d.assignHolidayShift(a,{employee_id:e.id,holiday_id:h.id,working_hours:'9-5'});await d.deleteHoliday(h.id,a);assert.equal(balance(d,'Holiday Shift Credit').allocated_days,0);assert.equal(d.getHolidayShifts({holiday_id:h.id}).length,0);});
scenario('private attachment persists and has owner/admin authorization',d=>{const r=d.submitLeaveRequest(e,leave({attachment_name:'note.txt',attachment_data:'data:text/plain;base64,aGVsbG8='}));const id=r.attachment_url.split('/').pop();const reloaded=new HRDatabase(d.exportState());assert.equal(reloaded.getLeaveAttachment(id,e).bytes.toString(),'hello');assert.equal(reloaded.getLeaveAttachment(id,a).bytes.toString(),'hello');assert.throws(()=>reloaded.getLeaveAttachment(id,other));assert.equal(JSON.stringify(reloaded.getLeaveRequests(e)).includes('aGVsbG8='),false);});
scenario('missing and unsafe attachments rejected',d=>{assert.throws(()=>d.submitLeaveRequest(e,leave({attachment_name:'missing.pdf'})));assert.throws(()=>decodeUpload('data:text/html;base64,aGVsbG8='));assert.throws(()=>decodeUpload({data:'invalid'}));assert.throws(()=>decodeUpload('data:text/plain;base64,aGVsbG8'));});
scenario('allocation floor and ledger remain consistent with used days',d=>{const r=d.submitLeaveRequest(e,leave());d.reviewLeaveRequest(r.id,'Approved',a);const result=d.manualBalanceAdjustment(e.id,'Vacation Leave',-100,'Floor check',a);assert.equal(result.balance.allocated_days,1);assert.equal(result.transaction.amount,-19);assert.throws(()=>d.adjustLeaveBalance(e.id,'Vacation Leave',0,a));});
scenario('all coverage nesting redacts private details but preserves own/admin access',d=>{d.adjustLeaveBalance(e.id,'Medical Leave',10,a);const r=d.submitLeaveRequest(e,leave({leave_type:'Medical Leave',reason:'PRIVATE-REASON',attachment_name:'note.txt',attachment_data:'data:text/plain;base64,aGVsbG8='}));d.reviewLeaveRequest(r.id,'Approved',a,'PRIVATE-NOTE');const h=holiday(d);const raw=d.getHolidayStaffingCoverage(h.id);const text=JSON.stringify(visibleCoverage(raw,other));for(const secret of ['PRIVATE-REASON','PRIVATE-NOTE','note.txt',r.attachment_url,'Medical Leave'])assert.equal(text.includes(secret),false);assert.ok(JSON.stringify(visibleCoverage(raw,e)).includes('PRIVATE-REASON'));assert.ok(JSON.stringify(visibleCoverage(raw,a)).includes('PRIVATE-REASON'));});
scenario('invalid policy values rejected',d=>{assert.throws(()=>d.updateCompanySettings({holiday_credit_rate:NaN}));assert.throws(()=>d.updateCompanySettings({annual_leave_default:-1}));assert.equal(d.getCompanySettings().email_notifications_enabled,false);});
test('CSV quotes delimiters and neutralizes formula prefixes',()=>{assert.equal(csvCell('a,"b"\nc'),'"a,""b""\nc"');for(const value of ['=1+1',' +SUM(A1)','-1+2','@SUM(A1)','\t=1','\rtest'])assert.ok(csvCell(value).startsWith('"\''));assert.equal(csvRow(['safe',-2]),'"safe","-2"');});

scenario('configured workweek applies to both full and half days',d=>{d.updateCompanySettings({workweek:'Monday to Saturday'});assert.equal(d.calculateWorkingDays('2026-10-10','2026-10-10',e.country),1);assert.equal(d.submitLeaveRequest(e,leave({start_date:'2026-10-10',is_half_day:true})).total_days,0.5);assert.throws(()=>d.updateCompanySettings({workweek:'whenever'}));});

scenario('a new zero credit allocation can be saved',d=>{assert.equal(d.adjustLeaveBalance(e.id,'Holiday Shift Credit',0,a).allocated_days,0);});

scenario('Philippines new accounts receive zero sick emergency medical defaults regardless of holiday calendar',d=>{const ph=d.createEmployee({full_name:'PH defaults',email:'ph-defaults@example.test',country:'Philippines',holiday_calendar:'United States',sick_leave_days:10},a);const rows=d.getLeaveBalances(ph.id);for(const type of ['Sick Leave','Emergency Leave','Medical Leave'])assert.equal(rows.find(b=>b.leave_type===type).allocated_days,0);assert.equal(rows.find(b=>b.leave_type==='Vacation Leave').allocated_days,20);const ca=d.createEmployee({full_name:'CA defaults',email:'ca-defaults@example.test',country:'Canada',holiday_calendar:'Philippines'},a);assert.equal(d.getLeaveBalances(ca.id).find(b=>b.leave_type==='Sick Leave').allocated_days,10);assert.equal(d.getLeaveBalances(ca.id).find(b=>b.leave_type==='Emergency Leave').allocated_days,5);assert.equal(d.getLeaveBalances(ca.id).find(b=>b.leave_type==='Medical Leave').allocated_days,10);});

scenario('half-day holiday credit persists and approval cancellation uses exact historical amount',d=>{const h=holiday(d);d.updateCompanySettings({holiday_credit_rate:2});const s=d.submitHolidayShiftRequest(e,{holiday_id:h.id,working_hours:'Half day morning 9-1',shift_days:0.5});assert.equal(s.shift_days,0.5);assert.equal(d.getLeaveBalances(e.id).some(b=>b.leave_type==='Holiday Shift Credit'),false);const saved=new HRDatabase(d.exportState());saved.reviewHolidayShiftRequest(s.id,'Approved',a);saved.reviewHolidayShiftRequest(s.id,'Approved',a);assert.equal(balance(saved,'Holiday Shift Credit').allocated_days,1);saved.updateCompanySettings({holiday_credit_rate:3});saved.cancelHolidayShiftRequest(s.id,e);assert.equal(balance(saved,'Holiday Shift Credit').allocated_days,0);assert.throws(()=>d.submitHolidayShiftRequest(e,{holiday_id:h.id,working_hours:'invalid',shift_days:0.25}),/full-day or half-day/);});

scenario('historical usage restores total while preserving remaining and other balances',d=>{
 d.adjustLeaveBalance(e.id,'Sick Leave',3,a);
 const vacation=structuredClone(balance(d));
 const result=d.recordHistoricalLeaveUsage(e.id,'Sick Leave',4,1,'Previously taken leave; allowance reduced manually',{allocated_days:3,used_days:0},a);
 assert.equal(result.allocated_days,4); assert.equal(result.used_days,1); assert.equal(result.allocated_days-result.used_days,3);
 assert.deepEqual(balance(d),vacation);
 assert.equal(d.getLeaveTransactions(e.id)[0].amount,0);
 assert.match(d.getLeaveTransactions(e.id)[0].description,/used 0 → 1/);
 assert.ok(d.getAuditLogs().some(l=>l.action==='Historical leave usage recorded'));
 assert.throws(()=>d.recordHistoricalLeaveUsage(e.id,'Sick Leave',4,1,'Repeated save',{allocated_days:3,used_days:0},a),/changed/);
 const reload=new HRDatabase(d.exportState()); assert.equal(balance(reload,'Sick Leave').used_days,1);
});
scenario('historical corrections validate before mutation and require admin',d=>{
 const before=structuredClone(balance(d)); const expected={allocated_days:before.allocated_days,used_days:before.used_days};
 for(const [total,days,reason] of [[20,NaN,'test'],[20,0,'test'],[20,-1,'test'],[20,0.2,'test'],[0,1,'test'],[20,1,' ']])
  assert.throws(()=>d.recordHistoricalLeaveUsage(e.id,'Vacation Leave',total,days,reason,expected,a));
 assert.throws(()=>d.recordHistoricalLeaveUsage(e.id,'Vacation Leave',20,1,'test',expected,e),/Administrator/);
 assert.deepEqual(balance(d),before);
});
scenario('cancelling approved request preserves separately recorded historical usage',d=>{
 const r=d.submitLeaveRequest(e,leave());d.reviewLeaveRequest(r.id,'Approved',a);
 const b=balance(d);d.recordHistoricalLeaveUsage(e.id,'Vacation Leave',b.allocated_days,0.5,'Historical half-day',{allocated_days:b.allocated_days,used_days:b.used_days},a);
 d.cancelLeaveRequest(r.id,e,BEFORE_LEAVE);assert.equal(balance(d).used_days,0.5);
});

// --- Audit fixes ---
scenario('employee cannot refund approved leave that has started; HR still can',d=>{
 const r=d.submitLeaveRequest(e,leave());d.reviewLeaveRequest(r.id,'Approved',a);
 assert.throws(()=>d.cancelLeaveRequest(r.id,e,'2026-10-12'),/already started/);
 assert.throws(()=>d.cancelLeaveRequest(r.id,e,'2026-11-07'),/already started/);
 assert.equal(balance(d).used_days,1);assert.equal(r.status,'Approved');
 d.cancelLeaveRequest(r.id,a,'2026-11-07');assert.equal(r.status,'Cancelled');assert.equal(balance(d).used_days,0);
});
scenario('pending leave in the past can still be withdrawn by the employee',d=>{
 const r=d.submitLeaveRequest(e,leave());d.cancelLeaveRequest(r.id,e,'2026-11-07');assert.equal(r.status,'Cancelled');
});
scenario('admins are notified when an employee cancels approved future leave',d=>{
 const r=d.submitLeaveRequest(e,leave());d.reviewLeaveRequest(r.id,'Approved',a);d.cancelLeaveRequest(r.id,e,BEFORE_LEAVE);
 const notice=d.getNotifications(a.id).find(n=>n.title==='Approved Leave Cancelled');
 assert.ok(notice);assert.equal(notice.request_id,r.id);assert.equal(notice.link_tab,'leave-requests');
 assert.equal(d.getNotifications(e.id).some(n=>n.title==='Approved Leave Cancelled'),false);
});
scenario('overlong leave reasons are rejected before saving',d=>{
 assert.throws(()=>d.submitLeaveRequest(e,leave({reason:'x'.repeat(5001)})),/under 5000/);
 assert.equal(d.submitLeaveRequest(e,leave({reason:'x'.repeat(5000)})).status,'Pending');
});
scenario('failed sign-ins are audited once per account window, plus lockout',d=>{
 const before=d.getAuditLogs().length;
 for(let i=0;i<25;i++)assert.throws(()=>d.authenticate('typo@example.test','wrong','office'));
 const rows=d.getAuditLogs().slice(0,d.getAuditLogs().length-before);
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.action==='Sign-in failed'));assert.ok(rows.some(r=>/temporarily locked/.test(r.details)));
});
scenario('failed sign-ins with many invented emails cannot flood the audit log',d=>{
 const before=d.getAuditLogs().length;
 for(let i=0;i<200;i++)assert.throws(()=>d.authenticate(`random-${i}@example.test`,'wrong','attacker'));
 assert.equal(d.getAuditLogs().length-before,26);
 assert.ok(d.getAuditLogs().some(r=>/not logged individually/.test(r.details)));
});
scenario('employee edits ignore unknown fields but keep supported ones',d=>{
 const u=d.updateEmployee(e.id,{job_title:'Senior Agent',is_pc:true,unexpected:'value',leave_balances:[]},a);
 assert.equal(u.job_title,'Senior Agent');assert.equal(u.is_pc,true);assert.equal('unexpected' in u,false);assert.equal('leave_balances' in u,false);
 assert.throws(()=>d.updateEmployee(e.id,{passwordHash:'x'},a),/cannot be changed/);
});
scenario('company settings ignore unknown keys, keep types and are audited',d=>{
 const saved=d.updateCompanySettings({...d.getCompanySettings(),company_name:'GO Test',injected:'x'},a);
 assert.equal(saved.company_name,'GO Test');assert.equal('injected' in saved,false);
 assert.throws(()=>d.updateCompanySettings({browser_notifications_enabled:'yes'},a),/Invalid value/);
 assert.ok(d.getAuditLogs().some(l=>l.action==='Company settings updated'&&/company_name/.test(l.details)));
});
scenario('holidays require valid dates; unchanged legacy values can still be re-saved',d=>{
 assert.throws(()=>holiday(d,{date:'not-a-date'}),/valid holiday date/);
 assert.throws(()=>holiday(d,{date:'2026-02-30'}),/valid holiday date/);
 const h=holiday(d);(d.holidays.find(x=>x.id===h.id)).date='legacy';
 assert.equal(d.updateHoliday(h.id,{name:'Renamed',date:'legacy'},a).name,'Renamed');
 assert.throws(()=>d.updateHoliday(h.id,{date:'13/10/2026'},a),/valid holiday date/);
});
scenario('employee document upload and deletion are audited',d=>{
 const doc=d.addEmployeeDocument({employee_id:e.id,name:'Contract',category:'Contract',file_size:'5 Bytes',file_data:'data:text/plain;base64,aGVsbG8=',uploaded_by_name:a.full_name},a);
 assert.ok(d.getAuditLogs().some(l=>l.action==='Employee document uploaded'&&l.target_id===doc.id));
 assert.equal(d.deleteEmployeeDocument(e.id,doc.id,a),true);
 assert.ok(d.getAuditLogs().some(l=>l.action==='Employee document deleted'&&l.target_id===doc.id));
});
scenario('deleting an employee removes their notifications and celebration records',d=>{
 const r=d.submitLeaveRequest(e,leave());d.reviewLeaveRequest(r.id,'Approved',a);
 d.setBirthdayVisibility(e,e.id,false);
 d.celebrationReactions.push({id:'x:'+e.id,celebration_id:'x',user_id:e.id,emoji:'🎉'},{id:e.id+':birthday:2026-10-12:'+other.id,celebration_id:e.id+':birthday:2026-10-12',user_id:other.id,emoji:'🎉'});
 d.announcementReceipts.push({id:'receipt',announcement_id:'a',user_id:e.id,revision:1,read_at:'2026-01-01',acknowledged_at:null});
 return d.deleteEmployee(e.id,a).then(()=>{
  const state=d.exportState();
  assert.equal(state.notifications.some(n=>n.user_id===e.id),false);
  assert.equal(state.celebrationPreferences.some(p=>p.id===e.id),false);
  assert.equal(state.celebrationReactions.length,0);
  assert.equal(state.announcementReceipts.length,0);
  assert.ok(state.leaveTransactions.some(t=>t.employee_id===e.id),'leave ledger kept as HR history');
 });
});

// --- Admin powers ---
scenario('HR cancels approved leave already taken: balance restored, reason recorded, employee notified',d=>{
 const r=d.submitLeaveRequest(e,leave());d.reviewLeaveRequest(r.id,'Approved',a);
 const c=d.cancelLeaveRequest(r.id,a,'2026-11-07','Employee worked that day');
 assert.equal(c.status,'Cancelled');assert.equal(balance(d).used_days,0);
 assert.equal(c.cancelled_by,a.id);assert.equal(c.cancellation_reason,'Employee worked that day');
 const notice=d.getNotifications(e.id).find(n=>n.title==='Leave Cancelled by HR');
 assert.ok(notice);assert.match(notice.message,/1 day\(s\) were returned/);assert.match(notice.message,/Employee worked that day/);
 assert.ok(d.getAuditLogs().some(l=>l.action==='Leave request cancelled'&&/Employee worked that day/.test(l.details)));
});
scenario('cancellation reasons are validated and employees cancelling their own leave get no HR notice',d=>{
 const r=d.submitLeaveRequest(e,leave());d.reviewLeaveRequest(r.id,'Approved',a);
 assert.throws(()=>d.cancelLeaveRequest(r.id,a,BEFORE_LEAVE,'x'.repeat(1001)),/1000 characters/);
 assert.equal(r.status,'Approved');
 d.cancelLeaveRequest(r.id,e,BEFORE_LEAVE);
 assert.equal(d.getNotifications(e.id).some(n=>n.title==='Leave Cancelled by HR'),false);
});
scenario('HR password reset lifts a sign-in lockout immediately',d=>{
 for(let i=0;i<20;i++)assert.throws(()=>d.authenticate(e.email,'wrong-password','home'));
 assert.throws(()=>d.authenticate(e.email,'Isolated-Employee-Temp-938!','home'),e=>e.code==='LOGIN_THROTTLED');
 d.adminResetPassword(e.id,'Fresh-Temporary-Pass-1',a);
 assert.equal(d.authenticate(e.email,'Fresh-Temporary-Pass-1','home').user.id,e.id);
});
