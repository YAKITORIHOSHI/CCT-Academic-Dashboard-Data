import React, { useEffect, useMemo, useState } from 'react';
// Institutional Sidebar & Profile Account Management Panel
import { useAuth } from '../../context/auth';
import { CustomSelect } from '../common/CustomSelect';
import { Toast } from '../common/Feedback';
import { Modal } from '../common/Modal';
import {
  LayoutDashboard,
  FileSpreadsheet,
  BarChart3,
  Users,
  HardDriveDownload,
  Building,
  ShieldCheck,
  X,
  ClipboardCheck,
  ChevronDown,
  User,
  Mail,
  Save,
  Server,
  Key,
  Check,
  Landmark
} from 'lucide-react';

const AccountPanel = ({ onClose }) => {
  const {
    currentUser,
    updateAccount,
    isFirebaseConnected,
    dataSync,
    permissions,
    departments,
    adminServiceReady
  } = useAuth();

  const [name, setName] = useState(currentUser?.name || '');
  const [department, setDepartment] = useState(currentUser?.department || '');
  const [notice, setNotice] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentUser?.name) setName(currentUser.name);
    if (currentUser?.department) setDepartment(currentUser.department);
  }, [currentUser?.name, currentUser?.department]);

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    if (!currentUser?.id) return;
    setIsSaving(true);
    const result = await updateAccount(currentUser.id, permissions.canManageAccounts && adminServiceReady && department !== currentUser.department ? { name, department } : { name });
    setIsSaving(false);
    setNotice(result?.success
      ? { type: 'success', message: 'Account preferences were updated and synchronized.' }
      : { type: 'error', message: result?.message || 'The account preferences could not be updated.' });
  };

  const permissionList = [
    { label: 'Create and encode academic records', granted: permissions.canCreateRecords },
    { label: 'View all academic units', granted: permissions.canViewAllDepartments },
    { label: 'Manage accounts and roles', granted: permissions.canManageAccounts },
    { label: 'Manage backup and recovery', granted: permissions.canManageBackups },
    { label: 'Manage departments, programs, and subjects', granted: permissions.canManageInstitutionalData },
    { label: 'Academic approval authority', granted: permissions.isVPAA || permissions.isDean }
  ];

  const selectOptions = useMemo(() => {
    const list = (departments || []).map((unit) => ({ value: unit, label: unit }));
    if (department && !departments.includes(department)) {
      list.unshift({ value: department, label: department });
    }
    return list;
  }, [departments, department]);

  return (
    <div className="flex max-h-[85vh] max-h-[85dvh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:w-[27rem]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-br from-crimson-950/20 to-transparent px-5 py-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gold-400/40 bg-crimson-800 text-base font-semibold text-gold-100 shadow-md" aria-hidden="true">
            {currentUser?.name?.charAt(0) || 'U'}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">My Account</h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Manage your account details and access</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          aria-label="Close account panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-5">
        {/* Profile form */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold-500/10 text-gold-500 dark:bg-gold-950 dark:text-gold-300">
              <User className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold tracking-normal text-slate-900 dark:text-white">Profile Details</h3>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-3 text-sm">
            <div>
              <span className="form-label mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Display Name</span>
              <input
                aria-label="Display Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-control w-full"
              />
            </div>
            <div>
              <span className="form-label mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">CCT Email</span>
              <div className="relative flex items-center">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
                <input
                  aria-label="CCT Email"
                  disabled
                  value={currentUser?.email || ''}
                  className="form-control w-full cursor-not-allowed pl-9 font-mono opacity-70"
                />
              </div>
            </div>
            <div>
              <span className="form-label mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Department / Academic School</span>
              <CustomSelect
                value={department}
                onChange={setDepartment}
                options={selectOptions}
                ariaLabel="Profile academic unit"
                placeholder="Select department"
              />
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="primary-action inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-crimson-900 via-crimson-800 to-crimson-700 hover:from-crimson-800 hover:to-crimson-600 px-5 text-sm font-bold text-gold-100 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60 cursor-pointer shadow-md"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving…' : 'Save Profile Changes'}
            </button>
          </form>
        </section>

        {/* Divider */}
        <hr className="border-slate-100 dark:border-slate-800/80" />

        {/* Synchronization */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold-500/10 text-gold-500">
              <Server className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold tracking-normal text-slate-900 dark:text-white">Synchronization</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-950/60">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Realtime Database</span>
              <span className={`font-bold ${isFirebaseConnected ? 'text-emerald-500' : 'text-amber-500'}`}>
                {isFirebaseConnected ? 'Connected' : 'Cached / offline'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-950/60">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Background status</span>
              <span className="font-bold capitalize text-gold-500">{dataSync?.status || 'idle'}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-950/60">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Pending writes</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">{dataSync?.pendingWrites || 0}</span>
            </div>
          </div>
        </section>

        {/* Divider */}
        <hr className="border-slate-100 dark:border-slate-800/80" />

        {/* Role authority */}
        <section className="space-y-3 pb-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold-500/10 text-gold-500 dark:bg-gold-950 dark:text-gold-300">
                <Key className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-semibold tracking-normal text-slate-900 dark:text-white">Role Authority</h3>
            </div>
            <span className="rounded-full border border-gold-400/30 bg-gold-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-gold-700 dark:text-gold-300">{currentUser?.role}</span>
          </div>
          <div className="space-y-2 text-xs">
            {permissionList.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/40">
                <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
                {item.granted
                  ? <span className="flex shrink-0 items-center gap-1 font-bold text-emerald-500"><Check className="h-3.5 w-3.5" /> Granted</span>
                  : <span className="shrink-0 text-slate-500 dark:text-slate-400 font-medium">Restricted</span>}
              </div>
            ))}
          </div>
        </section>
      </div>

      <Toast message={notice?.message} type={notice?.type} onClose={() => setNotice(null)} />
    </div>
  );
};

export const Sidebar = ({ activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const { currentUser, permissions, records, dataSync } = useAuth();
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeDesktopDrawer = () => { if (desktop.matches) setIsMobileMenuOpen?.(false); };
    closeDesktopDrawer();
    desktop.addEventListener('change', closeDesktopDrawer);
    return () => desktop.removeEventListener('change', closeDesktopDrawer);
  }, [setIsMobileMenuOpen]);

  const pendingForUser = records.filter((record) => {
    if (record.status !== 'Pending Dean Approval') return false;
    if (permissions.isVPAA) return true;
    return permissions.isDean && record.department === currentUser?.department;
  }).length;

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, visible: true },
    { id: 'records', label: 'Academic Records', icon: FileSpreadsheet, visible: true, badge: pendingForUser || null },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, visible: true },
    { id: 'annualReports', label: 'Annual Reports', icon: BarChart3, visible: true },
    { id: 'students', label: 'Student Records', icon: Users, visible: !permissions.isPresident },
    { id: 'retention', label: 'Retention & Movement', icon: Users, visible: !permissions.isPresident },
    { id: 'faculty', label: 'Faculty Performance', icon: Users, visible: true },
    { id: 'achievements', label: 'School Achievements', icon: Landmark, visible: true },
    { id: 'topcit', label: 'TOPCIT Results', icon: BarChart3, visible: true },
    { id: 'admin', label: 'System Administration', icon: HardDriveDownload, visible: permissions.isVPAA },
    { id: 'institutional', label: 'CCT Directory', icon: Landmark, visible: true }
  ];

  const selectTab = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen?.(false);
  };

  const syncLabel = dataSync?.status === 'syncing'
    ? 'Synchronizing data'
    : dataSync?.status === 'error'
      ? 'Sync needs attention'
      : dataSync?.status === 'offline'
        ? 'Using cached data'
        : 'Database synchronized';

  const sidebarContent = (
    <div className="sidebar-content flex h-full min-h-0 flex-col p-3">
      <div className="mb-3 flex shrink-0 items-center justify-between lg:hidden">
        <div className="text-xs font-semibold tracking-normal text-slate-500 dark:text-slate-400">Navigation</div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(false)}
          className="control-lift icon-control grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Profile card — clickable to open account management */}
      <button
        type="button"
        onClick={() => setIsAccountOpen(true)}
        className="sidebar-profile group w-full shrink-0 rounded-2xl border border-gold-900/30 bg-gradient-to-br from-crimson-50 via-gold-50 to-white p-3 text-left transition hover:border-gold-400/40 hover:shadow-md dark:border-gold-900/60 dark:from-crimson-950/70 dark:via-gold-950/10 dark:to-slate-900 dark:hover:border-gold-400/50"
        aria-label="Open account management"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 aspect-square items-center justify-center overflow-hidden rounded-xl border border-gold-400/40 bg-gradient-to-br from-crimson-900 to-gold-700 text-sm font-semibold text-gold-100 shadow-md">
            {currentUser?.name?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">{currentUser?.name}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-gold-700 dark:text-gold-300">
              <ShieldCheck className="h-3 w-3 shrink-0" />
              <span className="truncate">{currentUser?.role}</span>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400 transition group-hover:text-gold-400" />
        </div>
        <div className="sidebar-profile-detail mt-2 flex min-w-0 items-center gap-1.5 border-t border-gold-900/10 pt-2 text-xs text-slate-500 dark:border-gold-900/40 dark:text-slate-400">
          <Building className="h-3 w-3 shrink-0 text-gold-700 dark:text-gold-400" />
          <span className="truncate">{currentUser?.department}</span>
        </div>
      </button>

      <div className="sidebar-scroll" tabIndex={0} role="region" aria-label="Scrollable navigation">
      <p className="nav-group-label">Academic Workspace</p>
      <nav className="sidebar-nav" aria-label="System modules">
        {navItems.filter((item) => item.visible).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectTab(item.id)}
              className={`nav-item group flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                active
                  ? 'nav-item-active border border-gold-400/40 bg-gradient-to-r from-crimson-950 via-crimson-900 to-gold-700 text-gold-100 shadow-lg shadow-gold-950/40'
                  : 'border border-transparent text-slate-600 hover:bg-gold-950/10 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-gold-950/30 dark:hover:text-white'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? 'border border-gold-400/30 bg-gold-500/20 text-gold-200' : 'bg-slate-100 dark:bg-slate-800'}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 whitespace-normal text-sm font-semibold">{item.label}</span>
              {item.badge ? (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? 'bg-gold-400 text-slate-950' : 'bg-gold-100 text-gold-800 dark:bg-gold-950 dark:text-gold-300'}`}>
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {(permissions.isVPAA || permissions.isDean) && (
        <button
          type="button"
          onClick={() => selectTab('records')}
          className="sidebar-queue mt-3 flex items-center gap-2 rounded-xl border border-gold-200 bg-gold-50 px-3 py-2 text-left text-gold-800 transition hover:bg-gold-100 dark:border-gold-900/70 dark:bg-gold-950/40 dark:text-gold-300"
        >
          <ClipboardCheck className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-xs font-bold">
            {pendingForUser > 0 ? `${pendingForUser} record${pendingForUser === 1 ? '' : 's'} awaiting review` : 'Approval queue is clear'}
          </span>
        </button>
      )}

      <div className="sidebar-footer border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-500">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">CCT Academic System</span>
          <span className={`h-2 w-2 shrink-0 rounded-full ${dataSync?.status === 'error' ? 'bg-rose-500' : dataSync?.status === 'offline' ? 'bg-amber-500' : dataSync?.status === 'syncing' ? 'bg-gold-500 animate-pulse' : 'bg-emerald-500'}`} aria-hidden="true" />
        </div>
        <div className="mt-1 truncate">{syncLabel}</div>
      </div>

      </div>
    </div>
  );

  return (
    <>
      <aside className="sidebar-shell hidden w-64 shrink-0 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block xl:w-72">
        {sidebarContent}
      </aside>

      <Modal
        open={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        ariaLabel="Primary navigation"
        backdropClassName="mobile-drawer-backdrop lg:hidden"
        className="mobile-drawer h-full w-[min(88vw,22rem)] bg-white dark:bg-slate-900"
        scrollable={false}
        zIndex={90}
      >
        {sidebarContent}
      </Modal>

      <Modal
        open={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        ariaLabel="Account management"
        className="w-full sm:w-auto"
        scrollable={false}
      >
        <AccountPanel onClose={() => setIsAccountOpen(false)} />
      </Modal>
    </>
  );
};
