import fs from 'node:fs/promises';
import path from 'node:path';
import { getFirestoreDb } from './firestore.js';
import { HRDatabase } from './db.js';

export interface PersistentData {
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
  employeeDocuments?: any[];
  companySettings?: Record<string, any>;
  sessions?: [string, any][];
  loginAttempts?: any[];
  microsoftAttempts?: any[];
  deletedEmployeeIds?: string[];
  deletedHolidayIds?: string[];
  deletedShiftIds?: string[];
}
// A new namespace deliberately leaves the former project's collections untouched.
const PREFIX = 'hr_v2_';
const TABLES = ['users', 'leaveAttachments', 'leaveBalances', 'leaveRequests', 'leaveTransactions', 'holidays', 'holidayShifts', 'auditLogs', 'notifications', 'employeeDocuments', 'sessions', 'loginAttempts', 'microsoftAttempts'] as const;
const clean = (value: any) => JSON.parse(JSON.stringify(value));
const rows = (data: PersistentData, table: typeof TABLES[number]): Map<string, any> => new Map(
  table === 'sessions' ? (data.sessions || []).map(([id, value]) => [id, value]) : ((data as any)[table] || []).map((row: any) => [row.id, row])
);
function metadata(data: PersistentData) {
  return clean({ nextEmployeeNumber: data.nextEmployeeNumber, companySettings: data.companySettings || {}, deletedEmployeeIds: data.deletedEmployeeIds || [], deletedHolidayIds: data.deletedHolidayIds || [], deletedShiftIds: data.deletedShiftIds || [] });
}

// Test-only file persistence exercises restarts without cloud credentials. Never enabled in production.
let testQueue = Promise.resolve();
export async function transact<T>(operation: (database: HRDatabase) => Promise<{ result: T; commit: boolean }>): Promise<T> {
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
  return firestore.runTransaction(async tx => {
    const metaRef = firestore.doc(PREFIX + 'meta/state');
    const meta = await tx.get(metaRef);
    const snapshots = await Promise.all(TABLES.map(table => tx.get(firestore.collection(PREFIX + table))));
    let before: PersistentData | undefined;
    if (meta.exists) {
      before = { ...meta.data(), employees: [] } as PersistentData;
      TABLES.forEach((table, i) => {
        (before as any)[table] = table === 'sessions'
          ? snapshots[i].docs.map(doc => [doc.id, doc.data()])
          : snapshots[i].docs.map(doc => doc.data());
      });
    } else if (snapshots.some(snapshot => !snapshot.empty)) {
      throw new Error('Database initialization marker missing; refusing to overwrite records.');
    }
    const database = before ? new HRDatabase(before) : HRDatabase.bootstrap();
    const outcome = await operation(database);
    if (!before || outcome.commit) {
      const after = database.exportState();
      // Metadata is a serialization barrier across service instances and concurrent writes.
      tx.set(metaRef, metadata(after));
      for (const table of TABLES) {
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
  await transact(async () => ({ result: undefined, commit: false }));
}
