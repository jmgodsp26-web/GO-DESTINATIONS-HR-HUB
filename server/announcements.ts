import { ANNOUNCEMENT_CATEGORIES, OFFICIAL_DEPARTMENTS, type Announcement, type AnnouncementInput, type UserProfile } from '../src/types.js';
import { EMPLOYEE_COUNTRIES } from '../src/utils/countryUtils.js';

export class AnnouncementError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function announcementAudience(a: Pick<Announcement, 'countries' | 'departments'>, user: UserProfile): boolean {
  return user.status === 'active' && ['admin', 'employee'].includes(user.role)
    && (!a.departments.length || a.departments.includes(user.department))
    && (!a.countries.length || a.countries.includes(user.country || ''));
}
export function announcementVisible(a: Announcement, user: UserProfile): boolean {
  return a.status === 'published' && (!a.expires_at || Date.parse(a.expires_at) > Date.now()) && announcementAudience(a, user);
}
export function validateAnnouncement(value: unknown): AnnouncementInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AnnouncementError('Enter announcement details.');
  const data = value as Record<string, unknown>;
  function text(key: string, max: number) {
    const value = data[key];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new AnnouncementError(`${key === 'title' ? 'Title' : 'Message'} is required and must be ${max} characters or fewer.`);
    return value.trim();
  }
  function selection(key: string, allowed: readonly string[]) {
    const values = data[key];
    if (!Array.isArray(values) || values.length > allowed.length || values.some(v => typeof v !== 'string' || !allowed.includes(v))) throw new AnnouncementError(`Choose valid ${key}.`);
    return [...new Set(values)] as string[];
  }
  if (!(ANNOUNCEMENT_CATEGORIES as readonly unknown[]).includes(data.category)) throw new AnnouncementError('Choose an announcement category.');
  if (!['draft', 'published'].includes(data.status as string)) throw new AnnouncementError('Choose draft or published status.');
  if (typeof data.pinned !== 'boolean' || typeof data.requires_acknowledgment !== 'boolean') throw new AnnouncementError('Invalid announcement options.');
  let expires_at: string | null = null;
  if (data.expires_at !== null) {
    if (typeof data.expires_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(data.expires_at) || !Number.isFinite(Date.parse(data.expires_at))) throw new AnnouncementError('Choose a valid expiry date and time.');
    if (Date.parse(data.expires_at) <= Date.now()) throw new AnnouncementError('Expiry must be in the future.');
    expires_at = new Date(data.expires_at).toISOString();
  }
  return { title: text('title', 160), message: text('message', 10000), category: data.category as AnnouncementInput['category'],
    departments: selection('departments', OFFICIAL_DEPARTMENTS), countries: selection('countries', EMPLOYEE_COUNTRIES),
    pinned: data.pinned, requires_acknowledgment: data.requires_acknowledgment, expires_at, status: data.status as AnnouncementInput['status'] };
}
