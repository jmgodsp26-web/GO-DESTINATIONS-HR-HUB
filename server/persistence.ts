import fs from 'node:fs/promises';
import path from 'node:path';
import { getFirestoreDb } from './firestore.js';
import { HRDatabase } from './db.js';
import type { Firestore } from 'firebase-admin/firestore';
import type { ReadPlan } from './read-plan.js';

export interface PersistentData {
  onboardingTemplates?: import('../src/types/onboarding.js').OnboardingTemplate[];
  onboardingPlans?: import('../src/types/onboarding.js').OnboardingPlan[];
  onboardingFiles?: import('../src/types/onboarding.js').OnboardingFile[];
  onboardingMessages?: import('../src/types/onboarding.js').OnboardingMessage[];
  nextEmployeeNumber?: number;
  leaveAttachments?: any[];
  users?: any[];
  employees: any[];
  leaveBalances: any[];
  leaveRequests: any[];
  leaveTransactions?: any[];
  holidays: any[];
  holidayShifts: any[];
  auditLogs: any[];
  notifications?: any[];
  announcements?: any[];
  announcementImages?: import('./announcements.js').AnnouncementImage[];
  announcementReceipts?: any[];
  employeeDocuments?: any[];
  companySettings?: Record<string, any>;
  sessions?: [string, any][];
  loginAttempts?: any[];
  deletedEmployeeIds?: string[];
  deletedHolidayIds?: string[];
  deletedShiftIds?: string[];
}
// A new namespace deliberately leaves the former project's collections untouched.
const PREFIX = 'hr_v2_';
const TABLES = ['users', 'leaveAttachments', 'leaveBalances', 'leaveRequests', 'leaveTransactions', 'holidays', 'holidayShifts', 'auditLogs', 'announcements', 'announcementImages', 'announcementReceipts', 'notifications', 'employeeDocuments', 'sessions', 'loginAttempts', 'onboardingTemplates', 'onboardingPlans', 'onboardingFiles', 'onboardingMessages'] as const;
const clean = (value: any) => JSON.parse(JSON.stringify(value));
const rows = (data: PersistentData, table: typeof TABLES[number]): Map<string, any> => new Map(
  table === 'sessions' ? (data.sessions || []).map(([id, value]) => [id, value]) : ((data as any)[table] || []).map((row: any) => [row.id, row])
);
function metadata(data: PersistentData) {
  return clean({ nextEmployeeNumber: data.nextEmployeeNumber, companySettings: data.companySettings || {}, deletedEmployeeIds: data.deletedEmployeeIds || [], deletedHolidayIds: data.deletedHolidayIds || [], deletedShiftIds: data.deletedShiftIds || [] });
}

// Test-only file persistence exercises restarts without cloud credentials. Never enabled in production.
let testQueue = Promise.resolve();
type Operation<T> = (database: HRDatabase) => Promise<{ result: T; commit: boolean }>;
interface TransactionOptions { onboardingFileId?: string; announcementImageId?: string; readPlan?: ReadPlan; }
export async function transact<T>(operation: Operation<T>, options: TransactionOptions = {}): Promise<T> {
  if (process.env.HR_TEST_STORE) {
    if (process.env.NODE_ENV !== 'test') throw new Error('Test storage is forbidden outside NODE_ENV=test.');
    const previous = testQueue;
    let release!: () => void;
    testQueue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      let before: PersistentData | undefined;
      try { before = JSON.parse(await fs.readFile(process.env.HR_TEST_STORE, 'utf8')); }
      catch (error: any) { if (error.code !== 'ENOENT') throw error; }
      const database = before ? new HRDatabase(before) : HRDatabase.bootstrap();
      const outcome = await operation(database);
      if (!before || outcome.commit) {
        await fs.mkdir(path.dirname(process.env.HR_TEST_STORE), { recursive: true, mode: 0o700 });
        const tmp = process.env.HR_TEST_STORE + '.tmp';
        await fs.writeFile(tmp, JSON.stringify(database.exportState()), { mode: 0o600 });
        await fs.rename(tmp, process.env.HR_TEST_STORE);
      }
      return outcome.result;
    } finally { release(); }
  }
  const firestore = getFirestoreDb();
  if (!firestore) throw new Error('Persistent database unavailable.');
  return transactFirestore(firestore, operation, options);
}

// Export the real Firestore adapter so regression tests can verify reads and
// writes without touching production or using cloud credentials.
export async function transactFirestore<T>(firestore: Firestore, operation: Operation<T>, options: TransactionOptions = {}): Promise<T> {
  const tables = options.readPlan?.tables || TABLES;
  return firestore.runTransaction(async tx => {
    const metaRef = firestore.doc(PREFIX + 'meta/state');
    const meta = await tx.get(metaRef);
    if (options.readPlan && !meta.exists) throw new Error('Database initialization marker missing.');
    // Onboarding blobs are fetched only for an explicit file request. Ordinary
    // HR transactions read metadata, keeping file bytes out of every page load.
    const snapshots = await Promise.all(tables.map(async table => {
      if (table === 'sessions' && options.readPlan) {
        const session = await tx.get(firestore.collection(PREFIX + table).doc(options.readPlan.sessionId));
        return { docs: session.exists ? [session] : [], empty: !session.exists };
      }
      return tx.get(table === 'onboardingFiles'
      ? firestore.collection(PREFIX + table).select('id', 'plan_id', 'task_id', 'name', 'mime_type', 'uploaded_at', 'uploaded_by')
      : table === 'announcementImages' ? firestore.collection(PREFIX + table).select('id')
      : firestore.collection(PREFIX + table));
    }));
    const requestedFile = options.onboardingFileId ? await tx.get(firestore.collection(PREFIX + 'onboardingFiles').doc(options.onboardingFileId)) : undefined;
    const requestedImage = options.announcementImageId ? await tx.get(firestore.collection(PREFIX + 'announcementImages').doc(options.announcementImageId)) : undefined;
    let before: PersistentData | undefined;
    if (meta.exists) {
      before = { ...meta.data(), employees: [] } as PersistentData;
      tables.forEach((table, i) => {
        (before as any)[table] = table === 'sessions'
          ? snapshots[i].docs.map(doc => [doc.id, doc.data()])
          : snapshots[i].docs.map(doc => doc.data());
      });
      if (requestedFile?.exists) {
        const index = before.onboardingFiles!.findIndex(f => f.id === requestedFile.id);
        if (index >= 0) before.onboardingFiles![index] = requestedFile.data() as any;
      }
      if (requestedImage?.exists) {
        const index = before.announcementImages!.findIndex(i => i.id === requestedImage.id);
        if (index >= 0) before.announcementImages![index] = requestedImage.data() as any;
      }
    } else if (snapshots.some(snapshot => !snapshot.empty)) {
      throw new Error('Database initialization marker missing; refusing to overwrite records.');
    }
    const database = before ? new HRDatabase(before) : HRDatabase.bootstrap();
    const outcome = await operation(database);
    if (!before || outcome.commit) {
      const after = database.exportState();
      // Business writes keep the existing serialization barrier. A page read
      // must not rewrite it just to refresh one user's session activity.
      if (!options.readPlan || !before || JSON.stringify(metadata(before)) !== JSON.stringify(metadata(after))) {
        tx.set(metaRef, metadata(after));
      }
      // Only diff collections actually loaded. Omitted data is never deleted.
      for (const table of tables) {
        const oldRows = before ? rows(before, table) : new Map<string, any>();
        const newRows = rows(after, table);
        for (const [id, value] of newRows) {
          const next = clean(value);
          if (JSON.stringify(oldRows.get(id)) !== JSON.stringify(next)) tx.set(firestore.collection(PREFIX + table).doc(id), next);
        }
        for (const id of oldRows.keys()) if (!newRows.has(id)) tx.delete(firestore.collection(PREFIX + table).doc(id));
      }
    }
    return outcome.result;
  });
}
export async function initializeDatabase() {
  // A warm-up must not download every HR record and attachment. Existing
  // databases only need their marker checked; creation still uses the guarded
  // transaction below, which refuses to overwrite collections without a marker.
  if (!process.env.HR_TEST_STORE) {
    const firestore = getFirestoreDb();
    if (!firestore) throw new Error('Persistent database unavailable.');
    if ((await firestore.doc(PREFIX + 'meta/state').get()).exists) return;
  }
  await transact(async () => ({ result: undefined, commit: false }));
}
