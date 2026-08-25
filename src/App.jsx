import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RecordsPage } from './pages/RecordsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AccountsPage } from './pages/AccountsPage';
import { BackupPage } from './pages/BackupPage';
import { InstitutionalUnitPage } from './pages/InstitutionalUnitPage';
import { SettingsPage } from './pages/SettingsPage';

/**
 * Build a per-user localStorage key so that preferences are isolated
 * between different accounts sharing the same browser.
 * Falls back to a global key when userId is unavailable.
 */
const userPrefKey = (userId, key) => userId ? `cct_u_${userId}_${key}` : `cct_${key}`;

const readPref = (userId, key, fallback) => {
  try {
    const value = localStorage.getItem(userPrefKey(userId, key));
    return value !== null ? value : fallback;
  } catch {
    return fallback;
  }
};

const writePref = (userId, key, value) => {
  try {
    localStorage.setItem(userPrefKey(userId, key), value);
  } catch {
    // Non-critical preference persistence.
  }
};

const AppContent = () => {
  const { currentUser, isAuthenticated, isAuthResolving, permissions } = useAuth();
  const userId = currentUser?.id || '';
  const prevUserIdRef = useRef('');

  // Start with defaults; preferences are loaded once currentUser is known.
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // When the authenticated user changes, load theme, font preferences, and reset active tab to Overview.
  useEffect(() => {
    if (!userId || userId === prevUserIdRef.current) return;
    prevUserIdRef.current = userId;

    const savedTheme = readPref(userId, 'theme', null);
    const savedFont = readPref(userId, 'font', 'system');

    setIsDarkMode(savedTheme ? savedTheme === 'dark' : true);
    
    document.documentElement.classList.remove('font-montserrat', 'font-oswald');
    if (savedFont === 'montserrat') document.documentElement.classList.add('font-montserrat');
    else if (savedFont === 'oswald') document.documentElement.classList.add('font-oswald');

    setActiveTab('dashboard');
  }, [userId]);

  // Persist theme preference per user.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    if (userId) writePref(userId, 'theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode, userId]);

  useEffect(() => {
    if ((activeTab === 'accounts' && !permissions.canManageAccounts)
      || (activeTab === 'backup' && !permissions.canManageBackups)) {
      setActiveTab('dashboard');
    }
    setIsMobileMenuOpen(false);
  }, [currentUser?.id, activeTab, permissions.canManageAccounts, permissions.canManageBackups]);

  const [previousTab, setPreviousTab] = useState('dashboard');

  const changeTab = useCallback((nextTab) => {
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
      id: 'accounts',
      visible: permissions.canManageAccounts,
      node: <AccountsPage />
    },
    {
      id: 'backup',
      visible: permissions.canManageBackups,
      node: <BackupPage />
    },
    {
      id: 'institutional',
      visible: true,
      node: <InstitutionalUnitPage setActiveTab={changeTab} />
    },
    {
      id: 'settings',
      visible: true,
      node: <SettingsPage setActiveTab={handleReturnFromSettings} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
    }
  ]), [changeTab, handleReturnFromSettings, isDarkMode, permissions.canManageAccounts, permissions.canManageBackups]);

  if (isAuthResolving) {
    return (
      <div className="grid min-h-screen min-h-[100dvh] place-items-center bg-slate-950 p-6 text-slate-100" role="status" aria-live="polite">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 text-sm font-bold shadow-2xl">
          <LoaderCircle className="h-5 w-5 animate-spin text-amber-500" aria-hidden="true" />
          Verifying institutional access…
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

      <div className="mx-auto flex w-full max-w-[1920px] items-start gap-4 px-3 py-3 sm:gap-5 sm:px-5 sm:py-5 lg:px-7 xl:gap-6 xl:px-10">
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
        <main className="min-w-0 flex-1 pb-8" id="main-content">
          {mountedPages.filter((page) => page.visible).map((page) => {
            const isActive = activeTab === page.id;
            return (
              <section
                key={`${page.id}-${currentUser?.id}`}
                className={isActive ? 'page-transition' : 'workspace-page-hidden'}
                aria-hidden={!isActive}
                hidden={!isActive}
              >
                {page.node}
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
      <AppContent />
    </AuthProvider>
  );
}
