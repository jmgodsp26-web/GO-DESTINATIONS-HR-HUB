import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
let openDialogs = 0;
let originalOverflow = '';
export function Dialog({ title, children, onClose, className = '', busy = false }: { title: string; children: React.ReactNode; onClose: () => void; className?: string; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null), close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, dialog = ref.current;
    if (openDialogs++ === 0) { originalOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    dialog?.showModal();
    return () => { dialog?.close(); if (--openDialogs === 0) document.body.style.overflow = originalOverflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(<dialog ref={ref} className={`go-native-dialog ${className}`} aria-label={title} aria-busy={busy}
    onCancel={e => { e.preventDefault(); if (!busy) close.current(); }}
    onClick={e => { if (e.target === e.currentTarget && !busy) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close.current(); } }}>
    <header className="go-dialog-header"><h2>{title}</h2><button type="button" onClick={onClose} disabled={busy} aria-label={`Close ${title}`}><X size={20} /></button></header>{children}
  </dialog>, document.body);
}
