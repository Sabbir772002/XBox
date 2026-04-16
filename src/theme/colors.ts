// Premium Theme System for Local Bus App
// Modern glassmorphic design with vibrant gradients

export const Colors = {
  // Primary palette — rich indigo-violet
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',
  primaryMuted: 'rgba(99, 102, 241, 0.12)',

  // Secondary palette — warm amber accents
  secondary: '#F59E0B',
  secondaryLight: '#FBBF24',
  secondaryDark: '#D97706',

  // Accent — teal for highlights
  accent: '#14B8A6',
  accentLight: '#2DD4BF',

  // Background hierarchy
  background: '#F8FAFC',
  backgroundLight: '#F1F5F9',
  backgroundDark: '#4F46E5',
  backgroundGradient: ['#6366F1', '#8B5CF6'],

  // Surface hierarchy (cards, modals)
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  cardBackground: '#FFFFFF',
  cardBackgroundAlt: '#F8FAFC',

  // Text hierarchy
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textLight: '#FFFFFF',
  textMuted: '#CBD5E1',
  text: '#0F172A',

  // Border system
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderAccent: '#6366F1',

  // Status colors — refined
  success: '#10B981',
  successLight: 'rgba(16, 185, 129, 0.12)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.12)',
  error: '#EF4444',
  errorLight: 'rgba(239, 68, 68, 0.12)',
  info: '#3B82F6',
  infoLight: 'rgba(59, 130, 246, 0.12)',

  // Overlay
  overlay: 'rgba(15, 23, 42, 0.6)',
  overlayLight: 'rgba(15, 23, 42, 0.3)',

  // Input
  inputBackground: '#F8FAFC',
  inputBackgroundFocus: '#FFFFFF',
  inputBorder: '#E2E8F0',
  inputBorderFocus: '#6366F1',
  inputPlaceholder: '#94A3B8',
  inputIcon: '#94A3B8',

  // Gradient (header)
  gradientStart: '#6366F1',
  gradientEnd: '#8B5CF6',
  gradientCardStart: '#F8FAFC',
  gradientCardEnd: '#EEF2FF',

  // Shadow
  shadow: '#0F172A',
  shadowPrimary: 'rgba(99, 102, 241, 0.25)',
  shadowCard: 'rgba(15, 23, 42, 0.08)',

  // Badge & pill
  badge: '#6366F1',
  badgeText: '#FFFFFF',
  pill: '#EEF2FF',
  pillAccent: '#6366F1',

  // Interactive
  hover: '#F8FAFC',
  hoverAccent: '#EEF2FF',
  active: '#6366F1',
  activeText: '#FFFFFF',

  // Transparent overlays
  whiteOverlay10: 'rgba(255, 255, 255, 0.1)',
  whiteOverlay20: 'rgba(255, 255, 255, 0.2)',
  whiteOverlay30: 'rgba(255, 255, 255, 0.3)',
  blackOverlay10: 'rgba(0, 0, 0, 0.06)',
  blackOverlay20: 'rgba(0, 0, 0, 0.12)',

  // Route type colors
  routeDirect: '#10B981',
  routeTransfer1: '#F59E0B',
  routeTransfer2: '#EF4444',
};

// Spacing system — 4px grid
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  mega: 40,
};

// Border radius
export const BorderRadius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: 999,
};

// Font sizes
export const FontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  base: 15,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 22,
  mega: 24,
  huge: 28,
  giant: 32,
};

// Font weights
export const FontWeight = {
  regular: '400' as '400',
  medium: '500' as '500',
  semibold: '600' as '600',
  bold: '700' as '700',
  extrabold: '800' as '800',
};

// Shadow presets
export const Shadow = {
  small: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  medium: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  large: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  glow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
};

// Animation durations (ms)
export const AnimationDuration = {
  fast: 150,
  normal: 250,
  slow: 400,
};

export default {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  FontWeight,
  Shadow,
  AnimationDuration,
};
