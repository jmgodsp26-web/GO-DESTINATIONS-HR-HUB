import { resolveRoute, routeHash, type WorkspaceRoute } from './utils/navigation';
import { NavigationContext } from './context/NavigationContext';
import { OnboardingProvider } from './context/OnboardingContext';
const OnboardingView = lazy(() => import('./components/onboarding/OnboardingView').then(module => ({ default: module.OnboardingView })));
const AnnouncementsView = lazy(() => import('./components/announcements/AnnouncementsView').then(module => ({ default: module.AnnouncementsView })));
import { MotionConfig } from 'motion/react';
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
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
const EmployeeDashboard = lazy(() => import('./components/dashboard/EmployeeDashboard').then(module => ({ default: module.EmployeeDashboard })));
const EmployeeProfile = lazy(() => import('./components/profile/EmployeeProfile').then(module => ({ default: module.EmployeeProfile })));
const LeaveHistory = lazy(() => import('./components/leave/LeaveHistory').then(module => ({ default: module.LeaveHistory })));
const HolidaysView = lazy(() => import('./components/holidays/HolidaysView').then(module => ({ default: module.HolidaysView })));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const EmployeeManagement = lazy(() => import('./components/admin/EmployeeManagement').then(module => ({ default: module.EmployeeManagement })));
const AdminLeaveRequests = lazy(() => import('./components/admin/AdminLeaveRequests').then(module => ({ default: module.AdminLeaveRequests })));
const CompanyCalendar = lazy(() => import('./components/admin/CompanyCalendar').then(module => ({ default: module.CompanyCalendar })));
const AuditLogsView = lazy(() => import('./components/admin/AuditLogsView').then(module => ({ default: module.AuditLogsView })));
const DocumentsView = lazy(() => import('./components/documents/DocumentsView').then(module => ({ default: module.DocumentsView })));
const ReportsView = lazy(() => import('./components/reports/ReportsView').then(module => ({ default: module.ReportsView })));
const SettingsView = lazy(() => import('./components/settings/SettingsView').then(module => ({ default: module.SettingsView })));
const NotificationsView = lazy(() => import('./components/notifications/NotificationsView').then(module => ({ default: module.NotificationsView })));

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [route, setRoute] = useState<WorkspaceRoute>({ mode: 'personal', tab: 'dashboard', query: '' });
  const routeRef = useRef(route); routeRef.current = route;
  const workspaceMode = route.mode, currentTab = route.tab;
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!user) return;
    const mode = user.role === 'admin' ? 'administration' : 'personal';
    let saved = ''; try { saved = sessionStorage.getItem(`hr:last-route:${user.id}`) || ''; } catch {}
    const next = resolveRoute(user.role, mode, location.hash || saved || (mode === 'administration' ? 'admin-dashboard' : 'dashboard'));
    setRoute(next); routeRef.current = next; history.replaceState(null, '', routeHash(next));
    const pop = () => {
      const event = new Event('workspace:before-navigate', { cancelable: true });
      if (!window.dispatchEvent(event)) { history.pushState(null, '', routeHash(routeRef.current)); return; }
      const target = resolveRoute(user.role, routeRef.current.mode, location.hash);
      setRoute(target); routeRef.current = target; setIsMobileSidebarOpen(false);
      try { sessionStorage.setItem(`hr:last-route:${user.id}`, routeHash(target)); } catch {}
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
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
    const target = resolveRoute(user.role, mode, targetTab);
    if (routeHash(target) === routeHash(route)) return true;
    if (!window.dispatchEvent(new Event('workspace:before-navigate', { cancelable: true }))) return false;
    history.pushState(null, '', routeHash(target)); setRoute(target); routeRef.current = target;
    try { sessionStorage.setItem(`hr:last-route:${user.id}`, routeHash(target)); } catch {}
    setIsMobileSidebarOpen(false);
    return true;
  };

  return (
    <NavigationContext.Provider value={{ query: route.query, navigate: handleTabChange }}><WorkspaceProvider mode={mode}>
    <div className="go-app go-polished min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans antialiased">
      <a className="go-skip-link" href="#workspace-content" onClick={e => { e.preventDefault(); document.getElementById("workspace-content")?.focus(); }}>Skip to content</a>
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
        <main id="workspace-content" tabIndex={-1} key={`${mode}:${currentTab}`} className="go-main flex-1 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
<Suspense fallback={<p className="go-refresh-status" role="status">Opening workspace…</p>}>
          {currentTab === 'onboarding' && <OnboardingView />}
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
              {currentTab === 'announcements' && <AnnouncementsView />}
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
                'announcements',
                'onboarding',
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
              {currentTab === 'announcements' && <AnnouncementsView />}
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
                'onboarding',
                'admin-dashboard',
                'dashboard',
                'employees',
                'leave-requests',
                'requests',
                'leave',
                'history',
                'announcements',
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
          </Suspense>
        </main>
      </div>

      {/* Global 2026 SaaS Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={handleTabChange}
      />
    </div>
    </WorkspaceProvider></NavigationContext.Provider>
  );
};

export default function App() {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <OnboardingProvider><MainApp /></OnboardingProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
    </MotionConfig>
  );
}
