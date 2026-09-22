import {
  UserProfile,
  LeaveBalance,
  LeaveRequest,
  LeaveTransaction,
  Holiday,
  HolidayType,
  HolidayScope,
  AuditLog,
  NotificationItem,
  UserRole,
  LeaveType,
  EmployeeDocument,
  HolidayShiftRequest,
  HolidayShiftStatus,
  HolidayStaffingCoverage,
  HolidayEmployeeStatus,
  isPaidLeaveType,
  OFFICIAL_DEPARTMENTS,
  LEAVE_TYPE_MASTER_DATA,
} from '../src/types.js';
import {
  saveEmployeeToFirestore,
  deleteEmployeeFromFirestore,
  saveLeaveBalanceToFirestore,
  saveLeaveRequestToFirestore,
  saveHolidayToFirestore,
  deleteHolidayFromFirestore,
  saveHolidayShiftToFirestore,
  saveAuditLogToFirestore,
  saveCompanySettingsToFirestore,
  loadDataFromFirestore,
  seedInitialFirestoreData,
} from './persistence.js';

interface UserCredentials {
  id: string;
  email: string;
  passwordHash: string;
  profile: UserProfile;
}

export function isProgramCoordinator(user: { job_title?: string; department?: string; is_pc?: boolean }): boolean {
  if (user.is_pc === true) return true;
  const title = (user.job_title || '').toLowerCase();
  return (
    title.includes('program coordinator') ||
    title.includes('coordinator') ||
    title.includes(' pc') ||
    title.startsWith('pc ') ||
    title === 'pc'
  );
}

class HRDatabase {
  private users: UserCredentials[] = [];
  private leaveBalances: LeaveBalance[] = [];
  private leaveTransactions: LeaveTransaction[] = [];
  private leaveRequests: LeaveRequest[] = [];
  private holidays: Holiday[] = [];
  private holidayShifts: HolidayShiftRequest[] = [];
  private auditLogs: AuditLog[] = [];
  private notifications: NotificationItem[] = [];
  private employeeDocuments: EmployeeDocument[] = [];
  private sessions: Map<string, string> = new Map(); // token -> user_id

  constructor() {
    this.seedInitialData();
  }

  public async initFirestoreSync(): Promise<void> {
    try {
      const cloudData = await loadDataFromFirestore();
      if (cloudData && cloudData.employees && cloudData.employees.length > 0) {
        console.log(`[Firestore] Syncing ${cloudData.employees.length} employees, ${cloudData.leaveRequests.length} leave requests, ${cloudData.leaveBalances.length} balances from cloud Firestore.`);

        if (cloudData.users && cloudData.users.length > 0) {
          this.users = cloudData.users;
        } else {
          this.users = cloudData.employees.map((emp) => ({
            id: emp.id,
            email: emp.email,
            passwordHash: '',
            profile: emp,
          }));
        }

        this.leaveBalances = cloudData.leaveBalances || [];
        this.leaveRequests = cloudData.leaveRequests || [];
        if (cloudData.holidays && cloudData.holidays.length > 0) {
          this.holidays = cloudData.holidays;
        }
        this.holidayShifts = cloudData.holidayShifts || [];
        if (cloudData.auditLogs && cloudData.auditLogs.length > 0) {
          this.auditLogs = cloudData.auditLogs;
        }
        if (cloudData.companySettings) {
          this.companySettings = {
            ...this.companySettings,
            ...cloudData.companySettings,
          };
        }
        console.log('[Firestore] State hydration from cloud Firestore complete!');
      } else {
        console.log('[Firestore] Firestore collection is empty. Seeding master data to cloud...');
        await seedInitialFirestoreData({
          employees: this.users.map((u) => ({
            profile: u.profile,
            credentials: { email: u.email, passwordHash: u.passwordHash },
          })),
          leaveBalances: this.leaveBalances,
          holidays: this.holidays,
          companySettings: this.companySettings,
        });
        console.log('[Firestore] Initial master data seeded successfully in cloud Firestore!');
      }
    } catch (err) {
      console.error('[Firestore] Initialization error (continuing with local cache):', err);
    }
  }

  private seedInitialData() {
    // Authorized staff accounts (Admins & Employees)
    const rawStaff: Array<{
      id: string;
      full_name: string;
      email: string;
      role: UserRole;
      department: string;
      job_title: string;
      employee_id: string;
    }> = [
      {
        id: "usr-isiah-dane",
        full_name: "Isiah Dane",
        email: "igeguera@gmail.com",
        role: "admin",
        department: "Leadership",
        job_title: "HR Administrator",
        employee_id: "HR-001",
      },
      {
        id: "usr-ann-loraine",
        full_name: "Ann Loraine",
        email: "ann.loraine@godestinations.com",
        role: "admin",
        department: "Leadership",
        job_title: "HR Director",
        employee_id: "HR-002",
      },
      {
        id: "usr-trixie-garganera",
        full_name: "Trixie Garganera",
        email: "trixie.garganera@godestinations.com",
        role: "employee",
        department: "Program Management",
        job_title: "Program Manager",
        employee_id: "HR-003",
      },
      {
        id: "usr-denisse-joseph",
        full_name: "Denisse Joseph",
        email: "denisse.joseph@godestinations.com",
        role: "employee",
        department: "Relationship Management",
        job_title: "Relationship Manager",
        employee_id: "HR-004",
      },
    ];

    this.users = rawStaff.map((s) => ({
      id: s.id,
      email: s.email,
      passwordHash: "",
      profile: {
        id: s.id,
        user_id: s.id,
        employee_id: s.employee_id,
        full_name: s.full_name,
        email: s.email,
        phone: "+63 917 123 4567",
        department: s.department,
        job_title: s.job_title,
        country: "Philippines",
        region: "National Capital Region",
        timezone: "Asia/Manila",
        date_joined: "2024-01-15",
        hire_date: "2024-01-15",
        date_of_birth: "1995-05-12",
        birthday: "1995-05-12",
        avatar_url: "",
        role: s.role,
        status: "active",
        is_pc: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }));

    // Initial Leave Balances for authorized users (0 used)
    this.leaveBalances = [];
    for (const u of this.users) {
      this.leaveBalances.push({
        id: "bal-vac-" + u.id,
        employee_id: u.id,
        leave_type: "Vacation Leave",
        allocated_days: u.profile.role === "admin" ? 20 : 15,
        used_days: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      this.leaveBalances.push({
        id: "bal-sick-" + u.id,
        employee_id: u.id,
        leave_type: "Sick Leave",
        allocated_days: 10,
        used_days: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      this.leaveBalances.push({
        id: "bal-emerg-" + u.id,
        employee_id: u.id,
        leave_type: "Emergency Leave",
        allocated_days: 5,
        used_days: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Company & Multi-Country Holidays
    this.holidays = [
      // --- PAST OBSERVED HOLIDAYS (For historical record & testing past-date filtering) ---
      {
        id: 'hol-00',
        name: 'National Heroes Day',
        date: '2026-08-31',
        country: 'Philippines',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'National public observance honoring the heroes of the Philippine revolution and nation.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-01',
        name: 'Labor Day',
        date: '2026-09-07',
        country: 'United States',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Federal holiday celebrating the American labor movement and contributions of workers.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-ca-01',
        name: 'Labour Day',
        date: '2026-09-07',
        country: 'Canada',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Statutory holiday celebrating the achievements of workers across Canada.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },

      // --- UPCOMING 2026 HOLIDAYS ---
      {
        id: 'hol-ca-02',
        name: 'National Day for Truth and Reconciliation',
        date: '2026-09-30',
        country: 'Canada',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Federal statutory holiday honoring children who survived residential schools and remembering those who did not.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-global-01',
        name: 'Global Summit & Wellbeing Day',
        date: '2026-10-02',
        country: 'Company-wide',
        region: 'All',
        holiday_type: 'Company Holiday',
        scope: 'Company-wide',
        description: 'All-hands global organizational reflection and mental health wellness break for all employees worldwide.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-ca-03',
        name: 'Thanksgiving Day',
        date: '2026-10-12',
        country: 'Canada',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Statutory holiday observed with family gatherings and gratitude across Canada.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-us-02',
        name: "Indigenous Peoples' Day / Columbus Day",
        date: '2026-10-12',
        country: 'United States',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Federal holiday recognizing the histories, resilience, and cultures of Indigenous peoples.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-us-03',
        name: 'Veterans Day',
        date: '2026-11-11',
        country: 'United States',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Federal holiday honoring military veterans who have served in the United States Armed Forces.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-ca-04',
        name: 'Remembrance Day',
        date: '2026-11-11',
        country: 'Canada',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Memorial day observed in Commonwealth member states since the end of the First World War.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-02',
        name: 'Thanksgiving Day',
        date: '2026-11-26',
        country: 'United States',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Federal holiday celebrated with family, feasting, and community gathering.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-03',
        name: 'Day After Thanksgiving',
        date: '2026-11-27',
        country: 'United States',
        region: 'All',
        holiday_type: 'Company Holiday',
        scope: 'Country-specific',
        description: 'Extended holiday weekend break for US personnel.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-ph-02',
        name: 'Bonifacio Day',
        date: '2026-11-30',
        country: 'Philippines',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Regular national holiday commemorating the birth and bravery of Andrés Bonifacio.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-ph-03',
        name: 'Feast of the Immaculate Conception',
        date: '2026-12-08',
        country: 'Philippines',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Special non-working national holiday observed throughout the Philippines.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-04',
        name: 'Christmas Eve',
        date: '2026-12-24',
        country: 'Philippines',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Special non-working holiday for family reunion and Noche Buena festivities.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-05',
        name: 'Christmas Day',
        date: '2026-12-25',
        country: 'Company-wide',
        region: 'All',
        holiday_type: 'Company Holiday',
        scope: 'Company-wide',
        description: 'Global holiday closure across all company locations and international offices.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-ca-05',
        name: 'Boxing Day',
        date: '2026-12-26',
        country: 'Canada',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Statutory holiday celebrated the day after Christmas across Canada.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-global-02',
        name: 'Year-End Global Rest & Shutdown',
        date: '2026-12-28',
        country: 'Company-wide',
        region: 'All',
        holiday_type: 'Company Holiday',
        scope: 'Company-wide',
        description: 'Annual paid winter shutdown for all international staff to recharge.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-ph-04',
        name: 'Rizal Day',
        date: '2026-12-30',
        country: 'Philippines',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'National holiday honoring the martyrdom, life, and legacy of Dr. José Rizal.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-06',
        name: 'Last Day of the Year',
        date: '2026-12-31',
        country: 'Philippines',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Special non-working holiday welcoming the New Year celebration.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },

      // --- UPCOMING 2027 HOLIDAYS (Seamless Year Transition) ---
      {
        id: 'hol-07',
        name: "New Year's Day",
        date: '2027-01-01',
        country: 'Company-wide',
        region: 'All',
        holiday_type: 'Company Holiday',
        scope: 'Company-wide',
        description: 'First day of the new calendar year observed worldwide as a company-wide holiday closure.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-us-04',
        name: 'Martin Luther King Jr. Day',
        date: '2027-01-18',
        country: 'United States',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Federal holiday marking the birthday of civil rights pioneer Dr. Martin Luther King Jr.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-ph-05',
        name: 'EDSA People Power Revolution Anniversary',
        date: '2027-02-25',
        country: 'Philippines',
        region: 'All',
        holiday_type: 'Observance',
        scope: 'Country-specific',
        description: 'Special national observance commemorating the historic peaceful restoration of democracy.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-global-03',
        name: 'Global Innovation & Hack Day',
        date: '2027-03-15',
        country: 'Company-wide',
        region: 'All',
        holiday_type: 'Company Holiday',
        scope: 'Company-wide',
        description: 'Company-wide creative exploration day and global project showcase.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-ph-06',
        name: 'Araw ng Kagitingan (Day of Valor)',
        date: '2027-04-09',
        country: 'Philippines',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Regular national holiday honoring Filipino and allied veterans of World War II.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-ca-06',
        name: 'Victoria Day',
        date: '2027-05-24',
        country: 'Canada',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Canadian statutory holiday honoring Queen Victoria and marking the unofficial beginning of summer.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-us-05',
        name: 'Memorial Day',
        date: '2027-05-31',
        country: 'United States',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Federal holiday honoring military personnel who died in service of the country.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-ph-07',
        name: 'Philippine Independence Day',
        date: '2027-06-12',
        country: 'Philippines',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Annual regular national holiday commemorating the 1898 declaration of Philippine independence.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-ca-07',
        name: 'Canada Day',
        date: '2027-07-01',
        country: 'Canada',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'National holiday celebrating the anniversary of the confederation of Canada.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'hol-us-06',
        name: 'Independence Day',
        date: '2027-07-04',
        country: 'United States',
        region: 'All',
        holiday_type: 'Public Holiday',
        scope: 'Country-specific',
        description: 'Federal holiday commemorating the adoption of the Declaration of Independence.',
        is_active: true,
        created_by: 'System',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    // Initialize all operational records completely clean (no dummy data)
    this.holidayShifts = [];
    this.leaveRequests = [];
    this.leaveTransactions = [];
    this.auditLogs = [];
    this.notifications = [];
    this.employeeDocuments = [];
  }

  // --- AUTH METHODS ---
  public authenticate(identifier: string, passwordHash?: string): { token: string; user: UserProfile } | null {
    const cleanId = (identifier || '').trim().toLowerCase();
    if (!cleanId) return null;

    const user = this.users.find((u) => {
      const email = (u.email || '').toLowerCase();
      const emailUser = email.split('@')[0];
      const fullName = (u.profile.full_name || '').toLowerCase();
      const nameParts = fullName.split(' ').filter(Boolean);
      const id = (u.id || '').toLowerCase();
      const empId = (u.profile.employee_id || '').toLowerCase();

      const emailMatch = email === cleanId || emailUser === cleanId;
      const nameMatch =
        fullName === cleanId ||
        nameParts.includes(cleanId) ||
        cleanId.includes(fullName) ||
        (cleanId.includes('isiah') && u.id === 'usr-isiah-dane') ||
        (cleanId.includes('geguera') && (u.id === 'usr-isiah-dane' || email.includes('geguera')));
      const idMatch = id === cleanId;
      const empIdMatch = empId && empId === cleanId;

      return emailMatch || nameMatch || idMatch || empIdMatch;
    });

    if (!user) return null;
    if (user.profile.status === 'disabled') {
      throw new Error('This account has been disabled. Please contact your HR administrator.');
    }

    // If password is set on the account, check it. If the account has no password set, permit sign-in without password.
    if (user.passwordHash && user.passwordHash !== (passwordHash || '')) {
      return null;
    }

    const token = 'token_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    this.sessions.set(token, user.id);
    return { token, user: user.profile };
  }

  public getUserByToken(token: string): UserProfile | null {
    if (!token) return null;
    const userId = this.sessions.get(token);
    if (!userId) return null;
    const user = this.users.find((u) => u.id === userId);
    return user ? user.profile : null;
  }

  public logout(token: string) {
    this.sessions.delete(token);
  }

  // --- EMPLOYEE PROFILE & MANAGEMENT METHODS ---
  public getProfile(userId: string): UserProfile | null {
    const user = this.users.find((u) => u.id === userId);
    return user ? user.profile : null;
  }

  public getAllEmployees(): (UserProfile & { leave_balances: LeaveBalance[]; is_pc: boolean })[] {
    return this.users.map((u) => {
      const balances = this.leaveBalances.filter((b) => b.employee_id === u.id);
      return {
        ...u.profile,
        is_pc: isProgramCoordinator(u.profile),
        leave_balances: balances,
      };
    });
  }

  public createEmployee(
    data: {
      full_name: string;
      email: string;
      password?: string;
      phone: string;
      department: string;
      job_title: string;
      country?: string;
      region?: string;
      timezone?: string;
      date_joined: string;
      hire_date?: string;
      date_of_birth?: string;
      birthday?: string;
      avatar_url?: string;
      annual_leave_days?: number;
      sick_leave_days?: number;
      role?: UserRole;
      is_pc?: boolean;
    },
    adminUser: UserProfile
  ): UserProfile {
    if (data.email && this.users.some((u) => u.email && u.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error('An employee with this email already exists.');
    }

    const newId = 'usr-' + Math.random().toString(36).substring(2, 9);
    const employeeId = 'HR-' + (100 + this.users.length).toString();
    const joined = data.hire_date || data.date_joined || new Date().toISOString().split('T')[0];

    const profile: UserProfile = {
      id: newId,
      user_id: newId,
      employee_id: employeeId,
      full_name: data.full_name,
      email: data.email || '',
      phone: data.phone || '',
      department: data.department || '',
      job_title: data.job_title || (data.role === 'admin' ? 'Administrator' : 'Employee'),
      country: data.country || '',
      region: data.region || '',
      timezone: data.timezone || '',
      date_joined: joined,
      hire_date: joined,
      date_of_birth: data.date_of_birth || data.birthday || '',
      birthday: data.date_of_birth || data.birthday || '',
      avatar_url: data.avatar_url || '',
      role: data.role || 'employee',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.users.push({
      id: newId,
      email: data.email || '',
      passwordHash: data.password || '',
      profile,
    });

    this.leaveBalances.push({
      id: 'bal-' + Math.random().toString(36).substring(2, 9),
      employee_id: newId,
      leave_type: 'Vacation Leave',
      allocated_days: data.annual_leave_days ?? 20,
      used_days: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.leaveBalances.push({
      id: 'bal-' + Math.random().toString(36).substring(2, 9),
      employee_id: newId,
      leave_type: 'Sick Leave',
      allocated_days: data.sick_leave_days ?? 10,
      used_days: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.leaveBalances.push({
      id: 'bal-' + Math.random().toString(36).substring(2, 9),
      employee_id: newId,
      leave_type: 'Emergency Leave',
      allocated_days: 5,
      used_days: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.leaveBalances.push({
      id: 'bal-' + Math.random().toString(36).substring(2, 9),
      employee_id: newId,
      leave_type: 'Medical Leave',
      allocated_days: 10,
      used_days: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.logAudit({
      action: 'Employee created',
      user_id: adminUser.id,
      user_name: adminUser.full_name,
      user_role: adminUser.role,
      target_type: 'employee',
      target_id: newId,
      details: `Created employee record for ${profile.full_name} (${profile.employee_id}) with ${profile.role} role.`,
    });

    // Cloud Firestore persistence
    saveEmployeeToFirestore(profile, { email: data.email || '', passwordHash: data.password || '' }).catch((e) =>
      console.error('[Firestore] Save employee error:', e)
    );
    this.leaveBalances
      .filter((b) => b.employee_id === newId)
      .forEach((b) => saveLeaveBalanceToFirestore(b).catch((e) => console.error('[Firestore] Save balance error:', e)));

    return profile;
  }

  public updateEmployee(
    employeeId: string,
    updates: Partial<UserProfile>,
    adminUser: UserProfile
  ): UserProfile {
    const user = this.users.find((u) => u.id === employeeId);
    if (!user) throw new Error('Employee not found');

    const previousRole = user.profile.role;
    const previousStatus = user.profile.status;

    if (updates.email !== undefined) {
      user.email = updates.email;
    }

    user.profile = {
      ...user.profile,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    let details = `Updated profile information for ${user.profile.full_name}.`;
    if (updates.status && updates.status !== previousStatus) {
      details = `Changed account status of ${user.profile.full_name} to ${updates.status}.`;
    }
    if (updates.role && updates.role !== previousRole) {
      details = `Changed role of ${user.profile.full_name} from ${previousRole} to ${updates.role}.`;
    }

    this.logAudit({
      action: updates.status === 'disabled' ? 'Employee disabled' : 'Employee updated',
      user_id: adminUser.id,
      user_name: adminUser.full_name,
      user_role: adminUser.role,
      target_type: 'employee',
      target_id: employeeId,
      details,
    });

    // Cloud Firestore persistence
    saveEmployeeToFirestore(user.profile).catch((e) => console.error('[Firestore] Update employee error:', e));

    return user.profile;
  }

  public deleteEmployee(employeeId: string, adminUser: UserProfile): boolean {
    const userIdx = this.users.findIndex((u) => u.id === employeeId);
    if (userIdx === -1) throw new Error('Employee not found');

    const targetUser = this.users[userIdx];
    const name = targetUser.profile.full_name;

    if (targetUser.id === adminUser.id) {
      throw new Error('You cannot delete your own account while logged in.');
    }

    this.users.splice(userIdx, 1);
    this.leaveBalances = this.leaveBalances.filter((b) => b.employee_id !== employeeId);
    this.leaveRequests = this.leaveRequests.filter((r) => r.employee_id !== employeeId);
    this.holidayShifts = this.holidayShifts.filter((s) => s.employee_id !== employeeId);

    for (const [token, uid] of this.sessions.entries()) {
      if (uid === employeeId) {
        this.sessions.delete(token);
      }
    }

    this.logAudit({
      action: 'Employee deleted',
      user_id: adminUser.id,
      user_name: adminUser.full_name,
      user_role: adminUser.role,
      target_type: 'employee',
      target_id: employeeId,
      details: `Permanently removed employee record for ${name}.`,
    });

    // Cloud Firestore persistence
    deleteEmployeeFromFirestore(employeeId).catch((e) => console.error('[Firestore] Delete employee error:', e));

    return true;
  }

  // --- LEAVE BALANCES METHODS ---
  public getLeaveBalances(employeeId: string): LeaveBalance[] {
    return this.leaveBalances.filter((b) => b.employee_id === employeeId);
  }

  public adjustLeaveBalance(
    employeeId: string,
    leaveType: LeaveType,
    allocatedDays: number,
    adminUser: UserProfile
  ): LeaveBalance {
    let balance = this.leaveBalances.find(
      (b) =>
        b.employee_id === employeeId &&
        (b.leave_type === leaveType ||
          (leaveType === 'Vacation Leave' && (b.leave_type as string) === 'Annual Leave'))
    );

    const employee = this.getProfile(employeeId);
    const employeeName = employee ? employee.full_name : employeeId;

    if (!balance) {
      balance = {
        id: 'bal-' + Math.random().toString(36).substring(2, 9),
        employee_id: employeeId,
        leave_type: leaveType,
        allocated_days: allocatedDays,
        used_days: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.leaveBalances.push(balance);
    } else {
      balance.leave_type = leaveType;
      balance.allocated_days = allocatedDays;
      balance.updated_at = new Date().toISOString();
    }

    this.logAudit({
      action: 'Leave balance changed',
      user_id: adminUser.id,
      user_name: adminUser.full_name,
      user_role: adminUser.role,
      target_type: 'leave_balance',
      target_id: balance.id,
      details: `Adjusted ${leaveType} allocation to ${allocatedDays} days for ${employeeName}.`,
    });

    // Cloud Firestore persistence
    saveLeaveBalanceToFirestore(balance).catch((e) => console.error('[Firestore] Save balance error:', e));

    return balance;
  }

  // --- LEAVE REQUESTS METHODS ---
  public getLeaveRequests(
    user: UserProfile,
    filters?: { status?: string; employee?: string; leave_type?: string; date?: string }
  ): LeaveRequest[] {
    let requests = [...this.leaveRequests];

    if (user.role === 'employee') {
      requests = requests.filter((r) => r.employee_id === user.id);
    } else if (filters?.employee) {
      requests = requests.filter((r) => r.employee_id === filters.employee);
    }

    if (filters?.status && filters.status !== 'All') {
      requests = requests.filter((r) => r.status === filters.status);
    }

    if (filters?.leave_type && filters.leave_type !== 'All') {
      requests = requests.filter((r) => r.leave_type === filters.leave_type);
    }

    if (filters?.date) {
      requests = requests.filter(
        (r) => r.start_date <= filters.date! && r.end_date >= filters.date!
      );
    }

    return requests.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
  }

  public calculateDurationInDays(startDateStr: string, endDateStr: string): number {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Please select valid leave dates.');
    }

    const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

    if (utcEnd < utcStart) {
      throw new Error('End date cannot be earlier than start date.');
    }

    const diffDays = Math.floor((utcEnd - utcStart) / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }

  public submitLeaveRequest(
    user: UserProfile,
    data: {
      leave_type: LeaveType;
      start_date: string;
      end_date: string;
      reason: string;
      is_half_day?: boolean;
      half_day_period?: 'morning' | 'afternoon';
      attachment_name?: string;
      attachment_url?: string;
    }
  ): LeaveRequest {
    if (!data.leave_type || !data.start_date || !data.reason?.trim()) {
      throw new Error('Please fill in all required fields.');
    }

    const isHalfDay = Boolean(data.is_half_day);
    const halfDayPeriod = isHalfDay ? (data.half_day_period || 'morning') : undefined;
    const startDate = data.start_date;
    const endDate = isHalfDay ? data.start_date : (data.end_date || data.start_date);
    const totalDays = isHalfDay ? 0.5 : this.calculateDurationInDays(startDate, endDate);

    const existingApproved = this.leaveRequests.filter(
      (r) =>
        r.employee_id === user.id &&
        r.status === 'Approved' &&
        !(endDate < r.start_date || startDate > r.end_date)
    );

    if (existingApproved.length > 0) {
      if (isHalfDay) {
        // If current request is half-day, check if existing is full-day or same half-day period
        const hasConflict = existingApproved.some(
          (r) => !r.is_half_day || r.half_day_period === halfDayPeriod
        );
        if (hasConflict) {
          throw new Error(`These dates overlap with existing approved leave on ${startDate}.`);
        }
      } else {
        throw new Error('These dates overlap with existing approved leave.');
      }
    }

    const isPaid = isPaidLeaveType(data.leave_type) || data.leave_type === 'Holiday Shift Credit';
    if (isPaid) {
      const balance = this.leaveBalances.find(
        (b) =>
          b.employee_id === user.id &&
          (b.leave_type === data.leave_type ||
            (data.leave_type === 'Vacation Leave' && (b.leave_type as string) === 'Annual Leave'))
      );
      const remaining = balance ? balance.allocated_days - balance.used_days : 0;
      if (totalDays > remaining) {
        throw new Error(`Insufficient ${data.leave_type} balance. You have ${remaining} day(s) remaining.`);
      }
    }

    const newRequest: LeaveRequest = {
      id: 'req-' + Math.random().toString(36).substring(2, 9),
      employee_id: user.id,
      employee_name: user.full_name,
      employee_email: user.email,
      employee_department: user.department,
      employee_avatar: user.avatar_url,
      leave_type: data.leave_type,
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
      is_half_day: isHalfDay,
      half_day_period: halfDayPeriod,
      reason: data.reason.trim(),
      attachment_name: data.attachment_name,
      attachment_url: data.attachment_url,
      status: 'Pending',
      submitted_at: new Date().toISOString(),
    };

    this.leaveRequests.unshift(newRequest);

    const halfDayLabel = isHalfDay ? ` (Half-Day ${halfDayPeriod === 'morning' ? 'Morning' : 'Afternoon'})` : '';

    const admins = this.users.filter((u) => u.profile.role === 'admin');
    for (const admin of admins) {
      this.notifications.unshift({
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        user_id: admin.id,
        title: 'New Leave Request',
        message: `${user.full_name} submitted a request for ${totalDays} day(s)${halfDayLabel} of ${data.leave_type} (${startDate}${startDate !== endDate ? ' to ' + endDate : ''}).`,
        type: 'new_request',
        read: false,
        created_at: new Date().toISOString(),
        link_tab: 'requests',
      });
    }

    return newRequest;
  }

  public reviewLeaveRequest(
    requestId: string,
    action: 'Approved' | 'Rejected',
    adminUser: UserProfile,
    adminNote?: string
  ): LeaveRequest {
    const request = this.leaveRequests.find((r) => r.id === requestId);
    if (!request) {
      throw new Error('Leave request not found.');
    }

    if (request.status !== 'Pending') {
      throw new Error(`This request has already been ${request.status.toLowerCase()}.`);
    }

    const employee = this.getProfile(request.employee_id);
    const employeeName = employee ? employee.full_name : request.employee_name;

    if (action === 'Approved') {
      const isPaid = isPaidLeaveType(request.leave_type) || request.leave_type === 'Holiday Shift Credit';
      let balance = this.leaveBalances.find(
        (b) =>
          b.employee_id === request.employee_id &&
          (b.leave_type === request.leave_type ||
            (request.leave_type === 'Vacation Leave' && (b.leave_type as string) === 'Annual Leave'))
      );

      if (isPaid) {
        const remaining = balance ? balance.allocated_days - balance.used_days : 0;
        if (request.total_days > remaining) {
          throw new Error(
            `Cannot approve. Employee only has ${remaining} day(s) of ${request.leave_type} remaining.`
          );
        }

        if (balance) {
          balance.used_days += request.total_days;
          balance.updated_at = new Date().toISOString();
        }
      }

      const balanceRemaining = balance ? balance.allocated_days - balance.used_days : 0;
      const periodDesc = request.is_half_day
        ? ` (Half-Day ${request.half_day_period === 'morning' ? 'Morning 9AM–1PM' : 'Afternoon 1PM–5PM'})`
        : '';

      // Record Leave Deduction Transaction (or unpaid leave record)
      this.leaveTransactions.unshift({
        id: 'tx-' + Math.random().toString(36).substring(2, 9),
        employee_id: request.employee_id,
        employee_name: employeeName,
        leave_type: request.leave_type,
        amount: isPaid ? -request.total_days : 0,
        balance_after: isPaid ? balanceRemaining : 0,
        transaction_type: 'leave_deduction',
        reference_type: 'leave_request',
        reference_id: request.id,
        description: isPaid
          ? `Leave deduction for ${request.total_days} day(s)${periodDesc} of ${request.leave_type} (${request.start_date}${request.start_date !== request.end_date ? ' to ' + request.end_date : ''})`
          : `Approved unpaid leave for ${request.total_days} day(s)${periodDesc} (${request.start_date}${request.start_date !== request.end_date ? ' to ' + request.end_date : ''})`,
        performed_by_id: adminUser.id,
        performed_by_name: adminUser.full_name,
        created_at: new Date().toISOString(),
      });

      request.status = 'Approved';
      request.admin_note = adminNote || undefined;
      request.reviewed_at = new Date().toISOString();
      request.reviewed_by = adminUser.id;
      request.reviewed_by_name = adminUser.full_name;

      this.logAudit({
        action: 'Leave approved',
        user_id: adminUser.id,
        user_name: adminUser.full_name,
        user_role: adminUser.role,
        target_type: 'leave_request',
        target_id: request.id,
        details: `Approved ${request.leave_type} (${request.total_days} days${periodDesc}) for ${employeeName} on ${request.start_date}${request.start_date !== request.end_date ? ' to ' + request.end_date : ''}.`,
      });

      this.notifications.unshift({
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        user_id: request.employee_id,
        title: 'Leave Approved',
        message: `Your ${request.leave_type} request for ${request.total_days} day(s)${periodDesc} (${request.start_date}${request.start_date !== request.end_date ? ' to ' + request.end_date : ''}) has been approved by ${adminUser.full_name}.`,
        type: 'leave_approved',
        read: false,
        created_at: new Date().toISOString(),
        link_tab: 'history',
      });
    } else {
      request.status = 'Rejected';
      request.admin_note = adminNote || undefined;
      request.reviewed_at = new Date().toISOString();
      request.reviewed_by = adminUser.id;
      request.reviewed_by_name = adminUser.full_name;

      this.logAudit({
        action: 'Leave rejected',
        user_id: adminUser.id,
        user_name: adminUser.full_name,
        user_role: adminUser.role,
        target_type: 'leave_request',
        target_id: request.id,
        details: `Rejected ${request.leave_type} (${request.total_days} days) for ${employeeName}.${adminNote ? ` Reason: "${adminNote}"` : ''}`,
      });

      this.notifications.unshift({
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        user_id: request.employee_id,
        title: 'Leave Request Rejected',
        message: `Your ${request.leave_type} request for ${request.start_date} to ${request.end_date} was rejected.${adminNote ? ` Note: "${adminNote}"` : ''}`,
        type: 'leave_rejected',
        read: false,
        created_at: new Date().toISOString(),
        link_tab: 'history',
      });
    }

    return request;
  }

  public getTodayDateString(timeZone?: string): string {
    try {
      const tz = timeZone || 'UTC';
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const formatted = formatter.format(new Date());
      if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
        return formatted;
      }
    } catch {
      // fallback
    }
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // --- HOLIDAYS METHODS ---
  public getHolidays(filters?: {
    country?: string;
    year?: string;
    holiday_type?: string;
    scope?: string;
    is_active?: boolean;
    upcoming_only?: boolean;
    reference_date?: string;
  }): Holiday[] {
    let list = [...this.holidays];

    if (filters?.country && filters.country !== 'All') {
      const c = filters.country.trim().toLowerCase();
      if (c === 'company-wide' || c === 'global' || c === 'all') {
        list = list.filter(
          (h) =>
            h.scope === 'Company-wide' ||
            h.country.toLowerCase() === 'company-wide' ||
            h.country.toLowerCase() === 'global' ||
            h.country.toLowerCase() === 'all'
        );
      } else {
        list = list.filter(
          (h) =>
            h.country.toLowerCase() === c ||
            h.scope === 'Company-wide' ||
            h.country.toLowerCase() === 'company-wide' ||
            h.country.toLowerCase() === 'global' ||
            h.country.toLowerCase() === 'all'
        );
      }
    }

    if (filters?.year && filters.year !== 'All') {
      list = list.filter((h) => h.date.startsWith(filters.year!));
    }

    if (filters?.holiday_type && filters.holiday_type !== 'All') {
      list = list.filter((h) => h.holiday_type === filters.holiday_type);
    }

    if (filters?.scope && filters.scope !== 'All') {
      list = list.filter((h) => h.scope === filters.scope);
    }

    if (filters?.is_active !== undefined) {
      list = list.filter((h) => h.is_active === filters.is_active);
    }

    if (filters?.upcoming_only) {
      const todayStr = filters.reference_date || this.getTodayDateString();
      // Strict: holiday.date > today
      list = list.filter((h) => h.date > todayStr);
    }

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }

  public addHoliday(
    data: {
      name: string;
      date: string;
      country: string;
      region?: string;
      holiday_type?: HolidayType;
      scope?: HolidayScope;
      description?: string;
      is_active?: boolean;
    },
    adminUser: UserProfile
  ): Holiday {
    if (!data.name?.trim() || !data.date) {
      throw new Error('Please provide both holiday name and date.');
    }

    const country = (data.country || 'United States').trim();
    const scope: HolidayScope =
      data.scope ||
      (country.toLowerCase() === 'company-wide' || country.toLowerCase() === 'global'
        ? 'Company-wide'
        : 'Country-specific');
    const holidayType: HolidayType =
      data.holiday_type || (scope === 'Company-wide' ? 'Company Holiday' : 'Public Holiday');

    const holiday: Holiday = {
      id: 'hol-' + Math.random().toString(36).substring(2, 9),
      name: data.name.trim(),
      date: data.date,
      country,
      region: data.region?.trim() || 'All',
      holiday_type: holidayType,
      scope,
      description: data.description?.trim() || undefined,
      is_active: data.is_active !== undefined ? data.is_active : true,
      created_by: adminUser.full_name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.holidays.push(holiday);

    this.logAudit({
      action: 'Holiday created',
      user_id: adminUser.id,
      user_name: adminUser.full_name,
      user_role: adminUser.role,
      target_type: 'holiday',
      target_id: holiday.id,
      details: `Added holiday: ${holiday.name} on ${holiday.date} (${holiday.country} • ${holiday.holiday_type}).`,
    });

    return holiday;
  }

  public updateHoliday(
    id: string,
    data: Partial<Holiday>,
    adminUser: UserProfile
  ): Holiday {
    const holiday = this.holidays.find((h) => h.id === id);
    if (!holiday) throw new Error('Holiday not found');

    if (data.name !== undefined) holiday.name = data.name.trim();
    if (data.date !== undefined) holiday.date = data.date;
    if (data.country !== undefined) holiday.country = data.country.trim();
    if (data.region !== undefined) holiday.region = data.region.trim();
    if (data.holiday_type !== undefined) holiday.holiday_type = data.holiday_type;
    if (data.scope !== undefined) holiday.scope = data.scope;
    if (data.description !== undefined) holiday.description = data.description.trim() || undefined;
    if (data.is_active !== undefined) holiday.is_active = data.is_active;
    holiday.updated_at = new Date().toISOString();

    // Keep shift requests date synchronized
    for (const shift of this.holidayShifts) {
      if (shift.holiday_id === id) {
        shift.holiday_name = holiday.name;
        shift.holiday_date = holiday.date;
      }
    }

    this.logAudit({
      action: 'Holiday updated',
      user_id: adminUser.id,
      user_name: adminUser.full_name,
      user_role: adminUser.role,
      target_type: 'holiday',
      target_id: holiday.id,
      details: `Updated holiday: ${holiday.name} (${holiday.date}, ${holiday.country}).`,
    });

    return holiday;
  }

  public toggleHolidayActive(id: string, adminUser: UserProfile): Holiday {
    const holiday = this.holidays.find((h) => h.id === id);
    if (!holiday) throw new Error('Holiday not found');

    holiday.is_active = !holiday.is_active;
    holiday.updated_at = new Date().toISOString();

    this.logAudit({
      action: 'Holiday status toggled',
      user_id: adminUser.id,
      user_name: adminUser.full_name,
      user_role: adminUser.role,
      target_type: 'holiday',
      target_id: holiday.id,
      details: `Changed status of holiday ${holiday.name} to ${holiday.is_active ? 'Active' : 'Inactive'}.`,
    });

    return holiday;
  }

  public deleteHoliday(id: string, adminUser: UserProfile) {
    const index = this.holidays.findIndex((h) => h.id === id);
    if (index === -1) throw new Error('Holiday not found');
    const removed = this.holidays[index];
    this.holidays.splice(index, 1);

    this.logAudit({
      action: 'Holiday deleted',
      user_id: adminUser.id,
      user_name: adminUser.full_name,
      user_role: adminUser.role,
      target_type: 'holiday',
      target_id: id,
      details: `Deleted holiday: ${removed.name} (${removed.date}, ${removed.country}).`,
    });
  }

  // --- HOLIDAY SHIFTS & COVERAGE METHODS ---
  public getHolidayShifts(filters?: {
    holiday_id?: string;
    holiday_date?: string;
    employee_id?: string;
    status?: string;
  }): HolidayShiftRequest[] {
    let list = [...this.holidayShifts];

    if (filters?.holiday_id) {
      list = list.filter((s) => s.holiday_id === filters.holiday_id);
    }
    if (filters?.holiday_date) {
      list = list.filter((s) => s.holiday_date === filters.holiday_date);
    }
    if (filters?.employee_id) {
      list = list.filter((s) => s.employee_id === filters.employee_id);
    }
    if (filters?.status && filters.status !== 'All') {
      list = list.filter((s) => s.status === filters.status);
    }

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public submitHolidayShiftRequest(
    user: UserProfile,
    data: {
      holiday_id: string;
      working_hours: string;
      reason?: string;
    }
  ): HolidayShiftRequest {
    const holiday = this.holidays.find((h) => h.id === data.holiday_id);
    if (!holiday) {
      throw new Error('Holiday not found.');
    }

    // Check if user already has an active shift request for this holiday
    const existingShift = this.holidayShifts.find(
      (s) => s.employee_id === user.id && s.holiday_id === holiday.id && s.status !== 'Rejected' && s.status !== 'Cancelled'
    );
    if (existingShift) {
      throw new Error('You already have a shift request submitted for this holiday.');
    }

    const isPc = isProgramCoordinator(user);

    const newShift: HolidayShiftRequest = {
      id: 'shift-' + Math.random().toString(36).substring(2, 9),
      employee_id: user.id,
      employee_name: user.full_name,
      employee_email: user.email,
      employee_department: user.department,
      employee_avatar: user.avatar_url,
      job_title: user.job_title,
      is_pc: isPc,
      holiday_id: holiday.id,
      holiday_name: holiday.name,
      holiday_date: holiday.date,
      working_hours: data.working_hours || '9:00 AM – 5:00 PM',
      reason: data.reason || 'Requested holiday working shift.',
      status: 'Pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.holidayShifts.unshift(newShift);

    // Notify admins
    const admins = this.users.filter((u) => u.profile.role === 'admin');
    for (const admin of admins) {
      this.notifications.unshift({
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        user_id: admin.id,
        title: 'New Holiday Shift Request',
        message: `${user.full_name} (${user.department}${isPc ? ' • PC' : ''}) requested to work on ${holiday.name} (${holiday.date}).`,
        type: 'new_request',
        read: false,
        created_at: new Date().toISOString(),
        link_tab: 'admin-dashboard',
      });
    }

    return newShift;
  }

  public assignHolidayShift(
    adminUser: UserProfile,
    data: {
      employee_id: string;
      holiday_id: string;
      working_hours: string;
      status?: 'Approved' | 'Pending';
      admin_note?: string;
    }
  ): HolidayShiftRequest {
    const employee = this.getProfile(data.employee_id);
    if (!employee) throw new Error('Employee not found');

    const holiday = this.holidays.find((h) => h.id === data.holiday_id);
    if (!holiday) throw new Error('Holiday not found');

    const isPc = isProgramCoordinator(employee);
    const status = data.status || 'Approved';

    // Check if shift exists, update or add
    let shift = this.holidayShifts.find(
      (s) => s.employee_id === employee.id && s.holiday_id === holiday.id
    );

    if (shift) {
      shift.working_hours = data.working_hours || '9:00 AM – 5:00 PM';
      shift.status = status;
      shift.admin_note = data.admin_note;
      shift.approved_by = status === 'Approved' ? adminUser.id : undefined;
      shift.approved_by_name = status === 'Approved' ? adminUser.full_name : undefined;
      shift.approved_at = status === 'Approved' ? new Date().toISOString() : undefined;
      shift.updated_at = new Date().toISOString();
    } else {
      shift = {
        id: 'shift-' + Math.random().toString(36).substring(2, 9),
        employee_id: employee.id,
        employee_name: employee.full_name,
        employee_email: employee.email,
        employee_department: employee.department,
        employee_avatar: employee.avatar_url,
        job_title: employee.job_title,
        is_pc: isPc,
        holiday_id: holiday.id,
        holiday_name: holiday.name,
        holiday_date: holiday.date,
        working_hours: data.working_hours || '9:00 AM – 5:00 PM',
        status,
        admin_note: data.admin_note || 'Directly scheduled by HR Administrator',
        approved_by: status === 'Approved' ? adminUser.id : undefined,
        approved_by_name: status === 'Approved' ? adminUser.full_name : undefined,
        approved_at: status === 'Approved' ? new Date().toISOString() : undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.holidayShifts.unshift(shift);
    }

    // Award holiday work credit if Approved and not already credited
    if (status === 'Approved') {
      const existingCredit = this.leaveTransactions.find(
        (t) => t.reference_id === shift!.id && t.transaction_type === 'holiday_credit'
      );
      if (!existingCredit) {
        let creditBal = this.leaveBalances.find(
          (b) => b.employee_id === employee.id && b.leave_type === 'Holiday Shift Credit'
        );
        if (!creditBal) {
          creditBal = {
            id: 'bal-hol-' + employee.id,
            employee_id: employee.id,
            leave_type: 'Holiday Shift Credit',
            allocated_days: 0,
            used_days: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          this.leaveBalances.push(creditBal);
        }
        creditBal.allocated_days += 1;
        creditBal.updated_at = new Date().toISOString();

        const remaining = creditBal.allocated_days - creditBal.used_days;

        this.leaveTransactions.unshift({
          id: 'tx-hol-' + Math.random().toString(36).substring(2, 9),
          employee_id: employee.id,
          employee_name: employee.full_name,
          leave_type: 'Holiday Shift Credit',
          amount: 1,
          balance_after: remaining,
          transaction_type: 'holiday_credit',
          reference_type: 'holiday_shift',
          reference_id: shift.id,
          holiday_date: holiday.date,
          holiday_name: holiday.name,
          description: `Holiday shift credit awarded for assignment on ${holiday.name} (${holiday.date})`,
          performed_by_id: adminUser.id,
          performed_by_name: adminUser.full_name,
          created_at: new Date().toISOString(),
        });
      }
    }

    this.logAudit({
      action: 'Holiday shift assigned',
      user_id: adminUser.id,
      user_name: adminUser.full_name,
      user_role: adminUser.role,
      target_type: 'leave_request',
      target_id: shift.id,
      details: `Assigned holiday working shift (${shift.working_hours}) to ${employee.full_name} for ${holiday.name} (${holiday.date}).`,
    });

    this.notifications.unshift({
      id: 'notif-' + Math.random().toString(36).substring(2, 9),
      user_id: employee.id,
      title: 'Holiday Shift Scheduled',
      message: `You are scheduled to work on ${holiday.name} (${holiday.date}) from ${shift.working_hours}. +1 Holiday Work Credit awarded.`,
      type: 'system',
      read: false,
      created_at: new Date().toISOString(),
      link_tab: 'holidays',
    });

    return shift;
  }

  public reviewHolidayShiftRequest(
    requestId: string,
    action: 'Approved' | 'Rejected',
    adminUser: UserProfile,
    adminNote?: string
  ): HolidayShiftRequest {
    const shift = this.holidayShifts.find((s) => s.id === requestId);
    if (!shift) {
      throw new Error('Holiday shift request not found.');
    }

    const previousStatus = shift.status;
    shift.status = action;
    shift.admin_note = adminNote || undefined;
    shift.updated_at = new Date().toISOString();

    const employee = this.getProfile(shift.employee_id);
    const employeeName = employee ? employee.full_name : shift.employee_name;

    if (action === 'Approved') {
      shift.approved_by = adminUser.id;
      shift.approved_by_name = adminUser.full_name;
      shift.approved_at = new Date().toISOString();

      // DUPLICATE CREDIT CHECK
      const existingCredit = this.leaveTransactions.find(
        (t) => t.reference_id === shift.id && t.transaction_type === 'holiday_credit'
      );

      if (!existingCredit) {
        let creditBal = this.leaveBalances.find(
          (b) => b.employee_id === shift.employee_id && b.leave_type === 'Holiday Shift Credit'
        );
        if (!creditBal) {
          creditBal = {
            id: 'bal-hol-' + shift.employee_id,
            employee_id: shift.employee_id,
            leave_type: 'Holiday Shift Credit',
            allocated_days: 0,
            used_days: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          this.leaveBalances.push(creditBal);
        }

        creditBal.allocated_days += 1;
        creditBal.updated_at = new Date().toISOString();

        const currentRemaining = creditBal.allocated_days - creditBal.used_days;

        this.leaveTransactions.unshift({
          id: 'tx-hol-' + Math.random().toString(36).substring(2, 9),
          employee_id: shift.employee_id,
          employee_name: employeeName,
          leave_type: 'Holiday Shift Credit',
          amount: 1,
          balance_after: currentRemaining,
          transaction_type: 'holiday_credit',
          reference_type: 'holiday_shift',
          reference_id: shift.id,
          holiday_date: shift.holiday_date,
          holiday_name: shift.holiday_name,
          description: `Holiday shift credit awarded for working ${shift.holiday_name} (${shift.holiday_date})`,
          performed_by_id: adminUser.id,
          performed_by_name: adminUser.full_name,
          created_at: new Date().toISOString(),
        });
      }

      this.logAudit({
        action: 'Holiday shift approved',
        user_id: adminUser.id,
        user_name: adminUser.full_name,
        user_role: adminUser.role,
        target_type: 'leave_request',
        target_id: shift.id,
        details: `Approved holiday shift for ${shift.employee_name} on ${shift.holiday_name} (${shift.holiday_date}). +1 Holiday Work Credit awarded.`,
      });

      this.notifications.unshift({
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        user_id: shift.employee_id,
        title: 'Holiday Shift Approved',
        message: `Your shift request for ${shift.holiday_name} (${shift.holiday_date}) was approved by ${adminUser.full_name}. +1 Holiday Work Credit has been added to your ledger.`,
        type: 'leave_approved',
        read: false,
        created_at: new Date().toISOString(),
        link_tab: 'leave',
      });
    } else {
      // If previously approved, reverse credit
      if (previousStatus === 'Approved') {
        const creditTx = this.leaveTransactions.find(
          (t) => t.reference_id === shift.id && t.transaction_type === 'holiday_credit'
        );
        if (creditTx) {
          const creditBal = this.leaveBalances.find(
            (b) => b.employee_id === shift.employee_id && b.leave_type === 'Holiday Shift Credit'
          );
          if (creditBal) {
            creditBal.allocated_days = Math.max(0, creditBal.allocated_days - 1);
            creditBal.updated_at = new Date().toISOString();
          }

          const currentRemaining = creditBal ? creditBal.allocated_days - creditBal.used_days : 0;

          this.leaveTransactions.unshift({
            id: 'tx-rev-' + Math.random().toString(36).substring(2, 9),
            employee_id: shift.employee_id,
            employee_name: employeeName,
            leave_type: 'Holiday Shift Credit',
            amount: -1,
            balance_after: currentRemaining,
            transaction_type: 'holiday_credit_reversal',
            reference_type: 'holiday_shift',
            reference_id: shift.id,
            holiday_date: shift.holiday_date,
            holiday_name: shift.holiday_name,
            description: `Reversal of holiday shift credit due to rejection for ${shift.holiday_name} (${shift.holiday_date})`,
            performed_by_id: adminUser.id,
            performed_by_name: adminUser.full_name,
            created_at: new Date().toISOString(),
          });
        }
      }

      this.logAudit({
        action: 'Holiday shift rejected',
        user_id: adminUser.id,
        user_name: adminUser.full_name,
        user_role: adminUser.role,
        target_type: 'leave_request',
        target_id: shift.id,
        details: `Rejected holiday shift for ${shift.employee_name} on ${shift.holiday_name} (${shift.holiday_date}).${adminNote ? ` Reason: "${adminNote}"` : ''}`,
      });

      this.notifications.unshift({
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        user_id: shift.employee_id,
        title: 'Holiday Shift Rejected',
        message: `Your shift request for ${shift.holiday_name} (${shift.holiday_date}) was rejected.${adminNote ? ` Note: "${adminNote}"` : ''}`,
        type: 'leave_rejected',
        read: false,
        created_at: new Date().toISOString(),
        link_tab: 'holidays',
      });
    }

    return shift;
  }

  public cancelHolidayShiftRequest(requestId: string, user: UserProfile): boolean {
    const shift = this.holidayShifts.find((s) => s.id === requestId);
    if (!shift) throw new Error('Shift request not found.');
    if (user.role !== 'admin' && shift.employee_id !== user.id) {
      throw new Error('Unauthorized to cancel this shift.');
    }

    const wasApproved = shift.status === 'Approved';
    shift.status = 'Cancelled';
    shift.updated_at = new Date().toISOString();

    if (wasApproved) {
      const creditTx = this.leaveTransactions.find(
        (t) => t.reference_id === shift.id && t.transaction_type === 'holiday_credit'
      );
      if (creditTx) {
        const creditBal = this.leaveBalances.find(
          (b) => b.employee_id === shift.employee_id && b.leave_type === 'Holiday Shift Credit'
        );
        if (creditBal) {
          creditBal.allocated_days = Math.max(0, creditBal.allocated_days - 1);
          creditBal.updated_at = new Date().toISOString();
        }

        const currentRemaining = creditBal ? creditBal.allocated_days - creditBal.used_days : 0;

        this.leaveTransactions.unshift({
          id: 'tx-rev-' + Math.random().toString(36).substring(2, 9),
          employee_id: shift.employee_id,
          employee_name: shift.employee_name,
          leave_type: 'Holiday Shift Credit',
          amount: -1,
          balance_after: currentRemaining,
          transaction_type: 'holiday_credit_reversal',
          reference_type: 'holiday_shift',
          reference_id: shift.id,
          holiday_date: shift.holiday_date,
          holiday_name: shift.holiday_name,
          description: `Holiday shift credit reversal for cancelled shift on ${shift.holiday_name} (${shift.holiday_date})`,
          performed_by_id: user.id,
          performed_by_name: user.full_name,
          created_at: new Date().toISOString(),
        });
      }
    }

    this.logAudit({
      action: 'Holiday shift cancelled',
      user_id: user.id,
      user_name: user.full_name,
      user_role: user.role,
      target_type: 'leave_request',
      target_id: shift.id,
      details: `Cancelled holiday shift on ${shift.holiday_name} (${shift.holiday_date}) for ${shift.employee_name}.`,
    });

    return true;
  }

  public resolveHolidayConflict(
    employeeId: string,
    holidayDate: string,
    resolution: 'keep_shift' | 'keep_leave',
    adminUser: UserProfile
  ) {
    const employee = this.getProfile(employeeId);
    if (!employee) throw new Error('Employee not found.');

    const shifts = this.holidayShifts.filter(
      (s) => s.employee_id === employeeId && s.holiday_date === holidayDate && s.status === 'Approved'
    );
    const leaves = this.leaveRequests.filter(
      (r) =>
        r.employee_id === employeeId &&
        r.status === 'Approved' &&
        r.start_date <= holidayDate &&
        r.end_date >= holidayDate
    );

    if (resolution === 'keep_shift') {
      // Cancel the approved leave on this date, restore deducted balance
      for (const l of leaves) {
        l.status = 'Rejected';
        l.admin_note = 'Cancelled by Admin in favor of approved holiday working shift.';
        l.reviewed_at = new Date().toISOString();
        l.reviewed_by = adminUser.id;
        l.reviewed_by_name = adminUser.full_name;

        // Restore balance
        const bal = this.leaveBalances.find(
          (b) => b.employee_id === employeeId && b.leave_type === l.leave_type
        );
        if (bal) {
          bal.used_days = Math.max(0, bal.used_days - l.total_days);
          bal.updated_at = new Date().toISOString();
        }

        const currentRem = bal ? bal.allocated_days - bal.used_days : 0;

        // Record reversal transaction
        this.leaveTransactions.unshift({
          id: 'tx-rev-leave-' + Math.random().toString(36).substring(2, 9),
          employee_id: employeeId,
          employee_name: employee.full_name,
          leave_type: l.leave_type,
          amount: l.total_days,
          balance_after: currentRem,
          transaction_type: 'leave_reversal',
          reference_type: 'leave_request',
          reference_id: l.id,
          description: `Restored ${l.total_days} day(s) of ${l.leave_type} due to holiday conflict resolution (kept working shift)`,
          performed_by_id: adminUser.id,
          performed_by_name: adminUser.full_name,
          created_at: new Date().toISOString(),
        });
      }

      // Ensure shift has holiday credit
      for (const s of shifts) {
        const existingCredit = this.leaveTransactions.find(
          (t) => t.reference_id === s.id && t.transaction_type === 'holiday_credit'
        );
        if (!existingCredit) {
          let creditBal = this.leaveBalances.find(
            (b) => b.employee_id === employeeId && b.leave_type === 'Holiday Shift Credit'
          );
          if (!creditBal) {
            creditBal = {
              id: 'bal-hol-' + employeeId,
              employee_id: employeeId,
              leave_type: 'Holiday Shift Credit',
              allocated_days: 0,
              used_days: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            this.leaveBalances.push(creditBal);
          }
          creditBal.allocated_days += 1;
          creditBal.updated_at = new Date().toISOString();

          this.leaveTransactions.unshift({
            id: 'tx-hol-' + Math.random().toString(36).substring(2, 9),
            employee_id: employeeId,
            employee_name: employee.full_name,
            leave_type: 'Holiday Shift Credit',
            amount: 1,
            balance_after: creditBal.allocated_days - creditBal.used_days,
            transaction_type: 'holiday_credit',
            reference_type: 'holiday_shift',
            reference_id: s.id,
            holiday_date: s.holiday_date,
            holiday_name: s.holiday_name,
            description: `Holiday shift credit awarded for working ${s.holiday_name} (${s.holiday_date})`,
            performed_by_id: adminUser.id,
            performed_by_name: adminUser.full_name,
            created_at: new Date().toISOString(),
          });
        }
      }
    } else {
      // Keep leave: cancel shift and reverse any shift credit
      for (const s of shifts) {
        s.status = 'Cancelled';
        s.admin_note = 'Cancelled by Admin in favor of approved leave request.';
        s.updated_at = new Date().toISOString();

        const creditTx = this.leaveTransactions.find(
          (t) => t.reference_id === s.id && t.transaction_type === 'holiday_credit'
        );
        if (creditTx) {
          const creditBal = this.leaveBalances.find(
            (b) => b.employee_id === employeeId && b.leave_type === 'Holiday Shift Credit'
          );
          if (creditBal) {
            creditBal.allocated_days = Math.max(0, creditBal.allocated_days - 1);
            creditBal.updated_at = new Date().toISOString();
          }

          const rem = creditBal ? creditBal.allocated_days - creditBal.used_days : 0;

          this.leaveTransactions.unshift({
            id: 'tx-rev-' + Math.random().toString(36).substring(2, 9),
            employee_id: employeeId,
            employee_name: employee.full_name,
            leave_type: 'Holiday Shift Credit',
            amount: -1,
            balance_after: rem,
            transaction_type: 'holiday_credit_reversal',
            reference_type: 'holiday_shift',
            reference_id: s.id,
            holiday_date: s.holiday_date,
            holiday_name: s.holiday_name,
            description: `Holiday shift credit reversal due to conflict resolution (kept leave) on ${s.holiday_name} (${s.holiday_date})`,
            performed_by_id: adminUser.id,
            performed_by_name: adminUser.full_name,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    this.logAudit({
      action: 'Holiday conflict resolved',
      user_id: adminUser.id,
      user_name: adminUser.full_name,
      user_role: adminUser.role,
      target_type: 'leave_request',
      target_id: employeeId,
      details: `Resolved holiday conflict for ${employee.full_name} on ${holidayDate} by keeping ${resolution === 'keep_shift' ? 'Working Shift' : 'Leave'}.`,
    });

    this.notifications.unshift({
      id: 'notif-' + Math.random().toString(36).substring(2, 9),
      user_id: employeeId,
      title: 'Holiday Schedule Conflict Resolved',
      message: `Your schedule conflict for ${holidayDate} was resolved by Admin: ${resolution === 'keep_shift' ? 'Working Shift Approved' : 'Leave Approved'}.`,
      type: 'system',
      read: false,
      created_at: new Date().toISOString(),
      link_tab: resolution === 'keep_shift' ? 'holidays' : 'history',
    });

    return { success: true };
  }

  // --- LEAVE TRANSACTIONS & MANUAL ADJUSTMENTS ---
  public getLeaveTransactions(employeeId?: string): LeaveTransaction[] {
    if (employeeId) {
      return this.leaveTransactions
        .filter((t) => t.employee_id === employeeId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return [...this.leaveTransactions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public manualBalanceAdjustment(
    employeeId: string,
    leaveType: LeaveType,
    amount: number,
    reason: string,
    adminUser: UserProfile
  ): { success: boolean; transaction: LeaveTransaction; balance: LeaveBalance } {
    const employee = this.getProfile(employeeId);
    if (!employee) throw new Error('Employee not found.');
    if (!reason || !reason.trim()) throw new Error('Please provide a reason for the manual balance adjustment.');
    if (typeof amount !== 'number' || isNaN(amount) || amount === 0) {
      throw new Error('Please enter a valid non-zero adjustment amount.');
    }

    let balance = this.leaveBalances.find(
      (b) => b.employee_id === employeeId && b.leave_type === leaveType
    );

    if (!balance) {
      balance = {
        id: 'bal-' + Math.random().toString(36).substring(2, 9),
        employee_id: employeeId,
        leave_type: leaveType,
        allocated_days: 0,
        used_days: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.leaveBalances.push(balance);
    }

    balance.allocated_days = Math.max(0, balance.allocated_days + amount);
    balance.updated_at = new Date().toISOString();

    const remaining = balance.allocated_days - balance.used_days;

    const transaction: LeaveTransaction = {
      id: 'tx-adj-' + Math.random().toString(36).substring(2, 9),
      employee_id: employeeId,
      employee_name: employee.full_name,
      leave_type: leaveType,
      amount: amount,
      balance_after: remaining,
      transaction_type: 'admin_adjustment',
      reference_type: 'admin_adjustment',
      description: `Manual adjustment by ${adminUser.full_name}: ${reason.trim()} (${amount >= 0 ? '+' : ''}${amount} days)`,
      performed_by_id: adminUser.id,
      performed_by_name: adminUser.full_name,
      created_at: new Date().toISOString(),
    };

    this.leaveTransactions.unshift(transaction);

    this.logAudit({
      action: 'Leave balance adjusted',
      user_id: adminUser.id,
      user_name: adminUser.full_name,
      user_role: adminUser.role,
      target_type: 'leave_balance',
      target_id: balance.id,
      details: `Adjusted ${leaveType} balance for ${employee.full_name} by ${amount >= 0 ? '+' : ''}${amount} days. Reason: "${reason.trim()}". New allocated balance: ${balance.allocated_days} days.`,
    });

    this.notifications.unshift({
      id: 'notif-' + Math.random().toString(36).substring(2, 9),
      user_id: employeeId,
      title: 'Leave Balance Adjusted',
      message: `Your ${leaveType} balance was adjusted by ${amount >= 0 ? '+' : ''}${amount} day(s) by ${adminUser.full_name}. Reason: ${reason.trim()}`,
      type: 'system',
      read: false,
      created_at: new Date().toISOString(),
      link_tab: 'leave',
    });

    return { success: true, transaction, balance };
  }

  // Calculate full coverage metrics for a holiday
  public getHolidayStaffingCoverage(holidayId: string): HolidayStaffingCoverage {
    const holiday = this.holidays.find((h) => h.id === holidayId);
    if (!holiday) throw new Error('Holiday not found.');

    const holidayDate = holiday.date;
    const allEmployees = this.getAllEmployees().filter((e) => e.status === 'active');
    const totalEmployees = allEmployees.length;

    // Working: Approved holiday shifts only
    const approvedShifts = this.holidayShifts.filter(
      (s) => (s.holiday_id === holidayId || s.holiday_date === holidayDate) && s.status === 'Approved'
    );

    // Leave: Approved leave requests covering this date
    const approvedLeaves = this.leaveRequests.filter(
      (r) => r.status === 'Approved' && r.start_date <= holidayDate && r.end_date >= holidayDate
    );

    // Pending Shifts
    const pendingShifts = this.holidayShifts.filter(
      (s) => (s.holiday_id === holidayId || s.holiday_date === holidayDate) && s.status === 'Pending'
    );

    // Pending Leaves
    const pendingLeaves = this.leaveRequests.filter(
      (r) => r.status === 'Pending' && r.start_date <= holidayDate && r.end_date >= holidayDate
    );

    // Detect Conflicts (employees with both approved shift and approved leave on this holiday)
    const shiftEmpIds = new Set(approvedShifts.map((s) => s.employee_id));
    const leaveEmpIds = new Set(approvedLeaves.map((l) => l.employee_id));
    const conflictEmpIds = new Set([...shiftEmpIds].filter((id) => leaveEmpIds.has(id)));

    // Count Program Coordinators Working (Approved shifts by PCs, excluding conflicts if any)
    const pcsWorking = approvedShifts.filter((s) => s.is_pc);
    const pcsWorkingCount = pcsWorking.length;
    const pcsRequired = 2;

    const workingCount = approvedShifts.length;
    const leaveCount = approvedLeaves.length;
    const pendingShiftCount = pendingShifts.length;
    const pendingLeaveCount = pendingLeaves.length;
    const totalPendingCount = pendingShiftCount + pendingLeaveCount;

    // Unaccounted = total employees - (working + leave + pending shifts + pending leaves - overlapping)
    const accountedEmpIds = new Set<string>();
    approvedShifts.forEach((s) => accountedEmpIds.add(s.employee_id));
    approvedLeaves.forEach((l) => accountedEmpIds.add(l.employee_id));
    pendingShifts.forEach((s) => accountedEmpIds.add(s.employee_id));
    pendingLeaves.forEach((l) => accountedEmpIds.add(l.employee_id));

    const unaccountedCount = Math.max(0, totalEmployees - accountedEmpIds.size);

    // Coverage status
    let coverageStatus: 'Good' | 'PC Coverage Needed' | 'Understaffed' = 'Good';
    if (pcsWorkingCount < pcsRequired) {
      coverageStatus = 'PC Coverage Needed';
    } else if (workingCount < 4) {
      coverageStatus = 'Understaffed';
    }

    // Build all employee statuses list
    const allStatuses: HolidayEmployeeStatus[] = allEmployees.map((emp) => {
      const isPc = emp.is_pc;
      const approvedShift = approvedShifts.find((s) => s.employee_id === emp.id);
      const approvedLeave = approvedLeaves.find((l) => l.employee_id === emp.id);
      const pendingShift = pendingShifts.find((s) => s.employee_id === emp.id);
      const pendingLeave = pendingLeaves.find((l) => l.employee_id === emp.id);
      const rejectedShift = this.holidayShifts.find(
        (s) => s.employee_id === emp.id && s.holiday_date === holidayDate && s.status === 'Rejected'
      );
      const rejectedLeave = this.leaveRequests.find(
        (r) => r.employee_id === emp.id && r.status === 'Rejected' && r.start_date <= holidayDate && r.end_date >= holidayDate
      );

      let status: any = 'No Request';
      let statusLabel = 'No Request';
      let details: string | undefined = undefined;

      if (approvedShift && approvedLeave) {
        status = 'Conflict';
        statusLabel = '⚠️ Conflict (Shift & Leave Approved)';
        details = `Approved shift (${approvedShift.working_hours}) and approved leave (${approvedLeave.leave_type}).`;
      } else if (approvedShift) {
        status = 'Working';
        statusLabel = '🟢 Working – Shift Approved';
        details = `${approvedShift.working_hours} • Approved by ${approvedShift.approved_by_name || 'HR Admin'}`;
      } else if (approvedLeave) {
        status = 'On Leave';
        statusLabel = '🔵 On Leave – Leave Approved';
        details = `${approvedLeave.leave_type} (${approvedLeave.start_date} to ${approvedLeave.end_date})`;
      } else if (pendingShift) {
        status = 'Holiday Shift Pending';
        statusLabel = '🟡 Holiday Shift Pending';
        details = `Requested hours: ${pendingShift.working_hours}`;
      } else if (pendingLeave) {
        status = 'Leave Pending';
        statusLabel = '🟡 Leave Pending';
        details = `${pendingLeave.leave_type} (${pendingLeave.start_date} to ${pendingLeave.end_date})`;
      } else if (rejectedShift || rejectedLeave) {
        status = 'Request Rejected';
        statusLabel = '🔴 Request Rejected';
        details = rejectedShift ? 'Shift request rejected' : 'Leave request rejected';
      }

      return {
        employee_id: emp.id,
        employee_name: emp.full_name,
        employee_email: emp.email,
        department: emp.department,
        job_title: emp.job_title,
        is_pc: isPc,
        avatar_url: emp.avatar_url,
        status,
        status_label: statusLabel,
        details,
        shift_request: approvedShift || pendingShift || rejectedShift,
        leave_request: approvedLeave || pendingLeave || rejectedLeave,
      };
    });

    const onLeaveRecords = approvedLeaves.map((l) => {
      const emp = allEmployees.find((e) => e.id === l.employee_id);
      return {
        employee_id: l.employee_id,
        employee_name: l.employee_name,
        employee_email: l.employee_email,
        department: l.employee_department,
        avatar_url: l.employee_avatar || emp?.avatar_url || '',
        job_title: emp?.job_title || 'Staff Member',
        is_pc: emp ? emp.is_pc : false,
        leave_request: l,
      };
    });

    const pendingLeaveRecords = pendingLeaves.map((l) => {
      const emp = allEmployees.find((e) => e.id === l.employee_id);
      return {
        employee_id: l.employee_id,
        employee_name: l.employee_name,
        employee_email: l.employee_email,
        department: l.employee_department,
        avatar_url: l.employee_avatar || emp?.avatar_url || '',
        job_title: emp?.job_title || 'Staff Member',
        is_pc: emp ? emp.is_pc : false,
        leave_request: l,
      };
    });

    return {
      holiday,
      total_employees: totalEmployees,
      working_count: workingCount,
      leave_count: leaveCount,
      pending_leave_count: pendingLeaveCount,
      pending_shift_count: pendingShiftCount,
      total_pending_count: totalPendingCount,
      unaccounted_count: unaccountedCount,
      pcs_working_count: pcsWorkingCount,
      pcs_required: pcsRequired,
      coverage_status: coverageStatus,
      conflicts_count: conflictEmpIds.size,
      working_shifts: approvedShifts,
      on_leave_records: onLeaveRecords,
      pending_shifts: pendingShifts,
      pending_leaves: pendingLeaveRecords,
      all_employee_statuses: allStatuses,
    };
  }

  // --- CALENDAR EVENTS & ICAL SYNC FEED ---
  public getCalendarEvents(user: UserProfile) {
    const events: any[] = [];

    // Company Holidays
    for (const h of this.holidays) {
      if (!h.is_active) continue;
      if (user.role !== 'admin') {
        const isApplicable =
          h.scope === 'Company-wide' ||
          h.country?.toLowerCase() === 'company-wide' ||
          h.country?.toLowerCase() === 'global' ||
          h.country?.toLowerCase() === 'all' ||
          (user.country && h.country?.toLowerCase() === user.country.toLowerCase());
        if (!isApplicable) continue;
      }

      events.push({
        id: h.id,
        title: `${h.name} (${h.country})`,
        date: h.date,
        type: 'holiday',
        description: h.description,
      });
    }

    // Approved leave for company visibility / Pending for admin & requester
    for (const r of this.leaveRequests) {
      if (
        r.status === 'Approved' ||
        (user.role === 'admin' && r.status === 'Pending') ||
        (r.employee_id === user.id && r.status === 'Pending')
      ) {
        const halfDayTag = r.is_half_day
          ? ` [Half-Day ${r.half_day_period === 'morning' ? 'AM' : 'PM'}]`
          : '';

        events.push({
          id: r.id,
          title: `${r.employee_name} (${r.leave_type}${halfDayTag})`,
          date: r.start_date,
          end_date: r.end_date,
          total_days: r.total_days,
          is_half_day: r.is_half_day,
          half_day_period: r.half_day_period,
          type: r.status === 'Approved' ? 'approved_leave' : 'pending_leave',
          employee_name: r.employee_name,
          employee_department: r.employee_department,
          leave_type: r.leave_type,
          status: r.status,
        });
      }
    }

    // Approved Holiday Shifts
    for (const s of this.holidayShifts) {
      if (s.status === 'Approved') {
        events.push({
          id: s.id,
          title: `Shift: ${s.employee_name} (${s.working_hours})`,
          date: s.holiday_date,
          type: 'holiday_shift',
          employee_name: s.employee_name,
          employee_department: s.employee_department,
          is_pc: s.is_pc,
          working_hours: s.working_hours,
        });
      }
    }

    return events;
  }

  // --- AUDIT LOGS ---
  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  private logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>) {
    const log: AuditLog = {
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      ...entry,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
  }

  // --- NOTIFICATIONS ---
  public getNotifications(userId: string): NotificationItem[] {
    return this.notifications
      .filter((n) => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public markNotificationRead(notifId: string, userId: string) {
    const notif = this.notifications.find((n) => n.id === notifId && n.user_id === userId);
    if (notif) notif.read = true;
  }

  public markAllNotificationsRead(userId: string) {
    for (const n of this.notifications) {
      if (n.user_id === userId) {
        n.read = true;
      }
    }
  }

  // --- EMPLOYEE DOCUMENTS (Admin Only) ---
  public getEmployeeDocuments(employeeId: string): EmployeeDocument[] {
    return this.employeeDocuments
      .filter((d) => d.employee_id === employeeId)
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  }

  public addEmployeeDocument(doc: {
    employee_id: string;
    name: string;
    category: EmployeeDocument['category'];
    file_size: string;
    file_data?: string;
    uploaded_by_name: string;
  }): EmployeeDocument {
    const newDoc: EmployeeDocument = {
      id: 'doc_' + Math.random().toString(36).substring(2, 11),
      employee_id: doc.employee_id,
      name: doc.name,
      category: doc.category,
      file_size: doc.file_size,
      file_data: doc.file_data,
      uploaded_at: new Date().toISOString(),
      uploaded_by_name: doc.uploaded_by_name,
    };
    this.employeeDocuments.unshift(newDoc);
    return newDoc;
  }

  public deleteEmployeeDocument(employeeId: string, docId: string): boolean {
    const prevLen = this.employeeDocuments.length;
    this.employeeDocuments = this.employeeDocuments.filter(
      (d) => !(d.id === docId && d.employee_id === employeeId)
    );
    return this.employeeDocuments.length < prevLen;
  }

  private companySettings: Record<string, any> = {
    company_name: 'GO Destinations Ltd.',
    timezone: 'Asia/Singapore (GMT+8)',
    working_hours: '09:00 - 18:00',
    workweek: 'Monday to Friday',
    annual_leave_default: 20,
    sick_leave_default: 10,
    casual_leave_default: 5,
    holiday_credit_rate: 1.0,
    require_medical_cert_days: 2,
    email_notifications_enabled: true,
    browser_notifications_enabled: true,
    leave_approval_digest: 'daily',
    supabase_configured: false,
    updated_at: new Date().toISOString(),
  };

  public getCompanySettings(): Record<string, any> {
    return { ...this.companySettings };
  }

  public updateCompanySettings(updates: Record<string, any>): Record<string, any> {
    this.companySettings = {
      ...this.companySettings,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return { ...this.companySettings };
  }
}

export const db = new HRDatabase();
