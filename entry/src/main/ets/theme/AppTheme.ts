export interface AppThemePalette {
  pageBg: string;
  surfaceBg: string;
  surfaceSubtle: string;
  primary: string;
  primarySoft: string;
  success: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderColor: string;
  chipBg: string;
  chipActiveBg: string;
  chipActiveText: string;
  accentActive: string;
  accentInactive: string;
  currentBeatBg: string;
  statusActiveBg: string;
  statusIdleBg: string;
  statusIdleText: string;
  danger: string;
  overlayBg: string;
  policyTagBg: string;
  policyTagText: string;
  sliderTrack: string;
  sliderBlock: string;
  dialogBg: string;
  stepperButtonBg: string;
  stepperPanelBg: string;
  systemBarBg: string;
  systemBarContent: string;
}

const LIGHT_THEME: AppThemePalette = {
  pageBg: '#F4F6FB',
  surfaceBg: '#FFFFFF',
  surfaceSubtle: '#EEF2FF',
  primary: '#2F5BFF',
  primarySoft: '#BFD1FF',
  success: '#0F766E',
  textPrimary: '#172033',
  textSecondary: '#4F596A',
  textMuted: '#5F6B7A',
  borderColor: '#C7D1E3',
  chipBg: '#F0F3FA',
  chipActiveBg: '#2F5BFF',
  chipActiveText: '#FFFFFF',
  accentActive: '#2F5BFF',
  accentInactive: '#EDF2FB',
  currentBeatBg: '#0F766E',
  statusActiveBg: '#DFF6EE',
  statusIdleBg: '#E8EDF5',
  statusIdleText: '#4F596A',
  danger: '#DC2626',
  overlayBg: '#B30F172A',
  policyTagBg: '#DBEAFE',
  policyTagText: '#1E3A8A',
  sliderTrack: '#D9E0F1',
  sliderBlock: '#FFFFFF',
  dialogBg: '#FFFFFF',
  stepperButtonBg: '#FFFFFF',
  stepperPanelBg: '#EEF2FF',
  systemBarBg: '#F4F6FB',
  systemBarContent: '#172033'
};

const DARK_THEME: AppThemePalette = {
  pageBg: '#0B1220',
  surfaceBg: '#111827',
  surfaceSubtle: '#162235',
  primary: '#77A6FF',
  primarySoft: '#365FA8',
  success: '#34D399',
  textPrimary: '#F3F6FF',
  textSecondary: '#A6B3C9',
  textMuted: '#7D8BA7',
  borderColor: '#2A3C57',
  chipBg: '#162235',
  chipActiveBg: '#77A6FF',
  chipActiveText: '#08101E',
  accentActive: '#77A6FF',
  accentInactive: '#1B2A40',
  currentBeatBg: '#34D399',
  statusActiveBg: '#0F2E28',
  statusIdleBg: '#162235',
  statusIdleText: '#A6B3C9',
  danger: '#F87171',
  overlayBg: '#C0000000',
  policyTagBg: '#1E3A5F',
  policyTagText: '#BFDBFE',
  sliderTrack: '#22324A',
  sliderBlock: '#D8E7FF',
  dialogBg: '#111827',
  stepperButtonBg: '#0F172A',
  stepperPanelBg: '#162235',
  systemBarBg: '#0B1220',
  systemBarContent: '#F3F6FF'
};

export function resolveTheme(isDarkMode: boolean): AppThemePalette {
  return isDarkMode ? DARK_THEME : LIGHT_THEME;
}
