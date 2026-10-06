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
  CalendarEvent,
  HalfDayPeriod,
  AuthResponse,
  LeaveType,
  UserRole,
  EmployeeDocument,
  HolidayShiftRequest,
  HolidayStaffingCoverage,
} from '../types';

const TOKEN_KEY = 'hr_portal_auth_token';
// Discard tokens left by the previous persistent-storage implementation.
try { localStorage.removeItem(TOKEN_KEY); } catch { /* Storage may be restricted. */ }

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      setStoredToken(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:expired', { detail: { message: data.error } }));
      }
    }
    throw new Error(data.error || 'An unexpected error occurred. Please try again.');
  }

  return data as T;
}

export const api = {
  // Auth
  async login(identifier: string, passwordHash?: string): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, email: identifier, password: passwordHash || '' }),
    });
    setStoredToken(res.token);
    return res;
  },

  async getMe(): Promise<{ user: UserProfile; mustChangePassword: boolean }> {
    return request<{ user: UserProfile; mustChangePassword: boolean }>('/api/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setStoredToken(null);
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const result = await request<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    setStoredToken(null);
    window.dispatchEvent(new CustomEvent('auth:expired'));
    return result;
  },

  // Profile & Balances
  async getProfile(): Promise<UserProfile> {
    return request<UserProfile>('/api/profile');
  },

  async getLeaveBalances(employeeId?: string): Promise<LeaveBalance[]> {
    const query = employeeId ? `?employee_id=${encodeURIComponent(employeeId)}` : '';
    return request<LeaveBalance[]>(`/api/leave-balances${query}`);
  },

  async getLeaveTransactions(employeeId?: string): Promise<LeaveTransaction[]> {
    const query = employeeId ? `?employee_id=${encodeURIComponent(employeeId)}` : '';
    return request<LeaveTransaction[]>(`/api/leave-transactions${query}`);
  },

  async manualLeaveAdjustment(data: {
    employee_id: string;
    leave_type: LeaveType;
    amount: number;
    reason: string;
  }): Promise<{ success: boolean; transaction: LeaveTransaction; balance: LeaveBalance }> {
    return request<{ success: boolean; transaction: LeaveTransaction; balance: LeaveBalance }>(
      '/api/admin/leave-adjustments',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  // Leave Requests
  async getLeaveRequests(filters?: {
    status?: string;
    employee?: string;
    leave_type?: string;
    date?: string;
  }): Promise<LeaveRequest[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.employee) params.append('employee', filters.employee);
    if (filters?.leave_type) params.append('leave_type', filters.leave_type);
    if (filters?.date) params.append('date', filters.date);

    const query = params.toString() ? `?${params.toString()}` : '';
    return request<LeaveRequest[]>(`/api/leave-requests${query}`);
  },

  async submitLeaveRequest(data: {
    leave_type: LeaveType;
    start_date: string;
    end_date: string;
    reason: string;
    is_half_day?: boolean;
    half_day_period?: HalfDayPeriod;
    attachment_name?: string;
    attachment_url?: string;
  }): Promise<LeaveRequest> {
    return request<LeaveRequest>('/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async reviewLeaveRequest(
    requestId: string,
    action: 'Approved' | 'Rejected',
    admin_note?: string
  ): Promise<LeaveRequest> {
    return request<LeaveRequest>(`/api/leave-requests/${requestId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ action, admin_note }),
    });
  },

  // Employee Management (Admin)
  async getAllEmployees(): Promise<(UserProfile & { leave_balances: LeaveBalance[] })[]> {
    return request<(UserProfile & { leave_balances: LeaveBalance[] })[]>('/api/employees');
  },

  async createEmployee(data: {
    full_name: string;
    email: string;
    phone: string;
    department: string;
    job_title: string;
    date_joined: string;
    hire_date?: string;
    date_of_birth?: string;
    birthday?: string;
    avatar_url?: string;
    country?: string;
    region?: string;
    timezone?: string;
    annual_leave_days?: number;
    sick_leave_days?: number;
    role?: UserRole;
  }): Promise<UserProfile> {
    return request<UserProfile>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateEmployee(id: string, updates: Partial<UserProfile> & { password?: string }): Promise<UserProfile> {
    return request<UserProfile>(`/api/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteEmployee(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/employees/${id}`, {
      method: 'DELETE',
    });
  },

  async adjustLeaveBalance(
    employeeId: string,
    leave_type: LeaveType,
    allocated_days: number
  ): Promise<LeaveBalance> {
    return request<LeaveBalance>(`/api/employees/${employeeId}/leave-balance`, {
      method: 'PATCH',
      body: JSON.stringify({ leave_type, allocated_days }),
    });
  },

  // Holidays & Staff Coverage
  async getHolidays(filters?: {
    country?: string;
    year?: string;
    holiday_type?: string;
    scope?: string;
    is_active?: boolean;
    upcoming_only?: boolean;
    reference_date?: string;
  }): Promise<Holiday[]> {
    const params = new URLSearchParams();
    if (filters?.country && filters.country !== 'All') params.append('country', filters.country);
    if (filters?.year && filters.year !== 'All') params.append('year', filters.year);
    if (filters?.holiday_type && filters.holiday_type !== 'All') params.append('holiday_type', filters.holiday_type);
    if (filters?.scope && filters.scope !== 'All') params.append('scope', filters.scope);
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
    if (filters?.upcoming_only) params.append('upcoming_only', 'true');
    if (filters?.reference_date) params.append('reference_date', filters.reference_date);

    const query = params.toString() ? `?${params.toString()}` : '';
    return request<Holiday[]>(`/api/holidays${query}`);
  },

  async addHoliday(data: {
    name: string;
    date: string;
    country: string;
    region?: string;
    holiday_type?: HolidayType;
    scope?: HolidayScope;
    description?: string;
    is_active?: boolean;
  }): Promise<Holiday> {
    return request<Holiday>('/api/holidays', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateHoliday(
    id: string,
    data: Partial<Omit<Holiday, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<Holiday> {
    return request<Holiday>(`/api/holidays/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async toggleHolidayActive(id: string): Promise<Holiday> {
    return request<Holiday>(`/api/holidays/${id}/toggle-active`, {
      method: 'PATCH',
    });
  },

  async deleteHoliday(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/holidays/${id}`, {
      method: 'DELETE',
    });
  },

  async getHolidayShifts(filters?: {
    holiday_id?: string;
    holiday_date?: string;
    employee_id?: string;
    status?: string;
  }): Promise<HolidayShiftRequest[]> {
    const params = new URLSearchParams();
    if (filters?.holiday_id) params.append('holiday_id', filters.holiday_id);
    if (filters?.holiday_date) params.append('holiday_date', filters.holiday_date);
    if (filters?.employee_id) params.append('employee_id', filters.employee_id);
    if (filters?.status) params.append('status', filters.status);

    const query = params.toString() ? `?${params.toString()}` : '';
    return request<HolidayShiftRequest[]>(`/api/holiday-shifts${query}`);
  },

  async submitHolidayShift(data: {
    holiday_id: string;
    working_hours: string;
    reason?: string;
  }): Promise<HolidayShiftRequest> {
    return request<HolidayShiftRequest>('/api/holiday-shifts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async assignHolidayShift(data: {
    employee_id: string;
    holiday_id: string;
    working_hours: string;
    status?: 'Approved' | 'Pending';
    admin_note?: string;
  }): Promise<HolidayShiftRequest> {
    return request<HolidayShiftRequest>('/api/admin/holiday-shifts/assign', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async reviewHolidayShift(
    requestId: string,
    action: 'Approved' | 'Rejected',
    admin_note?: string
  ): Promise<HolidayShiftRequest> {
    return request<HolidayShiftRequest>(`/api/holiday-shifts/${requestId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ action, admin_note }),
    });
  },

  async cancelHolidayShift(requestId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/holiday-shifts/${requestId}`, {
      method: 'DELETE',
    });
  },

  async deleteHolidayShift(requestId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/holiday-shifts/${requestId}`, {
      method: 'DELETE',
    });
  },

  async cancelLeaveRequest(requestId: string): Promise<LeaveRequest> {
    return request<LeaveRequest>(`/api/leave-requests/${requestId}/cancel`, {
      method: 'POST',
    });
  },

  async getAllHolidayCoverage(filters?: {
    upcoming_only?: boolean;
    country?: string;
    reference_date?: string;
  }): Promise<HolidayStaffingCoverage[]> {
    const params = new URLSearchParams();
    if (filters?.upcoming_only !== undefined) params.append('upcoming_only', String(filters.upcoming_only));
    if (filters?.country && filters.country !== 'All') params.append('country', filters.country);
    if (filters?.reference_date) params.append('reference_date', filters.reference_date);

    const query = params.toString() ? `?${params.toString()}` : '';
    return request<HolidayStaffingCoverage[]>(`/api/holiday-coverage${query}`);
  },

  async getHolidayCoverageById(holidayId: string): Promise<HolidayStaffingCoverage> {
    return request<HolidayStaffingCoverage>(`/api/holiday-coverage/${holidayId}`);
  },

  async resolveHolidayConflict(
    employee_id: string,
    holiday_date: string,
    resolution: 'keep_shift' | 'keep_leave'
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/api/admin/holiday-conflicts/resolve', {
      method: 'POST',
      body: JSON.stringify({ employee_id, holiday_date, resolution }),
    });
  },

  // Calendar
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    return request<CalendarEvent[]>('/api/calendar');
  },

  // Audit Logs (Admin)
  async getAuditLogs(): Promise<AuditLog[]> {
    return request<AuditLog[]>('/api/audit-logs');
  },

  // Notifications
  async getNotifications(): Promise<NotificationItem[]> {
    return request<NotificationItem[]>('/api/notifications');
  },

  async markNotificationRead(id: string): Promise<void> {
    await request(`/api/notifications/${id}/read`, { method: 'PATCH' });
  },

  async markAllNotificationsRead(): Promise<void> {
    await request('/api/notifications/mark-all-read', { method: 'POST' });
  },

  async deleteNotification(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/notifications/${id}`, {
      method: 'DELETE',
    });
  },

  async clearNotifications(): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/api/notifications', {
      method: 'DELETE',
    });
  },

  // Employee Documents
  async getMyDocuments(): Promise<EmployeeDocument[]> {
    return request<EmployeeDocument[]>('/api/my-documents');
  },

  async getEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]> {
    return request<EmployeeDocument[]>(`/api/admin/employees/${employeeId}/documents`);
  },

  async uploadEmployeeDocument(
    employeeId: string,
    data: { name: string; category: string; file_size: string; file_data?: string }
  ): Promise<EmployeeDocument> {
    return request<EmployeeDocument>(`/api/admin/employees/${employeeId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteEmployeeDocument(employeeId: string, docId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/admin/employees/${employeeId}/documents/${docId}`, {
      method: 'DELETE',
    });
  },

  // Company Settings
  async getSettings(): Promise<import('../types').CompanySettings> {
    return request<import('../types').CompanySettings>('/api/settings');
  },

  async updateSettings(updates: Partial<import('../types').CompanySettings>): Promise<import('../types').CompanySettings> {
    return request<import('../types').CompanySettings>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
};
