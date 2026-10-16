import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

const VIEWPORT_GUTTER = 8;
const OPTION_HEIGHT = 42;
const MAX_MENU_HEIGHT = 288;

const normalizeOptions = (options) => (Array.isArray(options) ? options : []).map((option) => {
  if (typeof option === 'object' && option !== null) {
    return {
      ...option,
      value: String(option.value),
      label: option.label || String(option.value)
    };
  }
  return { value: String(option), label: String(option) };
});

export const CustomSelect = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select option',
  className = '',
  icon: Icon,
  disabled = false,
  menuMinWidth = 0,
  menuMaxWidth = 480,
  singleLine = false,
  ariaLabel
}) => {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listboxId = useId();
  const triggerId = `${listboxId}-trigger`;
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState({});

  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);
  const selectedIndex = normalizedOptions.findIndex((option) => option.value === String(value ?? ''));
  const selectedOption = selectedIndex >= 0 ? normalizedOptions[selectedIndex] : null;
  const displayLabel = selectedOption?.triggerLabel || selectedOption?.label || placeholder;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = Math.max(0, window.innerWidth);
    const viewportHeight = Math.max(0, window.innerHeight);
    const estimatedHeight = Math.min(
      MAX_MENU_HEIGHT,
      Math.max(64, normalizedOptions.length * OPTION_HEIGHT + 12)
    );
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - VIEWPORT_GUTTER);
    const spaceAbove = Math.max(0, rect.top - VIEWPORT_GUTTER);
    const openAbove = spaceBelow < Math.min(estimatedHeight, 180) && spaceAbove > spaceBelow;
    const availableSpace = openAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(48, Math.min(MAX_MENU_HEIGHT, availableSpace - 6));
    const maximumWidth = Math.max(0, viewportWidth - VIEWPORT_GUTTER * 2);
    const preferredWidth = Math.max(rect.width, Number(menuMinWidth) || 0);
    const width = Math.min(preferredWidth, Number(menuMaxWidth) || 480, maximumWidth);
    const left = Math.min(
      Math.max(VIEWPORT_GUTTER, rect.left),
      Math.max(VIEWPORT_GUTTER, viewportWidth - width - VIEWPORT_GUTTER)
    );

    setMenuStyle({
      position: 'fixed',
      left,
      width,
      maxHeight,
      top: openAbove ? 'auto' : rect.bottom + 6,
      bottom: openAbove ? viewportHeight - rect.top + 6 : 'auto',
      zIndex: 140
    });
  }, [normalizedOptions.length, menuMinWidth, menuMaxWidth]);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    updatePosition();
    const handleViewportChange = () => updatePosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event) => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [isOpen, selectedIndex]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const activeOption = menuRef.current?.querySelector(`[data-option-index="${activeIndex}"]`);
    activeOption?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  useEffect(() => {
    if (disabled && isOpen) setIsOpen(false);
  }, [disabled, isOpen]);

  const selectOption = (option) => {
    if (!option || disabled) return;
    onChange?.(option.value, option);
    setIsOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const moveActive = (direction) => {
    if (normalizedOptions.length === 0) return;
    setActiveIndex((current) => {
      const base = current < 0 ? 0 : current;
      return (base + direction + normalizedOptions.length) % normalizedOptions.length;
    });
  };

  const closeMenu = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    setIsOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      else moveActive(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        setActiveIndex(Math.max(0, normalizedOptions.length - 1));
        setIsOpen(true);
      } else {
        moveActive(-1);
      }
    } else if (event.key === 'Home' && isOpen) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End' && isOpen) {
      event.preventDefault();
      setActiveIndex(Math.max(0, normalizedOptions.length - 1));
    } else if ((event.key === 'Enter' || event.key === ' ') && isOpen) {
      event.preventDefault();
      selectOption(normalizedOptions[activeIndex]);
    } else if ((event.key === 'Enter' || event.key === ' ') && !isOpen) {
      event.preventDefault();
      setIsOpen(true);
    } else if (event.key === 'Escape' && isOpen) {
      closeMenu(event);
    } else if (event.key === 'Tab' && isOpen) {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleKeyDown}
        className={`control-lift flex min-h-11 w-full items-center justify-between gap-2.5 rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-slate-900 transition-all outline-none focus:ring-2 dark:bg-slate-900 dark:text-slate-100 ${
          isOpen
            ? 'border-gold-500/80 ring-2 ring-gold-500/20 shadow-md dark:border-gold-400/80 dark:ring-gold-400/20'
            : 'border-slate-300 hover:border-slate-400 dark:border-slate-700/80 dark:hover:border-slate-600'
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        aria-label={ariaLabel}
        aria-description={selectedOption?.triggerLabel ? selectedOption.label : undefined}
        title={selectedOption?.triggerLabel ? selectedOption.label : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-gold-500" aria-hidden="true" />}
          <span className={`min-w-0 ${singleLine ? 'truncate' : 'whitespace-normal break-words'} ${selectedOption ? '' : 'font-normal text-slate-500 dark:text-slate-400'}`}>{displayLabel}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-gold-500' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={ariaLabel ? undefined : triggerId}
          aria-label={ariaLabel}
          style={menuStyle}
          className="dropdown-surface dropdown-scroll-frame rounded-2xl border border-gold-950/30 bg-white/98 p-1.5 shadow-2xl backdrop-blur-xl dark:border-gold-900/60 dark:bg-slate-900/98"
          onKeyDown={handleKeyDown}
        >
          <div className="dropdown-scroll-body">
          {normalizedOptions.length === 0 ? (
            <div className="px-3 py-3 text-center text-sm text-slate-500 dark:text-slate-400">No options available</div>
          ) : normalizedOptions.map((option, index) => {
            const isSelected = option.value === String(value ?? '');
            const isActive = index === activeIndex;
            return (
              <button
                id={`${listboxId}-option-${index}`}
                key={`${option.value}-${index}`}
                type="button"
                role="option"
                tabIndex={-1}
                data-option-index={index}
                aria-selected={isSelected}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
                className={`menu-option flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                  isSelected
                    ? 'bg-gold-500/15 font-bold text-gold-700 dark:bg-gold-950/70 dark:text-gold-300'
                    : isActive
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/70'
                }`}
              >
                <span className="min-w-0 flex-1 whitespace-normal break-words pr-2">{option.label}</span>
                {isSelected && <Check className="h-4 w-4 shrink-0 text-gold-500" aria-hidden="true" />}
              </button>
            );
          })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
