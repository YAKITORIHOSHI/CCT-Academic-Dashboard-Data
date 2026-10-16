import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/auth';
import { CustomSelect } from '../components/common/CustomSelect';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog, Toast } from '../components/common/Feedback';
import {
  Building,
  CheckCircle2,
  Edit3,
  History,
  Lock,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
  XCircle
} from 'lucide-react';

const ROLE_STYLES = {
  VPAA: 'border-crimson-200 bg-crimson-50 text-crimson-700 dark:border-crimson-800 dark:bg-crimson-950 dark:text-crimson-300',
  President: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  Deans: 'border-crimson-200 bg-crimson-50 text-crimson-700 dark:border-crimson-800 dark:bg-crimson-950 dark:text-crimson-300',
  Heads: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
};

const roleDescription = {
  VPAA: 'Full administrative authority',
  President: 'Executive read-only oversight',
  Deans: 'Department review and approval',
  Heads: 'Department encoding and submission'
};

export const AccountsPage = () => {
  const {
    currentUser,
    accounts,
    addAccount,
    updateAccount,
    toggleAccountStatus,
    auditLogs,
    departments,
    permissions,
    adminServiceReady
  } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingStatusUser, setPendingStatusUser] = useState(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [notice, setNotice] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Heads',
    department: departments[0]
  });

  const departmentOptions = useMemo(() => [
    ...departments,
    'Office of VPAA',
    'Office of the College President'
  ], [departments]);

  const filteredAccounts = accounts.filter((account) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || [account.name, account.email, account.department]
      .some((value) => String(value || '').toLowerCase().includes(query));
    return matchesSearch
      && (roleFilter === 'ALL' || account.role === roleFilter)
      && (deptFilter === 'ALL' || account.department === deptFilter);
  });

  const openAddModal = () => {
    setEditingUser(null);
    setFormError('');
    setFormData({ name: '', email: '', password: '', role: 'Heads', department: departments[0] });
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormError('');
    setFormData({ name: user.name, email: user.email, password: '', role: user.role, department: user.department });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSaving) return;
    setFormError('');

    const normalizedEmail = formData.email.trim().toLowerCase();
    if (!editingUser && !/^[^\s@]+@college\.cct\.edu$/i.test(normalizedEmail)) {
      setFormError('Use a valid @college.cct.edu CCT email address.');
      return;
    }

    const duplicate = accounts.find((account) => account.email?.toLowerCase() === normalizedEmail && account.id !== editingUser?.id);
    if (duplicate) {
      setFormError('An account with this email address already exists.');
      return;
    }

    setIsSaving(true);
    const result = editingUser
      ? await updateAccount(editingUser.id, {
          name: formData.name,
          role: formData.role,
          department: formData.department
        })
      : await addAccount({ ...formData, email: normalizedEmail });
    setIsSaving(false);

    if (!result?.success) {
      setFormError(result?.message || 'The account could not be saved.');
      return;
    }

    setIsModalOpen(false);
    setNotice({
      type: 'success',
      message: editingUser
        ? `${result.account.name}'s access profile was updated.`
        : `${result.account.name} was provisioned in Firebase Authentication and the CCT directory.`
    });
  };

  const handleToggleStatus = (user) => {
    setPendingStatusUser(user);
  };

  const confirmToggleStatus = async () => {
    if (!pendingStatusUser || isChangingStatus) return;
    setIsChangingStatus(true);
    const result = await toggleAccountStatus(pendingStatusUser.id);
    setIsChangingStatus(false);
    if (!result?.success) {
      setNotice({ type: 'error', message: result?.message || 'Unable to change account status.' });
      setPendingStatusUser(null);
      return;
    }
    setNotice({
      type: 'success',
      message: `${result.account.name} is now ${result.account.status.toLowerCase()}.`
    });
    setPendingStatusUser(null);
  };

  if (!permissions.canManageAccounts) return null;

  return (
    <div className="page-stack space-y-4 sm:space-y-5">
      <section className="hero-panel hero-motion relative overflow-hidden rounded-2xl border border-gold-500/30 bg-gradient-to-br from-slate-950 via-crimson-950 to-gold-950 p-5 text-white sm:p-6 lg:p-7 shadow-xl shadow-gold-950/40">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gold-500/25 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-crimson-600/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-normal text-gold-400">
              <ShieldCheck className="h-4 w-4" />
              VPAA Administration & Access Control
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">CCT Accounts & Access</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gold-100/90 sm:text-sm">
              The VPAA is the sole authority for creating accounts, assigning roles, changing department scope, and suspending access.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-crimson-900/40 px-3 py-1.5 text-xs font-bold text-gold-200">
                <ShieldCheck className="h-3.5 w-3.5 text-gold-400" /> {currentUser?.role}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-crimson-900/40 px-3 py-1.5 text-xs font-bold text-gold-200">
                <Users className="h-3.5 w-3.5 text-emerald-400" /> Total Accounts: {accounts.length}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            disabled={!adminServiceReady}
            className="hero-action button-shine inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-300 to-gold-500 hover:from-gold-200 hover:to-gold-400 px-4 text-sm font-semibold text-slate-950 transition shadow-lg shadow-gold-500/25 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" /> Create Account
          </button>
        </div>
      </section>

      {!adminServiceReady && <p className="notice-card p-4 text-sm text-slate-600 dark:text-slate-300" role="status">CCT account creation and access changes are managed by the project administrator while the secure administration service is inactive. You can review the directory here.</p>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="metric-tile rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="text-xs font-semibold tracking-normal text-slate-500 dark:text-slate-400">Total Accounts</div><div className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white">{accounts.length}</div></div>
        <div className="metric-tile rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="text-xs font-semibold tracking-normal text-slate-500 dark:text-slate-400">Active</div><div className="mt-1 font-mono text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{accounts.filter((account) => account.status === 'Active' && account.uid).length}</div></div>
        <div className="metric-tile rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="text-xs font-semibold tracking-normal text-slate-500 dark:text-slate-400">Deans</div><div className="mt-1 font-mono text-2xl font-semibold text-crimson-600 dark:text-crimson-400">{accounts.filter((account) => account.role === 'Deans').length}</div></div>
        <div className="metric-tile rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="text-xs font-semibold tracking-normal text-slate-500 dark:text-slate-400">Heads</div><div className="mt-1 font-mono text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{accounts.filter((account) => account.role === 'Heads').length}</div></div>
      </section>

      <section className="surface-panel surface-panel-hover relative z-30 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1.5fr)_minmax(10rem,1fr)_minmax(12rem,1fr)]">
          <label className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input type="search" placeholder="Search name, email, or department" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="form-control pl-9" />
          </label>
          <CustomSelect
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: 'ALL', label: 'All roles' },
              ...Object.keys(ROLE_STYLES).map((role) => ({ value: role, label: role }))
            ]}
          />
          <CustomSelect
            value={deptFilter}
            onChange={setDeptFilter}
            options={[
              { value: 'ALL', label: 'All departments' },
              ...departmentOptions.map((dept) => ({ value: dept, label: dept }))
            ]}
          />
        </div>
        <div className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">Showing {filteredAccounts.length} of {accounts.length} accounts</div>
      </section>

      <section className="surface-panel hidden overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-normal text-slate-500 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400">
              <tr><th className="px-4 py-3.5">User</th><th className="px-4 py-3.5">Role</th><th className="px-4 py-3.5">Department Scope</th><th className="px-4 py-3.5">Status</th><th className="px-4 py-3.5">Created</th><th className="px-4 py-3.5 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAccounts.map((user) => (
                <tr key={user.id} className="table-row-lift transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {(user.name || 'Incomplete CCT Profile').charAt(0)}
                      </div>
                      <div className="min-w-0"><div className="font-bold text-slate-900 dark:text-white">{user.name || 'Incomplete CCT Profile'}</div><div className="mt-0.5 font-mono text-xs text-crimson-600 dark:text-crimson-400">{user.email}</div></div>
                    </div>
                  </td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${ROLE_STYLES[user.role] || 'border-slate-300 text-slate-600 dark:text-slate-300'}`}>{user.role || 'Unassigned'}</span><div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{roleDescription[user.role]}</div></td>
                  <td className="max-w-[17rem] px-4 py-4"><div className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300"><Building className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />{user.department}</div></td>
                  <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${user.status === 'Active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'}`}>{user.status === 'Active' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}{!user.name || !user.role || !user.status ? 'Incomplete Profile' : !user.uid ? 'Not Provisioned' : user.status}</span></td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{user.createdAt}</td>
                  <td className="px-4 py-4"><div className="flex justify-end gap-1.5"><button type="button" onClick={() => openEditModal(user)} disabled={!adminServiceReady} className="control-lift icon-control grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:border-crimson-200 hover:text-crimson-700 dark:border-slate-700 dark:text-slate-300" title="Edit account"><Edit3 className="h-4 w-4" /></button><button type="button" onClick={() => handleToggleStatus(user)} disabled={!adminServiceReady || user.id === currentUser?.id} className="control-lift icon-control grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:text-slate-400" title="Change account status"><Lock className="h-4 w-4" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {filteredAccounts.map((user) => (
          <article key={user.id} className="surface-panel surface-panel-hover interactive-surface rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {(user.name || 'Incomplete CCT Profile').charAt(0)}
              </div><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-slate-950 dark:text-white">{user.name || 'Incomplete CCT Profile'}</h2><p className="mt-0.5 truncate font-mono text-xs text-crimson-600 dark:text-crimson-400">{user.email}</p></div><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${user.status === 'Active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'}`}>{!user.name || !user.role || !user.status ? 'Incomplete Profile' : !user.uid ? 'Not Provisioned' : user.status}</span></div>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${ROLE_STYLES[user.role] || 'border-slate-300 text-slate-600 dark:text-slate-300'}`}>{user.role || 'Unassigned'}</span><p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{roleDescription[user.role]}</p><p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"><Building className="mt-0.5 h-3.5 w-3.5 shrink-0" />{user.department}</p></div>
            <div className="mt-3 flex gap-2"><button type="button" onClick={() => openEditModal(user)} disabled={!adminServiceReady} className="control-lift inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"><Edit3 className="h-4 w-4" />Edit</button><button type="button" onClick={() => handleToggleStatus(user)} disabled={!adminServiceReady || user.id === currentUser?.id} className="control-lift inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-35 dark:border-slate-700 dark:text-slate-300"><Lock className="h-4 w-4" />{user.status === 'Active' ? 'Suspend' : 'Activate'}</button></div>
          </article>
        ))}
      </section>

      <section className="surface-panel rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><History className="h-4 w-4 text-crimson-500" />Audit trail</div><span className="text-xs text-slate-500 dark:text-slate-400">{auditLogs.length} events</span></div>
        <div className="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {auditLogs.slice(0, 10).map((log) => <div key={log.id} className="py-3 text-xs"><div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"><div><span className="font-bold text-slate-800 dark:text-slate-200">{log.action}</span><span className="text-slate-500 dark:text-slate-400"> — {log.details}</span><div className="mt-1 text-crimson-600 dark:text-crimson-400">{log.user}</div></div><span className="shrink-0 font-mono text-slate-500 dark:text-slate-400">{log.timestamp}</span></div></div>)}
        </div>
      </section>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        align="bottom"
        ariaLabel={editingUser ? 'Edit account' : 'Create account'}
        className="w-full max-w-lg overscroll-contain rounded-t-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 sm:rounded-2xl"
      >
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-semibold tracking-normal text-crimson-600 dark:text-crimson-400">VPAA Access Control</div><h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{editingUser ? 'Edit Account' : 'Create Account'}</h2></div><button type="button" onClick={() => setIsModalOpen(false)} aria-label="Close Account Form" className="control-lift icon-control grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><X className="h-4 w-4" /></button></div>
            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              {formError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">{formError}</div>}
              <label><span className="form-label">Full Name / Office Name</span><input type="text" required placeholder="Enter a full name or office name" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className="form-control" /></label>
              <label>
                <span className="form-label">CCT Email</span>
                <input
                  type="email"
                  required
                  disabled={Boolean(editingUser)}
                  placeholder="name@college.cct.edu"
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                  className="form-control disabled:cursor-not-allowed disabled:opacity-60"
                />
                {editingUser && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Email identity is managed in Firebase Authentication and cannot be changed from this form.</span>}
              </label>
              {!editingUser && (
                <label><span className="form-label">Initial Password</span><input type="password" required minLength={12} maxLength={128} placeholder="12+ characters: Aa, number, and symbol" value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} className="form-control" /></label>
              )}
              <div>
                <span className="form-label">Role Assignment</span>
                <CustomSelect
                  value={formData.role}
                  onChange={(val) => setFormData({ ...formData, role: val })}
                  options={Object.keys(ROLE_STYLES).map((role) => ({
                    value: role,
                    label: `${role} — ${roleDescription[role]}`
                  }))}
                  ariaLabel="Role Assignment"
                />
              </div>
              <div>
                <span className="form-label">Department Scope</span>
                <CustomSelect
                  value={formData.department}
                  onChange={(val) => setFormData({ ...formData, department: val })}
                  options={departmentOptions.map((dept) => ({ value: dept, label: dept }))}
                  ariaLabel="Department Scope"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setIsModalOpen(false)} className="control-lift min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">Cancel</button><button type="submit" disabled={isSaving} className="primary-action button-shine min-h-11 rounded-xl bg-crimson-600 px-5 text-sm font-bold text-white hover:bg-crimson-700 disabled:cursor-wait disabled:opacity-60">{isSaving ? 'Saving…' : editingUser ? 'Save Changes' : 'Create Account'}</button></div>
            </form>
          </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingStatusUser)}
        title={pendingStatusUser?.status === 'Active' ? 'Suspend account access?' : 'Reactivate account access?'}
        message={pendingStatusUser
          ? `${pendingStatusUser.name} (${pendingStatusUser.email}) will ${pendingStatusUser.status === 'Active' ? 'lose access after their current authenticated session is revalidated' : 'be allowed to sign in again'}.`
          : ''}
        confirmLabel={pendingStatusUser?.status === 'Active' ? 'Suspend Account' : 'Reactivate Account'}
        tone={pendingStatusUser?.status === 'Active' ? 'danger' : 'warning'}
        busy={isChangingStatus}
        onCancel={() => setPendingStatusUser(null)}
        onConfirm={confirmToggleStatus}
      />

      <Toast
        message={notice?.message}
        type={notice?.type}
        onClose={() => setNotice(null)}
      />
    </div>
  );
};
