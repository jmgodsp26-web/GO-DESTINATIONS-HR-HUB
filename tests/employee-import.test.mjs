import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HRDatabase, verifyPassword } from '../server/db.ts';
import { parseEmployeeSheet, importPreview, importErrors } from '../src/utils/employeeImport.ts';
const row = {full_name:'Example employee',email:'example@example.test',department:'Technology',job_title:'Developer',country:'Philippines',holiday_calendar:'United States',phone:'',date_joined:'2024-01-01',date_of_birth:'',role:'employee',annual_leave_days:0,sick_leave_days:0};
function database() {process.env.INITIAL_ADMIN_EMAIL='import-admin@example.test';process.env.INITIAL_ADMIN_PASSWORD='Synthetic-Only-12345'; const db=HRDatabase.bootstrap(); return {db,admin:db.getAllEmployees()[0]};}
test('spreadsheet parser reads headings below notes, dates, admin marker, and ignores passwords and notes',()=>{
 const result=parseEmployeeSheet([['Title'],['','Name','Email Address','Department','Position','Location','Start Date','Birthdate','Password'],['Admin','Example employee',' Example@Example.test ','Technology','Developer','PH',new Date('2024-01-01'),'','DO_NOT_IMPORT'],[null,null,null,null,null,null,null,null,null,'PTO policy note']]);
 assert.equal(result.length,1);assert.equal(result[0].role,'admin');assert.equal(result[0].country,'Philippines');assert.equal(result[0].date_joined,'2024-01-01');assert.equal(result[0].email,'example@example.test');assert.equal('password' in result[0],false);
 assert.throws(()=>parseEmployeeSheet([['Name'],['X']]));
});
test('duplicates normalized across names and emails; unsupported countries and invalid dates blocked',()=>{
 const preview=importPreview([row,{...row,email:'second@example.test',full_name:' EXAMPLE   EMPLOYEE '},{...row,full_name:'Other',email:'EXAMPLE@EXAMPLE.TEST'}],[]);
 assert.equal(preview.filter(r=>!r.skip).length,1);
 assert.ok(importPreview([row],[{full_name:'Example employee',email:'old@example.test'}])[0].skip);
 assert.ok(importErrors({...row,country:'South Africa'}).length);
 assert.ok(importErrors({...row,date_joined:'2026-02-30'}).length);
 assert.ok(importErrors({...row,annual_leave_days:-1}).length);
});
test('import preserves existing credentials, enforces admin and validates whole batch before mutation',()=>{
 const {db,admin}=database();const before=db.exportState().users[0].passwordHash;
 assert.throws(()=>db.importEmployees([row],'Synthetic-Only-12345',{...admin,role:'employee'}),/Administrator/);
 assert.throws(()=>db.importEmployees([row],'short',admin));
 assert.throws(()=>db.importEmployees([row,{...row,email:'bad',full_name:'Bad'}],'Synthetic-Only-12345',admin));
 assert.equal(db.getAllEmployees().length,1);
 const result=db.importEmployees([row,{...row,email:'next@example.test',full_name:'New administrator',role:'admin'}],'Synthetic-Only-12345',admin);
 assert.equal(result.filter(r=>r.status==='created').length,2);
 const state=db.exportState();assert.equal(state.users[0].passwordHash,before);
 for(const u of state.users.slice(1)){assert.equal(u.mustChangePassword,true);assert.ok(verifyPassword('Synthetic-Only-12345',u.passwordHash));}
 assert.equal(state.users[2].profile.role,'admin');
 assert.equal(JSON.stringify(result).includes('Synthetic-Only'),false);
 assert.equal(db.importEmployees([row],'Different-Password-123',admin)[0].status,'skipped');
 assert.equal(db.getAllEmployees().length,3);
 assert.equal(db.exportState().users[1].passwordHash,state.users[1].passwordHash);
});
