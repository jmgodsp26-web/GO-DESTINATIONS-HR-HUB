/**
 * Who counts as a Program Coordinator (PC).
 *
 * PCs get the "PC" badge on holiday shifts and count toward the Program Coordinators
 * needed on each holiday. HR can set it per employee (Yes / No); when HR has not chosen,
 * it follows the employee's department and job title.
 */
export type CoordinatorSetting = 'auto' | 'yes' | 'no';

interface CoordinatorFields {
  department?: string;
  job_title?: string;
  is_pc?: boolean | null;
}

/** What the department and job title alone say, ignoring HR's choice. */
export function coordinatorFromRole(user: CoordinatorFields): boolean {
  if ((user.department || '').trim().toLowerCase() === 'program coordinator') return true;
  const title = (user.job_title || '').trim().toLowerCase();
  // "Program Coordinator", or "PC" as a word of its own ("PC", "Senior PC", "PC - Flights").
  // Other coordinators (HR Coordinator, Property Services Coordinator, …) are not PCs.
  return /\bprogram coordinator\b/.test(title) || /(^|[^a-z0-9])pc([^a-z0-9]|$)/.test(title);
}

/** HR's explicit choice wins; otherwise the department and job title decide. */
export function isProgramCoordinator(user: CoordinatorFields): boolean {
  return typeof user.is_pc === 'boolean' ? user.is_pc : coordinatorFromRole(user);
}

export function coordinatorSetting(override: boolean | null | undefined): CoordinatorSetting {
  return override === true ? 'yes' : override === false ? 'no' : 'auto';
}

/** The value to store: true, false, or null for "decide from department and job title". */
export function coordinatorOverride(setting: CoordinatorSetting): boolean | null {
  return setting === 'yes' ? true : setting === 'no' ? false : null;
}
