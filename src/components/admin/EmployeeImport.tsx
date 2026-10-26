import React, { useMemo, useRef, useState } from 'react';
import { Dialog } from '../common/Dialog';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { api } from '../../services/api';
import { importCountries, importPreview, parseEmployeeSheet, type ImportEmployee } from '../../utils/employeeImport';

type Result = { email:string; full_name:string; status:'created'|'skipped'; message?:string };
export function EmployeeImport({existing, onClose, onComplete}:{existing:{full_name:string;email:string}[];onClose:()=>void;onComplete:()=>void}) {
  const [rows,setRows] = useState<ImportEmployee[]>([]), [directory,setDirectory] = useState(existing);
  const [password,setPassword] = useState(''), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  const [fileName,setFileName] = useState(''), [results,setResults] = useState<Result[]>([]), [reviewed,setReviewed] = useState(false);
  const [vacation,setVacation] = useState(0), [sick,setSick] = useState(0), [progress,setProgress] = useState('');
  const inFlight = useRef(false);
  const canClose = useUnsavedChanges(rows.length > 0 && results.length === 0, busy);
  const preview = useMemo(()=>importPreview(rows,directory),[rows,directory]);
  const ready = preview.filter(p=>!p.skip && !p.errors.length), invalid = preview.filter(p=>p.errors.length);
  const update = (index:number, changes:Partial<ImportEmployee>) => {setReviewed(false); setRows(all=>all.map((r,i)=>i===index?{...r,...changes}:r));};
  const inputClass = 'w-full min-w-32 rounded-lg border border-slate-300 bg-white p-2 text-sm';
  async function load(file?:File) {
    if (!file) return;
    setError('');setResults([]);setPassword('');setReviewed(false);setRows([]);setFileName('');
    if (!/\.xlsx$/i.test(file.name) || file.size > 5*1024*1024) {setError('Choose an .xlsx workbook smaller than 5 MB.');return;}
    setBusy(true);
    try {
      const {readSheet} = await import('read-excel-file/browser');
      const grid = await readSheet(file,1);
      setRows(parseEmployeeSheet(grid));setFileName(file.name);
      setDirectory(await api.getAllEmployees());
    } catch(e:any) {setError(e.message || 'Unable to read this workbook.');} finally {setBusy(false);}
  }
  async function submit() {
    if(inFlight.current || !reviewed || invalid.length || !ready.length) return;
    inFlight.current=true;setBusy(true);setError('');
    try {
      const fresh = await api.getAllEmployees();setDirectory(fresh);
      const remaining = importPreview(rows,fresh).filter(p=>!p.skip);
      if (remaining.some(p=>p.errors.length)) throw new Error('Correct the highlighted rows before importing.');
      for(let offset=0;offset<remaining.length;offset+=5) {
        setProgress(`Saving ${offset+1}–${Math.min(offset+5,remaining.length)} of ${remaining.length} employees…`);
        const response = await api.importEmployees(remaining.slice(offset,offset+5).map(p=>p.row),password);
        setResults(all=>[...all,...response.results]);
        // Completed rows become existing immediately; a retry also refreshes the server directory.
        setDirectory(all=>[...all,...response.results.map(r=>({email:r.email,full_name:r.full_name}))]);
      }
      setProgress('Import finished. Existing accounts were left unchanged.');setReviewed(false);onComplete();
    } catch(e:any) {setError((e.message || 'Import interrupted.')+' Completed batches stay saved. Review the directory and retry; existing accounts will be skipped.');setProgress('Import paused.');onComplete();}
    finally {setPassword('');setBusy(false);inFlight.current=false;}
  }
  return <Dialog title="Import employees" busy={busy} onClose={()=>{if(canClose())onClose();}} className="max-w-6xl w-[96vw]">
    <div className="p-5 space-y-5">
      <p className="text-sm text-slate-600">Upload an Excel workbook, review the first worksheet, then create new accounts together. Existing names or emails are skipped—including disabled accounts. Existing profiles, passwords and leave balances are never overwritten.</p>
      <label className="block font-semibold text-sm">Employee workbook (.xlsx, first worksheet only)
        <input className="block mt-2 w-full border rounded-lg p-3" type="file" accept=".xlsx" disabled={busy} onChange={e=>void load(e.target.files?.[0])}/>
      </label>
      <p className="text-xs text-slate-500">Columns: Name, Email Address, Position, Department, Location, Start Date, Birthdate, Phone Number. Optional: Role, Holiday Calendar, Vacation Days, Sick Days. Blank passwords and worksheet policy notes are not imported. An “Admin” marker in the first unlabeled column is recognized.</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800 text-sm">{error}</p>}
      {rows.length>0 && <>
        <div className="rounded-xl bg-slate-50 border p-4 space-y-3">
          <p className="font-semibold">{fileName} · {rows.length} rows · {ready.length} ready · {preview.filter(p=>p.skip).length} skipped · {invalid.length} need correction</p>
          <p className="text-sm">Leave values below are opening allowances, with no used days recorded. Missing allowances start at 0 until you set them. Review these temporary values before import.</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">Vacation days<input aria-label="Default vacation days" className={inputClass} type="number" min="0" max="366" value={vacation} disabled={busy} onChange={e=>setVacation(Number(e.target.value))}/></label>
            <label className="text-sm">Sick days<input aria-label="Default sick days" className={inputClass} type="number" min="0" max="366" value={sick} disabled={busy} onChange={e=>setSick(Number(e.target.value))}/></label>
            <button type="button" className="border rounded-lg p-2 text-sm font-semibold" disabled={busy} onClick={()=>{setRows(all=>all.map(r=>({...r,annual_leave_days:vacation,sick_leave_days:sick})));setReviewed(false);}}>Apply to new rows</button>
            <button type="button" className="border rounded-lg p-2 text-sm font-semibold" disabled={busy} onClick={()=>{setRows(all=>all.map(r=>r.country.toLowerCase()==='south africa'?{...r,country:'United States',holiday_calendar:'United States'}:r));setReviewed(false);}}>Use US temporarily for South Africa</button>
          </div>
        </div>
        <div className="max-h-[42vh] overflow-auto border rounded-xl" tabIndex={0} aria-label="Employee import preview">
          <table className="w-full text-sm"><thead className="bg-slate-100 sticky top-0"><tr>{['Employee / email','Department / title','Country / calendar','Role / leave','Review'].map(h=><th key={h} className="p-3 text-left">{h}</th>)}</tr></thead>
            <tbody>{preview.map(({row,skip,errors},i)=><React.Fragment key={i}><tr className="border-t align-top"><td className="p-2 space-y-2">
              <input aria-label={`Name row ${i+1}`} className={inputClass} value={row.full_name} disabled={busy||!!skip} onChange={e=>update(i,{full_name:e.target.value})}/>
              <input aria-label={`Email row ${i+1}`} className={inputClass} value={row.email} disabled={busy||!!skip} onChange={e=>update(i,{email:e.target.value.trim().toLowerCase()})}/>
              <details><summary className="cursor-pointer text-slate-600">Dates and phone</summary><label>Hire date<input type="date" className={inputClass} value={row.date_joined} disabled={busy||!!skip} onChange={e=>update(i,{date_joined:e.target.value})}/></label><label>Birthdate<input type="date" className={inputClass} value={row.date_of_birth} disabled={busy||!!skip} onChange={e=>update(i,{date_of_birth:e.target.value})}/></label><label>Phone<input className={inputClass} value={row.phone} disabled={busy||!!skip} onChange={e=>update(i,{phone:e.target.value})}/></label></details>
            </td><td className="p-2 space-y-2"><input aria-label={`Department row ${i+1}`} className={inputClass} value={row.department} disabled={busy||!!skip} onChange={e=>update(i,{department:e.target.value})}/><input aria-label={`Job title row ${i+1}`} className={inputClass} value={row.job_title} disabled={busy||!!skip} onChange={e=>update(i,{job_title:e.target.value})}/></td>
            <td className="p-2 space-y-2">{(['country','holiday_calendar'] as const).map(key=><select key={key} aria-label={`${key==='country'?'Country':'Holiday calendar'} row ${i+1}`} className={inputClass} value={row[key]} disabled={busy||!!skip} onChange={e=>update(i,{[key]:e.target.value})}>{!importCountries.includes(row[key])&&<option value={row[key]}>{row[key]||'Select'} — choose country</option>}{importCountries.map(c=><option key={c}>{c}</option>)}</select>)}</td>
            <td className="p-2 space-y-2"><select aria-label={`Role row ${i+1}`} className={inputClass} value={row.role} disabled={busy||!!skip} onChange={e=>update(i,{role:e.target.value as ImportEmployee['role']})}><option value="employee">Employee</option><option value="admin">Admin — full HR access</option></select><label className="block">Vacation<input aria-label={`Vacation days row ${i+1}`} className={inputClass} type="number" min="0" max="366" value={row.annual_leave_days} disabled={busy||!!skip} onChange={e=>update(i,{annual_leave_days:Number(e.target.value)})}/></label><label className="block">Sick<input aria-label={`Sick days row ${i+1}`} className={inputClass} type="number" min="0" max="366" value={row.sick_leave_days} disabled={busy||!!skip} onChange={e=>update(i,{sick_leave_days:Number(e.target.value)})}/></label></td>
            <td className={`p-3 min-w-40 ${errors.length?'text-red-700':'text-slate-600'}`}>{skip||errors.join('; ')||'Ready'}</td></tr></React.Fragment>)}</tbody></table>
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-semibold">Temporary password for new accounts<input className={inputClass+' block mt-1 max-w-md'} type="password" autoComplete="new-password" minLength={12} value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label>
          <p className="text-xs text-slate-600">At least 12 characters. Employees must change it at first sign-in. It is not stored in your browser or included in import results. No invitation emails are sent.</p>
          <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={reviewed} disabled={busy} onChange={e=>setReviewed(e.target.checked)}/>I reviewed the new accounts, including {ready.filter(p=>p.row.role==='admin').length} Admin account(s), holiday calendars and opening leave allowances. Admins can access all HR records.</label>
          <button type="button" className="rounded-lg bg-[#3A5D83] text-white px-5 py-3 font-semibold disabled:opacity-50" disabled={busy||!reviewed||invalid.length>0||!ready.length||password.trim().length<12||new TextEncoder().encode(password.trim()).length>72} onClick={()=>void submit()}>{busy?'Importing…':`Import ${ready.length} new employees`}</button>
        </div>
      </>}
      <p role="status" aria-live="polite" className="text-sm">{progress}</p>
      {results.length>0&&<details open><summary className="font-semibold">Results: {results.filter(r=>r.status==='created').length} created, {results.filter(r=>r.status==='skipped').length} skipped</summary><ul className="max-h-40 overflow-auto text-sm p-3">{results.map((r,i)=><li key={i}>{r.full_name}: {r.status}{r.message?` — ${r.message}`:''}</li>)}</ul></details>}
    </div>
  </Dialog>;
}
