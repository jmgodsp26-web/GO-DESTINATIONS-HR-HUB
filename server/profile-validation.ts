import { MAX_PROFILE_PHOTO_BYTES } from '../src/utils/profilePhoto.js';

/** Validate before mutating credentials/profile or reaching the Firestore transaction. */
export function validateProfileStorage(profile: Record<string, unknown>): void {
  const photo = profile.avatar_url;
  if (photo !== undefined && typeof photo !== 'string') throw new Error('Profile photo must be an image URL.');
  if (typeof photo === 'string' && Buffer.byteLength(photo, 'utf8') > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error('The profile photo is too large to save. Please upload the photo again so it can be resized, or remove it.');
  }
  const textFields = ['full_name', 'email', 'phone', 'department', 'job_title', 'country', 'region', 'timezone',
    'holiday_calendar', 'holiday_region', 'date_joined', 'hire_date', 'date_of_birth', 'birthday'];
  for (const field of textFields) {
    const value = profile[field];
    if (value !== undefined && (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 4096)) {
      throw new Error('Invalid or oversized employee field: ' + field + '. Please check the employee details.');
    }
  }
  if (Buffer.byteLength(JSON.stringify(profile), 'utf8') > 800 * 1024) {
    throw new Error('The employee profile is too large to save. Please reduce the photo or profile details.');
  }
}
