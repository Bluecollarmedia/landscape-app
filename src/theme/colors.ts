/**
 * Design System — Color Tokens
 *
 * Brand palette derived from the Brighton Lawn + Landscape logos:
 *  - Main logo: dark forest green (#1B3A2D) + medium green (#4A8B3F)
 *  - Leaf icon: fresh light green (#8BC34A) — the preferred brand tone
 *
 * The palette leans toward the lighter, approachable green from the
 * leaf mark per brand direction, with the darker greens reserved for
 * headings and strong emphasis.
 */

// ── Brand Palette (extracted from Brighton logos) ────────────────
export const brand = {
  /** Primary — true grass green (updated per approved reference) */
  primary: '#4CAF50',
  /** Lighter tint for hover / selected backgrounds */
  primaryLight: '#81C784',
  /** Darker for pressed states / gradients */
  primaryDark: '#2E7D32',
  /** Very light tint for subtle backgrounds */
  primarySurface: '#E8F5E9',
  /** Deep forest green from the main wordmark — for headings & strong text */
  accent: '#1B3A2D',
  /** Medium green from the main logo lettering */
  accentMid: '#4A8B3F',
} as const;

// ── Neutral Palette ──────────────────────────────────────────────
export const neutral = {
  white: '#FFFFFF',
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#EEEEEE',
  gray300: '#E0E0E0',
  gray400: '#BDBDBD',
  gray500: '#9E9E9E',
  gray600: '#757575',
  gray700: '#616161',
  gray800: '#424242',
  gray900: '#212121',
  black: '#000000',
} as const;

// ── Semantic Colors ──────────────────────────────────────────────
export const semantic = {
  success: '#43A047',
  successLight: '#E8F5E9',
  warning: '#F9A825',
  warningLight: '#FFF8E1',
  error: '#D32F2F',
  errorLight: '#FFEBEE',
  info: '#1976D2',
  infoLight: '#E3F2FD',
} as const;

// ── Light Theme ──────────────────────────────────────────────────
export const lightTheme = {
  // Backgrounds
  background: neutral.white,
  backgroundSecondary: neutral.gray50,
  backgroundTertiary: neutral.gray100,
  surface: neutral.white,
  surfaceElevated: neutral.white,
  surfacePressed: neutral.gray100,

  // Text
  textPrimary: neutral.gray900,
  textSecondary: neutral.gray600,
  textTertiary: neutral.gray500,
  textInverse: neutral.white,
  textOnPrimary: neutral.white,

  // Borders
  border: neutral.gray200,
  borderLight: neutral.gray100,
  borderFocus: brand.primary,
  /** Hairline row/list separators — iOS system separator */
  separator: 'rgba(60, 60, 67, 0.29)',
  /** Screen background behind grouped list sections — iOS systemGroupedBackground */
  groupedBackground: '#F2F2F7',

  // Interactive
  primary: brand.primary,
  primaryLight: brand.primaryLight,
  primaryDark: brand.primaryDark,
  primarySurface: brand.primarySurface,

  // Semantic
  success: semantic.success,
  successLight: semantic.successLight,
  warning: semantic.warning,
  warningLight: semantic.warningLight,
  error: semantic.error,
  errorLight: semantic.errorLight,
  info: semantic.info,
  infoLight: semantic.infoLight,

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  scrim: 'rgba(0, 0, 0, 0.32)',

  // Shadows
  shadowColor: neutral.black,
} as const;

// ── Dark Theme (future use) ──────────────────────────────────────
export const darkTheme = {
  background: '#121212',
  backgroundSecondary: '#1E1E1E',
  backgroundTertiary: '#2C2C2C',
  surface: '#1E1E1E',
  surfaceElevated: '#2C2C2C',
  surfacePressed: '#2A2A2A',

  textPrimary: '#F5F5F5',
  textSecondary: '#BDBDBD',
  textTertiary: '#9E9E9E',
  textInverse: neutral.gray900,
  textOnPrimary: neutral.white,

  border: '#333333',
  borderLight: '#2C2C2C',
  borderFocus: brand.primaryLight,
  separator: 'rgba(84, 84, 88, 0.6)',
  groupedBackground: '#000000',

  primary: brand.primaryLight,
  primaryLight: brand.primary,
  primaryDark: brand.primaryDark,
  primarySurface: 'rgba(76, 175, 80, 0.12)',

  // Semantic
  success: semantic.success,
  successLight: '#1B5E20',
  warning: semantic.warning,
  warningLight: '#4A3800',
  error: '#EF5350',
  errorLight: '#4A1515',
  info: '#42A5F5',
  infoLight: '#0D3B66',

  overlay: 'rgba(0, 0, 0, 0.7)',
  scrim: 'rgba(0, 0, 0, 0.5)',

  shadowColor: neutral.black,
} as const;

// Use a widened type so both light and dark themes satisfy the same interface
export type ThemeColors = { [K in keyof typeof lightTheme]: string };
