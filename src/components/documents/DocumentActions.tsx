import React, { useState } from 'react';
import { Download, Eye } from 'lucide-react';
import type { EmployeeDocument } from '../../types';
import { useToast } from '../../context/ToastContext';
export function DocumentActions({ doc }: { doc: EmployeeDocument }) {
  const [busy, setBusy] = useState(false); const { showToast } = useToast();
  const source = doc.file_url || doc.file_data;
  if (!source) return <span className="text-sm text-slate-500">Original file unavailable · Contact HR</span>;
  const canPreview = Boolean(doc.file_url && ['application/pdf', 'image/png', 'image/jpeg'].includes(doc.mime_type || ''));
  async function download() {
    setBusy(true);
    try {
      const response = await fetch(source!, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('The file could not be downloaded. Try again or contact HR.');
      const url = URL.createObjectURL(await response.blob()), a = document.createElement('a');
      a.href = url; a.download = doc.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) { showToast({ type: 'error', title: 'Download failed', message: (e as Error).message }); }
    finally { setBusy(false); }
  }
  return <span className="go-file-actions">{canPreview && <a href={doc.file_url + '?preview=1'} target="_blank" rel="noopener noreferrer"><Eye size={16} />Preview</a>}<button type="button" disabled={busy} onClick={download}><Download size={16} />{busy ? 'Opening…' : 'Download'}</button></span>;
}
