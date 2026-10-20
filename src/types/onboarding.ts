export const ONBOARDING_STAGES = ['Before starting', 'First day', 'First week', 'First month'] as const;
export const ONBOARDING_OWNERS = ['employee', 'hr', 'manager', 'it'] as const;
export type OnboardingOwner = typeof ONBOARDING_OWNERS[number];
export type OnboardingTaskSpec = {
  id: string; title: string; instructions: string; stage: typeof ONBOARDING_STAGES[number];
  owner: OnboardingOwner; kind: 'task' | 'acknowledgment' | 'document';
  due_offset: number; required: boolean; requires_review: boolean; resource_url: string;
};
export type OnboardingTemplateInput = { name: string; description: string; welcome: string; tasks: OnboardingTaskSpec[] };
export type OnboardingTemplate = OnboardingTemplateInput & { id: string; revision: number; active: boolean; updated_at: string };
export type OnboardingTask = OnboardingTaskSpec & {
  assigned_to: string; due_date: string; status: 'Not started' | 'In progress' | 'Needs review' | 'Completed' | 'Waived';
  read_at: string | null; acknowledged_at: string | null; submitted_at: string | null;
  completed_at: string | null; completed_by: string | null; review_note: string;
  file_id: string | null; help_open: boolean; last_reminded: string | null;
};
export type OnboardingPlan = {
  id: string; employee_id: string; template_id: string; template_revision: number;
  name: string; welcome: string; start_date: string; assignments: Record<'hr' | 'manager' | 'it', string>;
  tasks: OnboardingTask[]; status: 'Active' | 'Completed' | 'Cancelled'; revision: number;
  created_at: string; updated_at: string; completed_at: string | null; completed_by: string | null;
};
export type OnboardingMessage = { id: string; plan_id: string; task_id: string; author_id: string; author_name: string; text: string; created_at: string };
export type OnboardingFile = { id: string; plan_id: string; task_id: string; name: string; data?: string; mime_type: string; uploaded_at: string; uploaded_by: string };
export type OnboardingFileView = Omit<OnboardingFile, 'data'> & { mime_type: string; url: string };
export type OnboardingPerson = { id: string; name: string; email: string };
export type OnboardingPlanView = OnboardingPlan & {
  employee_name: string; department: string; country: string; timezone: string;
  hr_contact: OnboardingPerson | null; people: OnboardingPerson[];
  messages: OnboardingMessage[]; files: OnboardingFileView[]; scope: 'manage' | 'mine' | 'assigned';
};
export type OnboardingAssignmentInput = {
  employee_id: string; template_id: string; template_revision: number; name: string; welcome: string;
  start_date: string; assignments: Record<'hr' | 'manager' | 'it', string>; tasks: OnboardingTaskSpec[];
};
export type OnboardingSummary = { available: boolean; active: number; incomplete: number; overdue: number; needs_review: number };
