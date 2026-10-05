import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Search,
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  FolderOpen,
  User,
  Users,
  ClipboardList,
  Calendar as CalendarIcon,
  FileText,
  PlusCircle,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Sun,
  X,
  Command,
  BarChart3,
  Settings as SettingsIcon,
  Bell,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onRequestLeave?: () => void;
  onHolidayShift?: () => void;
}

interface CommandItem {
  id: string;
  category: 'Navigation' | 'Actions';
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onRequestLeave,
  onHolidayShift,
}) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build command list based on role
  const allCommands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-dash',
      category: 'Navigation',
      title: isAdmin ? 'Admin Command Center' : 'My Dashboard',
      subtitle: 'Headquarters overview, balances, and immediate actions',
      icon: LayoutDashboard,
      action: () => {
        onNavigate(isAdmin ? 'admin-dashboard' : 'dashboard');
        onClose();
      },
    },
    ...(!isAdmin
      ? [
          {
            id: 'nav-leave',
            category: 'Navigation' as const,
            title: 'Leave & Time Off',
            subtitle: 'View balance breakdown, request history, and transactions ledger',
            icon: CalendarCheck,
            action: () => {
              onNavigate('leave');
              onClose();
            },
          },
          {
            id: 'nav-profile',
            category: 'Navigation' as const,
            title: 'My Profile & Details',
            subtitle: 'Personal info, department, verified credentials, and emergency contacts',
            icon: User,
            action: () => {
              onNavigate('profile');
              onClose();
            },
          },
        ]
      : [
          {
            id: 'nav-employees',
            category: 'Navigation' as const,
            title: 'Employee Headcount Directory',
            subtitle: 'Directory list, status toggle, leave balance adjustments, and profiles',
            icon: Users,
            action: () => {
              onNavigate('employees');
              onClose();
            },
          },
          {
            id: 'nav-leave-requests',
            category: 'Navigation' as const,
            title: 'Leave Review Queue',
            subtitle: 'Approve or reject employee leave submissions with instant balance audits',
            icon: ClipboardList,
            badge: 'Admin',
            action: () => {
              onNavigate('leave-requests');
              onClose();
            },
          },
          {
            id: 'nav-calendar',
            category: 'Navigation' as const,
            title: 'Company Calendar & Out of Office',
            subtitle: 'Monthly visual schedule, team coverage, and planned holidays',
            icon: CalendarIcon,
            action: () => {
              onNavigate('calendar');
              onClose();
            },
          },
          {
            id: 'nav-audit',
            category: 'Navigation' as const,
            title: 'System Audit Logs',
            subtitle: 'Immutable record of approvals, employee updates, and system events',
            icon: FileText,
            action: () => {
              onNavigate('audit-logs');
              onClose();
            },
          },
          {
            id: 'nav-reports',
            category: 'Navigation' as const,
            title: 'Reports & Analytics',
            subtitle: 'Leave utilization, department absence distribution, and CSV compliance export',
            icon: BarChart3,
            action: () => {
              onNavigate('reports');
              onClose();
            },
          },
        ]),
    {
      id: 'nav-calendar-shared',
      category: 'Navigation',
      title: 'Company Calendar',
      subtitle: 'Monthly visual schedule, team coverage, and public holidays',
      icon: CalendarIcon,
      action: () => {
        onNavigate('calendar');
        onClose();
      },
    },
    {
      id: 'nav-holidays',
      category: 'Navigation',
      title: 'Company Holidays & Staffing',
      subtitle: 'Official calendar closures and designated public holiday shift rosters',
      icon: CalendarDays,
      action: () => {
        onNavigate('holidays');
        onClose();
      },
    },
    {
      id: 'nav-docs',
      category: 'Navigation',
      title: 'Confidential Documents Vault',
      subtitle: 'Signed contracts, identity proofs, and performance reviews',
      icon: FolderOpen,
      action: () => {
        onNavigate('documents');
        onClose();
      },
    },
    {
      id: 'nav-notifications',
      category: 'Navigation',
      title: 'Notifications Center',
      subtitle: 'Review leave approvals, status updates, and company announcements',
      icon: Bell,
      action: () => {
        onNavigate('notifications');
        onClose();
      },
    },
    {
      id: 'nav-settings',
      category: 'Navigation',
      title: isAdmin ? 'Company Settings & Policies' : 'Preferences & Policy Guidelines',
      subtitle: 'Leave allowances, working hours, company profiles, and notification rules',
      icon: SettingsIcon,
      action: () => {
        onNavigate('settings');
        onClose();
      },
    },
    // Actions
    ...(onRequestLeave
      ? [
          {
            id: 'act-req-leave',
            category: 'Actions' as const,
            title: 'Submit Leave Request',
            subtitle: 'Apply for Annual, Sick, Casual, or Half-Day time off',
            icon: PlusCircle,
            action: () => {
              onRequestLeave();
              onClose();
            },
          },
        ]
      : []),
    ...(onHolidayShift
      ? [
          {
            id: 'act-vol-shift',
            category: 'Actions' as const,
            title:
              user?.role === 'admin'
                ? 'Assign Holiday Shift Coverage'
                : 'Request Holiday Shift Coverage',
            subtitle:
              user?.role === 'admin'
                ? 'Schedule and assign employee holiday shift coverage'
                : 'Volunteer for public holiday coverage with compensatory credit',
            icon: Sun,
            action: () => {
              onHolidayShift();
              onClose();
            },
          },
        ]
      : []),
  ];

  const filteredCommands = allCommands.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q)) ||
      cmd.category.toLowerCase().includes(q)
    );
  });

  // Handle keyboard arrow navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative border-b border-slate-200/80 px-4 py-3.5 flex items-center bg-slate-50/50">
          <Search className="w-4 h-4 text-slate-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, page, or action..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="flex items-center space-x-1 pl-2 ml-2 border-l border-slate-200 shrink-0">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
              ESC
            </kbd>
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-100">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <Search className="w-6 h-6 mx-auto text-slate-300 mb-2" />
              <p className="font-medium text-slate-600">No commands matching &ldquo;{query}&rdquo;</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Try searching for dashboard, leave, employees, or holidays</p>
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-[#3A5D83]/10 text-[#3A5D83]'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                        isSelected
                          ? 'bg-[#3A5D83] text-white border-[#3A5D83] shadow-xs'
                          : 'bg-slate-100 text-slate-600 border-slate-200/80'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {cmd.title}
                        </span>
                        {cmd.badge && (
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                              cmd.badge === 'Admin'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {cmd.badge}
                          </span>
                        )}
                      </div>
                      {cmd.subtitle && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{cmd.subtitle}</p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex items-center space-x-1 text-[#3A5D83] text-xs font-medium pl-2 shrink-0">
                      <span className="hidden sm:inline text-[11px]">Select</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-3">
            <span>
              Use <kbd className="font-mono bg-white border border-slate-200 px-1 py-0.2 rounded shadow-2xs">↑</kbd> <kbd className="font-mono bg-white border border-slate-200 px-1 py-0.2 rounded shadow-2xs">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="font-mono bg-white border border-slate-200 px-1 py-0.2 rounded shadow-2xs">↵</kbd> to select
            </span>
          </div>
          <span className="text-slate-400 font-medium">HR Hub Quick Jump</span>
        </div>
      </div>
    </div>
  );
};
