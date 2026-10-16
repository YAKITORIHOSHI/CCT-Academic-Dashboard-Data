import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from './auth';
import { httpsCallable } from 'firebase/functions';
import { RECORD_STATUS, normalizeAcademicYear } from '../utils/academic';
import { MODULE_COLLECTIONS } from '../utils/academicModules';
import { createCacheScope, createCollectionCache, pruneCollectionCache, removeLegacyCollectionCache } from '../services/collectionCache';
import { runRecordTransaction } from '../services/recordTransactions';
import { firebaseCollectionRows, firebaseErrorMessage, firebaseOperationResult, subscribeSafely, withFirebaseReadDeadline } from '../services/firebaseSafety';
import { scheduleBackgroundTask } from '../services/backgroundTask';
import { normalizeSnapshotInBackground } from '../services/backgroundDataWorker';
import { auth, rtdb, functions, firebaseConfig, isFirebaseInitialized, isCctAdminServiceEnabled, KEEP_SIGNED_IN_KEY } from '../firebase/config';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import {
  ref as rtdbRef,
  onValue,
  set as rtdbSet,
  push as rtdbPush,
  remove as rtdbRemove,
  query as rtdbQuery,
  limitToLast,
  orderByChild,
  equalTo,
  get as rtdbGet
} from 'firebase/database';

const DATA_VERSION = '8.0-city-college-of-tagaytay';
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const ACCOUNT_ACCESS_ERROR = 'Your sign-in was accepted, but this account has no active CCT access profile. Contact the CCT administrator to restore your account access.';
const timestamp = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

const updateKeepSignedInPreference = (keepSignedIn) => {
  try {
    if (keepSignedIn) localStorage.setItem(KEEP_SIGNED_IN_KEY, 'true');
    else localStorage.removeItem(KEEP_SIGNED_IN_KEY);
  } catch (error) {
    console.warn('Sign-in preference could not be stored:', error);
  }
};


const collectionToArray = (value) => firebaseCollectionRows(value);
const firebaseServiceError = isFirebaseInitialized ? '' : 'CCT Firebase services could not be initialized. Reload or contact the CCT administrator to check the configuration.';

const normalizeDepartmentCollection = (items) => items
  .map((item) => (typeof item === 'string' ? item : item?.name || item?.value || item?.id))
  .filter(Boolean);

const normalizeRecordCollection = (items) => items.map((record) => {
  const enrolledCount = Math.max(0, Number.parseInt(record.enrolledCount, 10) || 0);
  const passedCount = Math.max(0, Number.parseInt(record.passedCount, 10) || 0);
  const failedCount = Math.max(0, Number.parseInt(record.failedCount, 10) || 0);
  const droppedCount = Math.max(0, Number.parseInt(record.droppedCount, 10) || 0);
  const incCount = Math.max(0, Number.parseInt(record.incCount, 10) || 0);
  return {
    ...record,
    academicYear: normalizeAcademicYear(record.academicYear),
    status: record.status || RECORD_STATUS.DRAFT,
    enrolledCount,
    passedCount,
    failedCount,
    droppedCount,
    incCount,
    passingRate: enrolledCount > 0 ? Number(((passedCount / enrolledCount) * 100).toFixed(2)) : 0,
    averageGrade: Math.min(5, Math.max(1, Number.parseFloat(record.averageGrade) || 1.75)),
    approvedBy: record.approvedBy || '',
    approvedAt: record.approvedAt || '',
    reviewNote: record.reviewNote || ''
  };
});

const sha256 = async (text) => {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') return null;
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const AuthProvider = ({ children }) => {
  const [accounts, setAccounts] = useState([]);
  const [records, setRecords] = useState([]);
  const [backups, setBackups] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [subjectCatalog, setSubjectCatalog] = useState([]);
  const [rtdbLiveTicker, setRtdbLiveTicker] = useState([]);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isAuthResolving, setIsAuthResolving] = useState(isFirebaseInitialized);
  const [dataSync, setDataSync] = useState({
    status: isFirebaseInitialized ? 'idle' : 'offline',
    pendingWrites: 0,
    completedCollections: [],
    lastSyncedAt: '',
    error: ''
  });

  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inactivityNotice, setInactivityNotice] = useState('');
  const cacheRef = useRef(null);
  const sessionRef = useRef({ generation: 0, uid: '', scope: '' });
  const connectedRef = useRef(false);
  connectedRef.current = isFirebaseConnected;
  const collectionsReadyRef = useRef(false);
  const directoryRequestRef = useRef(null);
  const signInAttemptRef = useRef(false);
  const catalogWriteErrorRef = useRef('');

  const resetSessionData = () => {
    sessionRef.current = { generation: sessionRef.current.generation + 1, uid: '', scope: '' };
    collectionsReadyRef.current = false;
    catalogWriteErrorRef.current = '';
    cacheRef.current?.dispose({ clear: true }); cacheRef.current = null;
    setAccounts([]); setRecords([]); setDepartments([]); setPrograms([]);
    setSubjectCatalog([]); setBackups([]); setAuditLogs([]); setRtdbLiveTicker([]);
    setDataSync({ status: 'idle', pendingWrites: 0, completedCollections: [], lastSyncedAt: '', error: '' });
  };

  const getAccountDirectory = (uid) => {
    if (directoryRequestRef.current?.uid === uid) return directoryRequestRef.current.promise;
    const promise = (async () => {
      const access = (await withFirebaseReadDeadline(() => rtdbGet(rtdbRef(rtdb, `access/${uid}`)))).val();
      if (!access || access.status !== 'Active' || !['VPAA','President','Deans','Heads'].includes(access.role)
        || typeof access.department !== 'string' || !access.department.trim() || !/^[A-Za-z0-9_-]{1,128}$/.test(access.accountId || '')) return { matched: null, list: [] };
      const snapshot = await withFirebaseReadDeadline(() => rtdbGet(rtdbRef(rtdb, access.role === 'VPAA' ? 'accounts' : `accounts/${access.accountId}`)));
      const list = access.role === 'VPAA' ? parseRtdbSnapshot(snapshot) : snapshot.exists() ? [{ ...snapshot.val(), id: access.accountId }] : [];
      const profile = list.find((account) => account.id === access.accountId);
      return { list, matched: profile ? { ...profile, ...access, id: access.accountId, uid } : null };
    })().catch((error) => {
      if (directoryRequestRef.current?.promise === promise) directoryRequestRef.current = null;
      throw error;
    });
    directoryRequestRef.current = { uid, promise };
    return promise;
  };

  const activateAccount = (firebaseUser, matched, list) => {
    const scope = createCacheScope(firebaseConfig.projectId, firebaseUser.uid, matched.role, matched.department);
    if (sessionRef.current.scope !== scope) {
      resetSessionData();
      let storage;
      try { storage = sessionStorage; } catch { /* Cache is optional. */ }
      pruneCollectionCache(storage, firebaseConfig.projectId, scope);
      try { removeLegacyCollectionCache(localStorage, firebaseConfig.projectId); } catch { /* Optional old cache cleanup. */ }
      const cache = createCollectionCache({ storage, scope,
        schedule: (task) => scheduleBackgroundTask(task, 1000), cancel: (cancelTask) => cancelTask?.() });
      cacheRef.current = cache;
      sessionRef.current = { generation: sessionRef.current.generation, uid: firebaseUser.uid, scope };
      setRecords(cache.read('records')); setDepartments(cache.read('departments'));
      setPrograms(cache.read('programs')); setSubjectCatalog(cache.read('subjects'));
    }
    accountsRef.current = list; setAccounts(list);
    setCurrentUser(matched); setIsAuthenticated(true);
  };


  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let inactivityTimer = null;
    let awayTimestamp = null;

    const performAutoLogout = () => {
      logout();
      setInactivityNotice('Session expired: You were away or inactive for 5 minutes. Please sign in again.');
    };

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(performAutoLogout, INACTIVITY_TIMEOUT_MS);
    };

    const handleVisibilityOrFocusChange = () => {
      if (document.hidden) {
        awayTimestamp = Date.now();
      } else {
        if (awayTimestamp && (Date.now() - awayTimestamp >= INACTIVITY_TIMEOUT_MS)) {
          performAutoLogout();
          return;
        }
        awayTimestamp = null;
        resetInactivityTimer();
      }
    };

    const handleWindowBlur = () => {
      awayTimestamp = Date.now();
    };

    const handleWindowFocus = () => {
      if (awayTimestamp && (Date.now() - awayTimestamp >= INACTIVITY_TIMEOUT_MS)) {
        performAutoLogout();
        return;
      }
      awayTimestamp = null;
      resetInactivityTimer();
    };

    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('keydown', resetInactivityTimer);
    window.addEventListener('click', resetInactivityTimer);
    window.addEventListener('scroll', resetInactivityTimer);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocusChange);

    resetInactivityTimer();

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      window.removeEventListener('mousemove', resetInactivityTimer);
      window.removeEventListener('keydown', resetInactivityTimer);
      window.removeEventListener('click', resetInactivityTimer);
      window.removeEventListener('scroll', resetInactivityTimer);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocusChange);
    };
  }, [isAuthenticated]);

  const clearInactivityNotice = () => setInactivityNotice('');

  const permissions = useMemo(() => {
    const role = currentUser?.role;
    return {
      isVPAA: role === 'VPAA',
      isPresident: role === 'President',
      isDean: role === 'Deans',
      isHead: role === 'Heads',
      canCreateRecords: Boolean(currentUser) && role !== 'President',
      canManageAccounts: role === 'VPAA',
      canManageBackups: role === 'VPAA',
      canManageInstitutionalData: role === 'VPAA',
      canViewAllDepartments: role === 'VPAA' || role === 'President'
    };
  }, [currentUser]);

  const parseRtdbSnapshot = (snapshot) => firebaseCollectionRows(snapshot?.val());

  const accountsRef = React.useRef(accounts);
  accountsRef.current = accounts;

  useEffect(() => {
    if (!isFirebaseInitialized || !rtdb || !auth) {
      setIsFirebaseConnected(false);
      setIsAuthResolving(false);
      return undefined;
    }

    const unsubConnection = subscribeSafely(onValue,
      () => rtdbRef(rtdb, '.info/connected'),
      (snapshot) => {
        const connected = snapshot.val() === true;
        connectedRef.current = connected;
        setIsFirebaseConnected(connected);
        setDataSync((previous) => ({
          ...previous,
          status: connected ? (previous.error ? 'error' : collectionsReadyRef.current ? 'live' : 'syncing') : 'offline'
        }));
      },
      (error) => {
        connectedRef.current = false;
        setIsFirebaseConnected(false);
        setDataSync((previous) => ({ ...previous, status: 'offline', error: firebaseErrorMessage(error) }));
      }
    );

    let disposed = false;
    let authGeneration = 0;
    const unsubscribeAuth = subscribeSafely(onAuthStateChanged, () => auth, async (firebaseUser) => {
      const generation = ++authGeneration;
      directoryRequestRef.current = null;
      resetSessionData();
      if (!firebaseUser) {
        try { pruneCollectionCache(sessionStorage, firebaseConfig.projectId); } catch { /* Optional cache cleanup. */ }
        setIsAuthenticated(false);
        setCurrentUser(null);
        setIsAuthResolving(false);
        return;
      }

      // Keep the submitted form mounted so its result and inputs survive verification.
      if (!signInAttemptRef.current) setIsAuthResolving(true);
      try {
        const { list, matched } = await getAccountDirectory(firebaseUser.uid);
        if (disposed || generation !== authGeneration || auth.currentUser?.uid !== firebaseUser.uid) return;
        accountsRef.current = list;
        setAccounts(list);

        if (!matched || matched.status === 'Suspended') {
          setIsAuthenticated(false);
          setCurrentUser(null);
          if (!signInAttemptRef.current) setInactivityNotice(ACCOUNT_ACCESS_ERROR);
          await firebaseSignOut(auth);
          return;
        }

        activateAccount(firebaseUser, matched, list);
      } catch (error) {
        if (disposed || generation !== authGeneration) return;
        console.warn('Account-directory verification failed:', error);
        setIsAuthenticated(false);
        setCurrentUser(null);
        setInactivityNotice('CCT access could not be verified. Reconnect and try again, or contact the CCT administrator.');
        await firebaseSignOut(auth).catch(() => {});
      } finally {
        if (!disposed && generation === authGeneration) setIsAuthResolving(false);
      }
    }, () => {
      if (disposed) return;
      authGeneration += 1;
      resetSessionData(); setIsAuthenticated(false); setCurrentUser(null); setIsAuthResolving(false);
      setInactivityNotice('CCT authentication could not be verified. Reload and sign in again.');
      void firebaseSignOut(auth).catch(() => {});
    });

    return () => {
      disposed = true; authGeneration += 1;
      cacheRef.current?.dispose();
      unsubscribeAuth();
      unsubConnection();
    };
  }, []);

  useEffect(() => {
    if (!isFirebaseInitialized || !rtdb || !auth || !isAuthenticated || !currentUser?.email) return undefined;

    let cancelled = false;
    const sessionGeneration = sessionRef.current.generation;
    const isCurrentSession = () => !cancelled && sessionRef.current.generation === sessionGeneration && auth.currentUser?.uid === currentUser.uid;
    const subscriptions = [];
    const expectedCollections = ['accounts', 'requests', 'departments', 'programs', 'subjects', ...(currentUser.role === 'VPAA' ? ['backups', 'auditLogs'] : [])];
    const completed = new Set();
    const normalizationVersions = new Map();
    const normalizationJobs = new Map();
    const readErrors = new Map();

    setDataSync((previous) => ({
      ...previous,
      status: connectedRef.current ? 'syncing' : 'offline',
      completedCollections: [],
      error: ''
    }));

    const markCollectionReady = (collection) => {
      if (!isCurrentSession()) return;
      completed.add(collection);
      readErrors.delete(collection);
      const completedCollections = Array.from(completed);
      collectionsReadyRef.current = completedCollections.length >= expectedCollections.length;
      setDataSync((previous) => ({
        ...previous,
        status: completedCollections.length >= expectedCollections.length
          ? (connectedRef.current ? 'live' : 'offline')
          : (connectedRef.current ? 'syncing' : 'offline'),
        completedCollections,
        lastSyncedAt: new Date().toISOString(),
        error: Array.from(readErrors.values()).join('; '),
        ...(readErrors.size && connectedRef.current ? { status: 'error' } : {})
      }));
    };

    const handleReadError = (collection) => (error) => {
      if (!isCurrentSession()) return;
      readErrors.set(collection, `${collection}: ${firebaseErrorMessage(error)}`);
      console.warn(`RTDB ${collection} subscription:`, error);
      setDataSync((previous) => ({
        ...previous,
        status: connectedRef.current ? 'error' : 'offline',
        error: Array.from(readErrors.values()).join('; ')
      }));
    };

    const normalizeAndApply = (collection, snapshot, fallback, apply) => {
      const value = snapshot?.val();
      const version = (normalizationVersions.get(collection) || 0) + 1;
      normalizationVersions.set(collection, version);

      normalizationJobs.get(collection)?.();
      normalizationJobs.set(collection, scheduleBackgroundTask(() => {
      normalizationJobs.delete(collection);
      if (!isCurrentSession()) return;
      void Promise.resolve().then(() => normalizeSnapshotInBackground(collection, value, fallback))
        .then((result) => {
          if (!isCurrentSession() || normalizationVersions.get(collection) !== version) return;
          apply(result);
          cacheRef.current?.write(collection === 'requests' ? 'records' : collection, result);
          markCollectionReady(collection);
        })
        .catch(handleReadError(collection));
      }, 120));
    };

    const startSubscriptions = () => {
      if (!isCurrentSession()) return;

      subscriptions.push(subscribeSafely(onValue, () => rtdbRef(rtdb, `access/${auth.currentUser.uid}`), (snapshot) => {
        if (!isCurrentSession()) return;
        const access = snapshot.val();
        if (!access || access.status !== 'Active' || access.role !== currentUser.role || access.department !== currentUser.department) {
          void logout();
        }
      }, () => { if (isCurrentSession()) void logout(); }));

      subscriptions.push(subscribeSafely(onValue, () => rtdbRef(rtdb, currentUser.role === 'VPAA' ? 'accounts' : `accounts/${currentUser.id}`), (snapshot) => {
        if (!isCurrentSession()) return;
        const list = currentUser.role === 'VPAA' ? parseRtdbSnapshot(snapshot) : snapshot.exists() ? [{ ...snapshot.val(), id: currentUser.id }] : [];

        accountsRef.current = list;
        setAccounts(list);
        const profile = list.find((account) => account.id === currentUser.id);
        const matched = profile ? { ...profile, uid: auth.currentUser.uid, role: currentUser.role, department: currentUser.department } : null;
        if (!matched || matched.status === 'Suspended') {
          setIsAuthenticated(false);
          setCurrentUser(null);
          firebaseSignOut(auth).catch(console.warn);
          return;
        }

        activateAccount(auth.currentUser, matched, list);
        markCollectionReady('accounts');
      }, handleReadError('accounts')));

      const createRecordsQuery = () => currentUser.role === 'VPAA' ? rtdbRef(rtdb, 'requests')
        : rtdbQuery(rtdbRef(rtdb, 'requests'), orderByChild(currentUser.role === 'President' ? 'status' : 'department'),
          equalTo(currentUser.role === 'President' ? RECORD_STATUS.APPROVED : currentUser.department));
      subscriptions.push(subscribeSafely(onValue, createRecordsQuery, (snapshot) => {
        if (!isCurrentSession()) return;
        normalizeAndApply(
          'requests',
          snapshot,
          (value) => normalizeRecordCollection(collectionToArray(value)),
          setRecords
        );
      }, handleReadError('requests')));

      subscriptions.push(subscribeSafely(onValue, () => rtdbRef(rtdb, 'departments'), (snapshot) => {
        if (!isCurrentSession()) return;
        normalizeAndApply(
          'departments',
          snapshot,
          (value) => normalizeDepartmentCollection(firebaseCollectionRows(value, { allowStrings: true })),
          setDepartments
        );
      }, handleReadError('departments')));

      subscriptions.push(subscribeSafely(onValue, () => rtdbRef(rtdb, 'programs'), (snapshot) => {
        if (!isCurrentSession()) return;
        normalizeAndApply(
          'programs',
          snapshot,
          (value) => collectionToArray(value).map((program) => ({
            ...program,
            code: String(program.code || '').trim().toUpperCase(),
            name: String(program.name || '').trim(),
            department: String(program.department || '').trim()
          })).filter((program) => program.id && program.name && program.department),
          setPrograms
        );
      }, handleReadError('programs')));

      subscriptions.push(subscribeSafely(onValue, () => rtdbRef(rtdb, 'subjects'), (snapshot) => {
        if (!isCurrentSession()) return;
        normalizeAndApply(
          'subjects',
          snapshot,
          (value) => collectionToArray(value).map((subject) => ({
            ...subject,
            code: String(subject.code || '').trim().toUpperCase().replace(/\s+/g, ' '),
            title: String(subject.title || '').trim(),
            department: String(subject.department || '').trim(),
            programId: String(subject.programId || '').trim(),
            programName: String(subject.programName || '').trim()
          })).filter((subject) => subject.id && subject.code && subject.title && subject.department),
          setSubjectCatalog
        );
      }, handleReadError('subjects')));

      if (currentUser.role === 'VPAA') subscriptions.push(subscribeSafely(onValue, () => rtdbQuery(rtdbRef(rtdb, 'backups'), limitToLast(100)), (snapshot) => {
        if (!isCurrentSession()) return;
        const list = parseRtdbSnapshot(snapshot).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        setBackups(list);
        markCollectionReady('backups');
      }, handleReadError('backups')));

      if (currentUser.role === 'VPAA') subscriptions.push(subscribeSafely(onValue, () => rtdbQuery(rtdbRef(rtdb, 'auditLogs'), limitToLast(500)), (snapshot) => {
        if (!isCurrentSession()) return;
        const list = parseRtdbSnapshot(snapshot).sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
        setAuditLogs(list);
        markCollectionReady('auditLogs');
      }, handleReadError('auditLogs')));

    };

    const cancelScheduledStart = scheduleBackgroundTask(startSubscriptions, 300);

    return () => {
      cancelled = true;
      cancelScheduledStart?.();
      normalizationJobs.forEach((cancelJob) => cancelJob());
      subscriptions.forEach((unsubscribe) => unsubscribe?.());
    };
  }, [isAuthenticated, currentUser?.id, currentUser?.uid, currentUser?.email, currentUser?.role, currentUser?.department]);

  const broadcastRealtimeActivity = (action, details) => {
    const item = {
      timestamp: new Date().toLocaleTimeString(),
      user: currentUser?.email || 'System',
      action,
      details
    };

    setRtdbLiveTicker((previous) => [item, ...previous].slice(0, 5));
  };

  const addAuditLog = (action, details) => {
    // Activity feedback is local. Authoritative audit entries are created only by CCT server functions.
    broadcastRealtimeActivity(action, details);
  };

  const syncRecord = async (record, expected = null, remove = false, authorize = () => true) => {
    if (!isFirebaseInitialized || !rtdb || !connectedRef.current) {
      return { success: false, message: 'Reconnect before saving. Your form stays open so you can try again.' };
    }
    const generation = sessionRef.current.generation;
    setDataSync((previous) => ({ ...previous, pendingWrites: previous.pendingWrites + 1 }));
    try {
      const result = await runRecordTransaction(rtdb, `requests/${record.id}`,
        { record, expected, remove, authorize }, () => sessionRef.current.generation === generation);
      if (sessionRef.current.generation !== generation) return { success: false, message: 'Your account session changed.' };
      if (!result.committed && expected && !result.snapshot.exists()) return { success: false, message: 'This CCT record no longer exists. Close the form and refresh the list.' };
      if (!result.committed) return { success: false, message: expected
        ? 'This record was changed on another device. Close this form and reopen the latest record before saving.'
        : 'Another user already saved this subject for the same Academic Year and semester. Refresh the record list.' };
      return { success: true, record: result.snapshot.val() };
    } catch (error) {
      return { success: false, message: error?.code?.includes('permission')
        ? 'You no longer have access to save this record.' : 'The record could not be saved. Please try again.' };
    } finally {
      if (sessionRef.current.generation === generation) setDataSync((previous) => ({
        ...previous, pendingWrites: Math.max(0, previous.pendingWrites - 1)
      }));
    }
  };

  const loginWithEmail = async (email, password, keepSignedIn = false) => {
    if (!isFirebaseInitialized || !auth) {
      return { success: false, message: 'Firebase Auth service is not initialized.' };
    }

    if (signInAttemptRef.current) return { success: false, message: 'Sign-in is already in progress.' };
    signInAttemptRef.current = true;
    setInactivityNotice('');
    let attemptUid = '';
    try {
      if (keepSignedIn) {
        updateKeepSignedInPreference(true);
        await setPersistence(auth, browserLocalPersistence);
      } else {
        updateKeepSignedInPreference(false);
        await setPersistence(auth, browserSessionPersistence);
      }

      const credential = await signInWithEmailAndPassword(auth, email, password);
      attemptUid = credential.user.uid;
      const { list, matched } = await getAccountDirectory(credential.user.uid);
      if (!matched || matched.status === 'Suspended') {
        updateKeepSignedInPreference(false);
        if (auth.currentUser?.uid === attemptUid) await firebaseSignOut(auth);
        return { success: false, message: ACCOUNT_ACCESS_ERROR };
      }
      if (auth.currentUser?.uid !== credential.user.uid) return { success: false, message: 'Sign-in session changed. Please try again.' };

      setInactivityNotice('');
      activateAccount(credential.user, matched, list);
      addAuditLog('Firebase Auth Sign In', `Signed in as ${email}`);
      return { success: true };
    } catch (error) {
      console.warn('Firebase Auth sign in failure:', error.code, error.message);
      if (attemptUid && auth.currentUser?.uid === attemptUid) await firebaseSignOut(auth).catch(() => {});
      updateKeepSignedInPreference(false);
      let message = 'Sign-in could not be completed. Check your CCT credentials or contact the CCT administrator.';
      if (error?.code === 'auth/too-many-requests') message = 'Too many sign-in attempts. Please try again later.';
      else if (['auth/network-request-failed', 'firebase/read-timeout'].includes(error?.code)) message = 'Check your connection and try again.';
      return { success: false, message };
    } finally {
      signInAttemptRef.current = false;
    }
  };


  const logout = async () => {
    updateKeepSignedInPreference(false);
    cacheRef.current?.dispose({ clear: true });
    resetSessionData();
    if (isFirebaseInitialized && auth) {
      try {
        await firebaseSignOut(auth);
      } catch (error) {
        console.warn('Logout note:', error);
      }
    }
    setIsAuthenticated(false);
    setCurrentUser(null);
  };


  const callAccountAction = async (payload) => {
    if (!isCctAdminServiceEnabled) return { success: false, message: 'CCT account administration is managed by the project administrator until the secure service is enabled.' };
    const generation = sessionRef.current.generation;
    try {
      const result = await httpsCallable(functions, 'manageCctAccount')(payload);
      if (sessionRef.current.generation !== generation) return { success: false, message: 'Your CCT account session changed.' };
      if (typeof result.data?.success !== 'boolean') return { success: false, message: 'The CCT account service returned an incomplete response. Refresh before retrying.' };
      return result.data;
    } catch (error) {
      const trustedCodes = ['functions/invalid-argument', 'functions/failed-precondition', 'functions/already-exists', 'functions/resource-exhausted'];
      return { success: false, message: trustedCodes.includes(error.code) ? error.message
        : 'The CCT account service could not complete this action. Contact the CCT administrator if it persists.' };
    }
  };

  const addAccount = async (profile) => {
    if (!permissions.canManageAccounts) return { success: false, message: 'Only the CCT VPAA can create accounts.' };
    return callAccountAction({ action: 'create', profile });
  };

  const updateAccount = async (id, updatedData = {}) => {
    const existing = accounts.find((account) => account.id === id);
    if (!existing) return { success: false, message: 'CCT account not found.' };
    if (updatedData.email && updatedData.email.trim().toLowerCase() !== String(existing.email || '').toLowerCase()) {
      return { success: false, message: 'CCT email changes require a verified Authentication update.' };
    }
    const isOwnNameChange = currentUser?.id === id && Object.keys(updatedData).every((key) => key === 'name');
    if (permissions.canManageAccounts && !isOwnNameChange) return callAccountAction({ action: 'update', id,
      profile: { name: updatedData.name ?? existing.name, role: updatedData.role ?? existing.role,
        department: updatedData.department ?? existing.department } });
    if (currentUser?.id !== id) return { success: false, message: 'You can update only your own CCT display name.' };
    const name = String(updatedData.name || '').trim();
    if (!name || name.length > 100) return { success: false, message: 'Enter a CCT display name of 1-100 characters.' };
    if (!isFirebaseInitialized || !rtdb) return { success: false, message: firebaseServiceError };
    if (!connectedRef.current) return { success: false, message: 'Reconnect before saving your CCT display name.' };
    const generation = sessionRef.current.generation;
    try {
      await rtdbSet(rtdbRef(rtdb, 'accounts/' + id + '/name'), name);
      if (generation !== sessionRef.current.generation) return { success: false, message: 'Your CCT account session changed.' };
      return { success: true, account: { ...existing, name } };
    } catch {
      return { success: false, message: 'Your CCT display name could not be saved. Please try again.' };
    }
  };

  const toggleAccountStatus = async (id) => {
    if (!permissions.canManageAccounts) return { success: false, message: 'Only the CCT VPAA can change account status.' };
    const existing = accounts.find((account) => account.id === id);
    if (!existing) return { success: false, message: 'CCT account not found.' };
    return callAccountAction({ action: 'status', id, status: existing.status === 'Active' ? 'Suspended' : 'Active' });
  };

  const isRecordInUserDepartment = (record) => record?.department === currentUser?.department;
  const isRecordOwner = (record) => Boolean(currentUser?.uid) && record?.encodedByUid === currentUser.uid;

  const canEditRecord = (record) => {
    if (!record || !currentUser) return false;
    if (permissions.isVPAA) return true;
    if (permissions.isDean) return isRecordInUserDepartment(record);
    if (permissions.isHead) {
      return isRecordInUserDepartment(record)
        && isRecordOwner(record)
        && record.status !== RECORD_STATUS.APPROVED;
    }
    return false;
  };

  const canDeleteRecord = (record) => {
    if (!record || !currentUser) return false;
    if (permissions.isVPAA) return true;
    if (permissions.isDean) return isRecordInUserDepartment(record) && record.status !== RECORD_STATUS.APPROVED;
    if (permissions.isHead) return canEditRecord(record);
    return false;
  };

  const canApproveRecord = (record) => {
    if (!record || !currentUser) return false;
    if (permissions.isVPAA) return true;
    return permissions.isDean && isRecordInUserDepartment(record);
  };

  const normalizeRecordNumbers = (recordData, fallbackGrade = 1.75) => {
    const safeCount = (value) => {
      const count = Number(value);
      return Number.isInteger(count) && count >= 0 ? count : 0;
    };
    const enrolledCount = safeCount(recordData.enrolledCount);
    const passedCount = safeCount(recordData.passedCount);
    const failedCount = safeCount(recordData.failedCount);
    const droppedCount = safeCount(recordData.droppedCount);
    const incCount = safeCount(recordData.incCount);
    const parsedGrade = Number.parseFloat(recordData.averageGrade);
    const averageGrade = Number.isFinite(parsedGrade)
      ? Math.min(5, Math.max(1, parsedGrade))
      : fallbackGrade;

    return {
      enrolledCount,
      passedCount,
      failedCount,
      droppedCount,
      incCount,
      passingRate: enrolledCount > 0 ? Number(((passedCount / enrolledCount) * 100).toFixed(2)) : 0,
      averageGrade
    };
  };

  const validateRecordInput = (recordData) => {
    if (!recordData.department || !recordData.academicYear || !recordData.semester) {
      return 'Academic unit, academic year, and semester are required.';
    }
    if (!recordData.subjectCode?.trim() || !recordData.subjectTitle?.trim()) {
      return 'Subject code and title are required.';
    }

    const counts = ['enrolledCount', 'passedCount', 'failedCount', 'droppedCount', 'incCount']
      .map((field) => Number(recordData[field] ?? 0));
    if (counts.some((count) => !Number.isInteger(count) || count < 0)) {
      return 'Student counts must be non-negative whole numbers.';
    }
    if (counts[0] <= 0) return 'Enrolled students must be greater than zero.';
    if (counts.slice(1).reduce((sum, count) => sum + count, 0) > counts[0]) {
      return 'Student outcomes cannot exceed the enrolled count.';
    }

    const averageGrade = Number(recordData.averageGrade);
    if (!Number.isFinite(averageGrade) || averageGrade < 1 || averageGrade > 5) {
      return 'Average grade must be between 1.00 and 5.00.';
    }
    return '';
  };

  const findDuplicateRecord = (recordData, excludedId = null) => {
    const normalizedCode = String(recordData.subjectCode || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const normalizedYear = normalizeAcademicYear(recordData.academicYear);
    return records.find((record) => record.id !== excludedId
      && record.department === recordData.department
      && String(record.programId || record.programName || '') === String(recordData.programId || recordData.programName || '')
      && normalizeAcademicYear(record.academicYear) === normalizedYear
      && record.semester === recordData.semester
      && String(record.subjectCode || '').trim().toUpperCase().replace(/\s+/g, ' ') === normalizedCode);
  };

  const addRecord = async (recordData) => {
    if (!permissions.canCreateRecords) return { success: false, message: 'The President role is read-only.' };
    if (!permissions.isVPAA && recordData.department !== currentUser?.department) {
      return { success: false, message: 'You can only create records for your assigned academic unit.' };
    }
    const validationError = validateRecordInput(recordData);
    if (validationError) return { success: false, message: validationError };
    if (findDuplicateRecord(recordData)) {
      return { success: false, message: 'A record already exists for this subject, program, academic year, and semester.' };
    }

    const isSubmittedForApproval = permissions.isHead;
    const now = timestamp();
    const status = isSubmittedForApproval ? RECORD_STATUS.PENDING : RECORD_STATUS.APPROVED;
    const numbers = normalizeRecordNumbers(recordData);

    const identity = JSON.stringify([recordData.department, recordData.programId || recordData.programName || '',
      normalizeAcademicYear(recordData.academicYear), recordData.semester,
      recordData.subjectCode.trim().toUpperCase().replace(/\s+/g, ' ')]);
    const identityHash = await sha256(identity);
    if (!identityHash) return { success: false, message: 'Use a secure connection before saving academic records.' };
    const newRecord = {
      id: `rec_${identityHash}`,
      ...recordData,
      ...numbers,
      subjectCode: recordData.subjectCode.trim().toUpperCase().replace(/\s+/g, ' '),
      subjectTitle: recordData.subjectTitle.trim(),
      academicYear: normalizeAcademicYear(recordData.academicYear),
      encodedBy: currentUser.name,
      encodedById: currentUser.id,
      encodedByUid: currentUser.uid,
      modifiedByUid: currentUser.uid,
      approvedByUid: status === RECORD_STATUS.APPROVED ? currentUser.uid : '',
      reviewedByUid: '',
      reviewedBy: '',
      reviewedAt: '',
      updatedAt: new Date().toISOString(),
      status,
      submittedAt: isSubmittedForApproval ? now : '',
      approvedBy: status === RECORD_STATUS.APPROVED ? currentUser.name : '',
      approvedAt: status === RECORD_STATUS.APPROVED ? now : '',
      reviewNote: status === RECORD_STATUS.APPROVED ? 'Created by an authorized approver.' : ''
    };

    const saved = await syncRecord(newRecord);
    if (!saved.success) return saved;

    addAuditLog(
      isSubmittedForApproval ? 'Record Submitted for Dean Approval' : 'Record Approved and Encoded',
      `${newRecord.subjectCode} (${newRecord.department})`
    );
    return saved;
  };

  const updateRecord = async (id, updatedData, original) => {
    const existing = records.find((record) => record.id === id);
    if (!existing) return { success: false, message: 'Record not found.' };
    if (!canEditRecord(existing)) return { success: false, message: 'You do not have permission to edit this record.' };
    const mergedRecord = { ...existing, ...updatedData };
    if (!permissions.isVPAA && mergedRecord.department !== currentUser?.department) {
      return { success: false, message: 'You cannot move a record outside your assigned academic unit.' };
    }
    const validationError = validateRecordInput(mergedRecord);
    if (validationError) return { success: false, message: validationError };
    if (findDuplicateRecord(mergedRecord, id)) {
      return { success: false, message: 'A record already exists for this subject, program, academic year, and semester.' };
    }

    const numbers = normalizeRecordNumbers(mergedRecord, existing.averageGrade);
    const updatedRecord = {
      ...existing,
      ...updatedData,
      ...numbers,
      subjectCode: String(updatedData.subjectCode || existing.subjectCode).trim().toUpperCase().replace(/\s+/g, ' '),
      subjectTitle: String(updatedData.subjectTitle || existing.subjectTitle).trim(),
      academicYear: normalizeAcademicYear(updatedData.academicYear || existing.academicYear),
      encodedByUid: existing.encodedByUid || (permissions.isVPAA ? currentUser.uid : ''),
      modifiedByUid: currentUser.uid,
      updatedAt: new Date().toISOString()
    };

    if (permissions.isHead) {
      updatedRecord.status = RECORD_STATUS.PENDING;
      updatedRecord.submittedAt = timestamp();
      updatedRecord.approvedBy = '';
      updatedRecord.approvedByUid = '';
      updatedRecord.reviewedByUid = '';
      updatedRecord.reviewedBy = '';
      updatedRecord.reviewedAt = '';
      updatedRecord.approvedAt = '';
      updatedRecord.reviewNote = '';
    } else if (!permissions.isVPAA) {
      updatedRecord.status = existing.status;
      updatedRecord.approvedBy = existing.approvedBy || '';
      updatedRecord.approvedAt = existing.approvedAt || '';
    } else {
      const now = timestamp();
      if (updatedRecord.status === RECORD_STATUS.APPROVED) {
        updatedRecord.approvedBy = currentUser.name;
        updatedRecord.approvedByUid = currentUser.uid;
        updatedRecord.approvedAt = existing.status === RECORD_STATUS.APPROVED && existing.approvedAt
          ? existing.approvedAt
          : now;
      } else {
        updatedRecord.approvedBy = '';
        updatedRecord.approvedByUid = '';
        updatedRecord.approvedAt = '';
        if (updatedRecord.status === RECORD_STATUS.PENDING) updatedRecord.submittedAt = now;
      }
    }

    const saved = await syncRecord(updatedRecord, original || existing, false, canEditRecord);
    if (!saved.success) return saved;

    addAuditLog(
      permissions.isHead ? 'Record Revised and Resubmitted' : 'Record Updated',
      `${updatedRecord.subjectCode} (${updatedRecord.department})`
    );
    return saved;
  };

  const reviewRecord = async (id, decision, note = '', original) => {
    const existing = records.find((record) => record.id === id);
    if (!existing) return { success: false, message: 'Record not found.' };
    if (!canApproveRecord(existing)) return { success: false, message: 'You do not have approval authority for this record.' };

    const approved = decision === RECORD_STATUS.APPROVED || decision === 'approve';
    const updatedRecord = {
      ...existing,
      status: approved ? RECORD_STATUS.APPROVED : RECORD_STATUS.RETURNED,
      encodedByUid: existing.encodedByUid || (permissions.isVPAA ? currentUser.uid : ''),
      approvedBy: approved ? currentUser.name : '',
      approvedByUid: approved ? currentUser.uid : '',
      modifiedByUid: currentUser.uid,
      reviewedByUid: currentUser.uid,
      approvedAt: approved ? timestamp() : '',
      reviewedBy: currentUser.name,
      reviewedAt: timestamp(),
      reviewNote: note.trim() || (approved ? 'Reviewed and approved.' : 'Returned for revision.'),
      updatedAt: new Date().toISOString()
    };

    const saved = await syncRecord(updatedRecord, original || existing, false, canApproveRecord);
    if (!saved.success) return saved;

    addAuditLog(
      approved ? 'Record Approved' : 'Record Returned for Revision',
      `${updatedRecord.subjectCode} reviewed by ${currentUser.name}`
    );
    return saved;
  };

  const deleteRecord = async (id, original) => {
    const target = records.find((record) => record.id === id);
    if (!target) return { success: false, message: 'Record not found.' };
    if (!canDeleteRecord(target)) return { success: false, message: 'You do not have permission to delete this record.' };

    const saved = await syncRecord(target, original || target, true, canDeleteRecord);
    if (!saved.success) return saved;
    addAuditLog('Record Deleted', `Deleted ${target.subjectCode} (${target.department})`);
    return { success: true };
  };

  const createBackup = async (type = 'Manual Export', academicSnapshot = {}) => {
    const generation = sessionRef.current.generation;
    if (!permissions.canManageBackups) return { success: false, message: 'Only the VPAA can create system backups.' };

    try {
      const now = new Date();
      const timestampString = timestamp();
      const dateCode = now.toISOString().split('T')[0].replace(/-/g, '');
      let snapshotData = {
        accounts,
        records,
        auditLogs,
        departments,
        programs,
        subjectCatalog,
        exportedAt: timestampString,
        version: DATA_VERSION,
        college: 'City College of Tagaytay'
      };
      const canSynchronize = isFirebaseInitialized && rtdb && isFirebaseConnected;
      if (canSynchronize) {
        // Read complete authorized collections, including catalog keys used by student links.
        const paths = ['accounts', 'requests', 'auditLogs', 'departments', 'programs', 'subjects', ...MODULE_COLLECTIONS];
        const snapshots = await withFirebaseReadDeadline(() => Promise.all(paths.map((path) => rtdbGet(rtdbRef(rtdb, path)))));
        const aliases = { requests: 'records', subjects: 'subjectCatalog' };
        snapshotData = { ...snapshotData, ...Object.fromEntries(paths.map((path, index) => [aliases[path] || path, snapshots[index].val() || {}])) };
      } else {
        snapshotData = { ...snapshotData, ...academicSnapshot };
      }
      if (sessionRef.current.generation !== generation) return { success: false, message: 'Your account session changed. Reopen this workspace before continuing.' };
      const jsonString = JSON.stringify(snapshotData, null, 2);
      const digest = await sha256(jsonString);
      const checksumSuffix = digest || `unavailable-${Date.now().toString(16)}`;

      const newBackup = {
        id: rtdbPush(rtdbRef(rtdb, 'backups')).key,
        fileName: `cct_academic_db_${dateCode}_${checksumSuffix.slice(0, 8)}.json`,
        fileSize: `${(new Blob([jsonString]).size / 1024).toFixed(2)} KB`,
        createdAt: timestampString,
        type,
        status: canSynchronize ? 'Completed' : 'Local Export',
        createdBy: currentUser.name,
        createdByUid: currentUser.uid,
        checksum: digest ? `sha256-${digest}` : checksumSuffix,
        rawContent: jsonString
      };

      if (canSynchronize) {
        await rtdbSet(rtdbRef(rtdb, `backups/${newBackup.id}`), newBackup);
      }
      if (sessionRef.current.generation !== generation) return { success: false, message: 'Your account session changed. Reopen this workspace before continuing.' };
      setBackups((previous) => [newBackup, ...previous.filter((backup) => backup.id !== newBackup.id)].slice(0, 100));
      addAuditLog('Backup Created', `Generated ${type} snapshot: ${newBackup.fileName}`);

      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = newBackup.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      return { success: true, backup: newBackup, synchronized: Boolean(canSynchronize) };
    } catch (error) {
      console.error('Backup error:', error);
      return { success: false, message: 'The backup could not be generated or synchronized.' };
    }
  };

  const restoreBackup = async (backupJsonData, expectedChecksum = '') => {
    if (!isCctAdminServiceEnabled) return { success: false, message: 'CCT snapshot imports require the secure restore service. Your export and existing data are available.' };
    if (!permissions.canManageBackups) return { success: false, message: 'Only the CCT VPAA can restore CCT data.' };
    if (!connectedRef.current) return { success: false, message: 'Reconnect before restoring CCT data.' };
    const generation = sessionRef.current.generation;
    try {
      const rawJson = typeof backupJsonData === 'string' ? backupJsonData : JSON.stringify(backupJsonData);
      if (new Blob([rawJson]).size > 10 * 1024 * 1024) return { success: false, message: 'The CCT snapshot exceeds 10 MB.' };
      if (expectedChecksum.startsWith('sha256-')) {
        const digest = await sha256(rawJson);
        if (!digest || 'sha256-' + digest !== expectedChecksum) return { success: false, message: 'CCT snapshot checksum verification failed.' };
      }
      const response = await httpsCallable(functions, 'restoreCctSnapshot', { timeout: 120000 })({ rawJson });
      if (sessionRef.current.generation !== generation) return { success: false, message: 'Your CCT account session changed.' };
      if (typeof response.data?.success !== 'boolean') return { success: false, message: 'The CCT restore service returned an incomplete response. Refresh before retrying.' };
      return response.data;
    } catch (error) {
      return { success: false, message: ['functions/invalid-argument', 'functions/failed-precondition'].includes(error.code)
        ? error.message : 'The CCT restore service could not complete this action. Please contact the CCT administrator.' };
    }
  };

  const runCatalogMutation = async (label, task) => {
    if (!isFirebaseInitialized || !rtdb) return { success: false, message: firebaseServiceError };
    if (!connectedRef.current) return { success: false, message: 'Reconnect before changing the CCT directory. Your form stays open.' };
    if (!['accounts','requests','departments','programs','subjects'].every((path) => dataSync.completedCollections.includes(path)) || (dataSync.error && dataSync.error !== catalogWriteErrorRef.current)) {
      return { success: false, message: 'Wait for the CCT directory and its linked data to synchronize before changing it.' };
    }
    const generation = sessionRef.current.generation;
    setDataSync((previous) => ({ ...previous, status: connectedRef.current ? 'syncing' : 'offline', pendingWrites: previous.pendingWrites + 1 }));
    try {
      const result = await task();
      if (sessionRef.current.generation !== generation) return { success: false, message: 'Your CCT account session changed. Reopen the workspace.' };
      const resolvedError = catalogWriteErrorRef.current;
      catalogWriteErrorRef.current = '';
      setDataSync((previous) => {
        const error = previous.error === resolvedError ? '' : previous.error;
        return { ...previous, error, status: error ? 'error' : connectedRef.current ? 'live' : 'offline', lastSyncedAt: new Date().toISOString() };
      });
      return result;
    } catch (error) {
      const message = firebaseErrorMessage(error, 'save');
      if (sessionRef.current.generation === generation) {
        const syncError = label + ': ' + message;
        catalogWriteErrorRef.current = syncError;
        setDataSync((previous) => ({ ...previous, status: connectedRef.current ? 'error' : 'offline', error: syncError }));
      }
      return { success: false, message };
    } finally {
      if (sessionRef.current.generation === generation) setDataSync((previous) => ({ ...previous, pendingWrites: Math.max(0, previous.pendingWrites - 1) }));
    }
  };

  const addDepartment = async (name) => {
    if (!permissions.isVPAA) return { success: false, message: 'Only the VPAA can create new departments.' };
    const trimmed = String(name || '').trim();
    if (!trimmed || trimmed.length > 160) return { success: false, message: 'Enter an academic unit name of 1–160 characters.' };
    if (departments.some((departmentName) => String(departmentName).toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, message: 'This department already exists.' };
    }

    const result = await runCatalogMutation('Add academic unit', async () => {
      const department = { id: rtdbPush(rtdbRef(rtdb, 'departments')).key, name: trimmed };
      await rtdbSet(rtdbRef(rtdb, `departments/${department.id}`), department);
      return { success: true, department: trimmed };
    });
    if (result.success) addAuditLog('Add Department', `VPAA created department: ${trimmed}`);
    return result;
  };

  const deleteDepartment = async (name) => {
    if (!permissions.isVPAA) return { success: false, message: 'Only the VPAA can remove departments.' };
    const accountReference = accounts.some((account) => account.department === name);
    const recordReference = records.some((record) => record.department === name);
    const programReference = programs.some((program) => program.department === name);
    const subjectReference = subjectCatalog.some((subject) => subject.department === name);
    if (accountReference || recordReference || programReference || subjectReference) {
      const references = [
        accountReference && 'accounts',
        recordReference && 'academic records',
        programReference && 'programs',
        subjectReference && 'subjects'
      ].filter(Boolean).join(', ');
      return {
        success: false,
        message: `This academic unit is still referenced by ${references}. Reassign or remove those dependencies first.`
      };
    }

    const result = await runCatalogMutation('Remove academic unit', async () => {
      const snapshot = await withFirebaseReadDeadline(() => rtdbGet(rtdbRef(rtdb, 'departments')));
      const match = firebaseCollectionRows(snapshot.val(), { allowStrings: true }).find((item) => item.name === name || item.id === name);
      if (!match) return { success: false, message: 'This academic unit no longer exists. Refresh the CCT directory.' };
      await rtdbRemove(rtdbRef(rtdb, `departments/${match.id}`));
      return { success: true };
    });
    if (result.success) addAuditLog('Remove Department', `VPAA removed department: ${name}`);
    return result;
  };

  const addProgram = async ({ code, name, department } = {}) => {
    if (!permissions.isVPAA) return { success: false, message: 'Only the VPAA can add academic programs.' };
    const normalizedCode = String(code || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const trimmedName = String(name || '').trim();
    const trimmedDepartment = String(department || '').trim();
    if (!normalizedCode || normalizedCode.length > 40 || !trimmedName || trimmedName.length > 160 || !trimmedDepartment) {
      return { success: false, message: 'Enter a program code of 1–40 characters, a name of 1–160 characters, and an academic unit.' };
    }
    if (!departments.includes(trimmedDepartment)) {
      return { success: false, message: 'Select an academic unit that exists in the database.' };
    }
    const duplicate = programs.some((program) => program.department === trimmedDepartment && (
      program.name?.trim().toLowerCase() === trimmedName.toLowerCase()
      || (normalizedCode && String(program.code || '').trim().toUpperCase() === normalizedCode)
    ));
    if (duplicate) return { success: false, message: 'This program name or code already exists in the selected academic unit.' };

    const result = await runCatalogMutation('Add program', async () => {
      const newProgram = { id: rtdbPush(rtdbRef(rtdb, 'programs')).key, code: normalizedCode, name: trimmedName,
        department: trimmedDepartment, status: 'Active', createdAt: timestamp(), updatedAt: timestamp() };
      await rtdbSet(rtdbRef(rtdb, `programs/${newProgram.id}`), newProgram);
      return { success: true, program: newProgram };
    });
    if (result.success) addAuditLog('Add Academic Program', `Added ${result.program.code} - ${result.program.name} (${result.program.department})`);
    return result;
  };

  const deleteProgram = async (id) => {
    if (!permissions.isVPAA) return { success: false, message: 'Only the VPAA can remove academic programs.' };
    const target = programs.find((program) => program.id === id);
    if (!target) return { success: false, message: 'Program not found.' };
    const subjectReference = subjectCatalog.some((subject) => subject.programId === id);
    if (subjectReference) {
      return { success: false, message: 'Remove or reassign the subjects linked to this program before deleting it.' };
    }

    const result = await runCatalogMutation('Remove program', async () => {
      await rtdbRemove(rtdbRef(rtdb, `programs/${id}`));
      return { success: true };
    });
    if (result.success) addAuditLog('Remove Academic Program', `Removed ${target.code ? `${target.code} - ` : ''}${target.name}`);
    return result;
  };

  const addSubjectToCatalog = async ({ code, title, department, programId = '' } = {}) => {
    if (!permissions.isVPAA) return { success: false, message: 'Only the VPAA can add subjects to the catalog.' };
    const normalizedCode = String(code || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const trimmedTitle = String(title || '').trim();
    const trimmedDepartment = String(department || '').trim();
    if (!normalizedCode || normalizedCode.length > 40 || !trimmedTitle || trimmedTitle.length > 250 || !trimmedDepartment) {
      return { success: false, message: 'Enter a subject code of 1–40 characters, a title of 1–250 characters, and an academic unit.' };
    }
    if (!departments.includes(trimmedDepartment)) {
      return { success: false, message: 'Select an academic unit that exists in the database.' };
    }

    const selectedProgram = programId ? programs.find((program) => program.id === programId) : null;
    if (programId && (!selectedProgram || selectedProgram.department !== trimmedDepartment)) {
      return { success: false, message: 'The selected program does not belong to the selected academic unit.' };
    }

    const duplicate = subjectCatalog.some((subject) => subject.department === trimmedDepartment
      && String(subject.programId || '') === String(programId || '')
      && String(subject.code || '').trim().toUpperCase().replace(/\s+/g, ' ') === normalizedCode);
    if (duplicate) return { success: false, message: 'This subject code already exists in the selected program scope.' };

    const result = await runCatalogMutation('Add subject', async () => {
      const newSubject = { id: rtdbPush(rtdbRef(rtdb, 'subjects')).key, code: normalizedCode, title: trimmedTitle,
        department: trimmedDepartment, programId: selectedProgram?.id || '', programName: selectedProgram?.name || '',
        createdAt: timestamp(), updatedAt: timestamp() };
      await rtdbSet(rtdbRef(rtdb, `subjects/${newSubject.id}`), newSubject);
      return { success: true, subject: newSubject };
    });
    if (result.success) addAuditLog('Add Subject/Course', `Added ${result.subject.code} - ${result.subject.title} (${result.subject.programName || 'Department-wide'} / ${result.subject.department})`);
    return result;
  };

  const deleteSubjectFromCatalog = async (id) => {
    if (!permissions.isVPAA) return { success: false, message: 'Only the VPAA can remove subjects.' };
    const target = subjectCatalog.find((subject) => subject.id === id);
    if (!target) return { success: false, message: 'Subject not found.' };

    const result = await runCatalogMutation('Remove subject', async () => {
      await rtdbRemove(rtdbRef(rtdb, `subjects/${id}`));
      return { success: true };
    });
    if (result.success) addAuditLog('Remove Subject/Course', `Removed subject ${target.code} - ${target.title}`);
    return result;
  };

  const safeAction = (action, verb = 'save', requiredObject = '') => (...args) => firebaseOperationResult(() => action(...args), verb, requiredObject);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        accounts,
        records,
        backups,
        auditLogs,
        rtdbLiveTicker,
        departments,
        programs,
        subjectCatalog,
        isFirebaseConnected,
        firebaseReady: isFirebaseInitialized,
        firebaseServiceError,
        isAuthResolving,
        dataSync,
        permissions,
        adminServiceReady: isCctAdminServiceEnabled,
        inactivityNotice,
        clearInactivityNotice,
        loginWithEmail,
        logout,
        addAccount: safeAction(addAccount, 'save', 'account'),
        updateAccount: safeAction(updateAccount, 'save', 'account'),
        toggleAccountStatus: safeAction(toggleAccountStatus, 'save', 'account'),
        addDepartment: safeAction(addDepartment),
        deleteDepartment: safeAction(deleteDepartment, 'remove'),
        addProgram: safeAction(addProgram, 'save', 'program'),
        deleteProgram: safeAction(deleteProgram, 'remove'),
        addSubjectToCatalog: safeAction(addSubjectToCatalog, 'save', 'subject'),
        deleteSubjectFromCatalog: safeAction(deleteSubjectFromCatalog, 'remove'),
        addRecord: safeAction(addRecord, 'save', 'record'),
        updateRecord: safeAction(updateRecord, 'save', 'record'),
        reviewRecord: safeAction(reviewRecord, 'save', 'record'),
        deleteRecord: safeAction(deleteRecord, 'remove'),
        canEditRecord,
        canDeleteRecord,
        canApproveRecord,
        createBackup: safeAction(createBackup, 'export', 'backup'),
        restoreBackup: safeAction(restoreBackup, 'restore'),
        addAuditLog
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
