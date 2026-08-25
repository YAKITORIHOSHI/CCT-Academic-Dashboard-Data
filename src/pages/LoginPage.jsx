import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import schoolLogo from '../assets/school-logo.png';
import {
  Lock,
  Mail,
  KeyRound,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  Check
} from 'lucide-react';

export const LoginPage = () => {
  const { loginWithEmail, inactivityNotice, clearInactivityNotice } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Enforce system default font on login screen
  useEffect(() => {
    document.documentElement.classList.remove('font-montserrat', 'font-oswald');
  }, []);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    // Read direct DOM value to catch Chrome / Windows Security autofill on first try
    const submittedEmail = (emailRef.current?.value || email || '').trim();
    const submittedPassword = passwordRef.current?.value || password || '';

    try {
      const res = await loginWithEmail(submittedEmail, submittedPassword, keepSignedIn);
      if (!res?.success) {
        setErrorMsg(res?.message || 'Invalid institutional email or password.');
      }
    } catch {
      setErrorMsg('Authentication request failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen min-h-screen min-h-[100dvh] w-full bg-slate-950/45 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">

      {/* NCI Deep Navy & Cyan Ambient Glow Orbs */}
      <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] bg-blue-900/40 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[36rem] h-[36rem] bg-sky-600/30 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[26rem] h-[26rem] bg-blue-950/60 rounded-full blur-[110px] pointer-events-none" />

      {/* Login Card */}
      <div className="max-w-md w-full z-10 rounded-3xl border border-sky-500/30 bg-slate-950/90 shadow-2xl shadow-sky-950/80 p-7 sm:p-8 space-y-6 backdrop-blur-2xl">

        {/* Header with Official School Logo */}
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <div className="w-16 h-20 mx-auto flex items-center justify-center p-1 bg-gradient-to-b from-sky-500/20 via-blue-900/40 to-slate-950 rounded-2xl border border-sky-400/30 shadow-lg shadow-sky-950/50">
              <img
                src={schoolLogo}
                alt="Natsuki College of Imus Logo"
                className="h-full w-auto translate-y-[1px] object-contain filter drop-shadow-[0_2px_8px_rgba(56,189,248,0.4)]"
              />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight sm:text-2xl">Natsuki College of Imus</h1>
            <p className="text-xs text-sky-200/80 font-medium mt-0.5">Academic Performance Monitoring & Reporting System</p>
          </div>
        </div>

        {inactivityNotice && (
          <div className="p-3 bg-slate-900/90 border border-sky-500/60 rounded-xl text-sky-200 text-xs flex items-center justify-between space-x-2 shadow-lg">
            <div className="flex items-center space-x-2 min-w-0">
              <Clock className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="truncate">{inactivityNotice}</span>
            </div>
            <button
              type="button"
              onClick={clearInactivityNotice}
              className="text-sky-400 hover:text-white font-bold text-xs px-1.5 py-0.5 rounded shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-950/90 border border-rose-800/90 rounded-xl text-rose-200 text-xs flex items-center space-x-2 shadow-lg">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Institutional Email</label>
            <div className="relative group">
              <Mail className="w-4 h-4 text-slate-500 group-focus-within:text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-20 transition-colors" />
              <input
                ref={emailRef}
                name="email"
                type="email"
                required
                autoComplete="username email"
                placeholder="Enter your institutional email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:border-sky-400 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Password</label>
            <div className="relative group">
              <Lock className="w-4 h-4 text-slate-500 group-focus-within:text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-20 transition-colors" />
              <input
                ref={passwordRef}
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-13 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:border-sky-400 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 text-slate-400 hover:text-sky-300 transition-colors z-20"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => setKeepSignedIn((prev) => !prev)}
              role="checkbox"
              aria-checked={keepSignedIn}
              className="flex min-h-11 w-full items-center gap-2.5 cursor-pointer group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg -mx-1 px-1"
            >
              <div className={`w-[18px] h-[18px] rounded-md border transition-all flex items-center justify-center shrink-0 ${
                keepSignedIn
                  ? 'bg-gradient-to-br from-sky-400 to-blue-600 border-sky-300 text-slate-950 shadow-sm shadow-sky-500/40'
                  : 'bg-slate-950/80 border-slate-700/80 group-hover:border-sky-400/60'
              }`}>
                {keepSignedIn && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <span className="text-[11px] font-medium text-sky-200/80 group-hover:text-sky-100 transition-colors">
                Keep me signed in on this device
              </span>
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-900 via-blue-800 to-sky-600 hover:from-blue-800 hover:to-sky-500 text-sky-100 border border-sky-400/40 rounded-xl font-bold transition flex items-center justify-center space-x-2 shadow-lg shadow-blue-950/80 cursor-pointer disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4 text-sky-300" />
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
          </button>
        </form>

        <div className="text-[11px] text-slate-500 text-center pt-2">
          Authorized personnel access only. Accounts managed by VPAA Office. Natsuki College of Imus © 2026
        </div>

      </div>

    </div>
  );
};
