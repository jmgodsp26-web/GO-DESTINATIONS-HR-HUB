import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { CompanySettings } from '../../types';
import {
  Settings,
  Building,
  Clock,
  CalendarCheck,
  Bell,
  Save,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const isAdmin = user?.role === 'admin';

  const [settings, setSettings] = useState<CompanySettings>({
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
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password successfully updated!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast({
        type: 'success',
        title: 'Password Updated',
        message: 'Your account password has been updated securely.',
      });
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password. Please check your current password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getSettings();
      if (data && data.company_name) {
        setSettings(data);
      }
    } catch (err) {
      console.warn('Using local settings defaults:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast({
        type: 'info',
        title: 'Preferences Saved',
        message: 'Personal notification settings updated successfully.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      showToast({
        type: 'success',
        title: 'Settings Saved',
        message: 'Company policies and system preferences updated successfully.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Failed to Save Settings',
        message: err.message || 'We could not update the company settings. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-slate-900 text-white">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {isAdmin ? 'Company & System Settings' : 'Preferences & Policies'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {isAdmin
                  ? 'Manage organizational standards, annual leave allowances, and system readiness.'
                  : 'Review company time-off guidelines and your notification preferences.'}
              </p>
            </div>
          </div>
        </div>

        {/* Status Chip */}
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Service Layer Active</span>
          </span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Organization & Working Hours */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-slate-100">
            <Building className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Organization Profile &amp; Operating Hours</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-slate-50/50 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Timezone</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-slate-50/50 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Standard Working Hours</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={settings.working_hours}
                onChange={(e) => setSettings({ ...settings, working_hours: e.target.value })}
                placeholder="e.g. 09:00 - 18:00"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-slate-50/50 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Standard Workweek</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={settings.workweek}
                onChange={(e) => setSettings({ ...settings, workweek: e.target.value })}
                placeholder="e.g. Monday to Friday"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-slate-50/50 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Leave Policy & Allowances */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-slate-100">
            <CalendarCheck className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Standard Leave Entitlements &amp; Policy Rules</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100">
              <label className="block font-semibold text-slate-800 mb-1">Vacation Leave Default</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  disabled={!isAdmin}
                  min={0}
                  max={60}
                  value={settings.annual_leave_default}
                  onChange={(e) =>
                    setSettings({ ...settings, annual_leave_default: parseInt(e.target.value) || 0 })
                  }
                  className="w-24 rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100"
                />
                <span className="text-slate-500 font-medium">days / year</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Assigned to newly created employee accounts.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100">
              <label className="block font-semibold text-slate-800 mb-1">Sick Leave Default</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  disabled={!isAdmin}
                  min={0}
                  max={60}
                  value={settings.sick_leave_default}
                  onChange={(e) =>
                    setSettings({ ...settings, sick_leave_default: parseInt(e.target.value) || 0 })
                  }
                  className="w-24 rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100"
                />
                <span className="text-slate-500 font-medium">days / year</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Paid medical leave allocation per calendar year.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100">
              <label className="block font-semibold text-slate-800 mb-1">Emergency Leave Default</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  disabled={!isAdmin}
                  min={0}
                  max={60}
                  value={settings.casual_leave_default}
                  onChange={(e) =>
                    setSettings({ ...settings, casual_leave_default: parseInt(e.target.value) || 0 })
                  }
                  className="w-24 rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100"
                />
                <span className="text-slate-500 font-medium">days / year</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Short notice emergency absence entitlement.</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Holiday Working Shift Credit Rate
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  step="0.5"
                  disabled={!isAdmin}
                  value={settings.holiday_credit_rate}
                  onChange={(e) =>
                    setSettings({ ...settings, holiday_credit_rate: parseFloat(e.target.value) || 1.0 })
                  }
                  className="w-24 rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100"
                />
                <span className="text-slate-500 font-medium">day credit per approved public holiday worked</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Medical Certificate Requirement Threshold
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  disabled={!isAdmin}
                  value={settings.require_medical_cert_days}
                  onChange={(e) =>
                    setSettings({ ...settings, require_medical_cert_days: parseInt(e.target.value) || 2 })
                  }
                  className="w-24 rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100"
                />
                <span className="text-slate-500 font-medium">consecutive days absent requires doctor's note</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Notification Preferences */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-slate-100">
            <Bell className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Alerts &amp; Notification Preferences</h2>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
              <div>
                <p className="font-semibold text-slate-900">Email Notifications</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Receive instant email digests when leave requests are submitted, approved, or rejected.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.email_notifications_enabled}
                onChange={(e) =>
                  setSettings({ ...settings, email_notifications_enabled: e.target.checked })
                }
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
              <div>
                <p className="font-semibold text-slate-900">In-App Notification Banner Alerts</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Show desktop toast alerts and pulse notification dots on status changes.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.browser_notifications_enabled}
                onChange={(e) =>
                  setSettings({ ...settings, browser_notifications_enabled: e.target.checked })
                }
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
            </label>
          </div>
        </div>

        {/* Section 4: Account Security & Password */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-slate-100">
            <Lock className="w-4 h-4 text-[#3A5D83]" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Account Security &amp; Password</h2>
              <p className="text-[11px] text-slate-500">Update your personal password for signing in to the HR portal</p>
            </div>
          </div>

          <div className="space-y-4">
            {passwordError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-700 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-700 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3A5D83]/20 focus:border-[#3A5D83] font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Default is Welcome2026! if not changed</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3A5D83]/20 focus:border-[#3A5D83] font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3A5D83]/20 focus:border-[#3A5D83] font-mono"
                />
              </div>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={handlePasswordChange}
                disabled={isUpdatingPassword || !newPassword}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#3A5D83] hover:bg-[#2F4D6D] disabled:opacity-50 transition-colors shadow-2xs"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{isUpdatingPassword ? 'Updating...' : 'Update Password'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isAdmin && (
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={loadSettings}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              Discard Changes
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#3A5D83] hover:bg-[#2F4D6D] shadow-xs transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save System Settings'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
