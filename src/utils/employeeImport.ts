export interface ImportEmployee {
  full_name: string; email: string; department: string; job_title: string; country: string;
  holiday_calendar: string; phone: string; date_joined: string; date_of_birth: string;
  role: 'employee' | 'admin'; annual_leave_days: number; sick_leave_days: number;
}
export const importCountries = ['Canada', 'Argentina', 'United States', 'Philippines', 'Costa Rica', 'United Kingdom'];
export const identityKey = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const text = (value: unknown) => value == null ? '' : String(value).trim();
const countryAliases: Record<string,string> = { us:'United States', usa:'United States', ph:'Philippines', ca:'Canada', arg:'Argentina', ar:'Argentina', uk:'United Kingdom', gb:'United Kingdom', cr:'Costa Rica' };
function date(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date && !isNaN(value.valueOf())) return value.toISOString().slice(0,10);
  return text(value); // Ambiguous text dates are flagged for explicit correction.
}
export function parseEmployeeSheet(grid: unknown[][]): ImportEmployee[] {
  const header = grid.findIndex(row => row.some(c => /^(name|full name)$/i.test(text(c))) && row.some(c => /^(email|email address)$/i.test(text(c))));
  if (header < 0) throw new Error('The first worksheet needs Name and Email Address column headings.');
  const headings = grid[header].map(c => text(c).toLowerCase());
  const index = (...names:string[]) => headings.findIndex(c=>names.includes(c));
  const get = (row:unknown[], ...names:string[]) => row[index(...names)];
  const rows = grid.slice(header+1).filter(row=>text(get(row,'name','full name'))).map(row => {
    const location = text(get(row,'country','location'));
    const rawRole = text(get(row,'role','portal role') ?? (headings[0] === '' ? row[0] : '')).toLowerCase();
    return {
      full_name:text(get(row,'name','full name')), email:text(get(row,'email address','email')).toLowerCase(),
      department:text(get(row,'department')), job_title:text(get(row,'position','job title')),
      country:countryAliases[location.toLowerCase()] || location,
      holiday_calendar:text(get(row,'holiday calendar')) || countryAliases[location.toLowerCase()] || location,
      phone:text(get(row,'phone number','phone','work phone')), date_joined:date(get(row,'start date','hire date','date joined')),
      date_of_birth:date(get(row,'birthdate','date of birth')), role:rawRole === 'admin' || rawRole === 'administrator' ? 'admin' as const : 'employee' as const,
      annual_leave_days:Number(get(row,'vacation days','annual leave days') ?? 0), sick_leave_days:Number(get(row,'sick days','sick leave days') ?? 0),
    };
  });
  if (!rows.length || rows.length > 200) throw new Error('Choose a worksheet with 1–200 employees.');
  return rows;
}
export function importErrors(row: ImportEmployee): string[] {
  const errors: string[] = [];
  for (const key of ['full_name','email','department','job_title','country','holiday_calendar','phone','date_joined','date_of_birth'] as const) {
    if (typeof row[key] !== 'string' || row[key].length > 500) errors.push('Invalid ' + key.replaceAll('_',' '));
  }
  if (errors.length) return errors;
  if (!row.full_name.trim() || !row.department.trim() || !row.job_title.trim()) errors.push('Name, department and job title required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push('Valid email required');
  if (!importCountries.includes(row.country) || !importCountries.includes(row.holiday_calendar)) errors.push('Choose a supported country and calendar');
  for (const key of ['date_joined','date_of_birth'] as const) {
    const value = row[key];
    if ((key === 'date_joined' && !value) || (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value))) errors.push('Use a valid YYYY-MM-DD ' + key.replaceAll('_',' '));
  }
  if (!['employee','admin'].includes(row.role)) errors.push('Invalid role');
  if ([row.annual_leave_days,row.sick_leave_days].some(n=>typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 366)) errors.push('Leave days must be between 0 and 366');
  return errors;
}
export function importPreview(rows:ImportEmployee[], existing:{full_name:string;email:string}[]) {
  const emails = new Set(existing.map(e=>identityKey(e.email))), names = new Set(existing.map(e=>identityKey(e.full_name)));
  const seenEmails = new Set<string>(), seenNames = new Set<string>();
  return rows.map(row=> {
    const email = identityKey(row.email), name = identityKey(row.full_name);
    let skip = emails.has(email) ? 'Existing email — skipped' : names.has(name) ? 'Existing name — skipped; review identity' : seenEmails.has(email) && email ? 'Duplicate email in file — skipped' : seenNames.has(name) ? 'Duplicate name in file — skipped' : '';
    seenEmails.add(email); seenNames.add(name);
    return {row, skip, errors:skip ? [] : importErrors(row)};
  });
}
