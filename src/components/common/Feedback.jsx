import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { Modal } from './Modal';

const toastStyles = {
  success: {
    shell: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
    icon: CheckCircle2,
    iconClass: 'text-emerald-600 dark:text-emerald-400'
  },
  error: {
    shell: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100',
    icon: XCircle,
    iconClass: 'text-rose-600 dark:text-rose-400'
  },
  warning: {
    shell: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
    icon: AlertTriangle,
    iconClass: 'text-amber-600 dark:text-amber-400'
  },
  info: {
    shell: 'border-crimson-300 bg-crimson-50 text-crimson-950 dark:border-crimson-800 dark:bg-crimson-950 dark:text-crimson-100',
    icon: Info,
    iconClass: 'text-crimson-600 dark:text-crimson-400'
  }
};

export const Toast = ({ message, type = 'info', onClose, duration = 4500 }) => {
  useEffect(() => {
    if (!message || duration <= 0) return undefined;
    const timer = window.setTimeout(() => onClose?.(), duration);
    return () => window.clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message || typeof document === 'undefined') return null;

  const style = toastStyles[type] || toastStyles.info;
  const Icon = style.icon;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-3 bottom-3 flex justify-end sm:inset-x-auto sm:bottom-5 sm:right-5"
      style={{ zIndex: 160 }}
    >
      <div
        role={type === 'error' ? 'alert' : 'status'}
        aria-live={type === 'error' ? 'assertive' : 'polite'}
        className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border p-3.5 shadow-2xl ${style.shell}`}
      >
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClass}`} />
        <p className="min-w-0 flex-1 whitespace-pre-line text-sm font-semibold leading-relaxed">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg opacity-65 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body
  );
};

export const ConfirmDialog = ({
  open,
  title = 'Confirm action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel
}) => {
  const titleId = useId();
  const isDanger = tone === 'danger';

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onCancel}
      closeOnBackdrop={!busy}
      ariaLabelledBy={titleId}
      className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-6"
      zIndex={150}
    >
      <div className="flex items-start gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${isDanger ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="control-lift min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`primary-action min-h-11 rounded-xl px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};
