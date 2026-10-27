/** Years of service only. Birthday ages are never used in celebration messages. */
export function goAnniversaryLabel(years?: number): string {
  if (!Number.isInteger(years) || years < 1) return 'GO Anniversary';
  const lastTwo = years % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[years % 10] || 'th');
  return `${years}${suffix} GO Anniversary`;
}
