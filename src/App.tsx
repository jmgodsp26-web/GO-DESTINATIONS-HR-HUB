import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { CommandPalette } from './components/common/CommandPalette';
import { LoginPage } from './components/auth/LoginPage';
import { EmployeeDashboard } from './components/dashboard/EmployeeDashboard';
import { EmployeeProfile } from './components/profile/EmployeeProfile';
import { LeaveHistory } from './components/leave/LeaveHistory';
import { HolidaysView } from './components/holidays/HolidaysView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { EmployeeManagement } from './components/admin/EmployeeManagement';
import { AdminLeaveRequests } from './components/admin/AdminLeaveRequests';
import { CompanyCalendar } from './components/admin/CompanyCalendar';
import { AuditLogsView } from './components/admin/AuditLogsView';
import { DocumentsView } from './components/documents/DocumentsView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { NotificationsView } from './components/notifications/NotificationsView';

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  // Sync default tab whenever user role changes
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        // If current tab is an employee-only tab, switch to admin-dashboard
        if (['dashboard', 'profile', 'leave'].includes(currentTab)) {
          setCurrentTab('admin-dashboard');
        }
      } else {
        // If current tab is an admin-only tab, switch to employee dashboard
        if (['admin-dashboard', 'employees', 'leave-requests', 'audit-logs', 'reports'].includes(currentTab)) {
          setCurrentTab('dashboard');
        }
      }
    }
  }, [user]);

  // Global Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500">Loading HR Portal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Navigation Header */}
      <Header
        onMenuToggle={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={(tab) => setCurrentTab(tab)}
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
          {/* Employee Views */}
          {!isAdmin && (
            <>
              {currentTab === 'dashboard' && (
                <EmployeeDashboard onNavigateTab={(tab) => setCurrentTab(tab)} />
              )}
              {currentTab === 'profile' && <EmployeeProfile />}
              {currentTab === 'leave' && <LeaveHistory />}
              {currentTab === 'calendar' && <CompanyCalendar />}
              {currentTab === 'holidays' && <HolidaysView />}
              {currentTab === 'documents' && <DocumentsView />}
              {currentTab === 'notifications' && (
                <NotificationsView onNavigateTab={(tab) => setCurrentTab(tab)} />
              )}
              {currentTab === 'settings' && <SettingsView />}
            </>
          )}

          {/* Admin Views */}
          {isAdmin && (
            <>
              {currentTab === 'admin-dashboard' && (
                <AdminDashboard onNavigateTab={(tab) => setCurrentTab(tab)} />
              )}
              {currentTab === 'employees' && <EmployeeManagement />}
              {currentTab === 'leave-requests' && <AdminLeaveRequests />}
              {currentTab === 'calendar' && <CompanyCalendar />}
              {currentTab === 'holidays' && <HolidaysView />}
              {currentTab === 'documents' && <DocumentsView />}
              {currentTab === 'reports' && <ReportsView />}
              {currentTab === 'audit-logs' && <AuditLogsView />}
              {currentTab === 'notifications' && (
                <NotificationsView onNavigateTab={(tab) => setCurrentTab(tab)} />
              )}
              {currentTab === 'settings' && <SettingsView />}
            </>
          )}
        </main>
      </div>

      {/* Global 2026 SaaS Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(tab) => setCurrentTab(tab)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <MainApp />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
