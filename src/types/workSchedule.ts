export interface WorkScheduleRules {
  /** null inherits the company workweek. JavaScript weekday numbers: Sunday = 0. */
  regular_days: number[] | null;
  exceptions: { date: string; working: boolean }[];
}

export interface WorkSchedule extends WorkScheduleRules {
  revision: string;
  updated_at: string;
  updated_by: string;
}

export interface WorkScheduleView {
  schedule: WorkSchedule | null;
  company_workweek: string;
  holiday_calendar: { country: string; region?: string };
}

export interface WorkScheduleUpdate extends WorkScheduleRules {
  expected_revision: string | null;
  expected_workweek: string;
  reason: string;
}
