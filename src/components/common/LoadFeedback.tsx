import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { SectionState } from '../../hooks/useSections';
export function LoadError({ message = 'This information could not load.', onRetry }: { message?: string; onRetry: () => void }) {
  return <div className="go-load-error" role="alert"><AlertCircle size={20} /><div><strong>{message}</strong><p>This does not mean your records have been removed.</p></div><button type="button" onClick={onRetry}><RefreshCw size={15} />Retry</button></div>;
}
export function RefreshStatus({ active }: { active?: boolean }) { return active ? <p className="go-refresh-status" role="status">Updating information…</p> : null; }
export function DataRegion({ state = {}, label, onRetry, children }: { state?: SectionState; label: string; onRetry: () => void; children: React.ReactNode }) {
  if (!state.ready) return state.error ? <LoadError message={`Could not load ${label}.`} onRetry={onRetry} /> : <p className="go-refresh-status" role="status">Loading {label}…</p>;
  return <>{state.error && <LoadError message={`Could not refresh ${label}. The information below may be out of date.`} onRetry={onRetry} />}<RefreshStatus active={state.loading} />{children}</>;
}
