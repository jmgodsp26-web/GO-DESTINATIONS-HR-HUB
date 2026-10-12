export const MAX_PROFILE_PHOTO_BYTES = 256 * 1024;

/** Keep inline avatars comfortably below Firestore's document limit. */
export async function resizeProfilePhoto(source: string): Promise<string> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('This photo could not be read. Please choose a JPG, PNG, or WebP image.'));
    image.src = source;
  });
  const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Photo processing is unavailable. Please try another browser.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [.85, .7, .5]) {
    const result = canvas.toDataURL('image/jpeg', quality);
    if (result.startsWith('data:image/jpeg;base64,') && result.length <= MAX_PROFILE_PHOTO_BYTES) return result;
  }
  throw new Error('This photo is too large to save. Please choose a smaller image.');
}

export async function prepareProfilePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Please choose a JPG, PNG, or WebP photo.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Photo must be under 2MB.');
  const url = URL.createObjectURL(file);
  try { return await resizeProfilePhoto(url); }
  finally { URL.revokeObjectURL(url); }
}

export async function normalizeProfilePhoto(value: string): Promise<string> {
  return value?.startsWith('data:') && value.length > MAX_PROFILE_PHOTO_BYTES ? resizeProfilePhoto(value) : value;
}
