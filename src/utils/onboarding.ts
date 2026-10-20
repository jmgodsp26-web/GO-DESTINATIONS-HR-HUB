import type { OnboardingTask, OnboardingTemplateInput } from '../types/onboarding';
export const ownerLabels = { employee: 'New hire', hr: 'HR', manager: 'Manager', it: 'IT' };
export const taskDone = (task: Pick<OnboardingTask, 'status'>) => ['Completed', 'Waived'].includes(task.status);
export function onboardingProgress(tasks: OnboardingTask[]) {
  const required = tasks.filter(t => t.required);
  const completed = required.filter(taskDone).length;
  return { completed, total: required.length, percent: required.length ? Math.round(completed / required.length * 100) : 100 };
}
export const GENERAL_ONBOARDING: OnboardingTemplateInput = {
  name: 'General employee onboarding', description: 'A starting checklist for HR, IT, managers, and new hires. Review and tailor it before assigning.',
  welcome: 'Welcome to GO Destinations! Work through your checklist at your own pace. Your HR contact is here to help with questions along the way.',
  tasks: [
    { id: 'access', title: 'Prepare company email and system access', instructions: 'Set up the approved company accounts and confirm access is ready. Share credentials through the company’s approved secure process; never post passwords here.', stage: 'Before starting', owner: 'it', kind: 'task', due_offset: -1, required: true, requires_review: false, resource_url: '' },
    { id: 'welcome', title: 'Prepare the first-day schedule', instructions: 'Confirm orientation time, meeting links, and the employee’s HR contact. Share the schedule with the new hire.', stage: 'Before starting', owner: 'hr', kind: 'task', due_offset: -1, required: true, requires_review: false, resource_url: '' },
    { id: 'profile', title: 'Review your personal details', instructions: 'Open My Profile and check your contact and employment details. Ask HR to correct anything that is missing or inaccurate.', stage: 'First day', owner: 'employee', kind: 'task', due_offset: 0, required: true, requires_review: false, resource_url: '' },
    { id: 'orientation', title: 'Attend your welcome orientation', instructions: 'Join the orientation arranged by HR. Learn how to request leave, find company updates, and contact support.', stage: 'First day', owner: 'employee', kind: 'task', due_offset: 0, required: true, requires_review: true, resource_url: '' },
    { id: 'tools', title: 'Confirm access to your work tools', instructions: 'Try signing in to your company email and the tools provided for your role. Use Need help if anything is unavailable.', stage: 'First week', owner: 'employee', kind: 'task', due_offset: 4, required: true, requires_review: false, resource_url: '' },
    { id: 'team', title: 'Introduce the team and first-week goals', instructions: 'Introduce the new hire to teammates and agree on initial priorities and training.', stage: 'First week', owner: 'manager', kind: 'task', due_offset: 4, required: true, requires_review: false, resource_url: '' },
    { id: 'checkin', title: 'Hold the first-month check-in', instructions: 'Review progress, answer questions, and agree on the next goals with the new hire.', stage: 'First month', owner: 'manager', kind: 'task', due_offset: 30, required: true, requires_review: false, resource_url: '' },
  ],
};
