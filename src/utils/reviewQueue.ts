import type { LeaveRequest } from '../types';
export function canReviewRequest(request: LeaveRequest, reviewerId?: string): boolean {
  return Boolean(reviewerId && request.status === 'Pending' && request.employee_id !== reviewerId);
}
export async function reviewBatch(ids: string[], perform: (id: string) => Promise<unknown>) {
  const results: { id: string; success: boolean; error?: string }[] = [];
  // Bound concurrency to keep large selections responsive without flooding the API.
  for (let offset = 0; offset < ids.length; offset += 4) {
    const batch = ids.slice(offset, offset + 4);
    const settled = await Promise.allSettled(batch.map(id => perform(id)));
    settled.forEach((result, index) => results.push(result.status === 'fulfilled'
      ? { id: batch[index], success: true }
      : { id: batch[index], success: false, error: result.reason instanceof Error ? result.reason.message : 'Could not update this request.' }));
  }
  return results;
}
