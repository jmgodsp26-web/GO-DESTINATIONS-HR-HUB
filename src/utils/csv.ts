export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (typeof value !== 'number' && /^[\s]*[=+\-@]|^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export const csvRow = (values: unknown[]) => values.map(csvCell).join(',');
