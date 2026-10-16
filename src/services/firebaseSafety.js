// Missing collections are normal. Invalid payloads and denied reads are errors.
export function firebaseCollectionRows(value, { allowStrings = false } = {}) {
  if (value == null) return [];
  if (typeof value !== 'object') throw invalidData();
  const array = Array.isArray(value);
  return Object.entries(value).flatMap(([key, row]) => {
    if (row == null) return [];
    if (allowStrings && typeof row === 'string') return [{ id: key, name: row, value: row }];
    if (typeof row !== 'object' || Array.isArray(row)) throw invalidData();
    return [{ ...row, id: array ? row.id || `item_${key}` : key }];
  });
}
const invalidData = () => Object.assign(new Error('CCT received an invalid database collection.'), { code: 'firebase/invalid-data' });

export function firebaseErrorMessage(error, action = 'load') {
  const code = String(error?.code || '').toLowerCase().replaceAll('_', '-');
  if (code.includes('permission-denied') || code.includes('unauthorized')) return action === 'load'
    ? 'You do not have permission to load this CCT data. Contact the CCT administrator.'
    : 'CCT rejected this change. Check your access, field values, and linked records, or contact the CCT administrator.';
  if (code.includes('invalid-data')) return 'CCT received an invalid database collection. Contact the CCT administrator to check this data.';
  if (code.includes('not-found')) return 'This CCT entry no longer exists. Refresh the list before continuing.';
  if (code.includes('read-timeout') || code.includes('network') || code.includes('disconnected') || code.includes('unavailable')) return 'The CCT connection could not complete this request. Reconnect and try again.';
  return `CCT could not ${action} this data. Try again or contact the CCT administrator.`;
}

// Public action boundary: a rejected/missing response never becomes a success toast.
export async function firebaseOperationResult(operation, action = 'save', requiredObject = '') {
  try {
    const result = await operation();
    if (typeof result?.success !== 'boolean' || (result.success && requiredObject && (!result[requiredObject] || typeof result[requiredObject] !== 'object'))) {
      return { success: false, message: 'CCT received an incomplete response. Refresh the current data before retrying.' };
    }
    return result;
  } catch (error) { return { success: false, message: firebaseErrorMessage(error, action) }; }
}

// Covers source creation, subscription setup, and both sync/async snapshot callbacks.
export function subscribeSafely(subscribe, createSource, onData, onError) {
  let disposed = false;
  let unsubscribe;
  const report = (error) => {
    if (disposed) return;
    try { onError(error); }
    catch { console.error('CCT could not display a Firebase subscription error.'); }
  };
  try {
    unsubscribe = subscribe(createSource(), (snapshot) => {
      if (disposed) return;
      try {
        const result = onData(snapshot);
        if (result?.then) Promise.resolve(result).catch(report);
      } catch (error) { report(error); }
    }, report);
  } catch (error) { report(error); }
  return () => {
    disposed = true;
    try { unsubscribe?.(); }
    catch { console.warn('CCT Firebase listener cleanup could not be completed.'); }
  };
}

// Read deadlines cannot create uncertain writes. Never use this to time out a commit.
export async function withFirebaseReadDeadline(read, timeoutMs = 30000) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('CCT database read timed out.'), { code: 'firebase/read-timeout' })), timeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
}

export function initializeFirebaseServices(config, sdk, { keepSignedIn = false, appCheckSiteKey = '' } = {}) {
  try {
    const app = sdk.getApps().some((existing) => existing.name === '[DEFAULT]') ? sdk.getApp() : sdk.initializeApp(config);
    for (const field of ['projectId', 'databaseURL', 'appId']) {
      if (config[field] && app.options?.[field] !== config[field]) {
        throw Object.assign(new Error('The initialized Firebase app does not match the selected project.'), { code: 'firebase/project-mismatch' });
      }
    }
    if (appCheckSiteKey) sdk.initializeAppCheck(app, {
      provider: new sdk.ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true
    });
    let auth;
    try { auth = sdk.initializeAuth(app, { persistence: keepSignedIn ? sdk.browserLocalPersistence : sdk.browserSessionPersistence }); }
    catch (error) {
      if (error?.code !== 'auth/already-initialized') throw error;
      auth = sdk.getAuth(app);
    }
    return { app, auth, rtdb: sdk.getDatabase(app), functions: sdk.getFunctions(app, 'asia-southeast1'), initializationError: null };
  } catch (error) {
    return { app: null, auth: null, rtdb: null, functions: null, initializationError: error };
  }
}

export async function initializeFirebaseAnalytics(app, sdk) {
  try {
    if (!app || !await sdk.isSupported()) return null;
    return sdk.getAnalytics(app);
  } catch {
    return null;
  }
}
