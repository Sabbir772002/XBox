import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions, Platform } from 'react-native';

export interface SafeAreaDimensions {
  top: number;
  bottom: number;
  left: number;
  right: number;
  screenHeight: number;
  screenWidth: number;
  contentHeight: number;
  hasNotch: boolean;
  isAndroid: boolean;
}

/**
 * Custom hook to get dynamic safe area dimensions
 * Accounts for different Android devices with notches, navigation bars, etc.
 */
export const useDynamicSafeArea = (): SafeAreaDimensions => {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const isAndroid = Platform.OS === 'android';

  // Android navigation bar height (typical values: 48dp or 56dp)
  const androidNavBarHeight = isAndroid ? insets.bottom : 0;

  // Detect notch presence
  const hasNotch = insets.top > 20;

  return {
    top: insets.top || 0,
    bottom: insets.bottom || androidNavBarHeight,
    left: insets.left || 0,
    right: insets.right || 0,
    screenHeight: height,
    screenWidth: width,
    contentHeight: height - insets.top - insets.bottom,
    hasNotch,
    isAndroid,
  };
};

/**
 * Get padding object for different screen regions
 */
export const getPaddingByRegion = (region: 'header' | 'content' | 'footer') => {
  switch (region) {
    case 'header':
      return {
        paddingTop: 12,
        paddingBottom: 8,
      };
    case 'content':
      return {
        paddingHorizontal: 16,
        paddingVertical: 8,
      };
    case 'footer':
      return {
        paddingTop: 12,
        paddingBottom: 16, // Accounts for bottom nav bar
      };
    default:
      return {};
  }
};

/**
 * Get margin for avoiding toolbars on specific devices
 */
export const getAndroidDeviceMargins = (
  insets: SafeAreaDimensions
): {
  headerMarginTop: number;
  contentMarginBottom: number;
  footerMarginBottom: number;
} => {
  return {
    // Extra margin for status bar on notched devices
    headerMarginTop: insets.hasNotch ? 8 : 0,
    // Extra margin for content to avoid keyboard
    contentMarginBottom: 8,
    // Extra margin for footer to avoid navigation bar
    footerMarginBottom: insets.isAndroid ? 8 : 0,
  };
};

export default {
  useDynamicSafeArea,
  getPaddingByRegion,
  getAndroidDeviceMargins,
};
