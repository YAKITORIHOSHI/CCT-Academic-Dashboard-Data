import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { RECORD_STATUS, normalizeAcademicYear } from '../utils/academic';
import { scheduleBackgroundTask } from '../services/backgroundTask';
import { normalizeSnapshotInBackground } from '../services/backgroundDataWorker';
import { auth, rtdb, firebaseConfig, isFirebaseInitialized, KEEP_SIGNED_IN_KEY } from '../firebase/config';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence
} from 'firebase/auth';
import {
  ref as rtdbRef,
  onValue,
  set as rtdbSet,
  push as rtdbPush,
  remove as rtdbRemove,
  update as rtdbUpdate,
  query as rtdbQuery,
  limitToLast,
  get as rtdbGet
} from 'firebase/database';

export const AuthContext = createContext(null);
const DATA_VERSION = '7.0-natsuki-college-of-imus';

// Automatic sign-out after 5 minutes without user interaction (300,000 ms).
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

const readStoredCollection = (key, fallback) => {
  try {
    const nciKey = key.replace(/^cct_/, 'nci_');
    if (localStorage.getItem('nci_data_version') !== DATA_VERSION && localStorage.getItem('cct_data_version') !== DATA_VERSION) return fallback;
    const saved = localStorage.getItem(nciKey) || localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const timestamp = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

const writeStoredCollection = (key, value) => {
  try {
    const nciKey = key.replace(/^cct_/, 'nci_');
    localStorage.setItem(nciKey, JSON.stringify(value));
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Local cache write skipped for ${key}:`, error);
  }
};

const updateKeepSignedInPreference = (keepSignedIn) => {
  try {
    if (keepSignedIn) localStorage.setItem(KEEP_SIGNED_IN_KEY, 'true');
    else localStorage.removeItem(KEEP_SIGNED_IN_KEY);
  } catch (error) {
    console.warn('Sign-in preference could not be stored:', error);
  }
};


const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

// Avatar URLs originate from Supabase Storage and are persisted in RTDB and
// localStorage before being bound to <img src>. Only well-formed https URLs
// are accepted so a tampered database or cache cannot inject other schemes.
const AVATAR_URL_PATTERN = /^https:\/\/[^\s"'<>\\]+$/i;
const sanitizeAvatarUrl = (url) => {
  const candidate = typeof url === 'string' ? url.trim() : '';
  return AVATAR_URL_PATTERN.test(candidate) ? candidate : '';
};

const collectionToArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => {
      if (item && typeof item === 'object') return { id: item.id || key, ...item };
      return { id: key, name: String(item), value: item };
    });
  }
  return [];
};

const collectionToMap = (items, prefix) => items.reduce((result, item, index) => {
  const id = String(item?.id || `${prefix}_${index + 1}`);
  result[id] = { ...item, id };
  return result;
}, {});

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
    status: record.status || RECORD_STATUS.APPROVED,
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

const validateRecordCollection = (items) => {
  const seen = new Set();
  for (let index = 0; index < items.length; index += 1) {
    const record = items[index] || {};
    const label = record.subjectCode || record.id || `record ${index + 1}`;
    const counts = ['enrolledCount', 'passedCount', 'failedCount', 'droppedCount', 'incCount']
      .map((field) => Number(record[field] ?? 0));
    if (!record.department || !record.academicYear || !record.semester || !record.subjectCode || !record.subjectTitle) {
      return `${label} is missing a required department, academic period, subject code, or subject title.`;
    }
    if (counts.some((count) => !Number.isInteger(count) || count < 0) || counts[0] <= 0) {
      return `${label} contains invalid student counts.`;
    }
    if (counts.slice(1).reduce((sum, count) => sum + count, 0) > counts[0]) {
      return `${label} classifies more outcomes than enrolled students.`;
    }
    const grade = Number(record.averageGrade);
    if (!Number.isFinite(grade) || grade < 1 || grade > 5) {
      return `${label} has an average grade outside the supported 1.00–5.00 range.`;
    }
    const duplicateKey = [record.department, record.programId || record.programName || '', normalizeAcademicYear(record.academicYear), record.semester, String(record.subjectCode).trim().toUpperCase()].join('|');
    if (seen.has(duplicateKey)) return `${label} duplicates another record in the same department, year, and semester.`;
    seen.add(duplicateKey);
  }
  return '';
};

const sha256 = async (text) => {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') return null;
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const AuthProvider = ({ children }) => {
  const [accounts, setAccounts] = useState(() => readStoredCollection('cct_accounts', []));
  const [records, setRecords] = useState(() => readStoredCollection('cct_records', []));
  const [backups, setBackups] = useState(() => readStoredCollection('cct_backups', []));
  const [auditLogs, setAuditLogs] = useState(() => readStoredCollection('cct_audit_logs', []));
  const [departments, setDepartments] = useState(() => readStoredCollection('cct_departments', []));
  const [programs, setPrograms] = useState(() => readStoredCollection('cct_programs', []));
  const [subjectCatalog, setSubjectCatalog] = useState(() => readStoredCollection('cct_subject_catalog', []));
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

  useEffect(() => {
    try {
      localStorage.setItem('nci_data_version', DATA_VERSION);
      localStorage.setItem('cct_data_version', DATA_VERSION);
    } catch (error) {
      console.warn('Local data-version cache write skipped:', error);
    }
    writeStoredCollection('cct_accounts', accounts);
  }, [accounts]);

  useEffect(() => {
    writeStoredCollection('cct_records', records);
  }, [records]);

  useEffect(() => {
    writeStoredCollection('cct_departments', departments);
  }, [departments]);

  useEffect(() => {
    writeStoredCollection('cct_programs', programs);
  }, [programs]);

  useEffect(() => {
    writeStoredCollection('cct_subject_catalog', subjectCatalog);
  }, [subjectCatalog]);

  useEffect(() => {
    const backupMetadata = backups.slice(0, 100).map((backup) => {
      const metadata = { ...backup };
      delete metadata.rawContent;
      return metadata;
    });
    writeStoredCollection('cct_backups', backupMetadata);
  }, [backups]);

  useEffect(() => {
    writeStoredCollection('cct_audit_logs', auditLogs.slice(0, 500));
  }, [auditLogs]);

  const parseRtdbSnapshot = (snapshot) => {
    if (!snapshot || !snapshot.exists()) return [];
    const value = snapshot.val();
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) {
      return value.filter(Boolean).map((item, index) => {
        if (typeof item === 'object' && item !== null) {
          return { id: item.id || `item_${index}`, ...item };
        }
        return item;
      });
    }
    if (typeof value === 'object' && value !== null) {
      return Object.keys(value).map((key) => {
        const item = value[key];
        if (typeof item === 'object' && item !== null) {
          return { id: item.id || key, ...item };
        }
        return { id: key, name: String(item), value: item };
      });
    }
    return [];
  };

  const resolveUserAvatarFromStorage = async (acc) => {
    if (!acc || !acc.id || acc.avatarUrl) return sanitizeAvatarUrl(acc?.avatarUrl);
    try {
      const { supabase, isSupabaseConfigured, BUCKET_NAME } = await import('../supabase/client');
      if (!isSupabaseConfigured || !supabase) return '';
      const { data: existingFiles } = await supabase.storage
        .from(BUCKET_NAME)
        .list('', { limit: 100 });
      const matchedFile = (existingFiles || []).find((f) => f.name && f.name.startsWith(acc.id));
      if (matchedFile) {
        const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(matchedFile.name);
        if (urlData?.publicUrl) {
          const resolvedUrl = `${urlData.publicUrl}?v=${Date.now()}`;
          try { localStorage.setItem(`nci_user_avatar_${acc.id}`, resolvedUrl); } catch { /* non-critical cache */ }
          if (isFirebaseInitialized && rtdb) {
            rtdbSet(rtdbRef(rtdb, `accounts/${acc.id}/avatarUrl`), resolvedUrl).catch(() => {});
          }
          return resolvedUrl;
        }
      }
    } catch (e) {
      console.warn('Avatar resolution from Supabase Storage skipped:', e);
    }
    return '';
  };

  const accountsRef = React.useRef(accounts);
  accountsRef.current = accounts;

  useEffect(() => {
    if (!isFirebaseInitialized || !rtdb || !auth) {
      setIsFirebaseConnected(false);
      setIsAuthResolving(false);
      return undefined;
    }

    const unsubConnection = onValue(
      rtdbRef(rtdb, '.info/connected'),
      (snapshot) => {
        const connected = snapshot.val() === true;
        setIsFirebaseConnected(connected);
        setDataSync((previous) => ({
          ...previous,
          status: connected ? ((previous.completedCollections?.length || 0) >= 8 ? 'live' : 'syncing') : 'offline'
        }));
      },
      () => {
        setIsFirebaseConnected(false);
        setDataSync((previous) => ({ ...previous, status: 'offline' }));
      }
    );

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setIsAuthResolving(false);
        return;
      }

      setIsAuthResolving(true);
      try {
        const snapshot = await rtdbGet(rtdbRef(rtdb, 'accounts'));
        let list = parseRtdbSnapshot(snapshot);

        list = list.map((acc) => ({
          ...acc,
          avatarUrl: sanitizeAvatarUrl(acc.avatarUrl || (acc.id ? localStorage.getItem(`nci_user_avatar_${acc.id}`) || '' : ''))
        }));

        accountsRef.current = list;
        setAccounts(list);
        let matched = list.find((account) => account.email?.toLowerCase() === firebaseUser.email?.toLowerCase());

        if (!matched || matched.status === 'Suspended') {
          setIsAuthenticated(false);
          setCurrentUser(null);
          await firebaseSignOut(auth);
          return;
        }

        if (!matched.avatarUrl && matched.id) {
          const resolvedAvatar = await resolveUserAvatarFromStorage(matched);
          if (resolvedAvatar) {
            matched = { ...matched, avatarUrl: resolvedAvatar };
            setAccounts((prev) => prev.map((a) => a.id === matched.id ? matched : a));
          }
        }

        setCurrentUser(matched);
        setIsAuthenticated(true);
      } catch (error) {
        console.warn('Account-directory verification failed:', error);
        setIsAuthenticated(false);
        setCurrentUser(null);
        await firebaseSignOut(auth).catch(() => {});
      } finally {
        setIsAuthResolving(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubConnection();
    };
  }, []);

  useEffect(() => {
    if (!isFirebaseInitialized || !rtdb || !auth || !isAuthenticated || !currentUser?.email) return undefined;

    let cancelled = false;
    const subscriptions = [];
    const expectedCollections = ['accounts', 'requests', 'departments', 'programs', 'subjects', 'backups', 'auditLogs', 'activityTicker'];
    const completed = new Set();
    const normalizationVersions = new Map();

    setDataSync((previous) => ({
      ...previous,
      status: isFirebaseConnected ? 'syncing' : 'offline',
      completedCollections: [],
      error: ''
    }));

    const markCollectionReady = (collection) => {
      completed.add(collection);
      const completedCollections = Array.from(completed);
      setDataSync((previous) => ({
        ...previous,
        status: completedCollections.length >= expectedCollections.length
          ? (isFirebaseConnected ? 'live' : 'offline')
          : (isFirebaseConnected ? 'syncing' : 'offline'),
        completedCollections,
        lastSyncedAt: new Date().toISOString(),
        error: ''
      }));
    };

    const handleReadError = (collection) => (error) => {
      console.warn(`RTDB ${collection} subscription:`, error);
      setDataSync((previous) => ({
        ...previous,
        status: isFirebaseConnected ? 'error' : 'offline',
        error: `${collection}: ${error?.message || 'Unable to synchronize collection.'}`
      }));
    };

    const normalizeAndApply = (collection, snapshot, fallback, apply) => {
      const version = (normalizationVersions.get(collection) || 0) + 1;
      normalizationVersions.set(collection, version);

      void normalizeSnapshotInBackground(collection, snapshot?.val(), fallback)
        .then((result) => {
          if (cancelled || normalizationVersions.get(collection) !== version) return;
          apply(result);
          markCollectionReady(collection);
        })
        .catch(handleReadError(collection));
    };

    const startSubscriptions = () => {
      if (cancelled) return;

      subscriptions.push(onValue(rtdbRef(rtdb, 'accounts'), async (snapshot) => {
        let list = parseRtdbSnapshot(snapshot);

        list = list.map((acc) => ({
          ...acc,
          avatarUrl: sanitizeAvatarUrl(acc.avatarUrl || (acc.id ? localStorage.getItem(`nci_user_avatar_${acc.id}`) || '' : ''))
        }));

        accountsRef.current = list;
        setAccounts(list);
        let matched = list.find((account) => account.email?.toLowerCase() === auth.currentUser?.email?.toLowerCase());
        if (!matched || matched.status === 'Suspended') {
          setIsAuthenticated(false);
          setCurrentUser(null);
          firebaseSignOut(auth).catch(console.warn);
          return;
        }

        if (matched.id && matched.avatarUrl) {
          try { localStorage.setItem(`nci_user_avatar_${matched.id}`, matched.avatarUrl); } catch { /* non-critical cache */ }
        } else if (matched.id && !matched.avatarUrl) {
          const resolvedAvatar = await resolveUserAvatarFromStorage(matched);
          if (resolvedAvatar) {
            matched = { ...matched, avatarUrl: resolvedAvatar };
            setAccounts((prev) => prev.map((a) => a.id === matched.id ? matched : a));
          }
        }

        const cachedAvatar = matched.id ? sanitizeAvatarUrl(localStorage.getItem(`nci_user_avatar_${matched.id}`)) : null;
        const finalAvatar = matched.avatarUrl || cachedAvatar || '';
        setCurrentUser({ ...matched, avatarUrl: finalAvatar });

        // Asynchronously check missing avatars for all directory accounts in background
        list.forEach((acc) => {
          if (acc.id && !acc.avatarUrl) {
            void resolveUserAvatarFromStorage(acc).then((resUrl) => {
              if (resUrl && !cancelled) {
                setAccounts((prev) => prev.map((item) => item.id === acc.id ? { ...item, avatarUrl: resUrl } : item));
              }
            });
          }
        });

        markCollectionReady('accounts');
      }, handleReadError('accounts')));

      subscriptions.push(onValue(rtdbRef(rtdb, 'requests'), (snapshot) => {
        normalizeAndApply(
          'requests',
          snapshot,
          (value) => normalizeRecordCollection(collectionToArray(value)),
          setRecords
        );
      }, handleReadError('requests')));

      subscriptions.push(onValue(rtdbRef(rtdb, 'departments'), (snapshot) => {
        normalizeAndApply(
          'departments',
          snapshot,
          (value) => normalizeDepartmentCollection(collectionToArray(value)),
          setDepartments
        );
      }, handleReadError('departments')));

      subscriptions.push(onValue(rtdbRef(rtdb, 'programs'), (snapshot) => {
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

      subscriptions.push(onValue(rtdbRef(rtdb, 'subjects'), (snapshot) => {
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

      subscriptions.push(onValue(rtdbQuery(rtdbRef(rtdb, 'backups'), limitToLast(100)), (snapshot) => {
        const list = parseRtdbSnapshot(snapshot).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        setBackups(list);
        markCollectionReady('backups');
      }, handleReadError('backups')));

      subscriptions.push(onValue(rtdbQuery(rtdbRef(rtdb, 'auditLogs'), limitToLast(500)), (snapshot) => {
        const list = parseRtdbSnapshot(snapshot).sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
        setAuditLogs(list);
        markCollectionReady('auditLogs');
      }, handleReadError('auditLogs')));

      subscriptions.push(onValue(rtdbQuery(rtdbRef(rtdb, 'activityTicker'), limitToLast(25)), (snapshot) => {
        setRtdbLiveTicker(parseRtdbSnapshot(snapshot).reverse().slice(0, 5));
        markCollectionReady('activityTicker');
      }, handleReadError('activityTicker')));
    };

    const cancelScheduledStart = scheduleBackgroundTask(startSubscriptions, 300);

    return () => {
      cancelled = true;
      cancelScheduledStart?.();
      subscriptions.forEach((unsubscribe) => unsubscribe?.());
    };
  }, [isAuthenticated, currentUser?.email, isFirebaseConnected]);

  const broadcastRealtimeActivity = (action, details) => {
    const item = {
      timestamp: new Date().toLocaleTimeString(),
      user: currentUser?.email || 'System',
      action,
      details
    };

    if (isFirebaseInitialized && rtdb) {
      rtdbPush(rtdbRef(rtdb, 'activityTicker'), item).catch((error) => {
        console.warn('RTDB activity broadcast:', error);
      });
    }

    setRtdbLiveTicker((previous) => [item, ...previous].slice(0, 5));
  };

  const addAuditLog = (action, details) => {
    const newLog = {
      id: `log_${Date.now()}`,
      timestamp: timestamp(),
      user: currentUser?.email || 'System',
      action,
      details
    };

    setAuditLogs((previous) => [newLog, ...previous].slice(0, 500));

    if (isFirebaseInitialized && rtdb) {
      rtdbSet(rtdbRef(rtdb, `auditLogs/${newLog.id}`), newLog).catch((error) => {
        console.warn('RTDB audit log write:', error);
      });
    }

    broadcastRealtimeActivity(action, details);
  };

  const syncRecord = (record) => {
    if (!isFirebaseInitialized || !rtdb) return;
    runBackgroundWrite('save academic record', () => rtdbSet(rtdbRef(rtdb, `requests/${record.id}`), record));
  };

  const loginWithEmail = async (email, password, keepSignedIn = false) => {
    if (!isFirebaseInitialized || !auth) {
      return { success: false, message: 'Firebase Auth service is not initialized.' };
    }

    try {
      if (keepSignedIn) {
        updateKeepSignedInPreference(true);
        await setPersistence(auth, browserLocalPersistence);
      } else {
        updateKeepSignedInPreference(false);
        await setPersistence(auth, inMemoryPersistence);
      }

      const credential = await signInWithEmailAndPassword(auth, email, password);
      const accountSnapshot = await rtdbGet(rtdbRef(rtdb, 'accounts'));
      let list = parseRtdbSnapshot(accountSnapshot);

      list = list.map((acc) => ({
        ...acc,
        avatarUrl: sanitizeAvatarUrl(acc.avatarUrl || (acc.id ? localStorage.getItem(`nci_user_avatar_${acc.id}`) || '' : ''))
      }));

      accountsRef.current = list;
      setAccounts(list);
      const matched = list.find((account) => account.email?.toLowerCase() === credential.user.email?.toLowerCase());

      if (!matched) {
        updateKeepSignedInPreference(false);
        await firebaseSignOut(auth);
        return { success: false, message: 'This Firebase user is not provisioned in the institutional accounts directory.' };
      }
      if (matched.status === 'Suspended') {
        updateKeepSignedInPreference(false);
        await firebaseSignOut(auth);
        return { success: false, message: 'This account has been suspended by VPAA.' };
      }

      setCurrentUser(matched);
      setIsAuthenticated(true);
      addAuditLog('Firebase Auth Sign In', `Signed in as ${email}`);
      return { success: true };
    } catch (error) {
      console.warn('Firebase Auth sign in failure:', error.code, error.message);
      let message = 'Invalid email or password.';
      if (error.code === 'auth/api-key-not-valid' || error.message?.includes('api-key-not-valid')) {
        message = 'Firebase API key is invalid. Please copy .env.example to .env.local and enter your real Firebase VITE_FIREBASE_API_KEY.';
      } else if (error.code === 'auth/invalid-email') message = 'Please enter a valid institutional email address.';
      else if (error.code === 'auth/user-disabled') message = 'This account has been disabled.';
      else if (error.code === 'auth/too-many-requests') message = 'Too many failed attempts. Please try again later.';
      else if (error.code === 'auth/network-request-failed') message = 'Network connection issue. Please check your internet connection.';
      else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        message = 'Invalid institutional email or password.';
      } else if (error.message) {
        message = error.message.replace(/^Firebase:\s*/, '');
      }
      return { success: false, message };
    }
  };


  const logout = async () => {
    updateKeepSignedInPreference(false);
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


  const addAccount = async (accountData) => {
    if (!permissions.canManageAccounts) return { success: false, message: 'Only the VPAA can create accounts.' };
    if (!isFirebaseInitialized || !rtdb) return { success: false, message: 'Firebase is not configured for account provisioning.' };

    const name = String(accountData?.name || '').trim();
    const email = String(accountData?.email || '').trim().toLowerCase();
    const password = String(accountData?.password || '');
    const role = accountData?.role;
    const department = String(accountData?.department || '').trim();
    const allowedRoles = ['VPAA', 'President', 'Deans', 'Heads'];

    if (!name || !department) return { success: false, message: 'Name and department scope are required.' };
    if (!/^[^\s@]+@college\.cvt\.edu$/i.test(email) && !/^[^\s@]+\.imus@college\.cvt\.edu$/i.test(email)) {
      return { success: false, message: 'Use a valid @college.cvt.edu institutional email address.' };
    }
    if (!allowedRoles.includes(role)) return { success: false, message: 'Select a supported institutional role.' };
    if (password.length < 6) return { success: false, message: 'Initial password must contain at least 6 characters.' };
    if (accounts.some((account) => account.email?.toLowerCase() === email)) {
      return { success: false, message: 'An account with this email already exists in the institutional directory.' };
    }

    const newAccount = {
      id: `usr_${Date.now()}`,
      name,
      email,
      role,
      department,
      status: 'Active',
      createdAt: new Date().toISOString().split('T')[0],
      lastLogin: 'Never'
    };

    let secondaryApp = null;
    let createdAuthUser = null;
    try {
      secondaryApp = initializeApp(firebaseConfig, `AuthWorker_${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      createdAuthUser = credential.user;

      await rtdbSet(rtdbRef(rtdb, `accounts/${newAccount.id}`), newAccount);
      setAccounts((previous) => [...previous, newAccount]);
      addAuditLog('Create Account', `Created account ${newAccount.email} (${newAccount.role})`);
      return { success: true, account: newAccount };
    } catch (error) {
      if (createdAuthUser) await deleteUser(createdAuthUser).catch(() => {});
      let message = 'Account provisioning failed.';
      if (error.code === 'auth/email-already-in-use') message = 'An account with this email already exists in Firebase Authentication.';
      else if (error.code === 'auth/weak-password') message = 'Password should be at least 6 characters.';
      else if (error.code === 'auth/invalid-email') message = 'Invalid email address format.';
      else if (error.code === 'PERMISSION_DENIED' || error.code === 'permission-denied') message = 'Firebase rejected the institutional directory write. Review Realtime Database rules.';
      else if (error.message) message = error.message.replace(/^Firebase:\s*/, '');
      return { success: false, message };
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp).catch(() => {});
    }
  };

  const updateAccount = async (id, updatedData) => {
    const existing = accounts.find((account) => account.id === id);
    if (!existing) return { success: false, message: 'Account not found.' };

    const isSelfUpdate = currentUser?.id === id;
    if (!permissions.canManageAccounts && !isSelfUpdate) {
      return { success: false, message: 'You can only update your own display name.' };
    }

    if (hasOwn(updatedData, 'email') && String(updatedData.email).trim().toLowerCase() !== existing.email?.toLowerCase()) {
      return { success: false, message: 'Institutional email changes must be completed in Firebase Authentication before updating the directory.' };
    }

    const safeData = permissions.canManageAccounts
      ? {
          name: String(updatedData.name ?? existing.name).trim(),
          role: updatedData.role ?? existing.role,
          department: String(updatedData.department ?? existing.department).trim(),
          avatarUrl: updatedData.avatarUrl !== undefined ? sanitizeAvatarUrl(updatedData.avatarUrl) : (existing.avatarUrl || '')
        }
      : {
          name: String(updatedData.name ?? existing.name).trim(),
          avatarUrl: updatedData.avatarUrl !== undefined ? sanitizeAvatarUrl(updatedData.avatarUrl) : (existing.avatarUrl || '')
        };

    if (!safeData.name) return { success: false, message: 'Display name cannot be empty.' };
    if (permissions.canManageAccounts && (!safeData.department || !['VPAA', 'President', 'Deans', 'Heads'].includes(safeData.role))) {
      return { success: false, message: 'A supported role and department scope are required.' };
    }

    const updatedAccount = { ...existing, ...safeData };
    try {
      if (isFirebaseInitialized && rtdb) await rtdbSet(rtdbRef(rtdb, `accounts/${id}`), updatedAccount);
    } catch (error) {
      console.warn('RTDB account update note:', error);
    }
    setAccounts((previous) => previous.map((account) => account.id === id ? updatedAccount : account));
    if (isSelfUpdate) {
      setCurrentUser(updatedAccount);
      if (updatedAccount.avatarUrl) {
        try { localStorage.setItem(`nci_user_avatar_${id}`, updatedAccount.avatarUrl); } catch { /* non-critical cache */ }
      }
    }
    addAuditLog('Update Account', `Updated profile for ${updatedAccount.email}`);
    return { success: true, account: updatedAccount };
  };

  const compressImageForAvatar = (file, maxSize = 1024) => {
    return new Promise((resolve) => {
      if (!file || !file.type || !file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        const targetSize = Math.min(minDim, maxSize);

        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const resizedFile = new File([blob], (file.name || 'avatar').replace(/\.[^/.]+$/, '') + '.jpg', {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(resizedFile);
          },
          'image/jpeg',
          0.92
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  };

  const uploadAvatar = async (file) => {
    if (!currentUser?.id) return { success: false, message: 'Must be logged in to upload avatar.' };
    if (!file) return { success: false, message: 'No file selected.' };

    try {
      const { supabase, isSupabaseConfigured, BUCKET_NAME } = await import('../supabase/client');
      if (!isSupabaseConfigured || !supabase) {
        return {
          success: false,
          message: 'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
        };
      }

      // 1. Compress high-res mobile photos (iPhone HEIC/JPEG or Android Camera photos)
      const compressedFile = await compressImageForAvatar(file);

      // 2. Delete all previous avatar files belonging to this user in Supabase Storage across all file extensions
      try {
        const defaultExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        const targetFiles = defaultExts.map((ext) => `${currentUser.id}.${ext}`);

        const { data: existingFiles } = await supabase.storage
          .from(BUCKET_NAME)
          .list('', { limit: 100 });

        const listedFiles = (existingFiles || [])
          .filter((f) => f.name && f.name.startsWith(currentUser.id))
          .map((f) => f.name);

        const filesToRemove = Array.from(new Set([...targetFiles, ...listedFiles]));

        if (filesToRemove.length > 0) {
          const { error: removeErr } = await supabase.storage
            .from(BUCKET_NAME)
            .remove(filesToRemove);

          if (removeErr) {
            console.warn('Supabase storage remove note:', removeErr.message);
          }
        }
      } catch (cleanupErr) {
        console.warn('Supabase storage old file list/remove cleanup note:', cleanupErr);
      }

      // 3. Upload the new compressed profile picture file
      const rawExt = (compressedFile.name || file.name || 'avatar.jpg').split('.').pop() || 'jpg';
      const fileExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const filePath = `${currentUser.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, compressedFile, { upsert: true, cacheControl: '0', contentType: compressedFile.type || 'image/jpeg' });

      if (uploadError) {
        return { success: false, message: uploadError.message || 'Supabase Storage upload failed.' };
      }

      const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
      const baseUrl = urlData?.publicUrl;

      if (!baseUrl) {
        return { success: false, message: 'Could not obtain public URL for uploaded profile picture.' };
      }

      // Add timestamp cache-buster so browsers immediately reload updated avatars
      const avatarUrl = `${baseUrl}?v=${Date.now()}`;

      // Cache avatar URL locally by user ID only
      if (currentUser.id) {
        try { localStorage.setItem(`nci_user_avatar_${currentUser.id}`, avatarUrl); } catch { /* non-critical cache */ }
      }

      const result = await updateAccount(currentUser.id, { avatarUrl });

      return result.success
        ? { success: true, avatarUrl, message: 'Profile picture updated and previous files removed.' }
        : result;
    } catch (err) {
      console.warn('Supabase Avatar Upload Error:', err);
      return { success: false, message: err.message || 'Failed to upload profile picture.' };
    }
  };

  const toggleAccountStatus = async (id) => {
    if (!permissions.canManageAccounts) return { success: false, message: 'Only the VPAA can change account status.' };
    const existing = accounts.find((account) => account.id === id);
    if (!existing) return { success: false, message: 'Account not found.' };
    if (existing.id === currentUser?.id) return { success: false, message: 'The active VPAA account cannot suspend itself.' };

    const updatedAccount = {
      ...existing,
      status: existing.status === 'Active' ? 'Suspended' : 'Active'
    };

    try {
      if (isFirebaseInitialized && rtdb) await rtdbSet(rtdbRef(rtdb, `accounts/${id}`), updatedAccount);
      setAccounts((previous) => previous.map((account) => account.id === id ? updatedAccount : account));
      addAuditLog('Account Status Changed', `Set ${updatedAccount.email} to ${updatedAccount.status}`);
      return { success: true, account: updatedAccount };
    } catch (error) {
      console.warn('RTDB account status update:', error);
      return { success: false, message: 'Firebase rejected the account status change.' };
    }
  };

  const isRecordInUserDepartment = (record) => record?.department === currentUser?.department;
  const isRecordOwner = (record) => record?.encodedById === currentUser?.id || record?.encodedBy === currentUser?.name;

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

  const addRecord = (recordData) => {
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

    const newRecord = {
      id: `rec_${Date.now()}`,
      ...recordData,
      ...numbers,
      subjectCode: recordData.subjectCode.trim().toUpperCase().replace(/\s+/g, ' '),
      subjectTitle: recordData.subjectTitle.trim(),
      academicYear: normalizeAcademicYear(recordData.academicYear),
      encodedBy: currentUser.name,
      encodedById: currentUser.id,
      updatedAt: new Date().toISOString().split('T')[0],
      status,
      submittedAt: isSubmittedForApproval ? now : '',
      approvedBy: status === RECORD_STATUS.APPROVED ? currentUser.name : '',
      approvedAt: status === RECORD_STATUS.APPROVED ? now : '',
      reviewNote: status === RECORD_STATUS.APPROVED ? 'Created by an authorized approver.' : ''
    };

    setRecords((previous) => [newRecord, ...previous]);
    syncRecord(newRecord);
    addAuditLog(
      isSubmittedForApproval ? 'Record Submitted for Dean Approval' : 'Record Approved and Encoded',
      `${newRecord.subjectCode} (${newRecord.department})`
    );
    return { success: true, record: newRecord };
  };

  const updateRecord = (id, updatedData) => {
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
      updatedAt: new Date().toISOString().split('T')[0]
    };

    if (permissions.isHead) {
      updatedRecord.status = RECORD_STATUS.PENDING;
      updatedRecord.submittedAt = timestamp();
      updatedRecord.approvedBy = '';
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
        updatedRecord.approvedAt = existing.status === RECORD_STATUS.APPROVED && existing.approvedAt
          ? existing.approvedAt
          : now;
      } else {
        updatedRecord.approvedBy = '';
        updatedRecord.approvedAt = '';
        if (updatedRecord.status === RECORD_STATUS.PENDING) updatedRecord.submittedAt = now;
      }
    }

    setRecords((previous) => previous.map((record) => record.id === id ? updatedRecord : record));
    syncRecord(updatedRecord);
    addAuditLog(
      permissions.isHead ? 'Record Revised and Resubmitted' : 'Record Updated',
      `${updatedRecord.subjectCode} (${updatedRecord.department})`
    );
    return { success: true, record: updatedRecord };
  };

  const reviewRecord = (id, decision, note = '') => {
    const existing = records.find((record) => record.id === id);
    if (!existing) return { success: false, message: 'Record not found.' };
    if (!canApproveRecord(existing)) return { success: false, message: 'You do not have approval authority for this record.' };

    const approved = decision === RECORD_STATUS.APPROVED || decision === 'approve';
    const updatedRecord = {
      ...existing,
      status: approved ? RECORD_STATUS.APPROVED : RECORD_STATUS.RETURNED,
      approvedBy: approved ? currentUser.name : '',
      approvedAt: approved ? timestamp() : '',
      reviewedBy: currentUser.name,
      reviewedAt: timestamp(),
      reviewNote: note.trim() || (approved ? 'Reviewed and approved.' : 'Returned for revision.'),
      updatedAt: new Date().toISOString().split('T')[0]
    };

    setRecords((previous) => previous.map((record) => record.id === id ? updatedRecord : record));
    syncRecord(updatedRecord);
    addAuditLog(
      approved ? 'Record Approved' : 'Record Returned for Revision',
      `${updatedRecord.subjectCode} reviewed by ${currentUser.name}`
    );
    return { success: true, record: updatedRecord };
  };

  const deleteRecord = (id) => {
    const target = records.find((record) => record.id === id);
    if (!target) return { success: false, message: 'Record not found.' };
    if (!canDeleteRecord(target)) return { success: false, message: 'You do not have permission to delete this record.' };

    setRecords((previous) => previous.filter((record) => record.id !== id));
    if (isFirebaseInitialized && rtdb) {
      runBackgroundWrite('remove academic record', () => rtdbRemove(rtdbRef(rtdb, `requests/${id}`)));
    }
    addAuditLog('Record Deleted', `Deleted ${target.subjectCode} (${target.department})`);
    return { success: true };
  };

  const createBackup = async (type = 'Manual Export') => {
    if (!permissions.canManageBackups) return { success: false, message: 'Only the VPAA can create system backups.' };

    try {
      const now = new Date();
      const timestampString = timestamp();
      const dateCode = now.toISOString().split('T')[0].replace(/-/g, '');
      const snapshotData = {
        accounts,
        records,
        auditLogs,
        departments,
        programs,
        subjectCatalog,
        exportedAt: timestampString,
        version: DATA_VERSION,
        college: 'Natsuki College of Imus'
      };
      const jsonString = JSON.stringify(snapshotData, null, 2);
      const digest = await sha256(jsonString);
      const checksumSuffix = digest || `unavailable-${Date.now().toString(16)}`;

      const canSynchronize = isFirebaseInitialized && rtdb && isFirebaseConnected;
      const newBackup = {
        id: `bkp_${Date.now()}`,
        fileName: `nci_academic_db_${dateCode}_${checksumSuffix.slice(0, 8)}.json`,
        fileSize: `${(new Blob([jsonString]).size / 1024).toFixed(2)} KB`,
        createdAt: timestampString,
        type,
        status: canSynchronize ? 'Completed' : 'Local Export',
        createdBy: currentUser.name,
        checksum: digest ? `sha256-${digest}` : checksumSuffix,
        rawContent: jsonString
      };

      setBackups((previous) => [newBackup, ...previous].slice(0, 100));
      if (canSynchronize) {
        await rtdbSet(rtdbRef(rtdb, `backups/${newBackup.id}`), newBackup);
      }
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
    if (!permissions.canManageBackups) return { success: false, message: 'Only the VPAA can restore system data.' };
    if (isFirebaseInitialized && rtdb && !isFirebaseConnected) {
      return { success: false, message: 'Firebase is offline. Reconnect before restoring to prevent local and remote data from diverging.' };
    }

    try {
      const rawJson = typeof backupJsonData === 'string' ? backupJsonData : JSON.stringify(backupJsonData);
      if (expectedChecksum?.startsWith('sha256-')) {
        const actualDigest = await sha256(rawJson);
        if (actualDigest && `sha256-${actualDigest}` !== expectedChecksum) {
          return { success: false, message: 'Snapshot checksum verification failed. The file may be incomplete or modified.' };
        }
      }
      const parsed = typeof backupJsonData === 'string' ? JSON.parse(backupJsonData) : backupJsonData;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { success: false, message: 'The selected file is not a supported database snapshot.' };
      }

      const includesAccounts = hasOwn(parsed, 'accounts');
      const includesRecords = hasOwn(parsed, 'records') || hasOwn(parsed, 'requests');
      const includesAuditLogs = hasOwn(parsed, 'auditLogs');
      const includesDepartments = hasOwn(parsed, 'departments');
      const includesPrograms = hasOwn(parsed, 'programs');
      const includesSubjects = hasOwn(parsed, 'subjectCatalog') || hasOwn(parsed, 'subjects');

      if (![includesAccounts, includesRecords, includesAuditLogs, includesDepartments, includesPrograms, includesSubjects].some(Boolean)) {
        return { success: false, message: 'No supported accounts, requests, records, departments, programs, subjects, or audit logs were found.' };
      }

      const nextAccounts = includesAccounts ? collectionToArray(parsed.accounts) : null;
      const rawRecords = includesRecords
        ? collectionToArray(hasOwn(parsed, 'records') ? parsed.records : parsed.requests)
        : null;
      const recordValidationError = includesRecords ? validateRecordCollection(rawRecords) : '';
      if (recordValidationError) return { success: false, message: `Restore validation failed: ${recordValidationError}` };
      const nextRecords = includesRecords ? normalizeRecordCollection(rawRecords) : null;
      const nextAuditLogs = includesAuditLogs ? collectionToArray(parsed.auditLogs) : null;
      const nextDepartmentItems = includesDepartments ? collectionToArray(parsed.departments) : null;
      const nextDepartments = includesDepartments ? normalizeDepartmentCollection(nextDepartmentItems) : null;
      const nextPrograms = includesPrograms ? collectionToArray(parsed.programs) : null;
      const nextSubjects = includesSubjects
        ? collectionToArray(hasOwn(parsed, 'subjectCatalog') ? parsed.subjectCatalog : parsed.subjects)
        : null;

      if (isFirebaseInitialized && rtdb) {
        const updates = {};
        if (includesAccounts) updates.accounts = nextAccounts.length ? collectionToMap(nextAccounts, 'usr') : null;
        if (includesRecords) updates.requests = nextRecords.length ? collectionToMap(nextRecords, 'rec') : null;
        if (includesAuditLogs) updates.auditLogs = nextAuditLogs.length ? collectionToMap(nextAuditLogs, 'log') : null;
        if (includesDepartments) {
          const departmentObjects = nextDepartmentItems.map((item, index) => typeof item === 'string'
            ? { id: `dept_${index + 1}`, name: item }
            : { ...item, id: item.id || `dept_${index + 1}`, name: item.name || item.value || item.id });
          updates.departments = departmentObjects.length ? collectionToMap(departmentObjects, 'dept') : null;
        }
        if (includesPrograms) updates.programs = nextPrograms.length ? collectionToMap(nextPrograms, 'prog') : null;
        if (includesSubjects) updates.subjects = nextSubjects.length ? collectionToMap(nextSubjects, 'subj') : null;
        await rtdbUpdate(rtdbRef(rtdb), updates);
      }

      if (includesAccounts) setAccounts(nextAccounts);
      if (includesRecords) setRecords(nextRecords);
      if (includesAuditLogs) setAuditLogs(nextAuditLogs);
      if (includesDepartments) setDepartments(nextDepartments);
      if (includesPrograms) setPrograms(nextPrograms);
      if (includesSubjects) setSubjectCatalog(nextSubjects);

      addAuditLog('System Restore', `Restored supported snapshot collections at ${timestamp()}`);
      return {
        success: true,
        message: `Database restore completed (${[
          includesAccounts && 'accounts',
          includesRecords && 'records',
          includesDepartments && 'departments',
          includesPrograms && 'programs',
          includesSubjects && 'subjects',
          includesAuditLogs && 'audit logs'
        ].filter(Boolean).join(', ')}).`
      };
    } catch (error) {
      console.error('Restoration error:', error);
      return { success: false, message: 'The backup file is invalid or Firebase rejected the restore operation.' };
    }
  };

  const runBackgroundWrite = (label, task) => {
    setDataSync((previous) => ({
      ...previous,
      status: isFirebaseConnected ? 'syncing' : 'offline',
      pendingWrites: (previous.pendingWrites || 0) + 1,
      error: ''
    }));

    Promise.resolve()
      .then(task)
      .then(() => {
        setDataSync((previous) => ({
          ...previous,
          status: isFirebaseConnected ? 'live' : 'offline',
          pendingWrites: Math.max(0, (previous.pendingWrites || 1) - 1),
          lastSyncedAt: new Date().toISOString(),
          error: ''
        }));
      })
      .catch((error) => {
        console.warn(`Background write failed (${label}):`, error);
        setDataSync((previous) => ({
          ...previous,
          status: isFirebaseConnected ? 'error' : 'offline',
          pendingWrites: Math.max(0, (previous.pendingWrites || 1) - 1),
          error: error?.message || `${label} could not be synchronized.`
        }));
      });
  };

  const addDepartment = (name) => {
    if (!permissions.isVPAA) return { success: false, message: 'Only the VPAA can create new departments.' };
    const trimmed = name?.trim();
    if (!trimmed) return { success: false, message: 'Department name cannot be empty.' };
    if (departments.some((departmentName) => String(departmentName).toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, message: 'This department already exists.' };
    }

    const department = { id: `dept_${Date.now()}`, name: trimmed };
    setDepartments((previous) => [...previous, trimmed]);
    if (isFirebaseInitialized && rtdb) {
      runBackgroundWrite('add department', () => rtdbSet(rtdbRef(rtdb, `departments/${department.id}`), department));
    }
    addAuditLog('Add Department', `VPAA created department: ${trimmed}`);
    return { success: true, department: trimmed };
  };

  const deleteDepartment = (name) => {
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

    setDepartments((previous) => previous.filter((departmentName) => departmentName !== name));
    if (isFirebaseInitialized && rtdb) {
      runBackgroundWrite('remove department', async () => {
        const snapshot = await rtdbGet(rtdbRef(rtdb, 'departments'));
        if (!snapshot.exists()) return;
        const value = snapshot.val();
        const match = Object.entries(value || {}).find(([key, item]) => (
          (typeof item === 'string' && item === name) || item?.name === name || item?.id === name || key === name
        ));
        if (match) await rtdbRemove(rtdbRef(rtdb, `departments/${match[0]}`));
      });
    }
    addAuditLog('Remove Department', `VPAA removed department: ${name}`);
    return { success: true };
  };

  const addProgram = ({ code, name, department }) => {
    if (!permissions.isVPAA) return { success: false, message: 'Only the VPAA can add academic programs.' };
    const normalizedCode = String(code || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const trimmedName = String(name || '').trim();
    const trimmedDepartment = String(department || '').trim();
    if (!trimmedName || !trimmedDepartment) {
      return { success: false, message: 'Program name and academic unit are required.' };
    }
    if (!departments.includes(trimmedDepartment)) {
      return { success: false, message: 'Select an academic unit that exists in the database.' };
    }
    const duplicate = programs.some((program) => program.department === trimmedDepartment && (
      program.name?.trim().toLowerCase() === trimmedName.toLowerCase()
      || (normalizedCode && String(program.code || '').trim().toUpperCase() === normalizedCode)
    ));
    if (duplicate) return { success: false, message: 'This program name or code already exists in the selected academic unit.' };

    const newProgram = {
      id: `prog_${Date.now()}`,
      code: normalizedCode,
      name: trimmedName,
      department: trimmedDepartment,
      status: 'Active',
      createdAt: timestamp(),
      updatedAt: timestamp()
    };
    setPrograms((previous) => [...previous, newProgram]);
    if (isFirebaseInitialized && rtdb) {
      runBackgroundWrite('add program', () => rtdbSet(rtdbRef(rtdb, `programs/${newProgram.id}`), newProgram));
    }
    addAuditLog('Add Academic Program', `Added ${newProgram.code ? `${newProgram.code} - ` : ''}${newProgram.name} (${newProgram.department})`);
    return { success: true, program: newProgram };
  };

  const deleteProgram = (id) => {
    if (!permissions.isVPAA) return { success: false, message: 'Only the VPAA can remove academic programs.' };
    const target = programs.find((program) => program.id === id);
    if (!target) return { success: false, message: 'Program not found.' };
    const subjectReference = subjectCatalog.some((subject) => subject.programId === id);
    if (subjectReference) {
      return { success: false, message: 'Remove or reassign the subjects linked to this program before deleting it.' };
    }

    setPrograms((previous) => previous.filter((program) => program.id !== id));
    if (isFirebaseInitialized && rtdb) {
      runBackgroundWrite('remove program', () => rtdbRemove(rtdbRef(rtdb, `programs/${id}`)));
    }
    addAuditLog('Remove Academic Program', `Removed ${target.code ? `${target.code} - ` : ''}${target.name}`);
    return { success: true };
  };

  const addSubjectToCatalog = ({ code, title, department, programId = '' }) => {
    if (!permissions.isVPAA) return { success: false, message: 'Only the VPAA can add subjects to the catalog.' };
    const normalizedCode = String(code || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const trimmedTitle = String(title || '').trim();
    const trimmedDepartment = String(department || '').trim();
    if (!normalizedCode || !trimmedTitle || !trimmedDepartment) {
      return { success: false, message: 'Subject code, title, and academic unit are required.' };
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

    const newSubject = {
      id: `subj_${Date.now()}`,
      code: normalizedCode,
      title: trimmedTitle,
      department: trimmedDepartment,
      programId: selectedProgram?.id || '',
      programName: selectedProgram?.name || '',
      createdAt: timestamp(),
      updatedAt: timestamp()
    };
    setSubjectCatalog((previous) => [...previous, newSubject]);
    if (isFirebaseInitialized && rtdb) {
      runBackgroundWrite('add subject', () => rtdbSet(rtdbRef(rtdb, `subjects/${newSubject.id}`), newSubject));
    }
    addAuditLog(
      'Add Subject/Course',
      `Added ${newSubject.code} - ${newSubject.title} (${newSubject.programName || 'Department-wide'} / ${newSubject.department})`
    );
    return { success: true, subject: newSubject };
  };

  const deleteSubjectFromCatalog = (id) => {
    if (!permissions.isVPAA) return { success: false, message: 'Only the VPAA can remove subjects.' };
    const target = subjectCatalog.find((subject) => subject.id === id);
    if (!target) return { success: false, message: 'Subject not found.' };

    setSubjectCatalog((previous) => previous.filter((subject) => subject.id !== id));
    if (isFirebaseInitialized && rtdb) {
      runBackgroundWrite('remove subject', () => rtdbRemove(rtdbRef(rtdb, `subjects/${id}`)));
    }
    addAuditLog('Remove Subject/Course', `Removed subject ${target.code} - ${target.title}`);
    return { success: true };
  };

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
        isAuthResolving,
        dataSync,
        permissions,
        inactivityNotice,
        clearInactivityNotice,
        loginWithEmail,
        logout,
        addAccount,
        updateAccount,
        uploadAvatar,
        toggleAccountStatus,
        addDepartment,
        deleteDepartment,
        addProgram,
        deleteProgram,
        addSubjectToCatalog,
        deleteSubjectFromCatalog,
        addRecord,
        updateRecord,
        reviewRecord,
        deleteRecord,
        canEditRecord,
        canDeleteRecord,
        canApproveRecord,
        createBackup,
        restoreBackup,
        addAuditLog
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
