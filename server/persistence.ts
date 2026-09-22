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
  Holiday,
  HolidayShiftRequest,
  AuditLog,
} from '../src/types.js';

export interface PersistentData {
  users?: any[];
  employees: UserProfile[];
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
  holidays: Holiday[];
  holidayShifts: HolidayShiftRequest[];
  auditLogs: AuditLog[];
  companySettings?: Record<string, any>;
}

// Collections mapping
const COLLECTIONS = {
  EMPLOYEES: 'employees',
  LEAVE_BALANCES: 'leave_balances',
  LEAVE_REQUESTS: 'leave_requests',
  HOLIDAYS: 'holidays',
  HOLIDAY_SHIFTS: 'holiday_shifts',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
};

export async function saveEmployeeToFirestore(employee: UserProfile, credentials?: { email: string; passwordHash: string }) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    const dataToSave: any = { ...employee };
    if (credentials) {
      dataToSave._credentials = credentials;
    }
    await setDoc(doc(db, COLLECTIONS.EMPLOYEES, employee.id), dataToSave);
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
    await setDoc(doc(db, COLLECTIONS.LEAVE_BALANCES, balance.id), balance);
  } catch (err) {
    console.error(`[Firestore] Failed to save leave balance ${balance.id}:`, err);
  }
}

export async function saveLeaveRequestToFirestore(request: LeaveRequest) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTIONS.LEAVE_REQUESTS, request.id), request);
  } catch (err) {
    console.error(`[Firestore] Failed to save leave request ${request.id}:`, err);
  }
}

export async function saveHolidayToFirestore(holiday: Holiday) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTIONS.HOLIDAYS, holiday.id), holiday);
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
    await setDoc(doc(db, COLLECTIONS.HOLIDAY_SHIFTS, shift.id), shift);
  } catch (err) {
    console.error(`[Firestore] Failed to save holiday shift ${shift.id}:`, err);
  }
}

export async function saveAuditLogToFirestore(log: AuditLog) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTIONS.AUDIT_LOGS, log.id), log);
  } catch (err) {
    console.error(`[Firestore] Failed to save audit log ${log.id}:`, err);
  }
}

export async function saveCompanySettingsToFirestore(settings: Record<string, any>) {
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await setDoc(doc(db, COLLECTIONS.SETTINGS, 'company_settings'), settings);
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
      getDocs(collection(db, COLLECTIONS.EMPLOYEES)),
      getDocs(collection(db, COLLECTIONS.LEAVE_BALANCES)),
      getDocs(collection(db, COLLECTIONS.LEAVE_REQUESTS)),
      getDocs(collection(db, COLLECTIONS.HOLIDAYS)),
      getDocs(collection(db, COLLECTIONS.HOLIDAY_SHIFTS)),
      getDocs(collection(db, COLLECTIONS.AUDIT_LOGS)),
      getDocs(collection(db, COLLECTIONS.SETTINGS)),
    ]);

    const employees: UserProfile[] = [];
    const users: any[] = [];
    empSnap.forEach((doc) => {
      const data = doc.data() as any;
      if (data._credentials) {
        users.push({
          id: data.id,
          email: data._credentials.email || data.email,
          passwordHash: data._credentials.passwordHash || '',
          profile: { ...data },
        });
        delete data._credentials;
      }
      employees.push(data as UserProfile);
    });

    const leaveBalances: LeaveBalance[] = [];
    balSnap.forEach((doc) => leaveBalances.push(doc.data() as LeaveBalance));

    const leaveRequests: LeaveRequest[] = [];
    reqSnap.forEach((doc) => leaveRequests.push(doc.data() as LeaveRequest));

    const holidays: Holiday[] = [];
    holSnap.forEach((doc) => holidays.push(doc.data() as Holiday));

    const holidayShifts: HolidayShiftRequest[] = [];
    shiftSnap.forEach((doc) => holidayShifts.push(doc.data() as HolidayShiftRequest));

    const auditLogs: AuditLog[] = [];
    logSnap.forEach((doc) => auditLogs.push(doc.data() as AuditLog));

    let companySettings: Record<string, any> | undefined = undefined;
    settingSnap.forEach((doc) => {
      if (doc.id === 'company_settings') {
        companySettings = doc.data();
      }
    });

    console.log(
      `[Firestore] Loaded: ${employees.length} employees, ${leaveBalances.length} balances, ${leaveRequests.length} leave requests, ${holidays.length} holidays, ${holidayShifts.length} shifts`
    );

    return {
      employees,
      users,
      leaveBalances,
      leaveRequests,
      holidays,
      holidayShifts,
      auditLogs,
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
