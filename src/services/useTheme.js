import { useEffect, useLayoutEffect, useState } from 'react';
import { readPreference, writePreference } from './userPreferences';

export const THEME_OPTIONS = [
  { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Use System Settings' }
];
export function useTheme(userId) {
  const [theme, setTheme] = useState('light');
  const [readyFor, setReadyFor] = useState(null);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useLayoutEffect(() => {
    const saved = userId ? readPreference(userId, 'theme', 'light') : 'light';
    setTheme(['light', 'dark', 'system'].includes(saved) ? saved : 'light'); setReadyFor(userId);
  }, [userId]);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const changed = (event) => setSystemDark(event.matches);
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemDark);
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDarkMode ? '#23282b' : '#edf0ef');
  }, [isDarkMode]);
  useEffect(() => { if (userId && readyFor === userId) writePreference(userId, 'theme', theme); }, [userId, readyFor, theme]);
  return { theme, setTheme, isDarkMode };
}
