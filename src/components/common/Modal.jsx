import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

let scrollLockDepth = 0;
let previousBodyOverflow = '';
let previousBodyPaddingRight = '';
const modalStack = [];

const lockBodyScroll = () => {
  if (scrollLockDepth === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  scrollLockDepth += 1;
};

const unlockBodyScroll = () => {
  scrollLockDepth = Math.max(0, scrollLockDepth - 1);
  if (scrollLockDepth === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.paddingRight = previousBodyPaddingRight;
  }
};

const getFocusableElements = (container) => Array.from(container.querySelectorAll(
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
)).filter((element) => element.getClientRects().length > 0 && !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');

export const Modal = ({
  open,
  onClose,
  children,
  className = '',
  backdropClassName = '',
  align = 'center',
  ariaLabel,
  ariaLabelledBy,
  closeOnBackdrop = true,
  scrollable = true,
  zIndex = 100
}) => {
  const modalRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const generatedLabelId = useId();

  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const modal = modalRef.current;
    modalStack.push(modal);
    lockBodyScroll();

    const focusFrame = window.requestAnimationFrame(() => {
      const focusable = modalRef.current ? getFocusableElements(modalRef.current) : [];
      (focusable[0] || modalRef.current)?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event) => {
      if (event.defaultPrevented || modalStack.at(-1) !== modal) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = getFocusableElements(modalRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        modalRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      const stackIndex = modalStack.lastIndexOf(modal);
      if (stackIndex >= 0) modalStack.splice(stackIndex, 1);
      unlockBodyScroll();
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const alignmentClass = align === 'bottom'
    ? 'items-end sm:items-center'
    : 'items-center';

  return createPortal(
    <div
      className={`modal-backdrop fixed inset-0 flex justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-4 ${alignmentClass} ${backdropClassName}`}
      style={{ zIndex }}
      onPointerDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || undefined}
        aria-labelledby={ariaLabelledBy || (!ariaLabel ? generatedLabelId : undefined)}
        tabIndex={-1}
        className={`modal-surface ${scrollable ? 'modal-scroll-frame' : ''} outline-none ${className}`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {scrollable
          ? <div className="modal-scroll-body">{typeof children === 'function' ? children({ titleId: generatedLabelId }) : children}</div>
          : typeof children === 'function' ? children({ titleId: generatedLabelId }) : children}
      </div>
    </div>,
    document.body
  );
};
