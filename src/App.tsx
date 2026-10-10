import { MotionConfig } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { navigateWorkspace, type WorkspaceMode } from './utils/workspace';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { CommandPalette } from './components/common/CommandPalette';
import { LoginPage } from './components/auth/LoginPage';
import { FirstTimePasswordModal } from './components/auth/FirstTimePasswordModal';
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
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('administration');
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  // Reset only on account/role changes, never when switching workspaces.
  useEffect(() => {
    setWorkspaceMode(user?.role === 'admin' ? 'administration' : 'personal');
    setCurrentTab(user?.role === 'admin' ? 'admin-dashboard' : 'dashboard');
  }, [user?.id, user?.role]);

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

  const mode: WorkspaceMode = user.role === 'admin' ? workspaceMode : 'personal';
  const isAdministration = user.role === 'admin' && mode === 'administration';
  const handleTabChange = (targetTab: string) => {
    const target = navigateWorkspace(user.role, mode, targetTab);
    setWorkspaceMode(target.mode);
    setCurrentTab(target.tab);
    setIsMobileSidebarOpen(false);
  };

  return (
    <WorkspaceProvider mode={mode}>
    <div className="go-app min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans antialiased">
      {/* First-Time Password Setup Modal for Initial Onboarding Sign-In */}
      <FirstTimePasswordModal />

      {/* Top Navigation Header */}
      <Header
        onMenuToggle={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      <div className="go-workspace flex-1 flex w-full mx-auto">
        {/* Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={handleTabChange}
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Viewport */}
        <main key={`${mode}:${currentTab}`} className="go-main flex-1 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
          {/* Employee Views */}
          {!isAdministration && (
            <>
              {(currentTab === 'dashboard' || currentTab === 'employee-dashboard') && (
                <EmployeeDashboard onNavigateTab={handleTabChange} />
              )}
              {currentTab === 'profile' && <EmployeeProfile />}
              {(currentTab === 'leave' || currentTab === 'requests' || currentTab === 'history') && (
                <LeaveHistory />
              )}
              {currentTab === 'calendar' && <CompanyCalendar />}
              {currentTab === 'holidays' && <HolidaysView />}
              {currentTab === 'documents' && <DocumentsView />}
              {currentTab === 'notifications' && (
                <NotificationsView onNavigateTab={handleTabChange} />
              )}
              {currentTab === 'settings' && <SettingsView />}
              {/* Fallback for unrecognized tab */}
              {![
                'dashboard',
                'employee-dashboard',
                'profile',
                'leave',
                'requests',
                'history',
                'calendar',
                'holidays',
                'documents',
                'notifications',
                'settings',
              ].includes(currentTab) && (
                <EmployeeDashboard onNavigateTab={handleTabChange} />
              )}
            </>
          )}

          {/* Admin Views */}
          {isAdministration && (
            <>
              {(currentTab === 'admin-dashboard' || currentTab === 'dashboard') && (
                <AdminDashboard onNavigateTab={handleTabChange} />
              )}
              {currentTab === 'employees' && <EmployeeManagement />}
              {(currentTab === 'leave-requests' || currentTab === 'requests' || currentTab === 'leave' || currentTab === 'history') && (
                <AdminLeaveRequests />
              )}
              {currentTab === 'calendar' && <CompanyCalendar />}
              {currentTab === 'holidays' && <HolidaysView />}
              {currentTab === 'documents' && <DocumentsView />}
              {currentTab === 'reports' && <ReportsView />}
              {currentTab === 'audit-logs' && <AuditLogsView />}
              {currentTab === 'notifications' && (
                <NotificationsView onNavigateTab={handleTabChange} />
              )}
              {currentTab === 'settings' && <SettingsView />}
              {/* Fallback for unrecognized tab */}
              {![
                'admin-dashboard',
                'dashboard',
                'employees',
                'leave-requests',
                'requests',
                'leave',
                'history',
                'calendar',
                'holidays',
                'documents',
                'reports',
                'audit-logs',
                'notifications',
                'settings',
              ].includes(currentTab) && (
                <AdminDashboard onNavigateTab={handleTabChange} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Global 2026 SaaS Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={handleTabChange}
      />
    </div>
    </WorkspaceProvider>
  );
};

export default function App() {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <MainApp />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
    </MotionConfig>
  );
}
