import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';
import { DarkColors } from '../theme/darkColors';
import { useTheme } from '../theme/ThemeContext';
import { TransferRoute } from '../services/DatabaseService';

interface TransferBusCardProps {
  transfer: TransferRoute;
  onPress?: (transfer: TransferRoute) => void;
}

export const TransferBusCard: React.FC<TransferBusCardProps> = ({ transfer, onPress }) => {
  const { isDark } = useTheme();
  const themeColors = isDark ? DarkColors : Colors;

  const containerStyle: ViewStyle = {
    backgroundColor: themeColors.surface,
    borderLeftColor: themeColors.primary,
  };

  return (
    <TouchableOpacity
      style={[styles.card, containerStyle]}
      onPress={() => onPress?.(transfer)}
      activeOpacity={0.7}
    >
      {/* First Bus Segment */}
      <View style={styles.segmentContainer}>
        <View style={[styles.busIcon, { backgroundColor: themeColors.badge }]}>
          <Ionicons name="bus" size={24} color="#FFFFFF" />
        </View>

        <View style={styles.busDetails}>
          <Text style={[styles.busName, { color: themeColors.textPrimary }]}>
            {transfer.firstBus.nameEnglish}
          </Text>
          {transfer.firstBus.nameBangla && (
            <Text style={[styles.busNameBn, { color: themeColors.textSecondary }]}>
              {transfer.firstBus.nameBangla}
            </Text>
          )}

          <View style={styles.routeInfo}>
            <Text style={[styles.routeText, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {transfer.firstBusFromStop}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={14}
              color={themeColors.primary}
              style={{ marginHorizontal: 6 }}
            />
            <Text style={[styles.routeText, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {transfer.transferStop.stopageEn}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statPill, { backgroundColor: themeColors.background }]}>
              <Ionicons name="walk-outline" size={12} color={themeColors.primary} />
              <Text style={[styles.statText, { color: themeColors.textSecondary }]}>
                {transfer.firstBusDistance.toFixed(2)} km
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Transfer Point */}
      <View style={styles.transferIndicator}>
        <View style={styles.transferDots}>
          <View style={[styles.dot, { backgroundColor: themeColors.warning }]} />
          <View style={[styles.dotLine, { backgroundColor: themeColors.warning }]} />
          <View style={[styles.dot, { backgroundColor: themeColors.warning }]} />
        </View>
        <Text style={[styles.transferText, { color: themeColors.warning }]}>
          Change at {transfer.transferStop.stopageEn}
        </Text>
      </View>

      {/* Second Bus Segment */}
      <View style={styles.segmentContainer}>
        <View style={[styles.busIcon, { backgroundColor: themeColors.info }]}>
          <Ionicons name="bus" size={24} color="#FFFFFF" />
        </View>

        <View style={styles.busDetails}>
          <Text style={[styles.busName, { color: themeColors.textPrimary }]}>
            {transfer.secondBus.nameEnglish}
          </Text>
          {transfer.secondBus.nameBangla && (
            <Text style={[styles.busNameBn, { color: themeColors.textSecondary }]}>
              {transfer.secondBus.nameBangla}
            </Text>
          )}

          <View style={styles.routeInfo}>
            <Text style={[styles.routeText, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {transfer.transferStop.stopageEn}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={14}
              color={themeColors.primary}
              style={{ marginHorizontal: 6 }}
            />
            <Text style={[styles.routeText, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {transfer.secondBusToStop}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statPill, { backgroundColor: themeColors.background }]}>
              <Ionicons name="walk-outline" size={12} color={themeColors.primary} />
              <Text style={[styles.statText, { color: themeColors.textSecondary }]}>
                {transfer.secondBusDistance.toFixed(2)} km
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Summary Footer */}
      <View style={[styles.footer, { borderTopColor: themeColors.borderLight }]}>
        <View style={styles.summaryItem}>
          <Ionicons name="walk-outline" size={16} color={themeColors.primary} />
          <Text style={[styles.summaryText, { color: themeColors.textSecondary }]}>
            {transfer.totalDistance.toFixed(2)} km
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="cash-outline" size={16} color={themeColors.warning} />
          <Text style={[styles.summaryText, { color: themeColors.textSecondary }]}>
            ৳ {Math.round(transfer.estimatedFare ?? 0)}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="swap-horizontal-outline" size={16} color={themeColors.info} />
          <Text style={[styles.summaryText, { color: themeColors.textSecondary }]}>
            1 change
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    marginHorizontal: Spacing.md,
    borderLeftWidth: 5,
    borderLeftColor: Colors.primary,
    shadowColor: Colors.shadowCard,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  busIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    marginTop: 2,
  },
  busDetails: {
    flex: 1,
  },
  busName: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  busNameBn: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 4,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    flex: 1,
    flexWrap: 'wrap',
  },
  routeText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 0,
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
    gap: 3,
  },
  statText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  transferIndicator: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  transferDots: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.warning,
  },
  dotLine: {
    width: 3,
    height: 16,
    backgroundColor: Colors.warning,
    marginVertical: 2,
  },
  transferText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.warning,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
    justifyContent: 'space-around',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
