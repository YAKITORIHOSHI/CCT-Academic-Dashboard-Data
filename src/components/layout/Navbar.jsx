import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import schoolLogo from '../../assets/school-logo.png';
import {
  Building,
  ChevronDown,
  LogOut,
  Menu,
  Sliders,
  X
} from 'lucide-react';

const roleBadgeClass = (role) => {
  switch (role) {
    case 'VPAA':
      return 'border-rose-300 bg-rose-100 font-bold text-rose-950 dark:border-rose-800 dark:bg-rose-950 dark:text-amber-300';
    case 'President':
      return 'border-amber-300 bg-amber-100 font-bold text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200';
    case 'Deans':
      return 'border-red-200 bg-red-50 font-bold text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-rose-200';
    case 'Heads':
      return 'border-emerald-300 bg-emerald-100 font-bold text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
};

export const Navbar = ({ setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const { currentUser, logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gutter = 12;
    const width = Math.min(320, window.innerWidth - gutter * 2);
    const left = window.innerWidth < 640
      ? gutter
      : Math.min(Math.max(gutter, rect.right - width), window.innerWidth - width - gutter);

    // Prefer opening below the trigger, but flip above it when the viewport is too
    // short (e.g. landscape phones) so the menu never renders past the screen edge.
    const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - 16);
    const spaceAbove = Math.max(0, rect.top - 16);
    if (spaceBelow < 220 && spaceAbove > spaceBelow) {
      setMenuStyle({
        position: 'fixed',
        left,
        bottom: window.innerHeight - rect.top + 8,
        width,
        maxHeight: spaceAbove,
        zIndex: 130
      });
    } else {
      setMenuStyle({
        position: 'fixed',
        left,
        top: rect.bottom + 8,
        width,
        maxHeight: Math.max(180, spaceBelow),
        zIndex: 130
      });
    }
  };

  useLayoutEffect(() => {
    if (!showUserDropdown) return undefined;
    updateMenuPosition();
    const reposition = () => updateMenuPosition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [showUserDropdown]);

  useEffect(() => {
    if (!showUserDropdown) return undefined;
    const handlePointerDown = (event) => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setShowUserDropdown(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowUserDropdown(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showUserDropdown]);

  return (
    <header className="app-header sticky top-0 z-40 border-b border-rose-950/10 bg-white/95 backdrop-blur-xl dark:border-rose-900/30 dark:bg-slate-950/95">
      <div className="mx-auto flex h-[4.5rem] w-full max-w-[1920px] items-center justify-between gap-3 px-3 sm:px-5 lg:px-7 xl:px-10">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-rose-900/30 bg-rose-950/20 text-rose-900 shadow-sm transition hover:border-amber-500/50 hover:bg-rose-900/30 active:bg-rose-900/40 dark:border-rose-800/60 dark:bg-slate-900 dark:text-amber-300 dark:hover:border-amber-500/60 dark:hover:bg-slate-800 lg:hidden"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5 text-rose-500 dark:text-amber-400" /> : <Menu className="h-5 w-5 text-slate-700 dark:text-amber-300" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab?.('dashboard')}
            className="flex min-w-0 cursor-pointer items-center gap-2.5 text-left rounded-xl transition hover:opacity-90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:gap-3"
            title="Go to Overview dashboard"
            aria-label="Go to Overview dashboard"
          >
            <div className="brand-mark flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-sky-400/40 bg-gradient-to-b from-blue-950 to-slate-950 p-1 shadow-lg shadow-sky-950/40 sm:h-11 sm:w-11">
              <img src={schoolLogo} alt="NCI Logo" width="350" height="459" className="h-full w-auto translate-y-[1px] object-contain drop-shadow-[0_1px_3px_rgba(56,189,248,0.4)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-black tracking-tight text-slate-950 dark:text-white sm:text-base">Natsuki College of Imus</span>
                <span className="hidden rounded-md border border-sky-500/40 bg-blue-950/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sky-700 dark:border-sky-400/40 dark:bg-sky-950/60 dark:text-sky-300 sm:inline">NCI</span>
              </div>
              <p className="truncate text-[10px] text-slate-500 dark:text-slate-400 sm:text-[11px]">Academic Performance Monitoring System</p>
            </div>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setShowUserDropdown((open) => !open)}
            className="control-lift flex h-10 max-w-[12rem] items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-950/10 px-2 transition hover:bg-sky-900/20 dark:border-sky-800/60 dark:bg-sky-950/40 sm:max-w-[18rem] sm:px-3"
            aria-expanded={showUserDropdown}
            aria-haspopup="menu"
            aria-label="Open user account menu"
          >
            <span className="flex h-7 w-7 shrink-0 aspect-square items-center justify-center overflow-hidden rounded-lg border border-sky-400/40 bg-gradient-to-br from-blue-900 to-sky-700 text-xs font-black text-sky-200">
              {currentUser?.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt={currentUser.name} className="h-full w-full aspect-square object-cover object-center" />
              ) : (
                currentUser?.name?.charAt(0) || 'U'
              )}
            </span>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block truncate text-[11px] font-bold text-slate-900 dark:text-white">{currentUser?.name}</span>
              <span className="block truncate text-[9px] text-slate-500 dark:text-slate-400">{currentUser?.role}</span>
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${showUserDropdown ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {showUserDropdown && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={menuStyle}
          onPointerDown={(event) => event.stopPropagation()}
          className="dropdown-surface overflow-y-auto rounded-2xl border border-sky-950/30 bg-white shadow-2xl dark:border-sky-900/60 dark:bg-slate-900"
        >
          <div className="border-b border-slate-100 bg-gradient-to-br from-blue-950/10 to-transparent p-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 aspect-square items-center justify-center overflow-hidden rounded-xl border border-sky-400/40 bg-gradient-to-br from-blue-900 to-sky-700 text-sm font-black text-sky-200">
                {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.name} className="h-full w-full aspect-square object-cover object-center" />
                ) : (
                  currentUser?.name?.charAt(0) || 'U'
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{currentUser?.name}</p>
                <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{currentUser?.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-2 text-[10px] dark:border-slate-800/80">
              <span className="flex min-w-0 items-center gap-1 text-slate-500 dark:text-slate-400">
                <Building className="h-3 w-3 shrink-0 text-sky-500" />
                <span className="truncate">{currentUser?.department}</span>
              </span>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] ${roleBadgeClass(currentUser?.role)}`}>{currentUser?.role}</span>
            </div>
          </div>

          <div className="space-y-1 p-2">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setActiveTab?.('settings');
                setShowUserDropdown(false);
              }}
              className="menu-option flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-rose-950/10 dark:text-slate-200 dark:hover:bg-rose-950/40"
            >
              <Sliders className="h-4 w-4 text-amber-500" />
              <span>Settings</span>
            </button>
          </div>

          <div className="border-t border-slate-100 p-2 dark:border-slate-800">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                logout();
                setShowUserDropdown(false);
              }}
              className="menu-option flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50"
            >
              <LogOut className="h-4 w-4 text-rose-500" />
              <span>Sign Out of Account</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};
