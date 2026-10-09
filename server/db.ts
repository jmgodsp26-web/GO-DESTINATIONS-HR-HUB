import { workingDays, holidayApplies } from '../src/utils/workingDays.js';
import { decodeUpload } from './files.js';
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
  LEAVE_TYPE_CONFIGS,
} from '../src/types.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PersistentData } from './persistence.js';
import { currentDatabase } from './request-context.js';
import { GUID, digest, type MicrosoftAttempt } from './microsoft.js';

const BCRYPT_SALT_ROUNDS = 12;

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain.trim(), BCRYPT_SALT_ROUNDS);
}

export function verifyPassword(plain: string, hashedOrPlain: string): boolean {
  if (!plain || !hashedOrPlain) return false;
  if (hashedOrPlain.startsWith('$2a$') || hashedOrPlain.startsWith('$2b$')) {
    try {
      return bcrypt.compareSync(plain.trim(), hashedOrPlain.trim());
    } catch {
      return false;
    }
  }
  // Graceful migration comparison for legacy unhashed strings
  return plain.trim() === hashedOrPlain.trim();
}

interface UserCredentials {
  id: string;
  email: string;
  passwordHash: string;
  passwordCustomized?: boolean;
  mustChangePassword?: boolean;
  profile: UserProfile;
}

interface SessionRecord {
  userId: string;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  provider?: 'microsoft';
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

export class HRDatabase {
  private users: UserCredentials[] = [];
  private leaveBalances: LeaveBalance[] = [];
  private leaveTransactions: LeaveTransaction[] = [];
  private leaveRequests: LeaveRequest[] = [];
  private holidays: Holiday[] = [];
  private holidayShifts: HolidayShiftRequest[] = [];
  private auditLogs: AuditLog[] = [];
  private notifications: NotificationItem[] = [];
  private employeeDocuments: EmployeeDocument[] = [];
  private sessions: Map<string, SessionRecord> = new Map();
  private loginAttempts: { id: string; count: number; expiresAt: number }[] = [];
  private microsoftAttempts: MicrosoftAttempt[] = [];
  private nextEmployeeNumber = 100;
  private leaveAttachments: {id: string; employee_id: string; name: string; data: string}[] = [];
  private deletedEmployeeIds: Set<string> = new Set();
  private deletedHolidayIds: Set<string> = new Set();
  private deletedShiftIds: Set<string> = new Set();
  private readonly SESSION_ABSOLUTE_TTL = 8 * 60 * 60 * 1000; // 8 hours absolute lifetime
  private readonly SESSION_IDLE_TTL = 2 * 60 * 60 * 1000; // 2 hours idle timeout

  constructor(data?: PersistentData) {
    // Keep the transaction input immutable so newly inserted/updated rows are detected.
    if (data) this.hydrateFromStore(structuredClone(data));
  }

  public static bootstrap(): HRDatabase {
    const instance = new HRDatabase();
    const email = (process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.INITIAL_ADMIN_PASSWORD || '';
    const full_name = process.env.INITIAL_ADMIN_NAME || 'HR Administrator';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.trim().length < 12) {
      throw new Error('A new database requires INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (at least 12 characters).');
    }
    const actor = { id: 'setup', full_name, role: 'admin' } as UserProfile;
    instance.createEmployee({ full_name, email, password, phone: '', department: 'Leadership', job_title: 'HR Administrator', date_joined: new Date().toISOString().slice(0, 10), role: 'admin' }, actor);
    return instance;
  }

  public cleanupExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt || (now - session.lastActivityAt) > this.SESSION_IDLE_TTL) {
        this.sessions.delete(token);
      }
    }
  }

  public exportState(): PersistentData {
    return {
      nextEmployeeNumber: this.nextEmployeeNumber,
      leaveAttachments: this.leaveAttachments,
      users: this.users,
      employees: this.users.map((u) => u.profile),
      leaveBalances: this.leaveBalances,
      leaveRequests: this.leaveRequests,
      leaveTransactions: this.leaveTransactions,
      holidays: this.holidays,
      holidayShifts: this.holidayShifts,
      auditLogs: this.auditLogs,
      notifications: this.notifications,
      employeeDocuments: this.employeeDocuments,
      companySettings: this.companySettings,
      sessions: Array.from(this.sessions.entries()),
      loginAttempts: this.loginAttempts,
      microsoftAttempts: this.microsoftAttempts.filter(row => row.expiresAt > Date.now()),
      deletedEmployeeIds: Array.from(this.deletedEmployeeIds),
      deletedHolidayIds: Array.from(this.deletedHolidayIds),
      deletedShiftIds: Array.from(this.deletedShiftIds),
    };

  }

  private hydrateFromStore(data: PersistentData) {
    this.leaveAttachments = data.leaveAttachments || [];
    this.loginAttempts = (data.loginAttempts || []).filter(row => row.expiresAt > Date.now());
    this.microsoftAttempts = (data.microsoftAttempts || []).filter(row => row.expiresAt > Date.now());
    this.nextEmployeeNumber = Math.max(data.nextEmployeeNumber || 100, ...((data.users || []).map(u => Number(u.profile?.employee_id?.replace('HR-', '')) + 1).filter(Number.isFinite)));

    for (const [hash, session] of data.sessions || []) {
      if (Date.now() < session.expiresAt && Date.now() - session.lastActivityAt < this.SESSION_IDLE_TTL) this.sessions.set(hash, session);
    }
    if (data.deletedEmployeeIds && Array.isArray(data.deletedEmployeeIds)) {
      this.deletedEmployeeIds = new Set(data.deletedEmployeeIds);
    }
    if (data.deletedHolidayIds && Array.isArray(data.deletedHolidayIds)) {
      this.deletedHolidayIds = new Set(data.deletedHolidayIds);
    }
    if (data.deletedShiftIds && Array.isArray(data.deletedShiftIds)) {
      this.deletedShiftIds = new Set(data.deletedShiftIds);
    }
    if (data.users && data.users.length > 0) {
      this.users = data.users.filter((u) => !this.deletedEmployeeIds.has(u.id)).map((u) => ({
        ...u, passwordHash: u.passwordHash && !/^\$2[ab]\$/.test(u.passwordHash) ? hashPassword(u.passwordHash) : u.passwordHash,
      }));
    }
    if (data.leaveBalances) {
      this.leaveBalances = data.leaveBalances;
    }
    if (data.leaveRequests) {
      this.leaveRequests = data.leaveRequests;
    }
    if (data.leaveTransactions) {
      this.leaveTransactions = data.leaveTransactions;
    }
    if (data.holidays) {
      this.holidays = data.holidays.filter((h) => !this.deletedHolidayIds.has(h.id));
    }
    if (data.holidayShifts) {
      this.holidayShifts = data.holidayShifts.filter(
        (s) => !this.deletedShiftIds.has(s.id) && !this.deletedHolidayIds.has(s.holiday_id)
      );
    }
    if (data.auditLogs) {
      this.auditLogs = data.auditLogs;
    }
    if (data.notifications) {
      this.notifications = data.notifications;
    }
    if (data.employeeDocuments) {
      this.employeeDocuments = data.employeeDocuments;
    }
    if (data.companySettings) {
      this.companySettings = {
        ...this.companySettings,
        ...data.companySettings,
      };
    }
  }

  // --- AUTH METHODS ---
  public authenticate(
    identifier: string,
    password?: string,
    callerIp = 'unknown'
  ): { token: string; user: UserProfile; mustChangePassword: boolean } {
    const cleanId = (identifier || '').trim().toLowerCase();
    const now = Date.now();
    this.loginAttempts = this.loginAttempts.filter(row => row.expiresAt > now);
    const fingerprint = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
    const accountKey = fingerprint('account:' + cleanId);
    const limits = [{ id: accountKey, max: 20 }, { id: fingerprint('ip:' + callerIp), max: 1000 }];
    // These counters are committed through the same Firestore serialization
    // barrier as sessions, including failed logins, across all Cloud Run instances.
    for (const limit of limits) {
      if ((this.loginAttempts.find(row => row.id === limit.id)?.count || 0) >= limit.max) {
        throw Object.assign(new Error('Too many login attempts. Please wait 15 minutes before trying again.'), { code: 'LOGIN_THROTTLED' });
      }
    }
    for (const limit of limits) {
      const row = this.loginAttempts.find(row => row.id === limit.id);
      if (row) row.count++;
      else this.loginAttempts.push({ id: limit.id, count: 1, expiresAt: now + 15 * 60 * 1000 });
    }
    const user = this.users.find(u => u.email.toLowerCase() === cleanId);
    if (!user || user.profile.status !== 'active' || !['admin', 'employee'].includes(user.profile.role) || !verifyPassword(password || '', user.passwordHash)) {
      this.logAudit({ action: 'Sign-in failed', user_id: 'anonymous', user_name: 'Unauthenticated', user_role: 'employee', target_type: 'security', target_id: accountKey, details: 'A sign-in attempt failed. Account fingerprint: ' + accountKey.slice(0, 12) });
      throw new Error('Wrong password or account not found. Please try again or contact HR.');
    }
    // Successful sign-in clears the account failure budget, not the IP budget.
    this.loginAttempts = this.loginAttempts.filter(row => row.id !== accountKey);
    const token = 'hr_sess_' + crypto.randomBytes(32).toString('hex');
    this.sessions.set(fingerprint(token), {
      userId: user.id, createdAt: now, lastActivityAt: now,
      expiresAt: now + this.SESSION_ABSOLUTE_TTL,
    });
    this.logAudit({ action: 'Signed in', user_id: user.id, user_name: user.profile.full_name, user_role: user.profile.role, target_type: 'security', target_id: user.id, details: 'Account signed in successfully.' });
    return { token, user: user.profile, mustChangePassword: this.requiresPasswordChange(user.id) };
  }

  public requiresPasswordChange(userId: string): boolean {
    const user = this.users.find((u) => u.id === userId);
    return Boolean(user && (user.mustChangePassword || !user.passwordCustomized));
  }

  public sessionRequiresPasswordChange(token: string): boolean {
    const session = this.sessions.get(digest(token));
    return Boolean(session && session.provider !== 'microsoft' && this.requiresPasswordChange(session.userId));
  }

  public saveMicrosoftAttempt(attempt: MicrosoftAttempt) {
    this.microsoftAttempts = this.microsoftAttempts.filter(row => row.expiresAt > Date.now());
    this.microsoftAttempts.push(attempt);
  }

  public consumeMicrosoftAttempt(state: string): MicrosoftAttempt | null {
    const id = digest(state);
    const attempt = this.microsoftAttempts.find(row => row.id === id && row.expiresAt > Date.now());
    this.microsoftAttempts = this.microsoftAttempts.filter(row => row.id !== id && row.expiresAt > Date.now());
    return attempt || null;
  }

  public authenticateMicrosoft(tenant: string, objectId: string) {
    const matches = this.users.filter(u => u.profile.microsoft_tenant_id === tenant && u.profile.microsoft_object_id === objectId);
    const user = matches.length === 1 ? matches[0] : undefined;
    if (!GUID.test(tenant) || !GUID.test(objectId) || !user || user.profile.status !== 'active' || !['admin', 'employee'].includes(user.profile.role)) {
      this.logAudit({ action: 'Sign-in failed', user_id: 'anonymous', user_name: 'Unauthenticated', user_role: 'employee', target_type: 'security', target_id: digest(tenant + ':' + objectId), details: 'Microsoft sign-in denied: no unique active approved account.' });
      return null;
    }
    const token = 'hr_sess_' + crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    this.sessions.set(digest(token), { userId: user.id, createdAt: now, lastActivityAt: now, expiresAt: now + this.SESSION_ABSOLUTE_TTL, provider: 'microsoft' });
    this.logAudit({ action: 'Signed in', user_id: user.id, user_name: user.profile.full_name, user_role: user.profile.role, target_type: 'security', target_id: user.id, details: 'Account signed in with Microsoft.' });
    return { token, user: user.profile };
  }

  public getUserByToken(token: string): UserProfile | null {
    if (!token) return null;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = this.sessions.get(tokenHash);
    if (!session) return null;

    const now = Date.now();
    // Validate absolute expiration and idle timeout
    if (now > session.expiresAt || (now - session.lastActivityAt) > this.SESSION_IDLE_TTL) {
      this.sessions.delete(tokenHash);

      return null;
    }

    session.lastActivityAt = now;
    const user = this.users.find((u) => u.id === session.userId);
    return user && user.profile.status === 'active' && ['admin', 'employee'].includes(user.profile.role) ? user.profile : null;
  }

  public logout(token: string) {
    if (token) {
      this.sessions.delete(crypto.createHash('sha256').update(token).digest('hex'));

    }
  }

  public revokeAllSessionsForUser(userId: string) {
    let changed = false;
    for (const [token, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(token);
        changed = true;
      }
    }
    if (changed) {

    }
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
    if (data.role !== undefined && !['admin', 'employee'].includes(data.role)) throw new Error('Role must be admin or employee.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) throw new Error('A valid company email is required.');
    if (!data.full_name?.trim()) throw new Error('Employee name is required.');
    if (data.password && data.password.trim().length < 12) throw new Error('Temporary password must be at least 12 characters.');
    if (data.email && this.users.some((u) => u.email && u.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error('An employee with this email already exists.');
    }

    for (const allocation of [data.annual_leave_days, data.sick_leave_days]) {
      if (allocation !== undefined && (typeof allocation !== 'number' || !Number.isFinite(allocation) || allocation < 0 || allocation > 366)) throw new Error('Leave allocation must be between 0 and 366 days.');
    }
    const newId = 'usr-' + Math.random().toString(36).substring(2, 9);
    const employeeId = 'HR-' + this.nextEmployeeNumber++;
    const joined = data.hire_date || data.date_joined || new Date().toISOString().split('T')[0];

    const profile: UserProfile = {
      id: newId,
      user_id: newId,
      employee_id: employeeId,
      full_name: data.full_name,
      email: data.email.trim().toLowerCase(),
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
      email: data.email.trim().toLowerCase(),
      passwordHash: hashPassword(data.password || crypto.randomBytes(32).toString('hex')),
      passwordCustomized: false,
      mustChangePassword: true,
      profile,
    });

    this.leaveBalances.push({
      id: 'bal-' + Math.random().toString(36).substring(2, 9),
      employee_id: newId,
      leave_type: 'Vacation Leave',
      allocated_days: data.annual_leave_days ?? this.companySettings.annual_leave_default,
      used_days: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.leaveBalances.push({
      id: 'bal-' + Math.random().toString(36).substring(2, 9),
      employee_id: newId,
      leave_type: 'Sick Leave',
      allocated_days: data.sick_leave_days ?? this.companySettings.sick_leave_default,
      used_days: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.leaveBalances.push({
      id: 'bal-' + Math.random().toString(36).substring(2, 9),
      employee_id: newId,
      leave_type: 'Emergency Leave',
      allocated_days: this.companySettings.casual_leave_default,
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

    return profile;
  }

  public updateEmployee(
    employeeId: string,
    updates: Partial<UserProfile> & { password?: string },
    adminUser: UserProfile
  ): UserProfile {
    const user = this.users.find((u) => u.id === employeeId);
    if (!user) throw new Error('Employee not found');

    if (updates.role !== undefined && !['admin', 'employee'].includes(updates.role)) throw new Error('Role must be admin or employee.');
    if (updates.status !== undefined && !['active', 'disabled'].includes(updates.status)) throw new Error('Status must be active or disabled.');
    for (const key of ['id', 'user_id', 'employee_id', 'passwordHash', 'passwordCustomized', 'mustChangePassword', 'created_at', 'microsoft_tenant_id']) {
      if (key in updates) throw new Error('This account field cannot be changed.');
    }
    const previousRole = user.profile.role;
    const previousStatus = user.profile.status;

    if (updates.microsoft_object_id !== undefined) {
      if (adminUser.role !== 'admin' || adminUser.status !== 'active') throw new Error('Only an active administrator can link Microsoft accounts.');
      if (typeof updates.microsoft_object_id !== 'string') throw new Error('Microsoft user ID must be text.');
      const oid = updates.microsoft_object_id.trim().toLowerCase();
      const tenant = (process.env.MICROSOFT_TENANT_ID || '').trim().toLowerCase();
      if (oid && (!GUID.test(oid) || !GUID.test(tenant))) throw new Error('Enter a valid Microsoft user Object ID and configure the company tenant.');
      if (oid && this.users.some(u => u.id !== employeeId && u.profile.microsoft_object_id === oid && u.profile.microsoft_tenant_id === tenant)) throw new Error('This Microsoft account is already linked to another employee.');
      if (oid !== (user.profile.microsoft_object_id || '') || (oid && tenant !== user.profile.microsoft_tenant_id)) {
        this.revokeAllSessionsForUser(employeeId);
        this.logAudit({ action: 'Employee updated', user_id: adminUser.id, user_name: adminUser.full_name, user_role: adminUser.role, target_type: 'security', target_id: employeeId, details: oid ? 'Administrator linked a Microsoft identity.' : 'Administrator removed a Microsoft identity.' });
      }
      updates = { ...updates, microsoft_object_id: oid, microsoft_tenant_id: oid ? tenant : '' };
    }

    // Sole active administrator protection: Cannot demote or deactivate the last admin
    if (
      user.profile.role === 'admin' &&
      ((updates.role && updates.role !== 'admin') || (updates.status && updates.status !== 'active'))
    ) {
      const otherActiveAdmins = this.users.filter(
        (u) => u.profile.role === 'admin' && u.profile.status === 'active' && u.id !== employeeId
      );
      if (otherActiveAdmins.length === 0) {
        throw new Error('Action blocked: Cannot demote or deactivate the organization\'s sole active administrator.');
      }
    }

    if (updates.email !== undefined) {
      const email = updates.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid company email is required.');
      if (this.users.some(u => u.id !== employeeId && u.email === email)) throw new Error('This company email is already registered.');
      user.email = email;
      updates = { ...updates, email };
    }

    if (updates.password && updates.password.trim().length < 12) throw new Error('Temporary password must be at least 12 characters.');
    if (updates.password !== undefined && updates.password.trim()) {
      user.passwordHash = hashPassword(updates.password.trim());
      user.passwordCustomized = false;
      user.mustChangePassword = true;
      this.revokeAllSessionsForUser(employeeId);

    }

    const { password: _password, ...profileUpdates } = updates;
    user.profile = {
      ...user.profile,
      ...profileUpdates,
      updated_at: new Date().toISOString(),
    };

    let details = `Updated profile information for ${user.profile.full_name}.`;
    if (updates.status && updates.status !== previousStatus) {
      details = `Changed account status of ${user.profile.full_name} to ${updates.status}.`;
      if (updates.status === 'disabled') {
        this.revokeAllSessionsForUser(employeeId);
      }
    }
    if (updates.role && updates.role !== previousRole) {
      details = `Changed role of ${user.profile.full_name} from ${previousRole} to ${updates.role}.`;
    }
    if (updates.password !== undefined && updates.password.trim()) {
      details += ` Reset credentials/password.`;
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

    // Cloud Firestore persistence (strictly clean of any credentials)

    return user.profile;
  }

  public changePassword(userId: string, currentPassword: string, newPassword: string): boolean {
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new Error('User account not found.');

    const cleanCurrent = (currentPassword || '').trim();
    const cleanNew = (newPassword || '').trim();
    const storedPass = (user.passwordHash || '').trim();

    // Verify current password using cryptographic comparison
    const isMatch = verifyPassword(cleanCurrent, storedPass);
    if (!isMatch && !(this.requiresPasswordChange(userId) && !cleanCurrent)) {
      throw new Error('Current password does not match our records.');
    }

    if (!cleanNew || cleanNew.length < 12) {
      throw new Error('New password must be at least 12 characters long.');
    }

    user.passwordHash = hashPassword(cleanNew);
    user.passwordCustomized = true;
    user.mustChangePassword = false;

    // Revoke all sessions on password change
    this.revokeAllSessionsForUser(userId);

    this.logAudit({
      action: 'Password updated',
      user_id: user.id,
      user_name: user.profile.full_name,
      user_role: user.profile.role,
      target_type: 'employee',
      target_id: user.id,
      details: `Account password was updated for ${user.profile.full_name}.`,
    });

    return true;
  }

  public adminResetPassword(employeeId: string, temporaryPassword: string, adminUser: UserProfile): boolean {
    const user = this.users.find((u) => u.id === employeeId);
    if (!user) throw new Error('Employee not found.');

    const cleanTemp = (temporaryPassword || '').trim();
    if (!cleanTemp || cleanTemp.length < 12) {
      throw new Error('Temporary password must be at least 12 characters long.');
    }

    user.passwordHash = hashPassword(cleanTemp);
    user.passwordCustomized = false;
    user.mustChangePassword = true;

    this.revokeAllSessionsForUser(employeeId);

    this.logAudit({
      action: 'Admin password reset',
      user_id: adminUser.id,
      user_name: adminUser.full_name,
      user_role: adminUser.role,
      target_type: 'employee',
      target_id: user.id,
      details: `Admin ${adminUser.full_name} issued a temporary credential reset for ${user.profile.full_name} (${user.profile.employee_id}).`,
    });

    return true;
  }

  public async deleteEmployee(employeeId: string, adminUser: UserProfile): Promise<boolean> {
    const userIdx = this.users.findIndex((u) => u.id === employeeId);
    if (userIdx === -1) throw new Error('Employee not found');

    const targetUser = this.users[userIdx];
    const name = targetUser.profile.full_name;
    const empId = targetUser.profile.employee_id;

    if (targetUser.id === adminUser.id) {
      throw new Error('You cannot delete your own account while logged in.');
    }

    // Sole active administrator protection
    if (targetUser.profile.role === 'admin') {
      const otherActiveAdmins = this.users.filter(
        (u) => u.profile.role === 'admin' && u.profile.status === 'active' && u.id !== employeeId
      );
      if (otherActiveAdmins.length === 0) {
        throw new Error('Action blocked: Cannot delete the organization\'s sole active administrator.');
      }
    }

    // 1. Remove employee from memory list
    this.users.splice(userIdx, 1);

    // 2. Add tombstone to prevent resurrection from cloud or caches
    this.deletedEmployeeIds.add(employeeId);

    // 3. Remove associated balances
    const removedBalances = this.leaveBalances.filter((b) => b.employee_id === employeeId);
    this.leaveBalances = this.leaveBalances.filter((b) => b.employee_id !== employeeId);

    // 4. Remove associated leave requests
    const removedRequests = this.leaveRequests.filter((r) => r.employee_id === employeeId);
    this.leaveRequests = this.leaveRequests.filter((r) => r.employee_id !== employeeId);

    // 5. Remove associated shifts, documents and private attachments.
    const removedShifts = this.holidayShifts.filter(s => s.employee_id === employeeId);
    this.holidayShifts = this.holidayShifts.filter(s => s.employee_id !== employeeId);
    for (const shift of removedShifts) this.deletedShiftIds.add(shift.id);
    this.employeeDocuments = this.employeeDocuments.filter(d => d.employee_id !== employeeId);
    this.leaveAttachments = this.leaveAttachments.filter(f => f.employee_id !== employeeId);

    // 6. Terminate all active sessions immediately
    this.revokeAllSessionsForUser(employeeId);

    // 7. Audit log
    this.logAudit({
      action: 'Employee deleted',
      user_id: adminUser.id,
      user_name: adminUser.full_name,
      user_role: adminUser.role,
      target_type: 'employee',
      target_id: employeeId,
      details: `Permanently deleted employee account for ${name} (${empId}) and purged associated balances and requests.`,
    });

    // 8. Authoritative local persistence and cloud tombstone save

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
    if (!Object.hasOwn(LEAVE_TYPE_CONFIGS, leaveType) || !Number.isFinite(allocatedDays) || allocatedDays < 0 || allocatedDays > 366) throw new Error('Enter a valid leave allocation between 0 and 366.');
    const balance = this.leaveBalances.find(b => b.employee_id === employeeId && b.leave_type === leaveType);
    if (balance && allocatedDays < balance.used_days) throw new Error('Allocation cannot be less than already used leave.');
    if (balance?.allocated_days === allocatedDays) return balance;
    if (!balance && allocatedDays === 0) {
      if (!this.getProfile(employeeId)) throw new Error('Employee not found.');
      const empty: LeaveBalance = {id: crypto.randomUUID(), employee_id: employeeId, leave_type: leaveType, allocated_days: 0, used_days: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString()};
      this.leaveBalances.push(empty);
      return empty;
    }
    return this.manualBalanceAdjustment(employeeId, leaveType, allocatedDays - (balance?.allocated_days || 0), 'Updated leave allocation', adminUser).balance;
  }

  // --- LEAVE REQUESTS METHODS ---
  public getLeaveRequests(
    user: UserProfile,
    filters?: { status?: string; employee?: string; leave_type?: string; date?: string }
  ): LeaveRequest[] {
    if (!['admin', 'employee'].includes(user.role)) throw new Error('Access denied. Unknown account role.');
    let requests = [...this.leaveRequests];

    if (user.role !== 'admin') {
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

  public calculateWorkingDays(
    startDateStr: string,
    endDateStr: string,
    employeeCountry?: string,
    employeeRegion?: string
  ): number {
    return workingDays(startDateStr, endDateStr, this.holidays, employeeCountry, employeeRegion, this.companySettings.workweek);
  }

  public calculateDurationInDays(startDateStr: string, endDateStr: string): number {
    return this.calculateWorkingDays(startDateStr, endDateStr);
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
      attachment_data?: string;
    }
  ): LeaveRequest {
    if (!data.leave_type || !data.start_date || !data.reason?.trim()) {
      throw new Error('Please fill in all required fields.');
    }

    if (!Object.hasOwn(LEAVE_TYPE_CONFIGS, data.leave_type)) throw new Error('Select a valid leave type.');
    if (data.is_half_day !== undefined && typeof data.is_half_day !== 'boolean') throw new Error('Invalid half-day selection.');
    if (data.is_half_day && data.half_day_period !== undefined && !['morning', 'afternoon'].includes(data.half_day_period)) throw new Error('Choose morning or afternoon.');
    if (data.attachment_data) decodeUpload(data.attachment_data);
    if (data.attachment_name && !data.attachment_data) throw new Error('Please upload the supporting attachment again.');
    const isHalfDay = Boolean(data.is_half_day);
    const halfDayPeriod = isHalfDay ? (data.half_day_period || 'morning') : undefined;
    const startDate = data.start_date;
    const endDate = isHalfDay ? data.start_date : (data.end_date || data.start_date);

    const eligibleDays = this.calculateWorkingDays(startDate, endDate, user.country, user.region);
    const calculatedWorkingDays = isHalfDay && eligibleDays > 0 ? 0.5 : eligibleDays;

    if (calculatedWorkingDays === 0) {
      throw new Error('The selected date range does not contain any working days (weekends or public holidays).');
    }
    const totalDays = calculatedWorkingDays;

    // Prevent duplicate or overlapping requests across both Pending and Approved states
    const existingConflicts = this.leaveRequests.filter(
      (r) =>
        r.employee_id === user.id &&
        (r.status === 'Approved' || r.status === 'Pending') &&
        !(endDate < r.start_date || startDate > r.end_date)
    );

    if (existingConflicts.length > 0) {
      if (isHalfDay) {
        const hasConflict = existingConflicts.some(
          (r) => !r.is_half_day || r.half_day_period === halfDayPeriod
        );
        if (hasConflict) {
          throw new Error(`These dates overlap with an existing approved or pending leave on ${startDate}.`);
        }
      } else {
        throw new Error('These dates overlap with an existing approved or pending leave request.');
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

    const attachmentId = data.attachment_data ? crypto.randomUUID() : undefined;
    if (attachmentId) this.leaveAttachments.push({id: attachmentId, employee_id: user.id, name: (data.attachment_name || 'attachment').slice(0, 200), data: data.attachment_data!});
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
      attachment_url: attachmentId ? '/api/leave-attachments/' + attachmentId : undefined,
      status: 'Pending',
      submitted_at: new Date().toISOString(),
    };

    this.leaveRequests.unshift(newRequest);

    const halfDayLabel = isHalfDay ? ` (Half-Day ${halfDayPeriod === 'morning' ? 'Morning' : 'Afternoon'})` : '';

    const admins = this.users.filter((u) => u.profile.role === 'admin');
    for (const admin of admins) {
      const notifItem: NotificationItem = {
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        user_id: admin.id,
        title: 'New Leave Request',
        message: `${user.full_name} submitted a request for ${totalDays} day(s)${halfDayLabel} of ${data.leave_type} (${startDate}${startDate !== endDate ? ' to ' + endDate : ''}).`,
        type: 'new_request',
        read: false,
        created_at: new Date().toISOString(),
        link_tab: 'leave-requests',
      };
      this.notifications.unshift(notifItem);

    }

    return newRequest;
  }

  public cancelLeaveRequest(requestId: string, user: UserProfile): LeaveRequest {
    const request = this.leaveRequests.find((r) => r.id === requestId);
    if (!request) {
      throw new Error('Leave request not found.');
    }

    if (user.role !== 'admin' && request.employee_id !== user.id) {
      throw new Error('Unauthorized to cancel this leave request.');
    }

    if (request.status === 'Cancelled') {
      throw new Error('This leave request has already been cancelled.');
    }

    if (request.status === 'Rejected') {
      throw new Error('Cannot cancel a leave request that has already been rejected.');
    }

    const wasApproved = request.status === 'Approved';
    request.status = 'Cancelled';
    request.updated_at = new Date().toISOString();

    // If the request was already approved, restore the deducted days to the balance atomically
    if (wasApproved) {
      const isPaid = isPaidLeaveType(request.leave_type) || request.leave_type === 'Holiday Shift Credit';
      if (isPaid) {
        const balance = this.leaveBalances.find(
          (b) =>
            b.employee_id === request.employee_id &&
            (b.leave_type === request.leave_type ||
              (request.leave_type === 'Vacation Leave' && (b.leave_type as string) === 'Annual Leave'))
        );
        if (balance) {
          balance.used_days = Math.max(0, balance.used_days - request.total_days);
          balance.updated_at = new Date().toISOString();

          const reversalTx: LeaveTransaction = {
            id: 'tx-' + Math.random().toString(36).substring(2, 9),
            employee_id: request.employee_id,
            employee_name: request.employee_name,
            leave_type: request.leave_type,
            amount: request.total_days,
            balance_after: balance.allocated_days - balance.used_days,
            transaction_type: 'leave_deduction',
            reference_type: 'leave_request',
            reference_id: request.id,
            description: `Leave cancelled: Restored ${request.total_days} day(s) to ${request.leave_type} balance.`,
            performed_by_id: user.id,
            performed_by_name: user.full_name,
            created_at: new Date().toISOString(),
          };
          this.leaveTransactions.unshift(reversalTx);

        }
      }
    }

    this.logAudit({
      action: 'Leave request cancelled',
      user_id: user.id,
      user_name: user.full_name,
      user_role: user.role,
      target_type: 'leave_request',
      target_id: request.id,
      details: `Cancelled leave request for ${request.employee_name} (${request.leave_type}, ${request.total_days} days).${wasApproved ? ' Restored balance in ledger.' : ''}`,
    });

    return request;
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

    // Segregation of duties violation check
    if (action === 'Approved' && request.employee_id === adminUser.id) {
      throw new Error('Segregation of duties violation: Administrators are not permitted to approve their own leave requests.');
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
      const deductionTx: LeaveTransaction = {
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
      };
      this.leaveTransactions.unshift(deductionTx);

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

      const approvedNotif: NotificationItem = {
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        user_id: request.employee_id,
        title: 'Leave Approved',
        message: `Your ${request.leave_type} request for ${request.total_days} day(s)${periodDesc} (${request.start_date}${request.start_date !== request.end_date ? ' to ' + request.end_date : ''}) has been approved by ${adminUser.full_name}.`,
        type: 'leave_approved',
        read: false,
        created_at: new Date().toISOString(),
        link_tab: 'leave',
      };
      this.notifications.unshift(approvedNotif);

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

      const rejectedNotif: NotificationItem = {
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        user_id: request.employee_id,
        title: 'Leave Request Rejected',
        message: `Your ${request.leave_type} request for ${request.start_date} to ${request.end_date} was rejected.${adminNote ? ` Note: "${adminNote}"` : ''}`,
        type: 'leave_rejected',
        read: false,
        created_at: new Date().toISOString(),
        link_tab: 'leave',
      };
      this.notifications.unshift(rejectedNotif);

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

  public async deleteHoliday(id: string, adminUser: UserProfile): Promise<boolean> {
    const index = this.holidays.findIndex((h) => h.id === id);
    if (index === -1) throw new Error('Holiday not found');
    const removed = this.holidays[index];
    this.assertCreditCanBeReversed(this.holidayShifts.filter(s => s.holiday_id === id || s.holiday_date === removed.date));
    this.holidays.splice(index, 1);
    this.deletedHolidayIds.add(id);

    // Clean up associated shifts
    const removedShifts = this.holidayShifts.filter(
      (s) => s.holiday_id === id || s.holiday_date === removed.date
    );
    for (const s of removedShifts) {
      this.cancelHolidayShiftRequest(s.id, adminUser);
      this.deletedShiftIds.add(s.id);
    }

    this.holidayShifts = this.holidayShifts.filter(s => s.holiday_id !== id && s.holiday_date !== removed.date);

    this.logAudit({
      action: 'Holiday deleted',
      user_id: adminUser.id,
      user_name: adminUser.full_name,
      user_role: adminUser.role,
      target_type: 'holiday',
      target_id: id,
      details: `Deleted holiday: ${removed.name} (${removed.date}, ${removed.country}) and cleared associated coverage shifts.`,
    });

    return true;
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
      const notifItem: NotificationItem = {
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        user_id: admin.id,
        title: 'New Holiday Shift Request',
        message: `${user.full_name} (${user.department}${isPc ? ' • PC' : ''}) requested to work on ${holiday.name} (${holiday.date}).`,
        type: 'new_request',
        read: false,
        created_at: new Date().toISOString(),
        link_tab: 'admin-dashboard',
      };
      this.notifications.unshift(notifItem);

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
      if (status !== 'Approved') this.assertCreditCanBeReversed([shift]);
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

    if (status !== 'Approved' && this.outstandingHolidayCredit(shift.id) > 0) {
      shift.status = 'Approved';
      this.reviewHolidayShiftRequest(shift.id, 'Rejected', adminUser);
    }
    shift.status = status;
    // Award holiday work credit if Approved and not already credited
    if (status === 'Approved') {
      const existingCredit = this.outstandingHolidayCredit(shift!.id);
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
        creditBal.allocated_days += this.companySettings.holiday_credit_rate;
        creditBal.updated_at = new Date().toISOString();

        const remaining = creditBal.allocated_days - creditBal.used_days;

        const creditTx: LeaveTransaction = {
          id: 'tx-hol-' + Math.random().toString(36).substring(2, 9),
          employee_id: employee.id,
          employee_name: employee.full_name,
          leave_type: 'Holiday Shift Credit',
          amount: this.companySettings.holiday_credit_rate,
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
        };
        this.leaveTransactions.unshift(creditTx);

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

    const notifItem: NotificationItem = {
      id: 'notif-' + Math.random().toString(36).substring(2, 9),
      user_id: employee.id,
      title: 'Holiday Shift Scheduled',
      message: `You are scheduled to work on ${holiday.name} (${holiday.date}) from ${shift.working_hours}. ${this.companySettings.holiday_credit_rate} Holiday Work Credit awarded.`,
      type: 'system',
      read: false,
      created_at: new Date().toISOString(),
      link_tab: 'holidays',
    };
    this.notifications.unshift(notifItem);

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

    if (action === 'Rejected') this.assertCreditCanBeReversed([shift]);
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
      const existingCredit = this.outstandingHolidayCredit(shift.id);

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

        creditBal.allocated_days += this.companySettings.holiday_credit_rate;
        creditBal.updated_at = new Date().toISOString();

        const currentRemaining = creditBal.allocated_days - creditBal.used_days;

        const creditTx: LeaveTransaction = {
          id: 'tx-hol-' + Math.random().toString(36).substring(2, 9),
          employee_id: shift.employee_id,
          employee_name: employeeName,
          leave_type: 'Holiday Shift Credit',
          amount: this.companySettings.holiday_credit_rate,
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
        };
        this.leaveTransactions.unshift(creditTx);

      }

      this.logAudit({
        action: 'Holiday shift approved',
        user_id: adminUser.id,
        user_name: adminUser.full_name,
        user_role: adminUser.role,
        target_type: 'leave_request',
        target_id: shift.id,
        details: `Approved holiday shift for ${shift.employee_name} on ${shift.holiday_name} (${shift.holiday_date}). ${this.companySettings.holiday_credit_rate} Holiday Work Credit awarded.`,
      });

      const approvedNotif: NotificationItem = {
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        user_id: shift.employee_id,
        title: 'Holiday Shift Approved',
        message: `Your shift request for ${shift.holiday_name} (${shift.holiday_date}) was approved by ${adminUser.full_name}. ${this.companySettings.holiday_credit_rate} Holiday Work Credit has been added to your ledger.`,
        type: 'leave_approved',
        read: false,
        created_at: new Date().toISOString(),
        link_tab: 'leave',
      };
      this.notifications.unshift(approvedNotif);

    } else {

      // If previously approved, reverse credit
      if (previousStatus === 'Approved') {
        const creditTx = this.outstandingHolidayCredit(shift.id);
        if (creditTx) {
          const creditBal = this.leaveBalances.find(
            (b) => b.employee_id === shift.employee_id && b.leave_type === 'Holiday Shift Credit'
          );
          if (creditBal) {
            creditBal.allocated_days = creditBal.allocated_days - creditTx;
            creditBal.updated_at = new Date().toISOString();

          }

          const currentRemaining = creditBal ? creditBal.allocated_days - creditBal.used_days : 0;

          const revTx: LeaveTransaction = {
            id: 'tx-rev-' + Math.random().toString(36).substring(2, 9),
            employee_id: shift.employee_id,
            employee_name: employeeName,
            leave_type: 'Holiday Shift Credit',
            amount: -creditTx,
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
          };
          this.leaveTransactions.unshift(revTx);

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

      const rejectedNotif: NotificationItem = {
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        user_id: shift.employee_id,
        title: 'Holiday Shift Rejected',
        message: `Your shift request for ${shift.holiday_name} (${shift.holiday_date}) was rejected.${adminNote ? ` Note: "${adminNote}"` : ''}`,
        type: 'leave_rejected',
        read: false,
        created_at: new Date().toISOString(),
        link_tab: 'holidays',
      };
      this.notifications.unshift(rejectedNotif);

    }

    return shift;
  }

  public cancelHolidayShiftRequest(requestId: string, user: UserProfile): boolean {
    const shift = this.holidayShifts.find((s) => s.id === requestId);
    if (!shift) throw new Error('Shift request not found.');
    if (user.role !== 'admin' && shift.employee_id !== user.id) {
      throw new Error('Unauthorized to cancel this shift.');
    }

    this.assertCreditCanBeReversed([shift]);
    const wasApproved = shift.status === 'Approved';

    if (wasApproved) {
      const creditTx = this.outstandingHolidayCredit(shift.id);
      if (creditTx) {
        const creditBal = this.leaveBalances.find(
          (b) => b.employee_id === shift.employee_id && b.leave_type === 'Holiday Shift Credit'
        );
        if (creditBal) {
          creditBal.allocated_days = creditBal.allocated_days - creditTx;
          creditBal.updated_at = new Date().toISOString();

        }

        const currentRemaining = creditBal ? creditBal.allocated_days - creditBal.used_days : 0;

        const revTx: LeaveTransaction = {
          id: 'tx-rev-' + Math.random().toString(36).substring(2, 9),
          employee_id: shift.employee_id,
          employee_name: shift.employee_name,
          leave_type: 'Holiday Shift Credit',
          amount: -creditTx,
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
        };
        this.leaveTransactions.unshift(revTx);

      }
    }

    this.logAudit({
      action: user.role === 'admin' ? 'Holiday shift deleted' : 'Holiday shift cancelled',
      user_id: user.id,
      user_name: user.full_name,
      user_role: user.role,
      target_type: 'leave_request',
      target_id: shift.id,
      details: `${user.role === 'admin' ? 'Permanently removed' : 'Cancelled'} holiday shift on ${shift.holiday_name} (${shift.holiday_date}) for ${shift.employee_name}.`,
    });

    if (user.role === 'admin') {
      const idx = this.holidayShifts.findIndex((s) => s.id === requestId);
      if (idx !== -1) {
        this.holidayShifts.splice(idx, 1);
      }
      this.deletedShiftIds.add(requestId);

    } else {
      shift.status = 'Cancelled';
      shift.updated_at = new Date().toISOString();

    }

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

    if (!['keep_shift', 'keep_leave'].includes(resolution)) throw new Error('Choose a valid conflict resolution.');
    if (resolution === 'keep_leave') this.assertCreditCanBeReversed(shifts);
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
        const revTx: LeaveTransaction = {
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
        };
        this.leaveTransactions.unshift(revTx);

      }

      // Ensure shift has holiday credit
      for (const s of shifts) {

        const existingCredit = this.outstandingHolidayCredit(s.id);
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
          creditBal.allocated_days += this.companySettings.holiday_credit_rate;
          creditBal.updated_at = new Date().toISOString();

          const creditTx: LeaveTransaction = {
            id: 'tx-hol-' + Math.random().toString(36).substring(2, 9),
            employee_id: employeeId,
            employee_name: employee.full_name,
            leave_type: 'Holiday Shift Credit',
            amount: this.companySettings.holiday_credit_rate,
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
          };
          this.leaveTransactions.unshift(creditTx);

        }
      }
    } else {
      // Keep leave: cancel shift and reverse any shift credit
      for (const s of shifts) {
        s.status = 'Cancelled';
        s.admin_note = 'Cancelled by Admin in favor of approved leave request.';
        s.updated_at = new Date().toISOString();

        const creditTx = this.outstandingHolidayCredit(s.id);
        if (creditTx) {
          const creditBal = this.leaveBalances.find(
            (b) => b.employee_id === employeeId && b.leave_type === 'Holiday Shift Credit'
          );
          if (creditBal) {
            creditBal.allocated_days = creditBal.allocated_days - creditTx;
            creditBal.updated_at = new Date().toISOString();

          }

          const rem = creditBal ? creditBal.allocated_days - creditBal.used_days : 0;

          const revTx: LeaveTransaction = {
            id: 'tx-rev-' + Math.random().toString(36).substring(2, 9),
            employee_id: employeeId,
            employee_name: employee.full_name,
            leave_type: 'Holiday Shift Credit',
            amount: -creditTx,
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
          };
          this.leaveTransactions.unshift(revTx);

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

    const conflictNotif: NotificationItem = {
      id: 'notif-' + Math.random().toString(36).substring(2, 9),
      user_id: employeeId,
      title: 'Holiday Schedule Conflict Resolved',
      message: `Your schedule conflict for ${holidayDate} was resolved by Admin: ${resolution === 'keep_shift' ? 'Working Shift Approved' : 'Leave Approved'}.`,
      type: 'system',
      read: false,
      created_at: new Date().toISOString(),
      link_tab: resolution === 'keep_shift' ? 'holidays' : 'leave',
    };
    this.notifications.unshift(conflictNotif);

    return { success: true };
  }

  private assertCreditCanBeReversed(shifts: HolidayShiftRequest[]) {
    const totals = new Map<string, number>();
    for (const shift of shifts) totals.set(shift.employee_id, (totals.get(shift.employee_id) || 0) + this.outstandingHolidayCredit(shift.id));
    for (const [employee, amount] of totals) {
      const balance = this.leaveBalances.find(b => b.employee_id === employee && b.leave_type === 'Holiday Shift Credit');
      if (amount > 0 && (!balance || balance.allocated_days - balance.used_days < amount)) throw new Error('This holiday credit has already been used. Cancel the approved credit leave before reversing the shift.');
    }
  }

  private outstandingHolidayCredit(shiftId: string): number {
    return this.leaveTransactions.filter(t => t.reference_id === shiftId && ['holiday_credit', 'holiday_credit_reversal'].includes(t.transaction_type)).reduce((sum, t) => sum + t.amount, 0);
  }

  public getLeaveAttachment(id: string, user: UserProfile) {
    const file = this.leaveAttachments.find(f => f.id === id);
    if (!file || (user.role !== 'admin' && file.employee_id !== user.id)) throw new Error('Attachment not found.');
    return {...decodeUpload(file.data), name: file.name};
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
    if (!Object.hasOwn(LEAVE_TYPE_CONFIGS, leaveType)) throw new Error('Select a valid leave type.');
    if (!reason || !reason.trim()) throw new Error('Please provide a reason for the manual balance adjustment.');
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) {
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

    const previousAllocation = balance.allocated_days;
    balance.allocated_days = Math.max(balance.used_days, balance.allocated_days + amount);
    amount = balance.allocated_days - previousAllocation;
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

    const notifItem: NotificationItem = {
      id: 'notif-' + Math.random().toString(36).substring(2, 9),
      user_id: employeeId,
      title: 'Leave Balance Adjusted',
      message: `Your ${leaveType} balance was adjusted by ${amount >= 0 ? '+' : ''}${amount} day(s) by ${adminUser.full_name}. Reason: ${reason.trim()}`,
      type: 'system',
      read: false,
      created_at: new Date().toISOString(),
      link_tab: 'leave',
    };
    this.notifications.unshift(notifItem);

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
        const isApplicable = holidayApplies(h, user.country, user.region);
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

        const isSelfOrAdmin = user.role === 'admin' || r.employee_id === user.id;
        const displayLeaveType = isSelfOrAdmin ? r.leave_type : 'Out of Office';
        const displayTitle = isSelfOrAdmin
          ? `${r.employee_name} (${r.leave_type}${halfDayTag})`
          : `${r.employee_name} (Out of Office${halfDayTag})`;

        events.push({
          id: r.id,
          title: displayTitle,
          date: r.start_date,
          end_date: r.end_date,
          total_days: r.total_days,
          is_half_day: r.is_half_day,
          half_day_period: r.half_day_period,
          type: r.status === 'Approved' ? 'approved_leave' : 'pending_leave',
          employee_name: r.employee_name,
          employee_department: r.employee_department,
          leave_type: displayLeaveType,
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
      .map((n) => ({
        ...n,
        link_tab:
          n.link_tab === 'requests'
            ? 'leave-requests'
            : n.link_tab === 'history'
            ? 'leave'
            : n.link_tab,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public markNotificationRead(notifId: string, userId: string) {
    const notif = this.notifications.find((n) => n.id === notifId && n.user_id === userId);
    if (notif) {
      notif.read = true;

    }
  }

  public markAllNotificationsRead(userId: string) {
    let changed = false;
    for (const n of this.notifications) {
      if (n.user_id === userId) {
        n.read = true;

        changed = true;
      }
    }
    if (changed) {

    }
  }

  public deleteNotification(notifId: string, userId: string): boolean {
    const idx = this.notifications.findIndex((n) => n.id === notifId && n.user_id === userId);
    if (idx !== -1) {
      this.notifications.splice(idx, 1);

      return true;
    }
    return false;
  }

  public clearNotifications(userId: string): boolean {
    const removed = this.notifications.filter((n) => n.user_id === userId);
    this.notifications = this.notifications.filter((n) => n.user_id !== userId);
    for (const n of removed) {

    }

    return true;
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
    if (this.employeeDocuments.length < prevLen) {

      return true;
    }
    return false;
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
    email_notifications_enabled: false,
    browser_notifications_enabled: true,
    leave_approval_digest: 'daily',
    supabase_configured: false,
    updated_at: new Date().toISOString(),
  };

  public getCompanySettings(): Record<string, any> {
    return { ...this.companySettings, email_notifications_enabled: false };
  }

  public updateCompanySettings(updates: Record<string, any>): Record<string, any> {
    if ('workweek' in updates) workingDays('2026-01-01', '2026-01-01', [], undefined, undefined, updates.workweek);
    for (const key of ['annual_leave_default', 'sick_leave_default', 'casual_leave_default', 'holiday_credit_rate', 'require_medical_cert_days']) {
      if (key in updates && (typeof updates[key] !== 'number' || !Number.isFinite(updates[key]) || updates[key] < 0 || updates[key] > 366)) throw new Error('Enter a valid policy value between 0 and 366.');
    }
    this.companySettings = {
      ...this.companySettings,
      ...updates,
      email_notifications_enabled: false,
      updated_at: new Date().toISOString(),
    };

    return { ...this.companySettings, email_notifications_enabled: false };
  }
}

export const db = new Proxy({} as HRDatabase, {
  get(_target, key) {
    const instance = currentDatabase();
    const value = (instance as any)[key];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
