import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { initializeFirebaseServices, initializeFirebaseAnalytics } from '../services/firebaseSafety';

// User-selected public SDK configuration. Environment flags cannot switch projects.
const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyABXspXcQOGHxVCHTM5IdNp6XIazui1CVk",
  authDomain: "academicdashboarddata.firebaseapp.com",
  databaseURL: "https://academicdashboarddata-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "academicdashboarddata",
  storageBucket: "academicdashboarddata.firebasestorage.app",
  messagingSenderId: "220617074534",
  appId: "1:220617074534:web:db3aa2fcd106ef72e8caa7",
  measurementId: "G-3VR70C544M"
});

const KEEP_SIGNED_IN_KEY = `${firebaseConfig.projectId}:cct_keep_signed_in`;

let keepSignedIn = false;
try { keepSignedIn = localStorage.getItem(KEEP_SIGNED_IN_KEY) === 'true'; } catch { /* Optional preference. */ }
const { app, auth, rtdb, functions, initializationError: firebaseInitializationError } = initializeFirebaseServices(firebaseConfig, {
  initializeApp, getApps, getApp, initializeAuth, getAuth, browserLocalPersistence, browserSessionPersistence,
  getDatabase, getFunctions, initializeAppCheck, ReCaptchaEnterpriseProvider
}, { keepSignedIn, appCheckSiteKey: import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY || '' });
if (firebaseInitializationError) console.error('CCT Firebase initialization failed.', { code: firebaseInitializationError?.code || 'firebase/initialization-failed' });
const isCctAdminServiceEnabled = import.meta.env.VITE_CCT_SERVER_FUNCTIONS_ENABLED === 'true';
const isFirebaseInitialized = Boolean(app && auth && rtdb);
// Analytics support varies by browser; it must not block authentication/data access.
let analytics = null;
const analyticsReady = initializeFirebaseAnalytics(app, { getAnalytics, isSupported }).then(instance => {
  analytics = instance;
  return instance;
});

export { app, auth, rtdb, functions, analytics, analyticsReady, firebaseConfig, isFirebaseInitialized, firebaseInitializationError, isCctAdminServiceEnabled, KEEP_SIGNED_IN_KEY };
