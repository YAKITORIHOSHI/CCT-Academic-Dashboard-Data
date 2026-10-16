import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/auth';
import schoolLogo from '../assets/school-logo.png';
import campus from '../assets/background.jpg';

export const LoginPage = () => {
  const { loginWithEmail, inactivityNotice, clearInactivityNotice, firebaseReady, firebaseServiceError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  useEffect(() => { document.documentElement.classList.remove('font-montserrat', 'font-oswald'); }, []);
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    if (!firebaseReady) { setErrorMsg(firebaseServiceError); return; }
    setLoading(true); setErrorMsg('');
    try {
      const result = await loginWithEmail((emailRef.current?.value || email).trim(), passwordRef.current?.value || password, keepSignedIn);
      if (!result?.success) setErrorMsg(result?.message || 'Unable to sign in. Please check your credentials.');
    } catch { setErrorMsg('Unable to connect. Please try again.'); }
    finally { setLoading(false); }
  };
  return (
    <main className="login-split">
        <section className="campus-panel" aria-label="City College of Tagaytay campus">
          <img src={campus} alt="City College of Tagaytay campus" width="1600" height="873" className="campus-pan" />
          <div className="campus-shade" />
          <div className="campus-identity"><img src={schoolLogo} alt="City College of Tagaytay Crest" /><span>City College<br />of Tagaytay</span></div>
          <div className="campus-caption"><p>City College of Tagaytay</p><h2>A Clearer View of Academic Progress.</h2><p>Records, reviews, and reporting for the CCT academic community.</p></div>
        </section>
        <section className="login-form-panel">
        <div className="login-card">
          <p className="workspace-eyebrow">City College of Tagaytay</p>
          <h1 className="workspace-title">CCT Academic Management System</h1>
          <p className="muted-copy mt-2 mb-6">Sign in with your CCT account.</p>
          {firebaseServiceError && <p className="login-alert mb-4" role="alert">{firebaseServiceError}</p>}
          {inactivityNotice && <div className="login-alert mb-4" role="status"><p>{inactivityNotice}</p><button type="button" onClick={clearInactivityNotice} className="mt-2 text-sm font-semibold underline">Dismiss Notice</button></div>}
          {errorMsg && <div className="login-alert mb-4" role="alert">{errorMsg}</div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="login-label">CCT Email</label>
              <div className="relative">
                <Mail className="login-icon" aria-hidden="true" />
                <input id="login-email" ref={emailRef} name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} onBlur={(e) => setEmail(e.target.value)} placeholder="name@college.cct.edu" className="login-input w-full pl-11 pr-4" />
              </div>
            </div>
            <div>
              <label htmlFor="login-password" className="login-label">Password</label>
              <div className="relative">
                <LockKeyhole className="login-icon" aria-hidden="true" />
                <input id="login-password" ref={passwordRef} name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} onBlur={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="login-input w-full pl-11 pr-12" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="login-password-button" aria-label={showPassword ? 'Hide Password' : 'Show Password'} aria-pressed={showPassword}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </div>
            <label className="flex min-h-11 items-center gap-3 text-sm" style={{color:'var(--neu-muted)'}}>
              <input type="checkbox" checked={keepSignedIn} onChange={(event) => setKeepSignedIn(event.target.checked)} className="login-check shrink-0" />
              <span>Keep me signed in on this device</span>
            </label>
            <button type="submit" disabled={loading || !firebaseReady} aria-busy={loading} className="login-submit">{loading ? 'Signing In…' : 'Sign In'}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
          </form>
          <p className="muted-copy mt-6 border-t pt-4 flex items-start gap-2" style={{borderColor:'var(--neu-line)'}}><ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />Accounts and access are managed by the CCT Office of the VPAA.</p>
        </div>
        <p className="login-footer">City College of Tagaytay · Academic Affairs</p>
        </section>
    </main>
  );
};
