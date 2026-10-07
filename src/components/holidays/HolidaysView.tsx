import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Holiday, HolidayStaffingCoverage, UserProfile, HolidayType, HolidayScope } from '../../types';
import { api } from '../../services/api';
import { HolidayDetailModal } from '../admin/HolidayDetailModal';
import { HolidayShiftRequestModal } from './HolidayShiftRequestModal';
import {
  COMMON_COUNTRIES,
  getCountryFlag,
  DEFAULT_COUNTRY,
  getTodayDateString,
  formatHolidayDate,
} from '../../utils/countryUtils';
import {
  CalendarDays,
  PlusCircle,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  Calendar,
  Clock,
  ShieldCheck,
  Eye,
  Plus,
  Globe,
  Filter,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  Search,
  Building2,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react';

export const HolidaysView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [coverageList, setCoverageList] = useState<HolidayStaffingCoverage[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('All');
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedScope, setSelectedScope] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [upcomingOnly, setUpcomingOnly] = useState<boolean>(false);

  // Detail Modal
  const [selectedCoverage, setSelectedCoverage] = useState<HolidayStaffingCoverage | null>(null);

  // Shift Request Modal (for employee or admin)
  const [shiftRequestHolidayId, setShiftRequestHolidayId] = useState<string | null>(null);

  // Admin Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [deletingHoliday, setDeletingHoliday] = useState<Holiday | null>(null);
  const [isDeletingHoliday, setIsDeletingHoliday] = useState<boolean>(false);
  const [isAssignShiftOpen, setIsAssignShiftOpen] = useState<boolean>(false);
  const [assignShiftForm, setAssignShiftForm] = useState({
    employee_id: '',
    holiday_id: '',
    working_hours: '9:00 AM – 5:00 PM',
    status: 'Approved' as 'Approved' | 'Pending',
    admin_note: '',
  });

  // Form fields for Add/Edit
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    country: DEFAULT_COUNTRY,
    region: 'All',
    holiday_type: 'Public Holiday' as HolidayType,
    scope: 'Country-specific' as HolidayScope,
    is_active: true,
    description: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch holidays with active filters applied on backend if desired, or fetch all and filter in memory for smooth client UX
      const [holRes, covRes, empRes] = await Promise.all([
        api.getHolidays(),
        api.getAllHolidayCoverage().catch(() => []),
        api.getAllEmployees().catch(() => []),
      ]);
      setHolidays(holRes);
      setCoverageList(covRes);
      setEmployees(empRes);

      if (selectedCoverage) {
        const updated = covRes.find((c) => c.holiday.id === selectedCoverage.holiday.id);
        if (updated) setSelectedCoverage(updated);
      }
    } catch (err: any) {
      if (!err?.message?.includes('Session expired') && !err?.message?.includes('token')) {
        console.error('Failed to load holidays & coverage:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedCoverage]);

  useEffect(() => {
    loadData();
  }, []);

  const isAdmin = user?.role === 'admin';
  const todayStr = getTodayDateString(user?.timezone);

  // Dynamic available countries from current holidays list + common
  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    COMMON_COUNTRIES.forEach((c) => set.add(c));
    holidays.forEach((h) => {
      if (h.country && h.country !== 'Company-wide') {
        set.add(h.country);
      }
    });
    return Array.from(set);
  }, [holidays]);

  // Filtered Holidays
  const filteredHolidays = useMemo(() => {
    return holidays.filter((h) => {
      // 1. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = h.name.toLowerCase().includes(q);
        const matchDesc = (h.description || '').toLowerCase().includes(q);
        const matchCountry = (h.country || '').toLowerCase().includes(q);
        const matchRegion = (h.region || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchCountry && !matchRegion) return false;
      }

      // 2. Country filter
      if (selectedCountry !== 'All') {
        if (selectedCountry === 'Company-wide') {
          if (h.scope !== 'Company-wide' && h.country !== 'Company-wide') return false;
        } else {
          // Check country match or company-wide
          const holidayCountry = h.country || DEFAULT_COUNTRY;
          if (holidayCountry !== selectedCountry && h.scope !== 'Company-wide') {
            return false;
          }
        }
      }

      // 3. Year filter
      if (selectedYear !== 'All') {
        const holidayYear = h.date.slice(0, 4);
        if (holidayYear !== selectedYear) return false;
      }

      // 4. Type filter
      if (selectedType !== 'All') {
        if ((h.holiday_type || 'Public Holiday') !== selectedType) return false;
      }

      // 5. Scope filter
      if (selectedScope !== 'All') {
        if ((h.scope || 'Country-specific') !== selectedScope) return false;
      }

      // 6. Status filter
      if (selectedStatus !== 'All') {
        const isActive = h.is_active !== false;
        if (selectedStatus === 'active' && !isActive) return false;
        if (selectedStatus === 'inactive' && isActive) return false;
      }

      // 7. Upcoming only filter (strict: holiday.date > todayStr)
      if (upcomingOnly) {
        if (h.date <= todayStr) return false;
      }

      return true;
    });
  }, [
    holidays,
    searchQuery,
    selectedCountry,
    selectedYear,
    selectedType,
    selectedScope,
    selectedStatus,
    upcomingOnly,
    todayStr,
  ]);

  // Metrics Summary
  const stats = useMemo(() => {
    const total = holidays.length;
    const upcoming = holidays.filter((h) => h.date > todayStr && h.is_active !== false).length;
    const active = holidays.filter((h) => h.is_active !== false).length;
    const inactive = total - active;
    const companyWide = holidays.filter((h) => h.scope === 'Company-wide').length;
    return { total, upcoming, active, inactive, companyWide };
  }, [holidays, todayStr]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCountry('All');
    setSelectedYear('All');
    setSelectedType('All');
    setSelectedScope('All');
    setSelectedStatus('All');
    setUpcomingOnly(false);
  };

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      date: '',
      country: user?.country || DEFAULT_COUNTRY,
      region: 'All',
      holiday_type: 'Public Holiday',
      scope: 'Country-specific',
      is_active: true,
      description: '',
    });
    setError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (h: Holiday) => {
    setFormData({
      name: h.name,
      date: h.date,
      country: h.country || DEFAULT_COUNTRY,
      region: h.region || 'All',
      holiday_type: h.holiday_type || 'Public Holiday',
      scope: h.scope || 'Country-specific',
      is_active: h.is_active !== false,
      description: h.description || '',
    });
    setError(null);
    setEditingHoliday(h);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.date) {
      setError('Please provide holiday name and date.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.addHoliday({
        name: formData.name.trim(),
        date: formData.date,
        country: formData.scope === 'Company-wide' ? 'Company-wide' : formData.country,
        region: formData.region?.trim() || 'All',
        holiday_type: formData.holiday_type,
        scope: formData.scope,
        is_active: formData.is_active,
        description: formData.description.trim() || undefined,
      });
      showToast({
        type: 'success',
        title: 'Holiday Added',
        message: `${formData.name.trim()} added to the holiday directory.`,
      });
      setIsAddModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to add holiday.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHoliday || !formData.name.trim() || !formData.date) {
      setError('Please provide holiday name and date.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.updateHoliday(editingHoliday.id, {
        name: formData.name.trim(),
        date: formData.date,
        country: formData.scope === 'Company-wide' ? 'Company-wide' : formData.country,
        region: formData.region?.trim() || 'All',
        holiday_type: formData.holiday_type,
        scope: formData.scope,
        is_active: formData.is_active,
        description: formData.description.trim() || undefined,
      });
      showToast({
        type: 'success',
        title: 'Holiday Updated',
        message: `${formData.name.trim()} updated successfully.`,
      });
      setEditingHoliday(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update holiday.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (holiday: Holiday) => {
    try {
      const updated = await api.toggleHolidayActive(holiday.id);
      showToast({
        type: updated.is_active ? 'success' : 'info',
        title: updated.is_active ? 'Holiday Activated' : 'Holiday Deactivated',
        message: `${holiday.name} is now ${updated.is_active ? 'active on employee calendars' : 'hidden from employee calendars'}.`,
      });
      await loadData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Failed to toggle holiday status.',
      });
    }
  };

  const handleOpenDelete = (holiday: Holiday) => {
    setDeletingHoliday(holiday);
  };

  const handleConfirmDeleteHoliday = async () => {
    if (!deletingHoliday) return;
    const targetId = deletingHoliday.id;
    const targetName = deletingHoliday.name;
    setIsDeletingHoliday(true);
    try {
      await api.deleteHoliday(targetId);
      showToast({
        type: 'info',
        title: 'Holiday Removed',
        message: `"${targetName}" was permanently removed from the holiday calendar.`,
      });
      setDeletingHoliday(null);
      setHolidays((prev) => prev.filter((h) => h.id !== targetId));
      setCoverageList((prev) => prev.filter((c) => c.holiday.id !== targetId));
      if (selectedCoverage?.holiday.id === targetId) {
        setSelectedCoverage(null);
      }
      await loadData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Deletion Failed',
        message: err.message || 'Failed to delete holiday.',
      });
    } finally {
      setIsDeletingHoliday(false);
    }
  };

  const handleAssignShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignShiftForm.employee_id || !assignShiftForm.holiday_id) {
      showToast({
        type: 'error',
        title: 'Missing Details',
        message: 'Please select both an employee and a holiday.',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await api.assignHolidayShift({
        employee_id: assignShiftForm.employee_id,
        holiday_id: assignShiftForm.holiday_id,
        working_hours: assignShiftForm.working_hours,
        status: assignShiftForm.status,
        admin_note: assignShiftForm.admin_note || 'Scheduled by Administrator',
      });
      const emp = employees.find((e) => e.id === assignShiftForm.employee_id);
      showToast({
        type: 'success',
        title: 'Shift Scheduled',
        message: `Holiday shift assigned to ${emp?.full_name || 'employee'} successfully.`,
      });
      setIsAssignShiftOpen(false);
      setAssignShiftForm({
        employee_id: '',
        holiday_id: '',
        working_hours: '9:00 AM – 5:00 PM',
        status: 'Approved',
        admin_note: '',
      });
      await loadData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Assignment Failed',
        message: err.message || 'Failed to assign holiday shift.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">
              {isAdmin ? 'Holidays & Staff Coverage' : 'Global Holiday Calendar'}
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Multi-Country
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin
              ? 'Configure country-specific, regional, and company-wide closures, staffing coverage, and team rosters.'
              : 'Configure country-specific, regional, and company-wide closures, staff coverage, and holiday shift volunteering.'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {!isAdmin && (
            <button
              type="button"
              onClick={() => setShiftRequestHolidayId(filteredHolidays[0]?.id || holidays[0]?.id || '')}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Volunteer for Holiday Shift</span>
            </button>
          )}

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => {
                  setAssignShiftForm({
                    employee_id: employees[0]?.id || '',
                    holiday_id: filteredHolidays[0]?.id || holidays[0]?.id || '',
                    working_hours: '9:00 AM – 5:00 PM',
                    status: 'Approved',
                    admin_note: '',
                  });
                  setIsAssignShiftOpen(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>Assign Staff Shift</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-[#3A5D83] hover:bg-[#182E3F] text-white rounded-xl font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Holiday</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI / Overview Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 block">Total Holidays</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-xl font-bold text-slate-900 tabular-nums">{stats.total}</span>
            <span className="text-[11px] text-slate-400">across 2026–2027</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 block">Upcoming Active</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-xl font-bold text-emerald-600 tabular-nums">{stats.upcoming}</span>
            <span className="text-[11px] text-slate-400">scheduled</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 block">Company-Wide</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-xl font-bold text-indigo-600 tabular-nums">{stats.companyWide}</span>
            <span className="text-[11px] text-slate-400">all countries</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 block">Status Overview</span>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {stats.active} Active
            </span>
            {stats.inactive > 0 && (
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {stats.inactive} Inactive
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="go-surface bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search holiday name, country, region, or details..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Upcoming Toggle Tab */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setUpcomingOnly(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                !upcomingOnly
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Holidays
            </button>
            <button
              type="button"
              onClick={() => setUpcomingOnly(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                upcomingOnly
                  ? 'bg-white text-indigo-600 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📅 Upcoming Only
            </button>
          </div>
        </div>

        {/* Multi-Filter Dropdown Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Country Filter */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="All">All Countries</option>
              <option value="Company-wide">🌐 Company-wide</option>
              {availableCountries.map((c) => (
                <option key={c} value={c}>
                  {getCountryFlag(c)} {c}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="All">All Years</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
            <span className="text-slate-400">🏷️</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="All">All Types</option>
              <option value="Public Holiday">Public Holiday</option>
              <option value="Company Holiday">Company Holiday</option>
              <option value="Regional Holiday">Regional Holiday</option>
              <option value="Observance">Observance</option>
            </select>
          </div>

          {/* Scope Filter */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="All">All Scopes</option>
              <option value="Company-wide">Company-wide</option>
              <option value="Country-specific">Country-specific</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="All">Status: All</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Reset Filters button if any filter is active */}
          {(searchQuery ||
            selectedCountry !== 'All' ||
            selectedYear !== 'All' ||
            selectedType !== 'All' ||
            selectedScope !== 'All' ||
            selectedStatus !== 'All' ||
            upcomingOnly) && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center space-x-1 px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}

          <div className="ml-auto text-slate-400 text-[11px] font-medium">
            Showing <span className="text-slate-800 font-semibold">{filteredHolidays.length}</span> of{' '}
            {holidays.length}
          </div>
        </div>
      </div>

      {/* Holidays List with Live Coverage Metrics */}
      <div className="go-surface bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading holidays...</div>
          ) : filteredHolidays.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 space-y-2">
              <p>No company holidays match your selected filters.</p>
              <button
                type="button"
                onClick={resetFilters}
                className="text-indigo-600 hover:underline font-semibold"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            filteredHolidays.map((holiday) => {
              const { monthShort: month, day, year, weekday } = formatHolidayDate(holiday.date, {
                showYear: true,
                showWeekday: true,
              });

              const isPast = holiday.date < todayStr;
              const isToday = holiday.date === todayStr;
              const isActive = holiday.is_active !== false;
              const coverage = coverageList.find((c) => c.holiday.id === holiday.id);

              return (
                <div
                  key={holiday.id}
                  className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                    !isActive
                      ? 'bg-slate-50/70 opacity-75'
                      : isPast
                      ? 'bg-slate-50/40 opacity-85'
                      : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    {/* Date badge */}
                    <div
                      className={`border rounded-xl p-2 text-center w-14 shadow-2xs shrink-0 ${
                        !isActive
                          ? 'bg-slate-100 border-slate-200 opacity-60'
                          : isPast
                          ? 'bg-slate-50 border-slate-200 text-slate-500'
                          : 'bg-white border-indigo-100'
                      }`}
                    >
                      <span
                        className={`block text-[10px] font-bold uppercase leading-none ${
                          isActive ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                      >
                        {month}
                      </span>
                      <span className="block text-lg font-extrabold text-slate-900 leading-tight mt-0.5">
                        {day}
                      </span>
                      <span className="block text-[9px] text-slate-400 font-medium leading-none mt-0.5">
                        {year}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {/* Name and Pill Badges */}
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h3 className={`font-bold text-sm ${isActive ? 'text-slate-900' : 'text-slate-500 line-through'}`}>
                          {holiday.name}
                        </h3>

                        {/* Country / Scope Pill */}
                        {holiday.scope === 'Company-wide' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <span>🌐</span>
                            <span>Company-wide</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                            <span>{getCountryFlag(holiday.country || DEFAULT_COUNTRY)}</span>
                            <span>{holiday.country || DEFAULT_COUNTRY}</span>
                            {holiday.region && holiday.region !== 'All' && (
                              <span className="text-slate-500">({holiday.region})</span>
                            )}
                          </span>
                        )}

                        {/* Holiday Type Pill */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            holiday.holiday_type === 'Public Holiday'
                              ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                              : holiday.holiday_type === 'Company Holiday'
                              ? 'bg-purple-50 text-purple-700 border-purple-200/80'
                              : holiday.holiday_type === 'Regional Holiday'
                              ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                              : 'bg-blue-50 text-blue-700 border-blue-200/80'
                          }`}
                        >
                          {holiday.holiday_type || 'Public Holiday'}
                        </span>

                        {/* Status Badge */}
                        {!isActive ? (
                          <span className="text-[10px] text-slate-500 bg-slate-200 px-2 py-0.5 rounded font-semibold">
                            Inactive / Deactivated
                          </span>
                        ) : isPast ? (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-medium">
                            Past Holiday
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                            Active
                          </span>
                        )}

                        {coverage && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              coverage.coverage_status === 'Good'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            Coverage: {coverage.coverage_status === 'Good' ? '✅ Good' : '⚠️ Coverage Needed'}
                          </span>
                        )}
                      </div>

                      {/* Date details */}
                      <p className="text-xs text-slate-500 font-medium">
                        {weekday} • {holiday.date}
                      </p>

                      {holiday.description && (
                        <p className="text-xs text-slate-600 max-w-xl">
                          {holiday.description}
                        </p>
                      )}

                      {/* Coverage Stat Pills */}
                      {coverage && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                            👥 Total: {coverage.total_employees}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                            🟢 Working: {coverage.working_count}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                            🔵 Leave: {coverage.leave_count}
                          </span>
                          {coverage.total_pending_count > 0 && (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                              🟡 Pending: {coverage.total_pending_count}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded font-semibold border ${
                              coverage.pcs_working_count >= coverage.pcs_required
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-amber-50 text-amber-700 border-amber-300'
                            }`}
                          >
                            👤 PCs: {coverage.pcs_working_count}/{coverage.pcs_required}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Roster Button */}
                  <div className="flex items-center space-x-2 self-end lg:self-center shrink-0">
                    {!isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShiftRequestHolidayId(holiday.id)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Volunteer</span>
                      </button>
                    )}

                    {isAdmin && coverage && (
                      <button
                        type="button"
                        onClick={() => setSelectedCoverage(coverage)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Staff Roster</span>
                      </button>
                    )}

                    {isAdmin && (
                      <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-200">
                        {/* Quick Toggle Active Status */}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(holiday)}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                          title={isActive ? 'Click to deactivate holiday' : 'Click to activate holiday'}
                        >
                          {isActive ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                          <span>{isActive ? 'Active' : 'Inactive'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(holiday)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit Holiday"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(holiday)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Holiday"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Selected Holiday Detail Modal */}
      {selectedCoverage && (
        <HolidayDetailModal
          coverage={selectedCoverage}
          allEmployees={employees}
          onClose={() => setSelectedCoverage(null)}
          onRefresh={loadData}
        />
      )}

      {/* Volunteer / Request Shift Modal (Employees only) */}
      {!isAdmin && shiftRequestHolidayId && (
        <HolidayShiftRequestModal
          holidays={holidays}
          initialHolidayId={shiftRequestHolidayId}
          onClose={() => setShiftRequestHolidayId(null)}
          onSuccess={() => {
            setShiftRequestHolidayId(null);
            loadData();
          }}
        />
      )}

      {/* Add Holiday Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="go-surface bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center space-x-2">
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Add Holiday</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSaveAdd} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Holiday Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Independence Day, Eid al-Fitr, Thanksgiving"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Scope *
                  </label>
                  <select
                    value={formData.scope}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value as HolidayScope })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  >
                    <option value="Country-specific">Country-specific</option>
                    <option value="Company-wide">Company-wide (All employees)</option>
                  </select>
                </div>
              </div>

              {formData.scope === 'Country-specific' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Country *
                    </label>
                    <select
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    >
                      {COMMON_COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {getCountryFlag(c)} {c}
                        </option>
                      ))}
                      <option value="Other">🌍 Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Region / Province / State
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. All, Metro Manila, California"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Use "All" for country-wide holidays.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Holiday Type
                  </label>
                  <select
                    value={formData.holiday_type}
                    onChange={(e) => setFormData({ ...formData, holiday_type: e.target.value as HolidayType })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  >
                    <option value="Public Holiday">Public Holiday</option>
                    <option value="Company Holiday">Company Holiday</option>
                    <option value="Regional Holiday">Regional Holiday</option>
                    <option value="Observance">Observance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Calendar Status
                  </label>
                  <div className="flex items-center space-x-3 pt-2">
                    <label className="inline-flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="font-semibold text-slate-800 text-xs">Active on Calendars</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief details or policy notes regarding this holiday closure..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#3A5D83] hover:bg-[#182E3F] rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Add Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Holiday Modal */}
      {editingHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="go-surface bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Holiday</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingHoliday(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Holiday Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Scope *
                  </label>
                  <select
                    value={formData.scope}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value as HolidayScope })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  >
                    <option value="Country-specific">Country-specific</option>
                    <option value="Company-wide">Company-wide (All employees)</option>
                  </select>
                </div>
              </div>

              {formData.scope === 'Country-specific' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Country *
                    </label>
                    <select
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    >
                      {COMMON_COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {getCountryFlag(c)} {c}
                        </option>
                      ))}
                      <option value="Other">🌍 Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Region / Province / State
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. All, Metro Manila, California"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Holiday Type
                  </label>
                  <select
                    value={formData.holiday_type}
                    onChange={(e) => setFormData({ ...formData, holiday_type: e.target.value as HolidayType })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  >
                    <option value="Public Holiday">Public Holiday</option>
                    <option value="Company Holiday">Company Holiday</option>
                    <option value="Regional Holiday">Regional Holiday</option>
                    <option value="Observance">Observance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Calendar Status
                  </label>
                  <div className="flex items-center space-x-3 pt-2">
                    <label className="inline-flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="font-semibold text-slate-800 text-xs">Active on Calendars</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      const holToDelete = editingHoliday;
                      setEditingHoliday(null);
                      setDeletingHoliday(holToDelete);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Holiday</span>
                  </button>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingHoliday(null)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#3A5D83] hover:bg-[#182E3F] rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Update Holiday'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Holiday Confirmation Modal */}
      {deletingHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="go-surface bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center space-x-2 text-rose-700">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-sm font-bold">Delete Holiday</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingHoliday(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-900 font-semibold">{deletingHoliday.name}</strong> on{' '}
                <span className="font-semibold text-slate-800">{deletingHoliday.date}</span>?
              </p>
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-500 space-y-1">
                <p><strong>Country / Scope:</strong> {deletingHoliday.country || 'Company-wide'} ({deletingHoliday.scope})</p>
                <p><strong>Type:</strong> {deletingHoliday.holiday_type}</p>
                <p className="text-rose-600 font-medium pt-1">
                  ⚠️ This will permanently remove this holiday from company calendars and purge associated staffing coverage records.
                </p>
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingHoliday(null)}
                  disabled={isDeletingHoliday}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteHoliday}
                  disabled={isDeletingHoliday}
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingHoliday ? 'Deleting...' : 'Delete Holiday'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Assign Staff Holiday Shift Modal */}
      {isAssignShiftOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="go-surface bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Assign Staff Holiday Shift
                  </h3>
                  <p className="text-xs text-slate-500">
                    Roster an employee for coverage on an upcoming company holiday.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignShiftOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignShiftSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign Employee *
                </label>
                <select
                  value={assignShiftForm.employee_id}
                  onChange={(e) => setAssignShiftForm({ ...assignShiftForm, employee_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                >
                  <option value="" disabled>-- Select Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_id}) • {emp.department} {emp.role === 'admin' ? '[Admin]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Holiday *
                </label>
                <select
                  value={assignShiftForm.holiday_id}
                  onChange={(e) => setAssignShiftForm({ ...assignShiftForm, holiday_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                >
                  <option value="" disabled>-- Select Holiday --</option>
                  {holidays
                    .filter((h) => h.is_active !== false)
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.date}) • {h.country || 'Company-wide'}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Working Hours
                  </label>
                  <input
                    type="text"
                    value={assignShiftForm.working_hours}
                    onChange={(e) => setAssignShiftForm({ ...assignShiftForm, working_hours: e.target.value })}
                    placeholder="e.g. 9:00 AM – 5:00 PM"
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Coverage Status
                  </label>
                  <select
                    value={assignShiftForm.status}
                    onChange={(e) => setAssignShiftForm({ ...assignShiftForm, status: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="Approved">Approved (Rostered)</option>
                    <option value="Pending">Pending Review</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrator Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={assignShiftForm.admin_note}
                  onChange={(e) => setAssignShiftForm({ ...assignShiftForm, admin_note: e.target.value })}
                  placeholder="e.g. Scheduled for vital operational staffing"
                  className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 font-medium resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAssignShiftOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold bg-[#3A5D83] hover:bg-[#182E3F] text-white rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Assigning...' : 'Assign Staff Shift'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
