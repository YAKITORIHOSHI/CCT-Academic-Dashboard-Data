import { readPreference, writePreference } from '../services/userPreferences';
import { ThemeSelect } from '../components/common/ThemeSelect';
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/auth';
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  Globe,
  Monitor,
  Moon,
  Sun,
  ShieldCheck,
  Wifi,
  WifiOff,
  Zap,
  Settings,
  Type
} from 'lucide-react';

const StatusDot = ({ status }) => {
  const colors = {
    healthy: 'bg-emerald-500 shadow-emerald-500/40',
    warning: 'bg-amber-500 shadow-amber-500/40',
    error: 'bg-rose-500 shadow-rose-500/40',
    idle: 'bg-slate-400 shadow-slate-400/40'
  };
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full shadow-[0_0_6px] ${colors[status] || colors.idle}`} />
  );
};

const StatusRow = ({ icon: Icon, label, value, status = 'idle', detail }) => (
  <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-950/60">
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</p>
        {detail && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{detail}</p>}
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      <span className={`text-sm font-bold ${
        status === 'healthy' ? 'text-emerald-500' :
        status === 'warning' ? 'text-amber-500' :
        status === 'error' ? 'text-rose-500' :
        'text-slate-500 dark:text-slate-400'
      }`}>{value}</span>
      <StatusDot status={status} />
    </div>
  </div>
);

const ToggleSwitch = ({ checked, onChange, id }) => (
  <button
    id={id}
    role="switch"
    type="button"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`neu-toggle relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
      checked ? 'bg-gradient-to-r from-rose-800 to-amber-600' : 'bg-slate-300 dark:bg-slate-700'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      }`}
    />
  </button>
);

const PreferenceRow = ({ icon: Icon, label, description, checked, onChange, id }) => (
  <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3.5 dark:bg-slate-950/60">
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-bold text-slate-700 dark:text-slate-200">{label}</label>
        {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
    </div>
    <ToggleSwitch id={id} checked={checked} onChange={onChange} />
  </div>
);

export const SettingsPage = ({ setActiveTab, isDarkMode, theme, setTheme }) => {
  const { isFirebaseConnected, dataSync, isAuthenticated, currentUser } = useAuth();

  // Internet connection state
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [connectionType, setConnectionType] = useState('');
  const [connectionLatency, setConnectionLatency] = useState(null);

  // Per-user preference key helper
  const userId = currentUser?.id || '';
  const readPref = useCallback((key, fallback) => readPreference(userId, key, fallback), [userId]);
  const writePref = useCallback((key, value) => writePreference(userId, key, value), [userId]);

  // Preferences — initialized with defaults, loaded per-user below
  const [hardwareAcceleration, setHardwareAcceleration] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [fontFamily, setFontFamily] = useState('system');

  // Load per-user preferences when user changes
  useEffect(() => {
    if (!userId) return;
    setHardwareAcceleration(readPref('hw_accel', 'true') !== 'false');
    setReduceMotion(readPref('reduce_motion', 'false') === 'true');
    setFontFamily(readPref('font', 'system'));
  }, [userId, readPref]);

  // Monitor online/offline status
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Connection info
  useEffect(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      const update = () => {
        setConnectionType(conn.effectiveType || conn.type || '');
        setConnectionLatency(conn.rtt ?? null);
      };
      update();
      conn.addEventListener?.('change', update);
      return () => conn.removeEventListener?.('change', update);
    }
    return undefined;
  }, []);

  // Hardware acceleration toggle
  const handleHardwareAcceleration = useCallback((enabled) => {
    setHardwareAcceleration(enabled);
    writePref('hw_accel', String(enabled));
    document.documentElement.classList.toggle('no-hw-accel', !enabled);
  }, [writePref]);

  // Reduce motion toggle
  const handleReduceMotion = useCallback((enabled) => {
    setReduceMotion(enabled);
    writePref('reduce_motion', String(enabled));
    document.documentElement.classList.toggle('reduce-motion', enabled);
  }, [writePref]);

  // Font family change handler
  const handleFontFamilyChange = useCallback((selectedFont) => {
    setFontFamily(selectedFont);
    writePref('font', selectedFont);
    document.documentElement.classList.remove('font-montserrat', 'font-oswald');
    if (selectedFont === 'montserrat') document.documentElement.classList.add('font-montserrat');
    else if (selectedFont === 'oswald') document.documentElement.classList.add('font-oswald');
  }, [writePref]);

  // Apply preferences to DOM whenever they change
  useEffect(() => {
    document.documentElement.classList.toggle('no-hw-accel', !hardwareAcceleration);
    document.documentElement.classList.toggle('reduce-motion', reduceMotion);
    document.documentElement.classList.remove('font-montserrat', 'font-oswald');
    if (fontFamily === 'montserrat') document.documentElement.classList.add('font-montserrat');
    else if (fontFamily === 'oswald') document.documentElement.classList.add('font-oswald');
  }, [hardwareAcceleration, reduceMotion, fontFamily]);

  // Sync status
  const syncStatus = dataSync?.status === 'syncing' ? 'warning'
    : dataSync?.status === 'error' ? 'error'
    : dataSync?.status === 'offline' ? 'warning'
    : 'healthy';

  const syncLabel = dataSync?.status === 'syncing' ? 'Synchronizing'
    : dataSync?.status === 'error' ? 'Error'
    : dataSync?.status === 'offline' ? 'Offline'
    : 'Idle';

  const connectionQuality = !isOnline ? 'Disconnected'
    : connectionType === '4g' ? 'Excellent'
    : connectionType === '3g' ? 'Good'
    : connectionType === '2g' ? 'Poor'
    : connectionType === 'slow-2g' ? 'Very poor'
    : 'Connected';

  const connectionStatus = !isOnline ? 'error'
    : connectionType === '4g' || !connectionType ? 'healthy'
    : connectionType === '3g' ? 'healthy'
    : 'warning';

  return (
    <div className="page-stack space-y-4 sm:space-y-6">
      {/* Hero panel */}
      <section className="hero-panel hero-motion relative overflow-hidden rounded-2xl border border-gold-500/30 bg-gradient-to-br from-slate-950 via-crimson-950 to-gold-950 p-5 text-white sm:p-6 lg:p-7 shadow-xl shadow-gold-950/40">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gold-500/25 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-crimson-600/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-normal text-gold-400">
              <Settings className="h-4 w-4" />
              Application Configuration
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">CCT Preferences</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gold-100/90 sm:text-sm">
              Monitor system health, connection stability, and manage display preferences. Changes are saved locally and applied immediately.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-crimson-900/40 px-3 py-1.5 text-xs font-bold text-gold-200">
                <ShieldCheck className="h-3.5 w-3.5 text-gold-400" /> {currentUser?.role}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-crimson-900/40 px-3 py-1.5 text-xs font-bold text-gold-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Realtime Sync: {isFirebaseConnected ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>

          {setActiveTab && (
            <button
              type="button"
              onClick={() => setActiveTab()}
              className="glass-control control-lift min-h-11 rounded-xl border border-gold-400/30 bg-crimson-950/40 px-4 text-sm font-bold text-gold-200 transition hover:bg-crimson-900/60 cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Workspace
            </button>
          )}
        </div>
      </section>

      {/* System status overview */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Database',
            value: isFirebaseConnected ? 'Connected' : 'Offline',
            status: isFirebaseConnected ? 'healthy' : 'warning',
            icon: Database
          },
          {
            label: 'Authentication',
            value: isAuthenticated ? 'Established' : 'Inactive',
            status: isAuthenticated ? 'healthy' : 'error',
            icon: ShieldCheck
          },
          {
            label: 'Internet',
            value: connectionQuality,
            status: connectionStatus,
            icon: isOnline ? Wifi : WifiOff
          },
          {
            label: 'Background Sync',
            value: syncLabel,
            status: syncStatus,
            icon: Zap
          }
        ].map((card) => (
          <div key={card.label} className="surface-panel flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              card.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-500'
              : card.status === 'warning' ? 'bg-amber-500/10 text-amber-500'
              : card.status === 'error' ? 'bg-rose-500/10 text-rose-500'
              : 'bg-slate-100 text-slate-500 dark:text-slate-400 dark:bg-slate-800'
            }`}>
              <card.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-normal text-slate-500 dark:text-slate-400">{card.label}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">{card.value}</p>
                <StatusDot status={card.status} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Connection & infrastructure */}
        <section className="surface-panel rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-500/10 text-gold-500">
              <Globe className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-normal text-slate-900 dark:text-white">Connection & Infrastructure</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Real-time system connectivity status</p>
            </div>
          </div>

          <div className="space-y-2">
            <StatusRow
              icon={Database}
              label="Firebase Realtime Database"
              value={isFirebaseConnected ? 'Connected' : 'Cached / Offline'}
              status={isFirebaseConnected ? 'healthy' : 'warning'}
              detail="asia-southeast1 region"
            />
            <StatusRow
              icon={ShieldCheck}
              label="Firebase Authentication"
              value={isAuthenticated ? 'Enabled & Stable' : 'Not authenticated'}
              status={isAuthenticated ? 'healthy' : 'error'}
              detail={currentUser?.email || 'No active session'}
            />
            <StatusRow
              icon={isOnline ? Wifi : WifiOff}
              label="Internet Connection"
              value={connectionQuality}
              status={connectionStatus}
              detail={connectionLatency != null ? `~${connectionLatency}ms round-trip latency` : connectionType ? `Effective type: ${connectionType.toUpperCase()}` : 'Network API unavailable'}
            />
            <StatusRow
              icon={Zap}
              label="Background Sync"
              value={syncLabel}
              status={syncStatus}
              detail={`${dataSync?.pendingWrites || 0} pending write${(dataSync?.pendingWrites || 0) === 1 ? '' : 's'}`}
            />
          </div>
        </section>

        {/* Display & Performance */}
        <section className="surface-panel rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/10 text-violet-500">
              <Monitor className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-normal text-slate-900 dark:text-white">Display & Performance</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Visual preferences and rendering options</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="appearance-row inset-panel rounded-xl" role="group" aria-labelledby="appearance-label" aria-description="Light is the default. Use System Settings follows your device automatically.">
              <p id="appearance-label" className="form-label">Appearance</p>
              <ThemeSelect value={theme} onChange={setTheme} compact />
            </div>
            <PreferenceRow
              id="toggle-hw-accel"
              icon={Zap}
              label="Hardware Acceleration"
              description="Use GPU-accelerated rendering for smoother transitions"
              checked={hardwareAcceleration}
              onChange={handleHardwareAcceleration}
            />
            <PreferenceRow
              id="toggle-reduce-motion"
              icon={Monitor}
              label="Reduce Motion"
              description="Minimize animations for accessibility or performance"
              checked={reduceMotion}
              onChange={handleReduceMotion}
            />

            {/* Typography Font Choice */}
            <div className="flex flex-col gap-2.5 rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950/60 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <Type className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Typography Font</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Select application-wide typeface family</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                {[
                  { id: 'system', name: 'System Sans', style: 'font-sans' },
                  { id: 'montserrat', name: 'Montserrat', style: "font-['Montserrat']" },
                  { id: 'oswald', name: 'Oswald', style: "font-['Oswald'] tracking-wide" }
                ].map((font) => {
                  const active = fontFamily === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => handleFontFamilyChange(font.id)}
                      className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                        font.style
                      } ${
                        active
                          ? 'bg-gradient-to-r from-rose-900 via-rose-800 to-amber-700 text-amber-100 shadow-md ring-1 ring-amber-500/40'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      {font.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Visual indicator of current mode */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-transparent px-4 py-3 dark:border-slate-800 dark:from-slate-950/60">
            <div className="flex items-center gap-2">
              <span className={`grid h-7 w-7 place-items-center rounded-lg ${isDarkMode ? 'bg-slate-800 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                {isDarkMode ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              </span>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {isDarkMode ? 'Dark' : 'Light'} theme active
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">•</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {hardwareAcceleration ? 'GPU rendering' : 'Software rendering'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">•</span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-300">
              Font: {fontFamily === 'montserrat' ? 'Montserrat' : fontFamily === 'oswald' ? 'Oswald' : 'System Sans'}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
};
