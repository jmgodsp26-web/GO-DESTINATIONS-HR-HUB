import { ANNOUNCEMENT_CATEGORIES, OFFICIAL_DEPARTMENTS, type Announcement, type AnnouncementInput, type UserProfile } from '../src/types.js';
import { EMPLOYEE_COUNTRIES } from '../src/utils/countryUtils.js';
import { decodeUpload } from './files.js';

export type AnnouncementImage = { id: string; data?: string };
export function decodeAnnouncementImage(value: unknown) {
  let file: ReturnType<typeof decodeUpload>;
  try { file = decodeUpload(value); } catch (e) { throw new AnnouncementError((e as Error).message); }
  const { bytes, mime } = file;
  const png = mime === 'image/png' && bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii', 12, 16) === 'IHDR';
  const jpeg = mime === 'image/jpeg' && bytes.length >= 20 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217;
  if (!png && !jpeg) throw new AnnouncementError('Choose a valid JPG or PNG image, up to 450 KB.');
  return file;
}

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
  let image_upload: AnnouncementInput['image_upload'];
  if (data.image_upload === null) image_upload = null;
  else if (data.image_upload !== undefined) {
    const image = data.image_upload as Record<string, unknown>;
    if (!image || typeof image !== 'object' || Array.isArray(image) || typeof image.name !== 'string' || !image.name.trim() || image.name.length > 180) throw new AnnouncementError('Choose an image with a file name of 180 characters or fewer.');
    decodeAnnouncementImage(image.data);
    image_upload = { name: image.name.trim(), data: image.data as string };
  }
  if (data.image_alt !== undefined && (typeof data.image_alt !== 'string' || data.image_alt.length > 300)) throw new AnnouncementError('Image description must be 300 characters or fewer.');
  let expires_at: string | null = null;
  if (data.expires_at !== null) {
    if (typeof data.expires_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(data.expires_at) || !Number.isFinite(Date.parse(data.expires_at))) throw new AnnouncementError('Choose a valid expiry date and time.');
    if (Date.parse(data.expires_at) <= Date.now()) throw new AnnouncementError('Expiry must be in the future.');
    expires_at = new Date(data.expires_at).toISOString();
  }
  return { ...(image_upload !== undefined ? { image_upload } : {}), ...(data.image_alt !== undefined ? { image_alt: (data.image_alt as string).trim() } : {}), title: text('title', 160), message: text('message', 10000), category: data.category as AnnouncementInput['category'],
    departments: selection('departments', OFFICIAL_DEPARTMENTS), countries: selection('countries', EMPLOYEE_COUNTRIES),
    pinned: data.pinned, requires_acknowledgment: data.requires_acknowledgment, expires_at, status: data.status as AnnouncementInput['status'] };
}
