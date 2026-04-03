import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';
import { DarkColors } from '../theme/darkColors';
import { useTheme } from '../theme/ThemeContext';

interface CollapsibleSectionProps {
  title: string;
  count: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  icon?: string;
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  count,
  defaultExpanded = true,
  children,
  icon = 'chevron-down',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { isDark } = useTheme();
  const themeColors = isDark ? DarkColors : Colors;

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={{ marginBottom: Spacing.md }}>
      <TouchableOpacity
        style={[
          styles.header,
          {
            backgroundColor: themeColors.surface,
            borderLeftColor: themeColors.primary,
            borderBottomColor: isExpanded ? themeColors.primary : themeColors.borderLight,
          },
        ]}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{title}</Text>
          <View style={[styles.badge, { backgroundColor: themeColors.badge }]}>
            <Text style={[styles.badgeText, { color: themeColors.badgeText }]}>{count}</Text>
          </View>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={themeColors.primary}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={[styles.content, { backgroundColor: isDark ? '#1a1a2e' : '#f8f9fa' }]}>
          {children}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderLeftWidth: 4,
    borderBottomWidth: 2,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  badge: {
    backgroundColor: Colors.badge,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Colors.badgeText,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderBottomLeftRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
  },
});
