import { useEffect, useCallback } from 'react';
export function useUnsavedChanges(dirty: boolean, busy = false) {
  const canLeave = useCallback(() => !busy && (!dirty || window.confirm('Discard your unsaved changes? Choose Cancel to keep editing.')), [dirty, busy]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    const navigate = (e: Event) => { if (!canLeave()) e.preventDefault(); };
    window.addEventListener('beforeunload', unload); window.addEventListener('workspace:before-navigate', navigate);
    return () => { window.removeEventListener('beforeunload', unload); window.removeEventListener('workspace:before-navigate', navigate); };
  }, [dirty, busy, canLeave]);
  return canLeave;
}
