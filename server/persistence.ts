import fs from 'fs';
import path from 'path';
import { Firestore, DocumentReference, CollectionReference } from 'firebase-admin/firestore';
// Small adapters preserve the existing persistence call sites using trusted Admin SDK access.
const doc = (db: Firestore, name: string, id: string) => db.collection(name).doc(id);
const collection = (db: Firestore, name: string) => db.collection(name);
const getDocs = (ref: CollectionReference) => ref.get();
const setDoc = (ref: DocumentReference, data: any) => ref.set(data);
const deleteDoc = (ref: DocumentReference) => ref.delete();
import { getFirestoreDb } from './firestore.js';
import {
  UserProfile,
  LeaveBalance,
  LeaveRequest,
  LeaveTransaction,
  Holiday,
  HolidayShiftRequest,
  AuditLog,
  NotificationItem,
  EmployeeDocument,
} from '../src/types.js';

export interface PersistentData {
  users?: any[];
  employees: UserProfile[];
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
  leaveTransactions?: LeaveTransaction[];
  holidays: Holiday[];
  holidayShifts: HolidayShiftRequest[];
  auditLogs: AuditLog[];
  notifications?: NotificationItem[];
  employeeDocuments?: EmployeeDocument[];
  companySettings?: Record<string, any>;
  sessions?: [string, any][];
  deletedEmployeeIds?: string[];
  deletedHolidayIds?: string[];
  deletedShiftIds?: string[];
}

// Collections mapping
const COLLECTIONS = {
  EMPLOYEES: 'employees',
  AUTH_CREDENTIALS: 'auth_credentials',
  LEAVE_BALANCES: 'leave_balances',
  LEAVE_REQUESTS: 'leave_requests',
  LEAVE_TRANSACTIONS: 'leave_transactions',
  HOLIDAYS: 'holidays',
  HOLIDAY_SHIFTS: 'holiday_shifts',
  AUDIT_LOGS: 'audit_logs',
  NOTIFICATIONS: 'notifications',
  EMPLOYEE_DOCUMENTS: 'employee_documents',
  SETTINGS: 'settings',
};

// Defensive sanitizer that strips `undefined` fields which Firestore rejects with error
function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return data;
  return JSON.parse(JSON.stringify(data));
}

export async function saveEmployeeToFirestore(employee: UserProfile): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  // Deep clone and strictly guarantee NO credentials or sensitive password hashes are ever in the employee profile
  const dataToSave: any = { ...employee };
  delete dataToSave._credentials;
  delete dataToSave.password;
  delete dataToSave.passwordHash;
  await setDoc(doc(db, COLLECTIONS.EMPLOYEES, employee.id), cleanForFirestore(dataToSave));
}

export async function saveCredentialsToFirestore(
  employeeId: string,
  credentials: {
    email: string;
    passwordHash: string;
    passwordCustomized?: boolean;
    mustChangePassword?: boolean;
  }
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await setDoc(doc(db, COLLECTIONS.AUTH_CREDENTIALS, employeeId), cleanForFirestore({
    id: employeeId,
    email: credentials.email.toLowerCase().trim(),
    passwordHash: credentials.passwordHash,
    passwordCustomized: Boolean(credentials.passwordCustomized),
    mustChangePassword: Boolean(credentials.mustChangePassword),
    updated_at: new Date().toISOString(),
  }));
}

export async function deleteEmployeeFromFirestore(employeeId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await Promise.all([
    deleteDoc(doc(db, COLLECTIONS.EMPLOYEES, employeeId)).catch(() => {}),
    deleteDoc(doc(db, COLLECTIONS.AUTH_CREDENTIALS, employeeId)).catch(() => {}),
  ]);
}

export async function saveLeaveBalanceToFirestore(balance: LeaveBalance): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await setDoc(doc(db, COLLECTIONS.LEAVE_BALANCES, balance.id), cleanForFirestore(balance));
}

export async function deleteLeaveBalanceFromFirestore(balanceId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await deleteDoc(doc(db, COLLECTIONS.LEAVE_BALANCES, balanceId)).catch(() => {});
}

export async function saveLeaveRequestToFirestore(request: LeaveRequest): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await setDoc(doc(db, COLLECTIONS.LEAVE_REQUESTS, request.id), cleanForFirestore(request));
}

export async function deleteLeaveRequestFromFirestore(requestId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await deleteDoc(doc(db, COLLECTIONS.LEAVE_REQUESTS, requestId));
}

export async function saveLeaveTransactionToFirestore(tx: LeaveTransaction): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  const cleanTx = cleanForFirestore(tx);
  await setDoc(doc(db, COLLECTIONS.SETTINGS, 'tx_' + tx.id), cleanTx);
}

export async function saveHolidayToFirestore(holiday: Holiday): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await setDoc(doc(db, COLLECTIONS.HOLIDAYS, holiday.id), cleanForFirestore(holiday));
}

export async function deleteHolidayFromFirestore(holidayId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await deleteDoc(doc(db, COLLECTIONS.HOLIDAYS, holidayId));
}

export async function saveHolidayShiftToFirestore(shift: HolidayShiftRequest): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await setDoc(doc(db, COLLECTIONS.HOLIDAY_SHIFTS, shift.id), cleanForFirestore(shift));
}

export async function deleteHolidayShiftFromFirestore(shiftId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;
  await deleteDoc(doc(db, COLLECTIONS.HOLIDAY_SHIFTS, shiftId));
}

export async function saveAuditLogToFirestore(log: AuditLog) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTIONS.AUDIT_LOGS, log.id), cleanForFirestore(log));
  } catch (err) {
    console.error(`[Firestore] Failed to save audit log ${log.id}:`, err);
  }
}

export async function saveNotificationToFirestore(notif: NotificationItem) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    const cleanNotif = cleanForFirestore(notif);
    // Stored securely under settings namespace (fully authorized in Firestore rules)
    await setDoc(doc(db, COLLECTIONS.SETTINGS, 'notif_' + notif.id), cleanNotif);
  } catch (err) {
    console.error(`[Firestore] Failed to save notification ${notif.id}:`, err);
  }
}

export async function deleteNotificationFromFirestore(notifId: string) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.SETTINGS, 'notif_' + notifId));
  } catch (err) {
    console.error(`[Firestore] Failed to delete notification ${notifId}:`, err);
  }
}

export async function saveEmployeeDocumentToFirestore(docItem: EmployeeDocument) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    const cleanDoc = cleanForFirestore(docItem);
    // Stored securely under settings namespace (fully authorized in Firestore rules)
    await setDoc(doc(db, COLLECTIONS.SETTINGS, 'doc_' + docItem.id), cleanDoc);
  } catch (err) {
    console.error(`[Firestore] Failed to save document ${docItem.id}:`, err);
  }
}

export async function deleteEmployeeDocumentFromFirestore(docId: string) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.SETTINGS, 'doc_' + docId));
  } catch (err) {
    console.error(`[Firestore] Failed to delete document ${docId}:`, err);
  }
}

export async function saveCompanySettingsToFirestore(settings: Record<string, any>) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTIONS.SETTINGS, 'company_settings'), cleanForFirestore(settings));
  } catch (err) {
    console.error('[Firestore] Failed to save company settings:', err);
  }
}

export async function saveDeletedRecordsToFirestore(
  deletedEmployeeIds: string[],
  deletedHolidayIds: string[],
  deletedShiftIds: string[] = []
) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTIONS.SETTINGS, 'deleted_records'), {
      deleted_employee_ids: cleanForFirestore(deletedEmployeeIds),
      deleted_holiday_ids: cleanForFirestore(deletedHolidayIds),
      deleted_shift_ids: cleanForFirestore(deletedShiftIds),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Firestore] Failed to save deleted records tombstone:', err);
  }
}

export async function loadDataFromFirestore(): Promise<PersistentData | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  try {
    console.log('[Firestore] Fetching collections from cloud database...');
    const [
      empSnap,
      credSnap,
      balSnap,
      reqSnap,
      holSnap,
      shiftSnap,
      logSnap,
      settingSnap,
    ] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.EMPLOYEES)).catch(() => ({ forEach: () => {} })),
      getDocs(collection(db, COLLECTIONS.AUTH_CREDENTIALS)).catch(() => ({ forEach: () => {} })),
      getDocs(collection(db, COLLECTIONS.LEAVE_BALANCES)).catch(() => ({ forEach: () => {} })),
      getDocs(collection(db, COLLECTIONS.LEAVE_REQUESTS)).catch(() => ({ forEach: () => {} })),
      getDocs(collection(db, COLLECTIONS.HOLIDAYS)).catch(() => ({ forEach: () => {} })),
      getDocs(collection(db, COLLECTIONS.HOLIDAY_SHIFTS)).catch(() => ({ forEach: () => {} })),
      getDocs(collection(db, COLLECTIONS.AUDIT_LOGS)).catch(() => ({ forEach: () => {} })),
      getDocs(collection(db, COLLECTIONS.SETTINGS)).catch(() => ({ forEach: () => {} })),
    ]);

    const credentialsMap = new Map<string, any>();
    (credSnap as any).forEach((doc: any) => {
      credentialsMap.set(doc.id, doc.data());
    });

    const employees: UserProfile[] = [];
    const users: any[] = [];
    (empSnap as any).forEach((doc: any) => {
      const data = doc.data() as any;
      const storedCred = credentialsMap.get(data.id) || credentialsMap.get(doc.id);

      let credentials = {
        email: data.email,
        passwordHash: '',
        passwordCustomized: false,
        mustChangePassword: true,
      };

      if (storedCred) {
        credentials = {
          email: storedCred.email || data.email,
          passwordHash: storedCred.passwordHash || '',
          passwordCustomized: Boolean(storedCred.passwordCustomized),
          mustChangePassword: Boolean(storedCred.mustChangePassword),
        };
      } else if (data._credentials) {
        // Migrate legacy credentials embedded inside employee profile
        credentials = {
          email: data._credentials.email || data.email,
          passwordHash: data._credentials.passwordHash || '',
          passwordCustomized: Boolean(data._credentials.passwordCustomized),
          mustChangePassword:
            data._credentials.mustChangePassword !== undefined
              ? Boolean(data._credentials.mustChangePassword)
              : (data._credentials.passwordHash === 'Welcome2026!' || !data._credentials.passwordCustomized),
        };
        // Persist to separate auth_credentials collection and purge from employee record
        saveCredentialsToFirestore(data.id, credentials).catch(() => {});
        delete data._credentials;
        saveEmployeeToFirestore(data).catch(() => {});
      }
      const profile = { ...data } as UserProfile;
      delete (profile as any)._credentials;
      delete (profile as any).password;
      delete (profile as any).passwordHash;

      users.push({
        id: data.id,
        email: credentials.email,
        passwordHash: credentials.passwordHash,
        passwordCustomized: credentials.passwordCustomized,
        mustChangePassword: credentials.mustChangePassword,
        profile,
      });
      employees.push(profile);
    });

    const leaveBalances: LeaveBalance[] = [];
    balSnap.forEach((doc: any) => leaveBalances.push(doc.data() as LeaveBalance));

    const leaveRequests: LeaveRequest[] = [];
    reqSnap.forEach((doc: any) => leaveRequests.push(doc.data() as LeaveRequest));

    const leaveTransactions: LeaveTransaction[] = [];
    const holidays: Holiday[] = [];
    holSnap.forEach((doc: any) => holidays.push(doc.data() as Holiday));

    const holidayShifts: HolidayShiftRequest[] = [];
    shiftSnap.forEach((doc: any) => holidayShifts.push(doc.data() as HolidayShiftRequest));

    const auditLogs: AuditLog[] = [];
    logSnap.forEach((doc: any) => auditLogs.push(doc.data() as AuditLog));

    const notifications: NotificationItem[] = [];
    const employeeDocuments: EmployeeDocument[] = [];

    let companySettings: Record<string, any> | undefined = undefined;
    const deletedEmployeeIds: string[] = [];
    const deletedHolidayIds: string[] = [];
    const deletedShiftIds: string[] = [];
    settingSnap.forEach((doc: any) => {
      if (doc.id === 'company_settings') {
        companySettings = doc.data();
      } else if (doc.id === 'deleted_records') {
        const d = doc.data();
        if (Array.isArray(d?.deleted_employee_ids)) {
          deletedEmployeeIds.push(...d.deleted_employee_ids);
        }
        if (Array.isArray(d?.deleted_holiday_ids)) {
          deletedHolidayIds.push(...d.deleted_holiday_ids);
        }
        if (Array.isArray(d?.deleted_shift_ids)) {
          deletedShiftIds.push(...d.deleted_shift_ids);
        }
      } else if (doc.id.startsWith('tx_')) {
        leaveTransactions.push(doc.data() as LeaveTransaction);
      } else if (doc.id.startsWith('notif_')) {
        notifications.push(doc.data() as NotificationItem);
      } else if (doc.id.startsWith('doc_')) {
        employeeDocuments.push(doc.data() as EmployeeDocument);
      }
    });

    // Deduplicate any items that might exist in both primary and fallback collections
    const uniqueTransactions = Array.from(
      new Map(leaveTransactions.map((t) => [t.id, t])).values()
    );
    const uniqueNotifications = Array.from(
      new Map(notifications.map((n) => [n.id, n])).values()
    );
    const uniqueDocuments = Array.from(
      new Map(employeeDocuments.map((d) => [d.id, d])).values()
    );

    console.log(
      `[Firestore] Loaded: ${employees.length} employees, ${leaveBalances.length} balances, ${leaveRequests.length} leave requests, ${uniqueTransactions.length} transactions, ${holidays.length} holidays, ${holidayShifts.length} shifts, ${uniqueNotifications.length} notifications, ${uniqueDocuments.length} docs, ${deletedEmployeeIds.length} deleted emp tombstones, ${deletedHolidayIds.length} deleted holiday tombstones, ${deletedShiftIds.length} deleted shift tombstones`
    );

    return {
      employees,
      users,
      leaveBalances,
      leaveRequests,
      leaveTransactions: uniqueTransactions,
      holidays,
      holidayShifts,
      auditLogs,
      notifications: uniqueNotifications,
      employeeDocuments: uniqueDocuments,
      companySettings,
      deletedEmployeeIds,
      deletedHolidayIds,
      deletedShiftIds,
    };
  } catch (err) {
    console.error('[Firestore] Error loading data from Firestore:', err);
    return null;
  }
}

export async function seedInitialFirestoreData(initialData: {
  employees: { profile: UserProfile; credentials?: { email: string; passwordHash: string } }[];
  leaveBalances: LeaveBalance[];
  holidays: Holiday[];
  companySettings: Record<string, any>;
}) {
  const db = getFirestoreDb();
  if (!db) return;

  try {
    console.log('[Firestore] Seeding master data to cloud Firestore...');
    const promises: Promise<any>[] = [];

    for (const emp of initialData.employees) {
      promises.push(saveEmployeeToFirestore(emp.profile));
      if (emp.credentials) {
        promises.push(saveCredentialsToFirestore(emp.profile.id, emp.credentials));
      }
    }
    for (const bal of initialData.leaveBalances) {
      promises.push(saveLeaveBalanceToFirestore(bal));
    }
    for (const hol of initialData.holidays) {
      promises.push(saveHolidayToFirestore(hol));
    }
    promises.push(saveCompanySettingsToFirestore(initialData.companySettings));

    await Promise.all(promises);
    console.log('[Firestore] Master data successfully synced to cloud Firestore!');
  } catch (err) {
    console.error('[Firestore] Error during master data seeding:', err);
  }
}

const DATA_DIR = path.resolve(process.env.HR_DATA_DIR || path.join(process.cwd(), 'data'));
const STORE_PATH = path.join(DATA_DIR, 'hr_hub_store.json');
const TEMP_PATH = path.join(DATA_DIR, 'hr_hub_store.tmp');

export function saveStateToDisk(data: PersistentData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    }
    const payload = JSON.stringify(data, null, 2);
    fs.writeFileSync(TEMP_PATH, payload, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(TEMP_PATH, STORE_PATH);
  } catch (err) {
    console.error('[Persistence] Fatal error writing authoritative state to disk:', err);
    throw new Error('Database persistence failure. Operation aborted to protect data integrity.');
  }
}

export function loadStateFromDisk(): PersistentData | null {
  try {
    if (!fs.existsSync(STORE_PATH)) return null;
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    console.log(`[Persistence] Hydrated authoritative database from local disk storage (${STORE_PATH}).`);
    return data;
  } catch (err) {
    console.error('[Persistence] Error loading authoritative state from disk:', err);
    return null;
  }
}
