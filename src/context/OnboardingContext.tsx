import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';
import type { OnboardingSummary } from '../types/onboarding';
const OnboardingContext = createContext<{ summary: OnboardingSummary | null; refresh: () => void }>({ summary: null, refresh: () => {} });
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user, mustChangePassword, notifications } = useAuth();
  const [state, setState] = useState<{ userId: string; summary: OnboardingSummary }>();
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  const updates = notifications.filter(n => n.onboarding_id).map(n => n.id).join('|');
  useEffect(() => {
    if (!user || mustChangePassword) { setState(undefined); return; }
    let active = true;
    api.getOnboardingSummary().then(summary => { if (active) setState({ userId: user.id, summary }); }).catch(() => {});
    return () => { active = false; };
  }, [user?.id, mustChangePassword, updates, version]);
  return <OnboardingContext.Provider value={{ summary: state?.userId === user?.id ? state?.summary || null : null, refresh }}>{children}</OnboardingContext.Provider>;
}
export const useOnboarding = () => useContext(OnboardingContext);
