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
scenario('approved cancellation restores balance once',d=>{const r=d.submitLeaveRequest(e,leave());d.reviewLeaveRequest(r.id,'Approved',a);d.cancelLeaveRequest(r.id,e);assert.equal(balance(d).used_days,0);assert.throws(()=>d.cancelLeaveRequest(r.id,e));assert.equal(balance(d).used_days,0);});
scenario('other employee cannot cancel request',d=>{const r=d.submitLeaveRequest(e,leave());assert.throws(()=>d.cancelLeaveRequest(r.id,other));});
scenario('employee sees only own requests',d=>{d.submitLeaveRequest(e,leave());d.submitLeaveRequest(other,leave());assert.equal(d.getLeaveRequests(e).length,1);});
scenario('admin cannot approve own leave',d=>{const r=d.submitLeaveRequest(a,leave());assert.throws(()=>d.reviewLeaveRequest(r.id,'Approved',a));});
scenario('unpaid approval does not charge paid balance',d=>{const r=d.submitLeaveRequest(e,leave({leave_type:'Unpaid Leave'}));d.reviewLeaveRequest(r.id,'Approved',a);assert.equal(balance(d).used_days,0);assert.equal(d.getLeaveTransactions(e.id)[0].amount,0);});
scenario('submission and review create notifications and audit trail',d=>{const r=d.submitLeaveRequest(e,leave());assert.ok(d.getNotifications(a.id).some(n=>n.title==='New Leave Request'));d.reviewLeaveRequest(r.id,'Approved',a);assert.ok(d.getNotifications(e.id).some(n=>n.title==='Leave Approved'));assert.ok(d.getAuditLogs().some(l=>l.action==='Leave approved'));});
scenario('other employees calendar hides leave type and reason',d=>{const r=d.submitLeaveRequest(e,leave({leave_type:'Medical Leave',reason:'Synthetic private reason'}));d.reviewLeaveRequest(r.id,'Approved',a);const event=d.getCalendarEvents(other).find(x=>x.id===r.id);assert.equal(event.leave_type,'Out of Office');assert.equal(JSON.stringify(event).includes('Synthetic private reason'),false);});
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
scenario('earned credit leave can be redeemed and refunded',d=>{const h=holiday(d);const s=d.submitHolidayShiftRequest(e,{holiday_id:h.id,working_hours:'9-5'});d.reviewHolidayShiftRequest(s.id,'Approved',a);const r=d.submitLeaveRequest(e,leave({leave_type:'Holiday Shift Credit',start_date:'2026-10-13',end_date:'2026-10-13'}));d.reviewLeaveRequest(r.id,'Approved',a);assert.equal(balance(d,'Holiday Shift Credit').used_days,1);assert.throws(()=>d.cancelHolidayShiftRequest(s.id,e));assert.equal(s.status,'Approved');d.cancelLeaveRequest(r.id,e);d.cancelHolidayShiftRequest(s.id,e);assert.equal(balance(d,'Holiday Shift Credit').allocated_days,0);});
scenario('assignment downgrade reverses credit and retains pending shift',d=>{const h=holiday(d);const s=d.assignHolidayShift(a,{employee_id:e.id,holiday_id:h.id,working_hours:'9-5'});d.assignHolidayShift(a,{employee_id:e.id,holiday_id:h.id,working_hours:'9-5',status:'Pending'});assert.equal(d.getHolidayShifts({holiday_id:h.id})[0].status,'Pending');assert.equal(balance(d,'Holiday Shift Credit').allocated_days,0);d.reviewHolidayShiftRequest(s.id,'Approved',a);assert.equal(balance(d,'Holiday Shift Credit').allocated_days,1);});
scenario('deleted holiday reverses outstanding credit',async d=>{const h=holiday(d);d.assignHolidayShift(a,{employee_id:e.id,holiday_id:h.id,working_hours:'9-5'});await d.deleteHoliday(h.id,a);assert.equal(balance(d,'Holiday Shift Credit').allocated_days,0);assert.equal(d.getHolidayShifts({holiday_id:h.id}).length,0);});
scenario('private attachment persists and has owner/admin authorization',d=>{const r=d.submitLeaveRequest(e,leave({attachment_name:'note.txt',attachment_data:'data:text/plain;base64,aGVsbG8='}));const id=r.attachment_url.split('/').pop();const reloaded=new HRDatabase(d.exportState());assert.equal(reloaded.getLeaveAttachment(id,e).bytes.toString(),'hello');assert.equal(reloaded.getLeaveAttachment(id,a).bytes.toString(),'hello');assert.throws(()=>reloaded.getLeaveAttachment(id,other));assert.equal(JSON.stringify(reloaded.getLeaveRequests(e)).includes('aGVsbG8='),false);});
scenario('missing and unsafe attachments rejected',d=>{assert.throws(()=>d.submitLeaveRequest(e,leave({attachment_name:'missing.pdf'})));assert.throws(()=>decodeUpload('data:text/html;base64,aGVsbG8='));assert.throws(()=>decodeUpload({data:'invalid'}));assert.throws(()=>decodeUpload('data:text/plain;base64,aGVsbG8'));});
scenario('allocation floor and ledger remain consistent with used days',d=>{const r=d.submitLeaveRequest(e,leave());d.reviewLeaveRequest(r.id,'Approved',a);const result=d.manualBalanceAdjustment(e.id,'Vacation Leave',-100,'Floor check',a);assert.equal(result.balance.allocated_days,1);assert.equal(result.transaction.amount,-19);assert.throws(()=>d.adjustLeaveBalance(e.id,'Vacation Leave',0,a));});
scenario('all coverage nesting redacts private details but preserves own/admin access',d=>{const r=d.submitLeaveRequest(e,leave({leave_type:'Medical Leave',reason:'PRIVATE-REASON',attachment_name:'note.txt',attachment_data:'data:text/plain;base64,aGVsbG8='}));d.reviewLeaveRequest(r.id,'Approved',a,'PRIVATE-NOTE');const h=holiday(d);const raw=d.getHolidayStaffingCoverage(h.id);const text=JSON.stringify(visibleCoverage(raw,other));for(const secret of ['PRIVATE-REASON','PRIVATE-NOTE','note.txt',r.attachment_url,'Medical Leave'])assert.equal(text.includes(secret),false);assert.ok(JSON.stringify(visibleCoverage(raw,e)).includes('PRIVATE-REASON'));assert.ok(JSON.stringify(visibleCoverage(raw,a)).includes('PRIVATE-REASON'));});
scenario('invalid policy values rejected',d=>{assert.throws(()=>d.updateCompanySettings({holiday_credit_rate:NaN}));assert.throws(()=>d.updateCompanySettings({annual_leave_default:-1}));assert.equal(d.getCompanySettings().email_notifications_enabled,false);});
test('CSV quotes delimiters and neutralizes formula prefixes',()=>{assert.equal(csvCell('a,"b"\nc'),'"a,""b""\nc"');for(const value of ['=1+1',' +SUM(A1)','-1+2','@SUM(A1)','\t=1','\rtest'])assert.ok(csvCell(value).startsWith('"\''));assert.equal(csvRow(['safe',-2]),'"safe","-2"');});

scenario('configured workweek applies to both full and half days',d=>{d.updateCompanySettings({workweek:'Monday to Saturday'});assert.equal(d.calculateWorkingDays('2026-10-10','2026-10-10',e.country),1);assert.equal(d.submitLeaveRequest(e,leave({start_date:'2026-10-10',is_half_day:true})).total_days,0.5);assert.throws(()=>d.updateCompanySettings({workweek:'whenever'}));});

scenario('a new zero credit allocation can be saved',d=>{assert.equal(d.adjustLeaveBalance(e.id,'Holiday Shift Credit',0,a).allocated_days,0);});
