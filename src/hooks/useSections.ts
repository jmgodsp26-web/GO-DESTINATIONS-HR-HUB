import { useCallback, useEffect, useRef, useState } from 'react';
export type SectionState = { ready?: boolean; loading?: boolean; error?: string };
export function useSections() {
  const [sections, setSections] = useState<Record<string, SectionState>>({});
  const versions = useRef<Record<string, number>>({}), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = useCallback(async <T,>(key: string, task: () => Promise<T>, apply: (value: T) => void) => {
    const version = versions.current[key] = (versions.current[key] || 0) + 1;
    setSections(s => ({ ...s, [key]: { ...s[key], loading: true, error: '' } }));
    try {
      const result = await task(); if (!mounted.current || versions.current[key] !== version) return;
      apply(result); setSections(s => ({ ...s, [key]: { ready: true, loading: false } }));
    } catch (error) { if (mounted.current && versions.current[key] === version) setSections(s => ({ ...s, [key]: { ...s[key], loading: false, error: (error as Error).message || 'Could not load information.' } })); }
  }, []);
  return { sections, run };
}
