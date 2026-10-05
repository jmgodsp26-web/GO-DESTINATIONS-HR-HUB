import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  UserProfile,
  LeaveBalance,
  UserRole,
  EmployeeStatus,
  LeaveType,
  DepartmentName,
  OFFICIAL_DEPARTMENTS,
  LEAVE_TYPE_MASTER_DATA,
} from '../../types';
import { api } from '../../services/api';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  MoreHorizontal,
  Edit2,
  UserX,
  UserCheck,
  Shield,
  Sliders,
  CheckCircle,
  AlertCircle,
  X,
  Building,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  Camera,
  Upload,
  User,
  FolderOpen,
  Globe,
  Trash2,
} from 'lucide-react';
import { EmployeeDocumentsModal } from './EmployeeDocumentsModal';
import { COMMON_COUNTRIES, getCountryFlag, DEFAULT_COUNTRY } from '../../utils/countryUtils';

export const EmployeeManagement: React.FC = () => {
  const { user: currentAdmin } = useAuth();
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<(UserProfile & { leave_balances: LeaveBalance[] })[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [countryFilter, setCountryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<UserProfile | null>(null);
  const [editPassword, setEditPassword] = useState<string>('');
  const [adjustingBalanceEmployee, setAdjustingBalanceEmployee] = useState<{
    employee: UserProfile;
    balances: LeaveBalance[];
  } | null>(null);
  const [selectedDocsEmployee, setSelectedDocsEmployee] = useState<UserProfile | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<UserProfile | null>(null);

  // Add Employee Form State
  const [newEmployee, setNewEmployee] = useState({
    full_name: '',
    email: '',
    password: 'Welcome2026!',
    phone: '',
    department: OFFICIAL_DEPARTMENTS[0],
    job_title: '',
    country: DEFAULT_COUNTRY,
    region: '',
    avatar_url: '',
    date_joined: new Date().toISOString().split('T')[0],
    hire_date: new Date().toISOString().split('T')[0],
    date_of_birth: '',
    annual_leave_days: 15,
    sick_leave_days: 10,
    role: 'employee' as UserRole,
  });

  const addFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Success modal after creating employee with login details
  const [createdEmployeeInfo, setCreatedEmployeeInfo] = useState<{
    full_name: string;
    email: string;
    password: string;
    role: string;
    employee_id: string;
  } | null>(null);

  // Adjust Balance State
  const [selectedLeaveTypeToAdjust, setSelectedLeaveTypeToAdjust] = useState<LeaveType>('Vacation Leave');
  const [newAllocatedDays, setNewAllocatedDays] = useState<number>(15);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getAllEmployees();
      setEmployees(data);
    } catch (err: any) {
      if (!err?.message?.includes('Session expired') && !err?.message?.includes('token')) {
        console.error('Failed to load employees:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const departments = ['All', ...OFFICIAL_DEPARTMENTS];

  // Filtering
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.job_title.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept = departmentFilter === 'All' || emp.department === departmentFilter;
    const matchesCountry = countryFilter === 'All' || (emp.country || DEFAULT_COUNTRY) === countryFilter;
    const matchesStatus = statusFilter === 'All' || emp.status === statusFilter;

    return matchesSearch && matchesDept && matchesCountry && matchesStatus;
  });

  // 1. Create Employee Handler
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const created = await api.createEmployee(newEmployee);
      setIsAddModalOpen(false);
      setCreatedEmployeeInfo({
        full_name: created.full_name,
        email: created.email,
        password: newEmployee.password || 'Welcome2026!',
        role: created.role,
        employee_id: created.employee_id,
      });
      setNewEmployee({
        full_name: '',
        email: '',
        password: 'Welcome2026!',
        phone: '',
        department: OFFICIAL_DEPARTMENTS[0],
        job_title: '',
        country: DEFAULT_COUNTRY,
        region: '',
        avatar_url: '',
        date_joined: new Date().toISOString().split('T')[0],
        hire_date: new Date().toISOString().split('T')[0],
        date_of_birth: '',
        annual_leave_days: 15,
        sick_leave_days: 10,
        role: 'employee',
      });
      await loadEmployees();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create employee record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Edit Employee Handler
  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      const payload: any = {
        full_name: editingEmployee.full_name,
        email: editingEmployee.email,
        phone: editingEmployee.phone,
        department: editingEmployee.department,
        job_title: editingEmployee.job_title,
        country: editingEmployee.country || DEFAULT_COUNTRY,
        region: editingEmployee.region || '',
        timezone: editingEmployee.timezone || '',
        avatar_url: editingEmployee.avatar_url,
        hire_date: editingEmployee.hire_date || editingEmployee.date_joined,
        date_joined: editingEmployee.hire_date || editingEmployee.date_joined,
        date_of_birth: editingEmployee.date_of_birth || editingEmployee.birthday,
        birthday: editingEmployee.date_of_birth || editingEmployee.birthday,
        role: editingEmployee.role,
        status: editingEmployee.status,
      };
      if (editPassword && editPassword.trim()) {
        payload.password = editPassword.trim();
      }
      await api.updateEmployee(editingEmployee.id, payload);
      setEditingEmployee(null);
      setEditPassword('');
      await loadEmployees();
      showToast({
        type: 'success',
        title: 'Profile Updated',
        message: `${editingEmployee.full_name}'s record ${editPassword.trim() ? '(and password) ' : ''}has been updated successfully.`,
      });
    } catch (err: any) {
      setFormError(err.message || 'Failed to update employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Toggle Status (Disable/Enable)
  const handleToggleStatus = async (emp: UserProfile) => {
    const newStatus: EmployeeStatus = emp.status === 'active' ? 'disabled' : 'active';
    try {
      await api.updateEmployee(emp.id, { status: newStatus });
      await loadEmployees();
      showToast({
        type: 'info',
        title: 'Account Status Changed',
        message: `${emp.full_name}'s account is now marked as ${newStatus}.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Failed to change employee status.',
      });
    }
  };

  // 3b. Delete Employee Handler
  const handleDeleteEmployee = async () => {
    if (!deletingEmployee) return;
    if (deletingEmployee.id === currentAdmin?.id) {
      showToast({
        type: 'error',
        title: 'Action Denied',
        message: 'You cannot delete your own administrator account.',
      });
      return;
    }

    setIsSubmitting(true);
    const targetId = deletingEmployee.id;
    const targetName = deletingEmployee.full_name;
    try {
      await api.deleteEmployee(targetId);
      showToast({
        type: 'success',
        title: 'Employee Deleted',
        message: `${targetName} has been removed from the system.`,
      });
      setDeletingEmployee(null);
      setEmployees((prev) => prev.filter((e) => e.id !== targetId));
      await loadEmployees();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Failed to delete employee record.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Adjust Balance
  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingBalanceEmployee) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      await api.adjustLeaveBalance(
        adjustingBalanceEmployee.employee.id,
        selectedLeaveTypeToAdjust,
        Number(newAllocatedDays)
      );
      showToast({
        type: 'success',
        title: 'Leave Balance Adjusted',
        message: `${selectedLeaveTypeToAdjust} for ${adjustingBalanceEmployee.employee.full_name} set to ${newAllocatedDays} days.`,
      });
      setAdjustingBalanceEmployee(null);
      await loadEmployees();
    } catch (err: any) {
      setFormError(err.message || 'Failed to adjust balance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Employee Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage company employees, update role authorizations, and maintain leave entitlements.
          </p>
        </div>

        <button
          type="button"
          id="add-employee-modal-btn"
          onClick={() => {
            setFormError(null);
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#3A5D83] hover:bg-[#2F4D6D] text-white rounded-lg font-semibold text-xs transition-colors shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="employee-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID, email, or position..."
            className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                Dept: {dept}
              </option>
            ))}
          </select>

          {/* Country / Location Filter */}
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
          >
            <option value="All">🌍 Location: All</option>
            {COMMON_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {getCountryFlag(c)} {c}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
          >
            <option value="All">Status: All</option>
            <option value="active">Active Only</option>
            <option value="disabled">Disabled Only</option>
          </select>
        </div>
      </div>

      {/* Employees Table (Desktop) & Card Stack (Mobile) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Employee</th>
                <th className="px-5 py-3.5 font-semibold">Department & Title</th>
                <th className="px-5 py-3.5 font-semibold">Location</th>
                <th className="px-5 py-3.5 font-semibold">Contact</th>
                <th className="px-5 py-3.5 font-semibold">Vacation Leave</th>
                <th className="px-5 py-3.5 font-semibold">Sick Leave</th>
                <th className="px-5 py-3.5 font-semibold">Role</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((emp) => {
                const vacationBal = emp.leave_balances?.find((b) => b.leave_type === 'Vacation Leave') || emp.leave_balances?.find((b) => (b.leave_type as string) === 'Annual Leave');
                const sickBal = emp.leave_balances?.find((b) => b.leave_type === 'Sick Leave');

                const vacationRem = (vacationBal?.allocated_days ?? 15) - (vacationBal?.used_days ?? 0);
                const sickRem = (sickBal?.allocated_days ?? 10) - (sickBal?.used_days ?? 0);

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Employee avatar & name */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center space-x-3">
                        {emp.avatar_url && emp.avatar_url.trim() ? (
                          <img
                            src={emp.avatar_url}
                            alt={emp.full_name}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
                            {emp.full_name.split(' ').map(n => n[0]).join('')}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900">{emp.full_name}</p>
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {emp.employee_id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Department & title */}
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{emp.job_title}</p>
                      <p className="text-[11px] text-slate-500">{emp.department}</p>
                    </td>

                    {/* Location */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-base" title={emp.country || DEFAULT_COUNTRY}>
                          {getCountryFlag(emp.country || DEFAULT_COUNTRY)}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800">{emp.country || DEFAULT_COUNTRY}</p>
                          <p className="text-[11px] text-slate-400">
                            {emp.region && emp.region !== 'All' ? emp.region : 'Nationwide'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-5 py-3.5 text-slate-600">
                      <p className="font-medium text-slate-800">{emp.email}</p>
                      <p className="text-[11px] text-slate-400">{emp.phone}</p>
                    </td>

                    {/* Vacation Leave balance */}
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-slate-900 tabular-nums">{vacationRem}</span>
                      <span className="text-[11px] text-slate-500"> / {vacationBal?.allocated_days ?? 15} days</span>
                    </td>

                    {/* Sick Leave balance */}
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-slate-900 tabular-nums">{sickRem}</span>
                      <span className="text-[11px] text-slate-500"> / {sickBal?.allocated_days ?? 10} days</span>
                    </td>

                    {/* Role badge */}
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        emp.role === 'admin'
                          ? 'bg-purple-50 text-purple-700 border-purple-200/80'
                          : 'bg-slate-100 text-slate-700 border-slate-200/80'
                      }`}>
                        {emp.role === 'admin' ? 'Admin' : 'Employee'}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        emp.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                          : 'bg-rose-50 text-rose-700 border-rose-200/80'
                      }`}>
                        {emp.status === 'active' ? 'Active' : 'Disabled'}
                      </span>
                    </td>

                    {/* Action buttons */}
                    <td className="px-5 py-3.5 text-right space-x-1 whitespace-nowrap">
                      {/* Employee Documents (Admin Only) */}
                      <button
                        type="button"
                        onClick={() => setSelectedDocsEmployee(emp)}
                        className="p-2 text-slate-500 hover:text-[#365c84] hover:bg-slate-100 rounded-lg transition-colors"
                        title="Upload & View Employee Documents"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>

                      {/* Adjust Balance */}
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustingBalanceEmployee({
                            employee: emp,
                            balances: emp.leave_balances || [],
                          });
                          setSelectedLeaveTypeToAdjust('Vacation Leave');
                          const curBal = emp.leave_balances?.find((b) => b.leave_type === 'Vacation Leave') || emp.leave_balances?.find((b) => (b.leave_type as string) === 'Annual Leave');
                          setNewAllocatedDays(curBal?.allocated_days ?? 15);
                        }}
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Adjust Leave Balance"
                      >
                        <Sliders className="w-4 h-4" />
                      </button>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEmployee({ ...emp });
                          setEditPassword('');
                          setFormError(null);
                        }}
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit Employee Information"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Disable / Enable */}
                      {emp.id !== currentAdmin?.id && (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(emp)}
                          className={`p-2 rounded-lg transition-colors ${
                            emp.status === 'active'
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={emp.status === 'active' ? 'Disable Account' : 'Reactivate Account'}
                        >
                          {emp.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      )}

                      {/* Permanent Delete */}
                      {emp.id !== currentAdmin?.id && (
                        <button
                          type="button"
                          onClick={() => setDeletingEmployee(emp)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Employee Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Stack View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredEmployees.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No employees matched your filter criteria.
            </div>
          ) : (
            filteredEmployees.map((emp) => {
              const vacationBal = emp.leave_balances?.find((b) => b.leave_type === 'Vacation Leave') || emp.leave_balances?.find((b) => (b.leave_type as string) === 'Annual Leave');
              const sickBal = emp.leave_balances?.find((b) => b.leave_type === 'Sick Leave');
              const vacationRem = (vacationBal?.allocated_days ?? 15) - (vacationBal?.used_days ?? 0);
              const sickRem = (sickBal?.allocated_days ?? 10) - (sickBal?.used_days ?? 0);

              return (
                <div key={emp.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      {emp.avatar_url && emp.avatar_url.trim() ? (
                        <img
                          src={emp.avatar_url}
                          alt={emp.full_name}
                          className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200 shrink-0">
                          {emp.full_name.split(' ').map(n => n[0]).join('')}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{emp.full_name}</h4>
                        <p className="text-xs text-slate-500">{emp.job_title} • {emp.department}</p>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="font-mono text-[10px] text-slate-400">
                            {emp.employee_id}
                          </span>
                          <span className="inline-flex items-center space-x-1 text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                            <span>{getCountryFlag(emp.country || DEFAULT_COUNTRY)}</span>
                            <span>{emp.country || DEFAULT_COUNTRY}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        emp.role === 'admin'
                          ? 'bg-purple-50 text-purple-700 border-purple-200/80'
                          : 'bg-slate-100 text-slate-700 border-slate-200/80'
                      }`}>
                        {emp.role === 'admin' ? 'Admin' : 'Employee'}
                      </span>
                    </div>
                  </div>

                  {/* Leave Balances Pill Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex justify-between items-center">
                      <span className="text-slate-500 text-[11px]">Vacation:</span>
                      <span className="font-bold text-slate-800 tabular-nums">
                        {vacationRem} <span className="text-[10px] text-slate-400 font-normal">/ {vacationBal?.allocated_days ?? 15}d</span>
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex justify-between items-center">
                      <span className="text-slate-500 text-[11px]">Sick:</span>
                      <span className="font-bold text-slate-800 tabular-nums">
                        {sickRem} <span className="text-[10px] text-slate-400 font-normal">/ {sickBal?.allocated_days ?? 10}d</span>
                      </span>
                    </div>
                  </div>

                  {/* Mobile Action Buttons Bar */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400 truncate max-w-[140px]">{emp.email}</span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => setSelectedDocsEmployee(emp)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                        title="Documents"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustingBalanceEmployee({
                            employee: emp,
                            balances: emp.leave_balances || [],
                          });
                          setSelectedLeaveTypeToAdjust('Vacation Leave');
                          const curBal = emp.leave_balances?.find((b) => b.leave_type === 'Vacation Leave') || emp.leave_balances?.find((b) => (b.leave_type as string) === 'Annual Leave');
                          setNewAllocatedDays(curBal?.allocated_days ?? 15);
                        }}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                        title="Adjust Balances"
                      >
                        <Sliders className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEmployee({ ...emp });
                          setEditPassword('');
                          setFormError(null);
                        }}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {emp.id !== currentAdmin?.id && (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(emp)}
                          className={`p-2 rounded-lg ${
                            emp.status === 'active'
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title="Toggle Status"
                        >
                          {emp.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      )}
                      {emp.id !== currentAdmin?.id && (
                        <button
                          type="button"
                          onClick={() => setDeletingEmployee(emp)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                          title="Delete Employee Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 1. Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-semibold text-slate-900">Add New Employee</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateEmployee} className="p-6 space-y-4 text-xs">
              {/* Profile Photo Upload Field */}
              <div className="flex items-center space-x-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="relative">
                  {newEmployee.avatar_url && newEmployee.avatar_url.trim() ? (
                    <img
                      src={newEmployee.avatar_url}
                      alt="Employee Avatar Preview"
                      className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500 shadow-xs"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg border border-indigo-200">
                      {newEmployee.full_name ? newEmployee.full_name[0].toUpperCase() : <User className="w-6 h-6" />}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-800">Profile Photo</label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => addFileInputRef.current?.click()}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Upload Photo</span>
                    </button>
                    {newEmployee.avatar_url && (
                      <button
                        type="button"
                        onClick={() => setNewEmployee({ ...newEmployee, avatar_url: '' })}
                        className="text-xs text-rose-600 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">JPG, PNG, or WebP up to 2MB</p>
                  <input
                    ref={addFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) {
                        setFormError('Photo must be under 2MB.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        setNewEmployee({ ...newEmployee, avatar_url: reader.result as string });
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newEmployee.full_name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, full_name: e.target.value })}
                    placeholder="e.g. Alex Morgan"
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                    placeholder="alex.morgan@company.com"
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department *</label>
                  <select
                    value={newEmployee.department}
                    onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value as DepartmentName })}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  >
                    {OFFICIAL_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Job Title *</label>
                  <input
                    type="text"
                    required
                    value={newEmployee.job_title}
                    onChange={(e) => setNewEmployee({ ...newEmployee, job_title: e.target.value })}
                    placeholder="e.g. DevOps Engineer"
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Country / Holiday Calendar *
                  </label>
                  <select
                    value={newEmployee.country}
                    onChange={(e) => setNewEmployee({ ...newEmployee, country: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {COMMON_COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {getCountryFlag(c)} {c}
                      </option>
                    ))}
                    <option value="Other">🌍 Other / International</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-0.5">Determines the employee's applicable holiday calendar.</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State / Province / Region</label>
                  <input
                    type="text"
                    value={newEmployee.region}
                    onChange={(e) => setNewEmployee({ ...newEmployee, region: e.target.value })}
                    placeholder="e.g. California, Metro Manila, Ontario"
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Regional or state office (optional).</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Phone</label>
                  <input
                    type="text"
                    value={newEmployee.phone}
                    onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Password *</label>
                  <input
                    type="text"
                    required
                    value={newEmployee.password}
                    onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                    placeholder="e.g. Welcome2026!"
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">This password allows the employee to log in immediately.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hire Date / Date Joined</label>
                  <input
                    type="date"
                    value={newEmployee.hire_date || newEmployee.date_joined}
                    onChange={(e) =>
                      setNewEmployee({
                        ...newEmployee,
                        hire_date: e.target.value,
                        date_joined: e.target.value,
                      })
                    }
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={newEmployee.date_of_birth}
                    onChange={(e) =>
                      setNewEmployee({
                        ...newEmployee,
                        date_of_birth: e.target.value,
                      })
                    }
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Portal Role</label>
                  <select
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value as UserRole })}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="employee">Employee (Self-Service Portal)</option>
                    <option value="admin">Administrator (Full HR Access)</option>
                  </select>
                </div>
              </div>

              {/* Leave Entitlements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vacation Leave Entitlement (Days)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={newEmployee.annual_leave_days}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, annual_leave_days: parseInt(e.target.value) || 0 })
                    }
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sick Leave Entitlement (Days)</label>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    value={newEmployee.sick_leave_days}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, sick_leave_days: parseInt(e.target.value) || 0 })
                    }
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold bg-[#3A5D83] text-white rounded-lg hover:bg-[#2F4D6D] disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Employee Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-semibold text-slate-900">
                Edit Employee: {editingEmployee.full_name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateEmployee} className="p-6 space-y-4 text-xs">
              {/* Profile Photo Change Field */}
              <div className="flex items-center space-x-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="relative">
                  {editingEmployee.avatar_url && editingEmployee.avatar_url.trim() ? (
                    <img
                      src={editingEmployee.avatar_url}
                      alt={editingEmployee.full_name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500 shadow-xs"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg border border-indigo-200">
                      {editingEmployee.full_name ? editingEmployee.full_name[0].toUpperCase() : <User className="w-6 h-6" />}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-800">Profile Photo</label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{editingEmployee.avatar_url ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>
                    {editingEmployee.avatar_url && (
                      <button
                        type="button"
                        onClick={() => setEditingEmployee({ ...editingEmployee, avatar_url: '' })}
                        className="text-xs text-rose-600 hover:underline cursor-pointer"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">JPG, PNG, or WebP up to 2MB</p>
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) {
                        setFormError('Photo must be under 2MB.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        setEditingEmployee({ ...editingEmployee, avatar_url: reader.result as string });
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.full_name}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, full_name: e.target.value })
                    }
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={editingEmployee.email}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, email: e.target.value })
                    }
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={editingEmployee.department}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, department: e.target.value })
                    }
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  >
                    {OFFICIAL_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Job Title</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.job_title}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, job_title: e.target.value })
                    }
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Country / Holiday Calendar *
                  </label>
                  <select
                    value={editingEmployee.country || DEFAULT_COUNTRY}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, country: e.target.value })
                    }
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {COMMON_COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {getCountryFlag(c)} {c}
                      </option>
                    ))}
                    <option value="Other">🌍 Other / International</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-0.5">Used for personalizing Upcoming Holidays.</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State / Province / Region</label>
                  <input
                    type="text"
                    value={editingEmployee.region || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, region: e.target.value })
                    }
                    placeholder="e.g. California, Metro Manila, Ontario"
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hire Date / Date Joined</label>
                  <input
                    type="date"
                    value={editingEmployee.hire_date || editingEmployee.date_joined || ''}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        hire_date: e.target.value,
                        date_joined: e.target.value,
                      })
                    }
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={editingEmployee.date_of_birth || editingEmployee.birthday || ''}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        date_of_birth: e.target.value,
                        birthday: e.target.value,
                      })
                    }
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={editingEmployee.role}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, role: e.target.value as UserRole })
                    }
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900"
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Status</label>
                  <select
                    value={editingEmployee.status}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        status: e.target.value as EmployeeStatus,
                      })
                    }
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900"
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              {/* Password Reset Field */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block font-semibold text-slate-700 mb-1">
                  Reset Account Password (Optional)
                </label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-[#3A5D83] font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Type a new password (e.g. Welcome2026!) to immediately reset this employee's sign-in credentials.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  {editingEmployee.id !== currentAdmin?.id && (
                    <button
                      type="button"
                      onClick={() => {
                        const empToDelete = editingEmployee;
                        setEditingEmployee(null);
                        setDeletingEmployee(empToDelete);
                      }}
                      className="px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Employee</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingEmployee(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-semibold bg-[#3A5D83] text-white rounded-lg hover:bg-[#2F4D6D] disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Adjust Leave Balance Modal */}
      {adjustingBalanceEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-semibold text-slate-900">
                Adjust Leave Balance
              </h3>
              <button
                type="button"
                onClick={() => setAdjustingBalanceEmployee(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustBalance} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="font-bold text-slate-900">
                  {adjustingBalanceEmployee.employee.full_name} ({adjustingBalanceEmployee.employee.employee_id})
                </p>
                <p className="text-slate-500 mt-0.5">{adjustingBalanceEmployee.employee.department}</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Leave Category</label>
                <select
                  value={selectedLeaveTypeToAdjust}
                  onChange={(e) => {
                    const type = e.target.value as LeaveType;
                    setSelectedLeaveTypeToAdjust(type);
                    const bal = adjustingBalanceEmployee.balances.find((b) => b.leave_type === type);
                    setNewAllocatedDays(bal ? bal.allocated_days : (type === 'Vacation Leave' ? 15 : 10));
                  }}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900"
                >
                  {LEAVE_TYPE_MASTER_DATA.map((lt) => (
                    <option key={lt.id} value={lt.name}>
                      {lt.name} {!lt.is_paid ? '(Unpaid)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  New Total Allocated Days (Yearly Entitlement)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newAllocatedDays}
                  onChange={(e) => setNewAllocatedDays(parseInt(e.target.value) || 0)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 font-bold"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Remaining balance is automatically calculated as allocated minus approved used.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setAdjustingBalanceEmployee(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold bg-[#3A5D83] text-white rounded-lg hover:bg-[#2F4D6D] disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Update Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Employee Created Credentials Notification Modal */}
      {createdEmployeeInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 bg-emerald-50/70 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Employee Account Created!</h3>
                  <p className="text-[11px] text-emerald-700 font-medium">Ready for immediate login</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreatedEmployeeInfo(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                The user account and leave ledger have been successfully provisioned. Share these credentials with <span className="font-semibold text-slate-900">{createdEmployeeInfo.full_name}</span>:
              </p>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2.5 font-mono">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-sans text-[11px]">Employee ID</span>
                  <span className="font-bold text-slate-800">{createdEmployeeInfo.employee_id}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-sans text-[11px]">Work Email / Login</span>
                  <span className="font-bold text-[#3A5D83]">{createdEmployeeInfo.email}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-sans text-[11px]">Temporary Password</span>
                  <span className="font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-xs">
                    {createdEmployeeInfo.password}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-sans text-[11px]">Role</span>
                  <span className="font-sans capitalize bg-slate-200 text-slate-800 px-2 py-0.5 rounded text-[11px]">
                    {createdEmployeeInfo.role}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-[11px] leading-relaxed">
                The employee can now open the login page, enter their email and password, and instantly access their leave portal dashboard.
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const info = `GO Destinations HR Portal Access:\nEmployee: ${createdEmployeeInfo.full_name} (${createdEmployeeInfo.employee_id})\nWork Email: ${createdEmployeeInfo.email}\nTemporary Password: ${createdEmployeeInfo.password}\nPortal URL: https://hr.godestinationservices.com/`;
                    navigator.clipboard?.writeText(info);
                    showToast({
                      type: 'success',
                      title: 'Credentials Copied!',
                      message: 'Login instructions and password copied to clipboard.',
                    });
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-200 transition-colors"
                >
                  Copy Login Credentials
                </button>
                <button
                  type="button"
                  onClick={() => setCreatedEmployeeInfo(null)}
                  className="w-full sm:w-auto px-5 py-2 text-xs font-semibold bg-[#3A5D83] text-white rounded-lg hover:bg-[#2F4D6D]"
                >
                  Done & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Delete Employee Confirmation Modal */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center space-x-2 text-rose-700">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-sm font-bold">Delete Employee Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingEmployee(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-900 font-semibold">{deletingEmployee.full_name}</strong> (
                {deletingEmployee.employee_id})?
              </p>
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-500 space-y-1">
                <p><strong>Department:</strong> {deletingEmployee.department}</p>
                <p><strong>Role:</strong> {deletingEmployee.role === 'admin' ? 'Administrator' : 'Employee'}</p>
                <p className="text-rose-600 font-medium pt-1">⚠️ This will delete their profile and leave balance records. This action cannot be undone.</p>
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingEmployee(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteEmployee}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isSubmitting ? 'Deleting...' : 'Delete Employee'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Employee Documents Modal (Admin Only) */}
      {selectedDocsEmployee && (
        <EmployeeDocumentsModal
          employee={selectedDocsEmployee}
          onClose={() => setSelectedDocsEmployee(null)}
        />
      )}
    </div>
  );
};
