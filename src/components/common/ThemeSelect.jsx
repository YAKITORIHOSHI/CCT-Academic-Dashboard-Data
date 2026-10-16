import { Monitor, Moon, Sun } from 'lucide-react';
import { THEME_OPTIONS } from '../../services/useTheme';
import { CustomSelect } from './CustomSelect';

const COMPACT_THEME_OPTIONS = THEME_OPTIONS.map((option) => ({
  ...option,
  triggerLabel: option.value === 'system' ? 'System' : option.label
}));

export function ThemeSelect({ value, onChange, compact = false }) {
  return <div className={compact ? 'theme-selector' : 'w-full max-w-xs'}>
    <CustomSelect value={value} onChange={onChange} options={compact ? COMPACT_THEME_OPTIONS : THEME_OPTIONS} ariaLabel="Appearance" singleLine
      icon={value === 'system' ? Monitor : value === 'dark' ? Moon : Sun} menuMinWidth={210} />
  </div>;
}
