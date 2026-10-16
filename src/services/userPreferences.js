import { firebaseConfig } from '../firebase/config';

const prefKey = (userId, key) => `${firebaseConfig.projectId}:preferences:${encodeURIComponent(userId || 'guest')}:${key}`;
export const readPreference = (userId, key, fallback) => {
  try {
    const value = localStorage.getItem(prefKey(userId, key));
    return value !== null ? value : fallback;
  } catch { return fallback; }
};
export const writePreference = (userId, key, value) => {
  if (!userId) return;
  try { localStorage.setItem(prefKey(userId, key), String(value)); } catch { /* Preferences are optional. */ }
};
