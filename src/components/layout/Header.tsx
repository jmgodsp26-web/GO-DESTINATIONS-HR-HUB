import { useWorkspace } from '../../context/WorkspaceContext';
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  LogOut,
  ChevronDown,
  Building2,
  Users,
  ShieldCheck,
  UserCheck,
  Check,
  Sparkles,
  Search,
  Command,
  SlidersHorizontal,
} from 'lucide-react';
import { GoDestinationsLogo } from '../common/GoDestinationsLogo';

interface HeaderProps {
  onMenuToggle?: () => void;
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenCommandPalette?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onMenuToggle,
  onTabChange,
  onOpenCommandPalette,
}) => {
  const {
    user,
    logout,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Format today's date for contextual display
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { isAdministration: isAdmin } = useWorkspace();
  if (!user) return null;

  return (
    <header className="go-header bg-white/95 backdrop-blur-md border-b border-slate-200/70 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-colors">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Left Branding & Mobile Menu Toggle */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            type="button"
            id="mobile-menu-btn"
            onClick={onMenuToggle}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Toggle navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div
            className="flex items-center space-x-3 cursor-pointer select-none"
            onClick={() => onTabChange(isAdmin ? 'admin-dashboard' : 'dashboard')}
          >
            <GoDestinationsLogo size="md" variant="icon-only" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-sm sm:text-[15px] tracking-tight">
                  GO Destinations <span className="font-medium text-slate-500">HR Hub</span>
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium tracking-wide uppercase ${
                    isAdmin
                      ? 'bg-[#3A5D83]/10 text-[#3A5D83] border border-[#3A5D83]/30'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {isAdmin ? 'Administration' : user.role === 'admin' ? 'My Workspace' : 'Employee'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block font-normal">
                Your people. Your workplace. Your GO.
              </p>
            </div>
          </div>
        </div>

        {/* Center: Modern 2026 SaaS Command Bar Search Trigger */}
        <div className="flex-1 max-w-md hidden md:block">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300 text-slate-400 text-xs transition-all duration-150 shadow-2xs group"
          >
            <div className="flex items-center space-x-2">
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
              <span className="text-slate-500 font-normal">Search or jump to...</span>
            </div>
            <div className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200/90 rounded shadow-2xs">
                ⌘K
              </kbd>
            </div>
          </button>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {/* Mobile search button */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="md:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Search commands (⌘K)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Today's Context Date Pill */}
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span className="tabular-nums">{todayFormatted}</span>
          </div>

          {/* Notifications Popover */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              id="notifications-btn"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              aria-label={`Notifications (${unreadCount} unread)`}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#ED9027] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white shadow-xs tabular-nums leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 go-surface bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/70 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-900 text-xs">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] bg-[#ED9027]/10 text-[#ED9027] border border-[#ED9027]/30 px-2 py-0.2 rounded-full font-medium">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-[11px] text-[#3A5D83] hover:text-[#182E3F] font-medium transition-colors"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          markNotificationRead(notif.id);
                          const targetTab = notif.link_tab || 'notifications';
                          onTabChange(targetTab);
                          setShowNotifications(false);
                        }}
                        className={`p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-start space-x-3 ${
                          !notif.read ? 'bg-[#3A5D83]/5' : ''
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {notif.type === 'leave_approved' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : notif.type === 'leave_rejected' ? (
                            <XCircle className="w-4 h-4 text-rose-600" />
                          ) : (
                            <Clock className="w-4 h-4 text-[#ED9027]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs ${!notif.read ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
                            {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ED9027] mt-1.5 shrink-0" />
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => {
                      onTabChange('notifications');
                      setShowNotifications(false);
                    }}
                    className="w-full text-center py-1.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 font-semibold transition-colors"
                  >
                    View All in Notifications →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Capsule & Sign Out */}
          <div className="flex items-center space-x-2.5 pl-2 sm:pl-3 border-l border-slate-200">
            {user.avatar_url && user.avatar_url.trim() ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                className="w-8 h-8 rounded-full object-cover border border-slate-200/90 shadow-2xs ring-1 ring-slate-100"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#3A5D83] text-white flex items-center justify-center text-xs font-bold shrink-0 border border-slate-200/90 shadow-2xs ring-1 ring-slate-100">
                {user.full_name
                  ? user.full_name
                      .split(' ')
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase()
                  : 'U'}
              </div>
            )}
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[130px]">{user.full_name}</p>
              <p className="text-[10px] text-slate-400 truncate max-w-[130px]">
                {user.job_title || (user.role === 'admin' ? 'Administrator' : 'Employee')}
              </p>
            </div>
            <button
              type="button"
              id="header-logout-btn"
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
