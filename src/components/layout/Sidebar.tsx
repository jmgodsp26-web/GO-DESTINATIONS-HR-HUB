import { motion } from 'motion/react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOnboarding } from '../../context/OnboardingContext';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  User,
  CalendarCheck,
  CalendarDays,
  Calendar as CalendarIcon,
  Users,
  ClipboardList,
  FileText,
  FolderOpen,
  LogOut,
  X,
  HelpCircle,
  LifeBuoy,
  BarChart3,
  Settings as SettingsIcon,
  Bell,
  Megaphone,
} from 'lucide-react';
import { GoDestinationsLogo } from '../common/GoDestinationsLogo';
import { GoBuddy } from '../common/GoBuddy';
import { buddyMessages } from '../../utils/brandDisplay';

const PILL_SPRING = { type: 'spring', stiffness: 520, damping: 38, mass: 0.9 } as const;

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
  const [hovered, setHovered] = useState<string | null>(null);
  // The buddy only appears when the whole menu fits, so it is never half cut off.
  const scrollRef = useRef<HTMLDivElement>(null), buddyHeight = useRef(76);
  const [tight, setTight] = useState(false);

  const { isAdministration: isAdmin } = useWorkspace();
  const { summary: onboarding } = useOnboarding();
  useEffect(() => {
    const area = scrollRef.current;
    if (!area || typeof ResizeObserver === 'undefined') return;
    const check = () => {
      const buddy = area.querySelector<HTMLElement>('.go-buddy');
      const shown = Boolean(buddy && buddy.offsetHeight);
      if (shown && buddy) buddyHeight.current = buddy.offsetHeight;
      setTight(area.scrollHeight + (shown ? 0 : buddyHeight.current + 12) > area.clientHeight + 1);
    };
    const observer = new ResizeObserver(check);
    observer.observe(area); check();
    return () => observer.disconnect();
  }, [user?.id, user?.role, isAdmin, onboarding?.available]);
  if (!user) return null;
  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  const employeeGroups: NavGroup[] = [
    {
      groupTitle: 'Workspace',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...(onboarding?.available ? [{ id: 'onboarding', label: 'Getting started', icon: ClipboardList }] : []),
        { id: 'profile', label: 'My Profile', icon: User },
      ],
    },
    {
      groupTitle: 'Time & Records',
      items: [
        { id: 'leave', label: 'My Leave', icon: CalendarCheck },
        { id: 'calendar', label: 'Company Calendar', icon: CalendarIcon },
        { id: 'announcements', label: 'Announcements', icon: Megaphone },
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
        { id: 'announcements', label: 'Announcements', icon: Megaphone },
      ],
    },
    {
      groupTitle: 'People & Requests',
      items: [
        { id: 'employees', label: 'Employees', icon: Users },
        { id: 'onboarding', label: 'Onboarding', icon: ClipboardList },
        { id: 'leave-requests', label: 'Leave Approvals', icon: ClipboardList },
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
  const firstName = user.full_name.split(' ').filter(Boolean)[0] || 'there';
  const initials = user.full_name ? user.full_name.split(' ').filter(Boolean).map((n) => n[0]).join('').substring(0, 2).toUpperCase() : 'GD';
  const now = new Date();
  const newRequests = notifications.filter((n) => !n.read && n.type === 'new_request').length;
  const buddyLines = buddyMessages({ firstName, hour: now.getHours(), weekday: now.getDay(), unread: unreadNotifCount,
    newRequests: isAdmin ? newRequests : undefined, onboarding: !isAdmin && Boolean(onboarding?.available) });

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
        className={`go-sidebar fixed md:sticky top-0 z-40 flex flex-col shrink-0 transition-transform duration-300 ease-out select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="go-sidebar-top">
          <button type="button" className="go-sidebar-brand" aria-label={`HR Hub home — ${isAdmin ? 'Administration' : 'My Workspace'}`}
            onClick={() => { onTabChange(isAdmin ? 'admin-dashboard' : 'dashboard'); onClose(); }}>
            <span className="go-sidebar-logo"><GoDestinationsLogo size="sm" variant="icon-only" /></span>
            <span className="go-sidebar-brand-copy"><strong>HR Hub</strong><small>GO Destinations</small></span>
          </button>
          <button type="button" onClick={() => setShowHelpModal(true)} className="go-sidebar-help" aria-label="HR Policies & Help" title="HR Policies & Help">
            <HelpCircle className="w-5 h-5" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Close navigation" onClick={onClose} className="go-sidebar-close md:hidden">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`go-sidebar-scroll${tight ? ' is-tight' : ''}`} ref={scrollRef}>
          {user.role === 'admin' && (
            <div className="go-workspace-switch" role="group" aria-label="Choose workspace">
              {[{ id: 'personal', label: 'My Workspace', tab: 'my-workspace', active: !isAdmin }, { id: 'administration', label: 'Administration', tab: 'admin-dashboard', active: isAdmin }].map(option => (
                <button key={option.id} type="button" id={`workspace-${option.id}`} aria-pressed={option.active}
                  onClick={() => { onTabChange(option.tab); onClose(); }}>
                  {option.active && <motion.span layoutId="workspace-selection" className="go-workspace-selection" aria-hidden="true" transition={PILL_SPRING} />}
                  <span className="relative z-10">{option.label}</span>
                </button>
              ))}
            </div>
          )}
          <nav className="go-nav" aria-label="Main navigation" onPointerLeave={() => setHovered(null)}>
            {navGroups.map((group, groupIdx) => (
              <div key={group.groupTitle || groupIdx} className="go-nav-group">
                <span className="go-nav-group-title">{group.groupTitle}</span>
                <div className="go-nav-items">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        id={`nav-${item.id}`}
                        aria-current={isActive ? 'page' : undefined}
                        type="button"
                        onPointerEnter={() => setHovered(item.id)}
                        onClick={() => {
                          onTabChange(item.id);
                          onClose();
                        }}
                        className={`sidebar-menu-item go-nav-item${isActive ? ' is-active' : ''}`}
                      >
                        {isActive && <motion.span layoutId="navigation-selection" className="go-nav-selection" aria-hidden="true" transition={PILL_SPRING} />}
                        {hovered === item.id && !isActive && <motion.span layoutId="navigation-hover" className="go-nav-hover" aria-hidden="true" transition={PILL_SPRING} />}
                        <span className="go-nav-item-label">
                          <Icon className="go-nav-icon" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.badge && <span className="go-nav-badge">{item.badge}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <GoBuddy messages={buddyLines} />
        </div>

        <div className="go-sidebar-foot">
          <div className="go-sidebar-user">
            <span className="go-sidebar-avatar">
              {user.avatar_url && user.avatar_url.trim() ? <img src={user.avatar_url} alt="" /> : <span aria-hidden="true">{initials}</span>}
              <span className="go-sidebar-presence" aria-hidden="true" />
            </span>
            <span className="go-sidebar-user-copy" title={user.role === 'admin' ? `${user.full_name} · Admin access` : user.full_name}><strong>{user.full_name}</strong><small>{user.job_title || (user.role === 'admin' ? 'Administrator' : 'Employee')}</small></span>
            <button type="button" id="sidebar-logout-btn" onClick={logout} className="go-sidebar-signout" aria-label="Sign out" title="Sign out">
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="go-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
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
                className="go-button go-button-primary"
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
