import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  Filter,
  Trash2,
  CalendarCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface NotificationsViewProps {
  onNavigateTab: (tab: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onNavigateTab }) => {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead, user } =
    useAuth();
  const { showToast } = useToast();
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'leaves'>('all');

  const filteredNotifications = notifications.filter((notif) => {
    if (activeFilter === 'unread') return !notif.read;
    if (activeFilter === 'leaves') {
      return (
        notif.type === 'leave_approved' ||
        notif.type === 'leave_rejected' ||
        notif.type === 'new_request'
      );
    }
    return true;
  });

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    showToast({
      type: 'info',
      title: 'All Caught Up',
      message: 'All notifications have been marked as read.',
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/80">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Notifications Center
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Real-time updates regarding leave requests, holiday rosters, and company notices.
              </p>
            </div>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-[#3A5D83]/5 text-[#3A5D83] font-semibold border border-[#3A5D83]/30 rounded-xl text-xs transition-colors shadow-2xs self-start sm:self-auto"
          >
            <Check className="w-4 h-4" />
            <span>Mark All as Read ({unreadCount})</span>
          </button>
        )}
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 text-xs">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-3.5 py-2 rounded-xl font-semibold transition-all ${
            activeFilter === 'all'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          All Notifications ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('unread')}
          className={`px-3.5 py-2 rounded-xl font-semibold transition-all ${
            activeFilter === 'unread'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('leaves')}
          className={`px-3.5 py-2 rounded-xl font-semibold transition-all ${
            activeFilter === 'leaves'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Leave Applications
        </button>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {filteredNotifications.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No notifications found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {activeFilter === 'unread'
                ? "You've read all your notifications! New leave updates or roster notices will show up here."
                : 'Activity alerts regarding leave requests and holiday rosters will appear here.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const isApproved = notif.type === 'leave_approved';
            const isRejected = notif.type === 'leave_rejected';
            const isPending = notif.type === 'new_request';

            return (
              <div
                key={notif.id}
                className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                  !notif.read ? 'bg-indigo-50/20 hover:bg-indigo-50/30' : 'hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-start space-x-3.5">
                  <div className="mt-0.5 shrink-0">
                    {isApproved ? (
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    ) : isRejected ? (
                      <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/80">
                        <XCircle className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80">
                        <Clock className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <h3
                        className={`text-xs sm:text-sm ${
                          !notif.read ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
                        }`}
                      >
                        {notif.title}
                      </h3>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                      {notif.message}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1.5 tabular-nums">
                      {new Date(notif.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                  {!notif.read && (
                    <button
                      type="button"
                      onClick={() => markNotificationRead(notif.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                      Mark read
                    </button>
                  )}
                  {notif.link_tab && (
                    <button
                      type="button"
                      onClick={() => {
                        markNotificationRead(notif.id);
                        onNavigateTab(notif.link_tab);
                      }}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
