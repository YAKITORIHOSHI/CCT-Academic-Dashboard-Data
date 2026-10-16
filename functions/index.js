import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onValueWritten } from 'firebase-functions/v2/database';
import { createHash } from 'node:crypto';
import { isSafeKey, validateAccount, validateSnapshot, validateAcademicReferences } from './validation.js';
import { MODULE_COLLECTIONS } from './academicValidation.js';
import { withCctErrorHandling } from './firebaseErrors.js';

initializeApp();
const db = getDatabase();
const options = { region: 'asia-southeast1', maxInstances: 10,
  enforceAppCheck: process.env.CCT_ENFORCE_APP_CHECK === 'true' };
const audit = async (uid, action, details, id = db.ref('auditLogs').push().key) => {
  await db.ref(`auditLogs/${id}`).set({ id, timestamp: new Date().toISOString(), user: uid, action, details });
};
async function requireAdmin(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to the CCT workspace.');
  const uid = request.auth.uid;
  const [access, user] = await Promise.all([db.ref(`access/${uid}`).get(), getAuth().getUser(uid)]);
  if (access.val()?.status !== 'Active' || access.val()?.role !== 'VPAA' || user.disabled
    || Number(request.auth.token.auth_time) < Math.floor(Date.parse(user.tokensValidAfterTime) / 1000)) {
    throw new HttpsError('permission-denied', 'An active CCT VPAA account is required.');
  }
  if (Date.now() / 1000 - Number(request.auth.token.auth_time || 0) > 15 * 60) {
    throw new HttpsError('failed-precondition', 'For this sensitive action, sign out and sign in again.');
  }
  const now = Date.now();
  const rate = await db.ref(`securityRateLimits/${uid}`).transaction((current) => {
    const window = Number.isFinite(current?.startedAt) && Number.isInteger(current?.count) && current.count >= 0
      && now - current.startedAt < 60 * 60 * 1000 ? current : { startedAt: now, count: 0 };
    if (window.count >= 30) return undefined;
    return { startedAt: window.startedAt, count: window.count + 1 };
  });
  if (!rate.committed) throw new HttpsError('resource-exhausted', 'CCT administrative action limit reached. Try again later.');
  return { uid, access: access.val() };
}
async function validateDepartment(profile) {
  if (profile.role === 'VPAA' && profile.department === 'Office of VPAA') return;
  if (profile.role === 'President' && profile.department === 'Office of the College President') return;
  const departments = (await db.ref('departments').get()).val() || {};
  if (!Object.values(departments).some((department) => department.name === profile.department)) {
    throw new HttpsError('invalid-argument', 'Select an existing CCT department.');
  }
}
export const manageCctAccount = onCall(options, withCctErrorHandling('account administration', async (request) => {
  const caller = await requireAdmin(request);
  const input = request.data || {};
  try {
    if (input.action === 'create') {
      const profile = validateAccount(input.profile, true);
      await validateDepartment(profile);
      const { password, ...directoryProfile } = profile;
      const user = await getAuth().createUser({ email: profile.email, password, displayName: profile.name });
      const account = { ...directoryProfile, id: user.uid, uid: user.uid, status: 'Active',
        createdAt: new Date().toISOString().split('T')[0], lastLogin: 'Never' };
      try {
        await db.ref().update({ [`accounts/${user.uid}`]: account,
          [`access/${user.uid}`]: { accountId: account.id, role: account.role, department: account.department, status: 'Active' } });
      } catch (error) {
        await getAuth().deleteUser(user.uid);
        throw error;
      }
      await audit(caller.uid, 'CCT Account Created', `${account.id}: ${account.role}`);
      return { success: true, account };
    }
    if (!['update', 'status'].includes(input.action) || !isSafeKey(input.id)) throw new Error('Select a valid CCT account action.');
    const existing = (await db.ref(`accounts/${input.id}`).get()).val();
    if (!existing || !isSafeKey(existing.uid)) throw new HttpsError('failed-precondition', 'Migrate this CCT account to a verified Firebase UID first.');
    try { await getAuth().getUser(existing.uid); }
    catch (error) {
      if (error?.code === 'auth/user-not-found') throw new HttpsError('failed-precondition', 'This CCT Authentication account no longer exists. Reprovision a verified account before changing its access.');
      throw error;
    }
    const profile = input.action === 'update' ? validateAccount(input.profile) : {};
    if (input.action === 'update') await validateDepartment(profile);
    if (input.action === 'status' && !['Active', 'Suspended'].includes(input.status)) throw new Error('Select a valid CCT account status.');
    const account = { ...existing, ...profile, ...(input.action === 'status' ? { status: input.status } : {}) };
    // The caller cannot remove their own administrative access and accidentally strand the school.
    if (existing.uid === caller.uid && (account.role !== 'VPAA' || account.status !== 'Active')) {
      throw new HttpsError('failed-precondition', 'A CCT VPAA cannot remove their own administrative access.');
    }
    const changedAccess = account.role !== existing.role || account.department !== existing.department || account.status !== existing.status;
    // Commit the authoritative access map and profile atomically. Suspension blocks RTDB immediately.
    await db.ref().update({ [`accounts/${input.id}`]: account,
      [`access/${existing.uid}`]: { accountId: input.id, role: account.role, department: account.department, status: account.status } });
    await getAuth().updateUser(existing.uid, { displayName: account.name, disabled: account.status === 'Suspended' });
    if (changedAccess) await getAuth().revokeRefreshTokens(existing.uid);
    await audit(caller.uid, 'CCT Account Updated', `${input.id}: ${account.role}, ${account.status}`);
    return { success: true, account };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'This CCT email already has an account.');
    if (!error.code) throw new HttpsError('invalid-argument', error.message);
    console.error('CCT account operation failed', { code: error.code });
    throw new HttpsError('internal', 'The CCT account action could not be completed.');
  }
}));

export const restoreCctSnapshot = onCall({ ...options, timeoutSeconds: 120, memory: '512MiB' }, withCctErrorHandling('snapshot restore', async (request) => {
  const caller = await requireAdmin(request);
  let collections;
  try { collections = validateSnapshot(request.data?.rawJson); }
  catch (error) { throw new HttpsError('invalid-argument', error.message); }
  // A root transaction serializes this rare maintenance action with other writers. It never touches access, accounts, or audit history.
  const rootRef = db.ref();
  // Keep a live snapshot attached until the transaction settles; get() alone does not populate transaction state.
  let resolveSnapshot;
  let rejectSnapshot;
  const loaded = new Promise((resolve, reject) => { resolveSnapshot = resolve; rejectSnapshot = reject; });
  const keepSnapshot = () => resolveSnapshot();
  let result;
  try { rootRef.on('value', keepSnapshot, rejectSnapshot); await loaded; result = await rootRef.transaction((current) => {
    if (!current || current.access?.[caller.uid]?.status !== 'Active' || current.access?.[caller.uid]?.role !== 'VPAA') return undefined;
    const next = { ...current, ...collections };
    try { validateAcademicReferences(next); }
    catch (error) { throw new HttpsError('invalid-argument', error.message || 'The CCT snapshot has invalid academic references.'); }
    for (const collection of MODULE_COLLECTIONS) {
      if (!collections[collection]) continue;
      next[collection] = Object.fromEntries(Object.entries(collections[collection]).map(([id, row]) => [id, {
        ...row, revision: (Number(current[collection]?.[id]?.revision) || 0) + 1,
        modifiedByUid: caller.uid, updatedAt: new Date().toISOString()
      }]));
    }
    if (collections.requests) next.requests = Object.fromEntries(Object.entries(collections.requests).map(([id, record]) => [id, {
      ...record, revision: (Number(current.requests?.[id]?.revision) || 0) + 1,
      modifiedByUid: caller.uid, updatedAt: new Date().toISOString(),
      passingRate: Number((record.passedCount / record.enrolledCount * 100).toFixed(2))
    }]));
    return next;
  }); } finally { rootRef.off('value', keepSnapshot); }
  if (!result.committed) throw new HttpsError('permission-denied', 'CCT administrative access changed during the restore.');
  await audit(caller.uid, 'CCT Snapshot Restored', Object.keys(collections).join(', '));
  return { success: true, message: `CCT restore completed (${Object.keys(collections).join(', ')}). Accounts and audit history were preserved.` };
}));

// Write an immutable, idempotent server audit entry for every actual record commit, including deletes.
export const auditCctRecord = onValueWritten({ ref: '/requests/{recordId}', region: 'asia-southeast1', maxInstances: 10 }, async (event) => {
  const row = event.data.after.val() || event.data.before.val();
  if (!row) return;
  const id = createHash('sha256').update(event.id).digest('hex');
  const actor = event.data.after.exists() ? row.modifiedByUid || 'CCT Server' : 'CCT Server';
  await audit(actor, event.data.after.exists() ? 'CCT Record Saved' : 'CCT Record Deleted',
    `${event.params.recordId}: ${String(row.subjectCode || '').slice(0, 40)} (${String(row.status || '').slice(0, 40)})`, id);
});
