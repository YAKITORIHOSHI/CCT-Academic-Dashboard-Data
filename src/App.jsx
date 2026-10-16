import React, { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { readPreference as readPref } from './services/userPreferences';
import { useTheme } from './services/useTheme';
import { LoaderCircle } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/auth';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AcademicDataProvider } from './context/AcademicDataProvider';
const AcademicWorkspacePage = lazy(() => import('./pages/AcademicWorkspacePage').then((module) => ({ default: module.AcademicWorkspacePage })));
const SystemAdminPage = lazy(() => import('./pages/SystemAdminPage').then((module) => ({ default: module.SystemAdminPage })));
const RecordsPage = lazy(() => import('./pages/RecordsPage').then((module) => ({ default: module.RecordsPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const InstitutionalUnitPage = lazy(() => import('./pages/InstitutionalUnitPage').then((module) => ({ default: module.InstitutionalUnitPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

const AppContent = () => {
  const { currentUser, isAuthenticated, isAuthResolving, permissions } = useAuth();
  const userId = currentUser?.id || '';
  const prevUserIdRef = useRef('');

  // Start with defaults; preferences are loaded once currentUser is known.
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, setTheme, isDarkMode } = useTheme(userId);
  const [visitedTabs, setVisitedTabs] = useState(['dashboard']);

  // When the authenticated user changes, load theme, font preferences, and reset active tab to Overview.
  useLayoutEffect(() => {
    if (!userId) {
      prevUserIdRef.current = '';
      document.documentElement.classList.remove('font-montserrat', 'font-oswald', 'reduce-motion', 'no-hw-accel');
      return;
    }
    if (userId === prevUserIdRef.current) return;
    prevUserIdRef.current = userId;

    const savedFont = readPref(userId, 'font', 'system');

    
    document.documentElement.classList.remove('font-montserrat', 'font-oswald');
    if (savedFont === 'montserrat') document.documentElement.classList.add('font-montserrat');
    else if (savedFont === 'oswald') document.documentElement.classList.add('font-oswald');

    document.documentElement.classList.toggle('no-hw-accel', readPref(userId, 'hw_accel', 'true') === 'false');
    document.documentElement.classList.toggle('reduce-motion', readPref(userId, 'reduce_motion', 'false') === 'true');
    setVisitedTabs(['dashboard']);
    setActiveTab('dashboard');
  }, [userId]);

  useEffect(() => {
    if ((activeTab === 'admin' && !permissions.isVPAA)
      || (['students','retention'].includes(activeTab) && permissions.isPresident)) {
      setActiveTab('dashboard');
    }
    setIsMobileMenuOpen(false);
    window.scrollTo(0, 0);
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [currentUser?.id, activeTab, permissions.isVPAA, permissions.isPresident]);

  const [previousTab, setPreviousTab] = useState('dashboard');

  const changeTab = useCallback((nextTab) => {
    setVisitedTabs((tabs) => tabs.includes(nextTab) ? tabs : [...tabs, nextTab]);
    setActiveTab((currentTab) => {
      if (currentTab !== 'settings' && nextTab === 'settings') {
        setPreviousTab(currentTab);
      }
      return nextTab;
    });
  }, []);

  const handleReturnFromSettings = useCallback(() => {
    changeTab(previousTab || 'dashboard');
  }, [changeTab, previousTab]);

  const mountedPages = useMemo(() => ([
    {
      id: 'dashboard',
      visible: true,
      node: <DashboardPage setActiveTab={changeTab} isDarkMode={isDarkMode} />
    },
    {
      id: 'records',
      visible: true,
      node: <RecordsPage />
    },
    {
      id: 'reports',
      visible: true,
      node: <ReportsPage isDarkMode={isDarkMode} />
    },
    {
      id: 'admin', visible: permissions.isVPAA, node: <SystemAdminPage />
    },
    ...['annualReports','students','retention','faculty','achievements','topcit'].map((id) => ({ id,
      visible: !permissions.isPresident || !['students','retention'].includes(id), node: <AcademicWorkspacePage module={id} /> })),
    {
      id: 'institutional',
      visible: true,
      node: <InstitutionalUnitPage setActiveTab={changeTab} />
    },
    {
      id: 'settings',
      visible: true,
      node: <SettingsPage setActiveTab={handleReturnFromSettings} isDarkMode={isDarkMode} theme={theme} setTheme={setTheme} />
    }
  ]), [changeTab, handleReturnFromSettings, isDarkMode, theme, setTheme, permissions.isVPAA, permissions.isPresident]);

  if (isAuthResolving) {
    return (
      <div className="auth-loading grid min-h-screen min-h-[100dvh] place-items-center bg-slate-950 p-6 text-slate-100" role="status" aria-live="polite">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 text-sm font-bold shadow-2xl">
          <LoaderCircle className="h-5 w-5 animate-spin text-amber-500" aria-hidden="true" />
          Verifying CCT access…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage />;

  const isSettingsTab = activeTab === 'settings';

  return (
    <div className={`app-shell min-h-screen min-h-[100dvh] w-full overflow-x-clip font-sans transition-colors duration-300 ${
      isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      <Navbar
        setActiveTab={changeTab}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="workspace-layout mx-auto flex w-full max-w-[1920px] items-stretch gap-4 px-3 py-3 sm:gap-5 sm:px-5 sm:py-5 lg:px-7 xl:gap-8 xl:px-10">
        {!isSettingsTab && (
          <Sidebar
            activeTab={activeTab}
            setActiveTab={(tab) => {
              changeTab(tab);
              setIsMobileMenuOpen(false);
            }}
            isMobileMenuOpen={isMobileMenuOpen}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
          />
        )}
        <main className="min-w-0 flex-1 pb-8 outline-none" id="main-content" tabIndex={-1}>
          {mountedPages.filter((page) => page.visible && visitedTabs.includes(page.id)).map((page) => {
            const isActive = activeTab === page.id;
            return (
              <section
                key={`${page.id}-${currentUser?.id}-${currentUser?.role}-${currentUser?.department}`}
                className={isActive ? 'page-transition' : 'workspace-page-hidden'}
                aria-hidden={!isActive}
                hidden={!isActive}
              >
                <Suspense fallback={<div className="surface-panel flex min-h-48 items-center justify-center gap-3 p-6" role="status"><LoaderCircle className="h-5 w-5 animate-spin" />Opening workspace…</div>}>{page.node}</Suspense>
              </section>
            );
          })}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AcademicDataProvider><AppContent /></AcademicDataProvider>
    </AuthProvider>
  );
}
