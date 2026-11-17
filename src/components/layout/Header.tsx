import { EASTERN_TIME_ZONE } from '../../utils/easternTime';
import { notificationDestination } from '../../utils/navigation';
import { useWorkspace } from '../../context/WorkspaceContext';
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  LogOut,
  Search,
  Sun,
  Moon,
} from 'lucide-react';
import { friendlyMessage, isNightHour } from '../../utils/brandDisplay';
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
    notificationError,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    refreshNotifications,
  } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showNotifications && user) void refreshNotifications();
  }, [showNotifications, user?.id, refreshNotifications]);

  // Format today's date for contextual display
  const todayFormatted = new Date().toLocaleDateString('en-US', { timeZone: EASTERN_TIME_ZONE,
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
    <header className="go-header sticky top-0 z-30">
      <div className="go-header-bar">
        {/* Left Branding & Mobile Menu Toggle */}
        <div className="go-header-start">
          <button
            type="button"
            id="mobile-menu-btn"
            onClick={onMenuToggle}
            className="go-header-icon-button md:hidden"
            aria-label="Toggle navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <button type="button" className="go-header-brand md:hidden" aria-label={`HR Hub home — ${isAdmin ? 'Administration' : 'My Workspace'}`}
            onClick={() => onTabChange(isAdmin ? 'admin-dashboard' : 'dashboard')}>
            <GoDestinationsLogo size="md" variant="icon-only" />
            <span className="go-header-brand-copy">
              <span className="go-header-company">GO DESTINATIONS</span>
              <span className="go-header-product"><strong>HR Hub</strong><span className="go-header-context"><span aria-hidden="true" />{isAdmin ? 'Administration' : 'My Workspace'}</span></span>
            </span>
          </button>
        </div>

        {/* Center: Modern 2026 SaaS Command Bar Search Trigger */}
        <div className="go-header-search hidden md:block">
          <button type="button" onClick={onOpenCommandPalette} className="go-command-trigger">
            <Search className="w-4 h-4" aria-hidden="true" />
            <span>Find a page or action</span>
            <kbd>⌘ / Ctrl K</kbd>
          </button>
        </div>

        {/* Right Side Controls */}
        <div className="go-header-end">
          {/* Mobile search button */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="go-header-icon-button md:hidden"
            title="Find a page or action (⌘ / Ctrl K)"
            aria-label="Find a page or action"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Today's Context Date Pill */}
          <div className="go-date-pill hidden lg:flex">
            {isNightHour(new Date().getHours()) ? <Moon className="go-date-sun is-moon" aria-hidden="true" /> : <Sun className="go-date-sun" aria-hidden="true" />}
            <span className="tabular-nums">{todayFormatted}</span>
          </div>

          {/* Notifications Popover */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              id="notifications-btn"
              onClick={() => setShowNotifications(!showNotifications)}
              className={`go-bell${unreadCount > 0 ? ' has-unread' : ''}`}
              aria-label={`Notifications (${unreadCount} unread)`}
              aria-expanded={showNotifications}
            >
              <Bell className="go-bell-icon" />
              {unreadCount > 0 && (
                <span className="go-bell-count tabular-nums" key={unreadCount}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="go-notification-popover absolute right-0 mt-2 w-80 sm:w-96 go-surface bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/70 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-900 text-xs">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[12px] bg-[#ED9027]/10 text-[#ED9027] border border-[#ED9027]/30 px-2 py-0.2 rounded-full font-medium">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-[12px] text-[#3A5D83] hover:text-[#182E3F] font-medium transition-colors"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                {notificationError && <p role="alert" className="go-field-error px-4 py-2">{notificationError}</p>}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        role="button" tabIndex={0}
                        onKeyDown={e => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                        onClick={() => {
                          markNotificationRead(notif.id);
                          const targetTab = notificationDestination(notif);
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
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{friendlyMessage(notif.message)}</p>
                          <p className="text-[12px] text-slate-400 mt-1 tabular-nums">
                            {new Date(notif.created_at).toLocaleTimeString('en-US', { timeZone: EASTERN_TIME_ZONE, timeZoneName: 'short', hour: '2-digit', minute: '2-digit' })}
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
          <div className="go-header-user">
            {user.avatar_url && user.avatar_url.trim() ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                className="go-header-avatar object-cover"
              />
            ) : (
              <div className="go-header-avatar">
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
              <p className="go-header-user-name">{user.full_name}</p>
              <p className="go-header-user-role">
                {user.job_title || (user.role === 'admin' ? 'Administrator' : 'Employee')}
              </p>
            </div>
            <button
              type="button"
              id="header-logout-btn"
              onClick={logout}
              className="go-header-icon-button go-header-signout"
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
