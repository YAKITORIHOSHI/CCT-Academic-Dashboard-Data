import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Check, Search } from 'lucide-react';

const VIEWPORT_GUTTER = 8;
const MAX_MENU_HEIGHT = 320;

export const SubjectCombobox = ({
  value,
  subjects = [],
  onInputChange,
  onSelect,
  placeholder = 'Enter subject code',
  ariaLabel = 'Subject code'
}) => {
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState({});

  const filteredSubjects = useMemo(() => {
    const query = String(value || '').trim().toLowerCase();
    const catalog = Array.isArray(subjects) ? subjects : [];
    const matches = catalog.filter((subject) => {
      if (!query) return true;
      return [subject.code, subject.title, subject.department, subject.programName]
        .some((field) => String(field || '').toLowerCase().includes(query));
    });
    return matches.slice(0, 30);
  }, [subjects, value]);

  const selectedIndex = useMemo(() => {
    const normalizedValue = String(value || '').trim().toLowerCase();
    return filteredSubjects.findIndex(
      (subject) => String(subject.code || '').trim().toLowerCase() === normalizedValue
    );
  }, [filteredSubjects, value]);

  const updatePosition = () => {
    const input = inputRef.current;
    if (!input || typeof window === 'undefined') return;

    const rect = input.getBoundingClientRect();
    const viewportWidth = Math.max(0, window.innerWidth);
    const viewportHeight = Math.max(0, window.innerHeight);
    const maximumWidth = Math.max(0, viewportWidth - VIEWPORT_GUTTER * 2);
    const width = Math.min(Math.max(rect.width, 360), 560, maximumWidth);
    const left = Math.min(
      Math.max(VIEWPORT_GUTTER, rect.left),
      Math.max(VIEWPORT_GUTTER, viewportWidth - width - VIEWPORT_GUTTER)
    );
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - VIEWPORT_GUTTER);
    const spaceAbove = Math.max(0, rect.top - VIEWPORT_GUTTER);
    const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
    const availableSpace = openAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(48, Math.min(MAX_MENU_HEIGHT, availableSpace - 6));

    setMenuStyle({
      position: 'fixed',
      left,
      width,
      maxHeight,
      top: openAbove ? 'auto' : rect.bottom + 6,
      bottom: openAbove ? viewportHeight - rect.top + 6 : 'auto',
      zIndex: 150
    });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    const reposition = () => updatePosition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, filteredSubjects.length]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (inputRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, filteredSubjects.length - 1)));
  }, [filteredSubjects.length]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const activeOption = menuRef.current?.querySelector(`[data-option-index="${activeIndex}"]`);
    activeOption?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const openMenu = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const chooseSubject = (subject) => {
    if (!subject) return;
    onSelect?.(subject);
    setOpen(false);
    inputRef.current?.focus({ preventScroll: true });
  };

  const closeMenu = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    setOpen(false);
    inputRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
        setOpen(true);
      } else {
        setActiveIndex((index) => filteredSubjects.length ? (index + 1) % filteredSubjects.length : 0);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : Math.max(0, filteredSubjects.length - 1));
        setOpen(true);
      } else {
        setActiveIndex((index) => filteredSubjects.length ? (index - 1 + filteredSubjects.length) % filteredSubjects.length : 0);
      }
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      setActiveIndex(Math.max(0, filteredSubjects.length - 1));
    } else if (event.key === 'Enter' && open && filteredSubjects[activeIndex]) {
      event.preventDefault();
      chooseSubject(filteredSubjects[activeIndex]);
    } else if (event.key === 'Escape' && open) {
      closeMenu(event);
    } else if (event.key === 'Tab' && open) {
      setOpen(false);
    }
  };

  const exactCode = String(value || '').trim().toLowerCase();

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        required
        value={value}
        onFocus={openMenu}
        onClick={openMenu}
        onChange={(event) => {
          onInputChange?.(event.target.value.toUpperCase());
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="form-control pl-10 pr-10 font-mono "
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && filteredSubjects[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
      />
      <BookOpen className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-500" aria-hidden="true" />

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          aria-label="Available subjects"
          style={menuStyle}
          className="dropdown-surface dropdown-scroll-frame rounded-2xl border border-gold-950/30 bg-white/98 p-1.5 shadow-2xl backdrop-blur-xl dark:border-gold-900/60 dark:bg-slate-900/98"
        >
          <div className="dropdown-scroll-body">
          {filteredSubjects.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">No matching subject in the selected academic unit.</div>
          ) : filteredSubjects.map((subject, index) => {
            const selected = String(subject.code || '').trim().toLowerCase() === exactCode;
            const active = index === activeIndex;
            return (
              <button
                id={`${listboxId}-option-${index}`}
                key={subject.id || `${subject.code}-${subject.department}`}
                type="button"
                role="option"
                tabIndex={-1}
                data-option-index={index}
                aria-selected={selected}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => chooseSubject(subject)}
                className={`menu-option flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  selected
                    ? 'bg-gold-500/15 font-bold text-gold-700 dark:bg-gold-950/70 dark:text-gold-300'
                    : active
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/70'
                }`}
              >
                <span className="min-w-[5rem] shrink-0 font-mono text-sm font-semibold">{subject.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{subject.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{subject.programName || 'Department-wide'} · {subject.department}</span>
                </span>
                {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" aria-hidden="true" />}
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
