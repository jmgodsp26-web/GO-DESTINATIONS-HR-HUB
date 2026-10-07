export const MAX_FILE_BYTES = 450000;
export async function readUpload(file: File): Promise<string> {
  if (!file.size || file.size > MAX_FILE_BYTES) throw new Error('Choose a non-empty file up to 450 KB.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file. Please select it again.'));
    reader.readAsDataURL(new Blob([file], {type: file.type || 'application/octet-stream'}));
  });
}
