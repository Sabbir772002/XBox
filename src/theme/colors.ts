// Theme colors for the Mad Bus App - Updated with DATA folder design patterns
export const Colors = {
  // Primary colors (purple-blue from DATA folder design)
  primary: '#667eea',
  primaryDark: '#5568d3',
  primaryLight: '#7e8ef0',
  
  // Secondary colors (darker purple)
  secondary: '#764ba2',
  secondaryLight: '#8a5fb8',
  secondaryDark: '#623d87',
  
  // Background colors with gradient support
  background: '#FFFFFF',
  backgroundLight: '#FFFFFF',
  backgroundDark: '#5568d3',
  backgroundGradient: ['#667eea', '#764ba2'], // For gradient backgrounds
  
  // Card and surface colors
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  cardBackground: '#f5f7fa',
  cardBackgroundAlt: '#c3cfe2',
  
  // Text colors
  textPrimary: '#333333',
  textSecondary: '#666666',
  textTertiary: '#888888',
  textLight: '#FFFFFF',
  textMuted: '#999999',
  text: '#333333', // Alias for textPrimary
  
  // Border colors
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
  borderAccent: '#667eea', // Primary border for left accents
  
  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#D32F2F',
  info: '#2196F3',
  
  // Overlay colors
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  
  // Input colors
  inputBackground: '#f8f9fa',
  inputBackgroundFocus: '#FFFFFF',
  inputBorder: '#E0E0E0',
  inputBorderFocus: '#667eea',
  inputPlaceholder: '#B7BEC7',
  inputIcon: '#9AA0A6',
  
  // Gradient colors (matches DATA folder design)
  gradientStart: '#667eea',
  gradientEnd: '#764ba2',
  gradientCardStart: '#f5f7fa',
  gradientCardEnd: '#c3cfe2',
  
  // Shadow colors
  shadow: '#000000',
  shadowPrimary: 'rgba(102, 126, 234, 0.3)',
  shadowCard: 'rgba(102, 126, 234, 0.2)',
  
  // Badge and pill colors
  badge: '#667eea',
  badgeText: '#FFFFFF',
  pill: '#e9ecef',
  pillAccent: '#667eea',
  
  // Hover and active states
  hover: '#f8f9fa',
  hoverAccent: '#e8eef7',
  active: '#667eea',
  activeText: '#FFFFFF',
  
  // Transparent overlays
  whiteOverlay10: '#FFFFFF1A',
  whiteOverlay20: '#FFFFFF33',
  whiteOverlay30: '#FFFFFF4D',
  blackOverlay10: '#0000001A',
  blackOverlay20: '#00000033',
};

// Spacing system
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

// Border radius system
export const BorderRadius = {
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

// Shadow styles
export const Shadow = {
  small: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  large: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
};

// Animation durations (ms)
export const AnimationDuration = {
  fast: 200,
  normal: 300,
  slow: 500,
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
