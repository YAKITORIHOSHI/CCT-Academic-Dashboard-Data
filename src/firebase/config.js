import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence, inMemoryPersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Natsuki College of Imus Firebase configuration.
// Values are injected at build time from .env.local — never hardcode them here.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || ''
};

const missingFirebaseVars = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => `VITE_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
if (missingFirebaseVars.length > 0) {
  console.warn(
    `Firebase configuration is incomplete. Copy .env.example to .env.local and provide: ${missingFirebaseVars.join(', ')}`
  );
}

const KEEP_SIGNED_IN_KEY = 'cct_keep_signed_in';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth;
try {
  auth = getAuth(app);
} catch {
  try {
    const userWantsToStaySignedIn = typeof window !== 'undefined' && localStorage.getItem(KEEP_SIGNED_IN_KEY) === 'true';
    auth = initializeAuth(app, {
      persistence: userWantsToStaySignedIn ? browserLocalPersistence : inMemoryPersistence
    });
  } catch {
    auth = getAuth(app);
  }
}

const rtdb = getDatabase(app);
const isFirebaseInitialized = Boolean(app && auth && rtdb);

export { app, auth, rtdb, firebaseConfig, isFirebaseInitialized, KEEP_SIGNED_IN_KEY };
