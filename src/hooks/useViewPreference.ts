import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
/** Store view choices only. Never store forms, passwords or HR records here. */
export function useViewPreference<T>(name: string, initial: T) {
  const { user } = useAuth(); const key = `hr:view:${user?.id}:${name}`;
  const [value, setValue] = useState<T>(() => { try { const saved = JSON.parse(sessionStorage.getItem(key) || 'null'); return saved !== null && typeof saved === typeof initial ? saved : initial; } catch { return initial; } });
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue] as const;
}
