import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import StorageService, { SearchHistory } from '../services/StorageService';
import { useTheme } from '../theme/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';
import { DarkColors } from '../theme/darkColors';

export default function HistoryScreen({ navigation }: any) {
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { isDark } = useTheme();
  const themeColors = isDark ? DarkColors : Colors;

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, []),
  );

  const loadHistory = async () => {
    try {
      const data = await StorageService.getSearchHistory();
      setHistory(data);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const handleHistoryClick = (item: SearchHistory) => {
    navigation.navigate('RouteSearch', {
      fromStopName: item.fromStopName,
      toStopName: item.toStopName,
    });
  };

  const handleDeleteHistory = async (id: string) => {
    Alert.alert('Delete History', 'Remove this search?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await StorageService.deleteSearchHistoryItem(id);
          loadHistory();
        },
      },
    ]);
  };

  const handleClearAll = async () => {
    Alert.alert('Clear All History', 'Remove all search history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await StorageService.clearSearchHistory();
          loadHistory();
        },
      },
    ]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, []);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderHistoryItem = ({ item }: { item: SearchHistory }) => (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: themeColors.surface,
          borderColor: isDark ? themeColors.border : 'transparent',
          borderWidth: isDark ? 1 : 0,
        },
      ]}
      onPress={() => handleHistoryClick(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.cardIcon, { backgroundColor: themeColors.primaryMuted }]}>
        <Ionicons name="time" size={18} color={themeColors.primary} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.routeRow}>
          <Text style={[styles.stopName, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {item.fromStopName}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={12}
            color={themeColors.textTertiary}
            style={{ marginHorizontal: 6 }}
          />
          <Text style={[styles.stopName, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {item.toStopName}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <View style={[styles.metaChip, { backgroundColor: themeColors.pill }]}>
            <Text style={[styles.metaText, { color: themeColors.primary }]}>
              {item.routesFound} routes
            </Text>
          </View>
          <Text style={[styles.timeText, { color: themeColors.textTertiary }]}>
            {formatDate(item.timestamp)}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.deleteBtn, { backgroundColor: themeColors.errorLight || 'rgba(239,68,68,0.12)' }]}
        onPress={() => handleDeleteHistory(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={15} color={themeColors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: themeColors.background }]}
      edges={['top']}
    >
      <LinearGradient
        colors={[themeColors.gradientStart, themeColors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Search History</Text>
            <Text style={styles.headerSubtitle}>{history.length} recent searches</Text>
          </View>
          {history.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearAll}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={14} color="#FFF" />
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: themeColors.primaryMuted }]}>
              <Ionicons name="time-outline" size={36} color={themeColors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
              No History Yet
            </Text>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              Your search history will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            renderItem={renderHistoryItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xxl,
    borderBottomRightRadius: BorderRadius.xxl,
    ...Platform.select({
      android: { elevation: 8 },
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
    fontWeight: '500',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  clearButtonText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      android: { elevation: 1 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
    }),
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  stopName: {
    fontSize: FontSize.base,
    fontWeight: '600',
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metaChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
  },
  metaText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  timeText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.mega,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: FontSize.base,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});
