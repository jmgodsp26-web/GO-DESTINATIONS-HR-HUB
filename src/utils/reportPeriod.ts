export function reportRange(value: string, today: string): [string, string] | null {
  const year = today.slice(0, 4);
  if (value === 'ytd') return [`${year}-01-01`, today];
  if (/^year:\d{4}$/.test(value)) return [`${value.slice(5)}-01-01`, `${value.slice(5)}-12-31`];
  const match = /^quarter:(\d{4}):([1-4])$/.exec(value);
  if (match) { const y = +match[1], q = +match[2]; return [`${y}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`, new Date(Date.UTC(y, q * 3, 0)).toISOString().slice(0, 10)]; }
  return null;
}
