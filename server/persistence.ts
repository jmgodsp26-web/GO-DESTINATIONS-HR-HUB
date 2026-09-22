import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
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
}

// Collections mapping
const COLLECTIONS = {
  EMPLOYEES: 'employees',
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

export async function saveEmployeeToFirestore(employee: UserProfile, credentials?: { email: string; passwordHash: string }) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    const dataToSave: any = { ...employee };
    if (credentials) {
      dataToSave._credentials = credentials;
    }
    await setDoc(doc(db, COLLECTIONS.EMPLOYEES, employee.id), cleanForFirestore(dataToSave));
  } catch (err) {
    console.error(`[Firestore] Failed to save employee ${employee.id}:`, err);
  }
}

export async function deleteEmployeeFromFirestore(employeeId: string) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.EMPLOYEES, employeeId));
  } catch (err) {
    console.error(`[Firestore] Failed to delete employee ${employeeId}:`, err);
  }
}

export async function saveLeaveBalanceToFirestore(balance: LeaveBalance) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTIONS.LEAVE_BALANCES, balance.id), cleanForFirestore(balance));
  } catch (err) {
    console.error(`[Firestore] Failed to save leave balance ${balance.id}:`, err);
  }
}

export async function saveLeaveRequestToFirestore(request: LeaveRequest) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTIONS.LEAVE_REQUESTS, request.id), cleanForFirestore(request));
  } catch (err) {
    console.error(`[Firestore] Failed to save leave request ${request.id}:`, err);
  }
}

export async function deleteLeaveRequestFromFirestore(requestId: string) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.LEAVE_REQUESTS, requestId));
  } catch (err) {
    console.error(`[Firestore] Failed to delete leave request ${requestId}:`, err);
  }
}

export async function saveLeaveTransactionToFirestore(tx: LeaveTransaction) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    const cleanTx = cleanForFirestore(tx);
    // Stored securely under settings namespace (fully authorized in Firestore rules)
    await setDoc(doc(db, COLLECTIONS.SETTINGS, 'tx_' + tx.id), cleanTx);
  } catch (err) {
    console.error(`[Firestore] Failed to save leave transaction ${tx.id}:`, err);
  }
}

export async function saveHolidayToFirestore(holiday: Holiday) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTIONS.HOLIDAYS, holiday.id), cleanForFirestore(holiday));
  } catch (err) {
    console.error(`[Firestore] Failed to save holiday ${holiday.id}:`, err);
  }
}

export async function deleteHolidayFromFirestore(holidayId: string) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.HOLIDAYS, holidayId));
  } catch (err) {
    console.error(`[Firestore] Failed to delete holiday ${holidayId}:`, err);
  }
}

export async function saveHolidayShiftToFirestore(shift: HolidayShiftRequest) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTIONS.HOLIDAY_SHIFTS, shift.id), cleanForFirestore(shift));
  } catch (err) {
    console.error(`[Firestore] Failed to save holiday shift ${shift.id}:`, err);
  }
}

export async function deleteHolidayShiftFromFirestore(shiftId: string) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.HOLIDAY_SHIFTS, shiftId));
  } catch (err) {
    console.error(`[Firestore] Failed to delete holiday shift ${shiftId}:`, err);
  }
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

export async function loadDataFromFirestore(): Promise<PersistentData | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  try {
    console.log('[Firestore] Fetching collections from cloud database...');
    const [
      empSnap,
      balSnap,
      reqSnap,
      holSnap,
      shiftSnap,
      logSnap,
      settingSnap,
    ] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.EMPLOYEES)).catch(() => ({ forEach: () => {} })),
      getDocs(collection(db, COLLECTIONS.LEAVE_BALANCES)).catch(() => ({ forEach: () => {} })),
      getDocs(collection(db, COLLECTIONS.LEAVE_REQUESTS)).catch(() => ({ forEach: () => {} })),
      getDocs(collection(db, COLLECTIONS.HOLIDAYS)).catch(() => ({ forEach: () => {} })),
      getDocs(collection(db, COLLECTIONS.HOLIDAY_SHIFTS)).catch(() => ({ forEach: () => {} })),
      getDocs(collection(db, COLLECTIONS.AUDIT_LOGS)).catch(() => ({ forEach: () => {} })),
      getDocs(collection(db, COLLECTIONS.SETTINGS)).catch(() => ({ forEach: () => {} })),
    ]);

    const employees: UserProfile[] = [];
    const users: any[] = [];
    empSnap.forEach((doc: any) => {
      const data = doc.data() as any;
      let credentials = { email: data.email, passwordHash: '' };
      if (data._credentials) {
        credentials = {
          email: data._credentials.email || data.email,
          passwordHash: data._credentials.passwordHash || '',
        };
        delete data._credentials;
      }
      const profile = { ...data } as UserProfile;
      delete (profile as any)._credentials;

      users.push({
        id: data.id,
        email: credentials.email,
        passwordHash: credentials.passwordHash,
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
    settingSnap.forEach((doc: any) => {
      if (doc.id === 'company_settings') {
        companySettings = doc.data();
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
      `[Firestore] Loaded: ${employees.length} employees, ${leaveBalances.length} balances, ${leaveRequests.length} leave requests, ${uniqueTransactions.length} transactions, ${holidays.length} holidays, ${holidayShifts.length} shifts, ${uniqueNotifications.length} notifications, ${uniqueDocuments.length} docs`
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
      promises.push(saveEmployeeToFirestore(emp.profile, emp.credentials));
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
