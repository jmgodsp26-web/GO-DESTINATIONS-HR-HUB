import React from 'react';
import { ArrowRight, ClipboardCheck } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';
export function OnboardingWidget({ onNavigate }: { onNavigate: (target: string) => void }) {
  const { summary } = useOnboarding();
  if (!summary?.active) return null;
  return <section className="onb-home-banner"><ClipboardCheck size={27} /><div><strong>Your getting-started checklist</strong><p>{summary.incomplete ? `${summary.incomplete} task${summary.incomplete === 1 ? '' : 's'} remaining${summary.overdue ? ` · ${summary.overdue} overdue` : ''}` : 'Your tasks are finished. HR will confirm the full onboarding plan.'}</p></div><button type="button" className="go-button go-button-primary" onClick={() => onNavigate('personal/onboarding')}>Continue checklist <ArrowRight size={16} /></button></section>;
}
