import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  User,
  CalendarCheck,
  CalendarDays,
  Users,
  ClipboardList,
  Calendar as CalendarIcon,
  FileText,
  FolderOpen,
  LogOut,
  X,
  HelpCircle,
  LifeBuoy,
  ChevronRight,
  Shield,
  Sparkles,
  BarChart3,
  Settings as SettingsIcon,
  Bell,
} from 'lucide-react';
import { GoDestinationsLogo } from '../common/GoDestinationsLogo';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface NavGroup {
  groupTitle: string;
  items: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange, isOpen, onClose }) => {
  const { user, logout, notifications } = useAuth();
  const [showHelpModal, setShowHelpModal] = useState(false);

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  const employeeGroups: NavGroup[] = [
    {
      groupTitle: 'Workspace',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'profile', label: 'My Profile', icon: User },
      ],
    },
    {
      groupTitle: 'Time & Records',
      items: [
        { id: 'leave', label: 'My Leave', icon: CalendarCheck },
        { id: 'calendar', label: 'Company Calendar', icon: CalendarIcon },
        { id: 'holidays', label: 'Company Holidays', icon: CalendarDays },
        { id: 'documents', label: 'My Documents', icon: FolderOpen },
      ],
    },
    {
      groupTitle: 'System',
      items: [
        {
          id: 'notifications',
          label: 'Notifications',
          icon: Bell,
          badge: unreadNotifCount > 0 ? String(unreadNotifCount) : undefined,
        },
        { id: 'settings', label: 'Settings & Policies', icon: SettingsIcon },
      ],
    },
  ];

  const adminGroups: NavGroup[] = [
    {
      groupTitle: 'Overview',
      items: [
        { id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'calendar', label: 'Company Calendar', icon: CalendarIcon },
      ],
    },
    {
      groupTitle: 'People & Requests',
      items: [
        { id: 'employees', label: 'Employees', icon: Users },
        { id: 'leave-requests', label: 'Leave Requests', icon: ClipboardList },
      ],
    },
    {
      groupTitle: 'Records',
      items: [
        { id: 'holidays', label: 'Holidays & Shifts', icon: CalendarDays },
        { id: 'documents', label: 'Documents', icon: FolderOpen },
        { id: 'reports', label: 'Reports', icon: BarChart3 },
        { id: 'audit-logs', label: 'Activity Log', icon: FileText },
      ],
    },
    {
      groupTitle: 'Administration',
      items: [
        {
          id: 'notifications',
          label: 'Notifications',
          icon: Bell,
          badge: unreadNotifCount > 0 ? String(unreadNotifCount) : undefined,
        },
        { id: 'settings', label: 'Company Settings', icon: SettingsIcon },
      ],
    },
  ];

  const navGroups = isAdmin ? adminGroups : employeeGroups;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 z-40 md:hidden backdrop-blur-sm transition-opacity duration-200"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`go-sidebar fixed md:sticky top-0 md:top-16 z-40 h-screen md:h-[calc(100vh-4rem)] w-64 bg-[#182E3F] text-slate-300 flex flex-col justify-between shrink-0 border-r border-slate-800/80 transition-transform duration-200 ease-out select-none shadow-sm ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 flex-1 overflow-y-auto flex flex-col">
          {/* Mobile close button header */}
          <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-800/80 md:hidden">
            <GoDestinationsLogo variant="horizontal" size="sm" darkBackground={true} />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Grouped Navigation Links */}
          <div className="go-sidebar-brand hidden md:block">
            <span className="go-eyebrow">GO DESTINATIONS</span>
            <p>Your workplace,<br /><em>beautifully connected.</em></p>
            <span className="go-sidebar-rule" />
          </div>
          <nav className="space-y-5 flex-1">
            {navGroups.map((group, groupIdx) => (
              <div key={group.groupTitle || groupIdx} className="space-y-1">
                {/* Group Title */}
                <div className="px-3 py-1">
                  <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                    {group.groupTitle}
                  </span>
                </div>

                {/* Items in Group */}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        id={`nav-${item.id}`}
                        type="button"
                        onClick={() => {
                          onTabChange(item.id);
                          onClose();
                        }}
                        className={`sidebar-menu-item w-full group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium tracking-normal transition-all duration-150 ${
                          isActive
                            ? 'bg-[#3A5D83] text-white font-semibold shadow-xs'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors duration-150 ${
                              isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[#ED9027] text-white shadow-2xs">
                            {item.badge}
                          </span>
                        ) : isActive ? (
                          <ChevronRight className="w-3.5 h-3.5 text-white/80 shrink-0" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Secondary Support & Help Link */}
          <div className="pt-3 border-t border-slate-800/80 mt-2 space-y-0.5">
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 transition-colors"
            >
              <HelpCircle className="w-4 h-4 shrink-0 text-slate-500" />
              <span>HR Policies &amp; Help</span>
            </button>
          </div>
        </div>

        {/* User profile capsule & Logout bottom action */}
        <div className="p-3 border-t border-slate-800/80 bg-[#182E3F]/80">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/90 mb-2">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="relative shrink-0">
                {user.avatar_url && user.avatar_url.trim() ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
                    className="w-7 h-7 rounded-full object-cover border border-slate-700/80 ring-1 ring-slate-800"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#3A5D83] text-white flex items-center justify-center text-[10px] font-bold border border-slate-700/80 ring-1 ring-slate-800">
                    {user.full_name
                      ? user.full_name
                          .split(' ')
                          .filter(Boolean)
                          .map((n) => n[0])
                          .join('')
                          .substring(0, 2)
                      : 'GD'}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#182E3F]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate leading-snug">{user.full_name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.job_title}</p>
              </div>
            </div>
            {isAdmin && (
              <span
                className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#3A5D83]/30 text-slate-200 border border-[#3A5D83]/50"
                title="Admin Access"
              >
                Admin
              </span>
            )}
          </div>

          <button
            type="button"
            id="sidebar-logout-btn"
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-400/90 hover:bg-rose-950/40 hover:text-rose-300 transition-colors border border-rose-900/30"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="go-surface bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <LifeBuoy className="w-5 h-5 text-[#3A5D83]" />
                <h3 className="text-sm font-bold text-slate-900">HR Help</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                <strong className="text-slate-900">Leave Policies:</strong> Vacation leave requires 3 days advance notice for requests exceeding 3 consecutive days. Sick leave requires medical certification if exceeding 2 days.
              </p>
              <p>
                <strong className="text-slate-900">Holiday Coverage:</strong> Approved holiday shifts earn leave credit under company policy.
              </p>
              <p>
                <strong className="text-slate-900">Documents:</strong> Find your contracts, ID documents, and reviews in Documents.
              </p>
              <p>
                <strong className="text-slate-900">HR Support:</strong> For payroll, tax inquiries, or system access issues, reach out to <span className="text-[#3A5D83] font-medium">hr-operations@godestinations.com</span>.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-[#3A5D83] hover:bg-[#182E3F] text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
