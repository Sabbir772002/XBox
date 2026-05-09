import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import StorageService, { SearchHistory, BookmarkedRoute } from '../services/StorageService';
import { useTheme } from '../theme/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';
import { DarkColors } from '../theme/darkColors';
import TransitNetworkService from '../services/TransitNetworkService';

const { width } = Dimensions.get('window');

type TabType = 'history' | 'bookmarks';

export default function ActivityScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<TabType>('history');
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { isDark } = useTheme();
  const themeColors = isDark ? DarkColors : Colors;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [activeTab]),
  );

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'history') {
        const data = await StorageService.getSearchHistory();
        setHistory(data);
      } else {
        const data = await StorageService.getBookmarks();
        setBookmarks(data);
      }
    } catch (error) {
      console.error('Error loading activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [activeTab]);

  const handleHistoryClick = (item: SearchHistory) => {
    navigation.navigate('Search', {
      fromStopName: item.fromStopName,
      toStopName: item.toStopName,
      fromStopId: item.fromStopId,
      toStopId: item.toStopId,
    });
  };

  const handleBookmarkClick = (item: BookmarkedRoute) => {
    if (item.busId && item.busId > 0) {
      navigation.navigate('RouteDetails', {
        busId: item.busId,
        busName: item.busName,
        busBn: item.busBn,
        fromStopName: item.fromStopName,
        toStopName: item.toStopName,
        fromStopId: item.fromStopId,
        toStopId: item.toStopId,
        showFullRoute: true,
      });
    } else {
      if (item.fromStopName && item.toStopName) {
        try {
          const routes = TransitNetworkService.findRoutes(item.fromStopName, item.toStopName, '', -1);
          const exactRoute = routes.find(r => r.legs[0]?.busName === item.busName) || routes[0];
          
          if (exactRoute) {
            navigation.navigate('RouteDetails', {
              algorithmRoute: exactRoute,
              fromStopName: item.fromStopName,
              toStopName: item.toStopName,
              fromStopId: item.fromStopId,
              toStopId: item.toStopId,
            });
            return;
          }
        } catch (e) {
          console.error("Error finding route for bookmark", e);
        }
      }
      
      // Fallback
      navigation.navigate('Search', {
        fromStopName: item.fromStopName,
        toStopName: item.toStopName,
      });
    }
  };

  const handleDeleteHistory = async (id: string) => {
    Alert.alert('Delete History', 'Remove this search?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await StorageService.deleteSearchHistoryItem(id);
          loadData();
        },
      },
    ]);
  };

  const handleRemoveBookmark = async (routeId: string) => {
    Alert.alert('Remove Bookmark', 'Remove this saved route?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await StorageService.removeBookmark(routeId);
          loadData();
        },
      },
    ]);
  };

  const handleClearAllHistory = async () => {
    Alert.alert('Clear All History', 'Remove all search history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await StorageService.clearSearchHistory();
          loadData();
        },
      },
    ]);
  };

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
        style={[styles.deleteBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)' }]}
        onPress={() => handleDeleteHistory(item.id)}
      >
        <Ionicons name="trash-outline" size={15} color={themeColors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderBookmarkItem = ({ item }: { item: BookmarkedRoute }) => (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: themeColors.surface,
          borderColor: isDark ? themeColors.border : 'transparent',
          borderWidth: isDark ? 1 : 0,
          flexDirection: 'column',
          alignItems: 'stretch',
        },
      ]}
      onPress={() => handleBookmarkClick(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: themeColors.primaryMuted }]}>
          <Ionicons name="bookmark" size={18} color={themeColors.primary} />
        </View>
        <View style={styles.cardContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.busName, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {item.busName}
            </Text>
            <View style={[styles.typeBadge, { backgroundColor: item.busId > 0 ? themeColors.primaryMuted : 'rgba(16,185,129,0.15)' }]}>
              <Text style={[styles.typeBadgeText, { color: item.busId > 0 ? themeColors.primary : themeColors.success }]}>
                {item.busId > 0 ? 'Bus' : 'Route'}
              </Text>
            </View>
          </View>
          {item.busBn ? (
            <Text style={[styles.busBn, { color: themeColors.textTertiary }]} numberOfLines={1}>
              {item.busBn}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)' }]}
          onPress={() => handleRemoveBookmark(item.routeId)}
        >
          <Ionicons name="trash-outline" size={15} color={themeColors.error} />
        </TouchableOpacity>
      </View>

      <View style={[styles.routeRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderTopWidth: 1, paddingTop: Spacing.sm, marginTop: Spacing.sm }]}>
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: themeColors.success }]} />
          <Text style={[styles.routeStopName, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {item.fromStopName}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={14} color={themeColors.textTertiary} />
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: themeColors.error }]} />
          <Text style={[styles.routeStopName, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {item.toStopName}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
          <Text style={[styles.statText, { color: themeColors.primary }]}>
            ৳ {item.fare.toFixed(0)}
          </Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
          <Text style={[styles.statText, { color: themeColors.primary }]}>
            {item.distance.toFixed(1)} km
          </Text>
        </View>
      </View>
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
        <View style={styles.headerTop}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                activeTab === 'history' && styles.toggleButtonActive
              ]}
              onPress={() => setActiveTab('history')}
            >
              <Ionicons 
                name="time-outline" 
                size={16} 
                color={activeTab === 'history' ? themeColors.primary : '#FFF'} 
              />
              <Text style={[
                styles.toggleText,
                activeTab === 'history' && { color: themeColors.primary }
              ]}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                activeTab === 'bookmarks' && styles.toggleButtonActive
              ]}
              onPress={() => setActiveTab('bookmarks')}
            >
              <Ionicons 
                name="bookmark-outline" 
                size={16} 
                color={activeTab === 'bookmarks' ? themeColors.primary : '#FFF'} 
              />
              <Text style={[
                styles.toggleText,
                activeTab === 'bookmarks' && { color: themeColors.primary }
              ]}>Saved</Text>
            </TouchableOpacity>
          </View>
          
          {activeTab === 'history' && history.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearAllHistory}
            >
              <Ionicons name="trash-outline" size={14} color="#FFF" />
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {activeTab === 'history' ? 'Activity Log' : 'Saved Routes'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {activeTab === 'history' ? `${history.length} recent searches` : `${bookmarks.length} bookmarked routes`}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {loading && !refreshing ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
          </View>
        ) : activeTab === 'history' ? (
          <FlatList
            data={history}
            keyExtractor={(item) => `history_${item.id}`}
            renderItem={renderHistoryItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            onRefresh={onRefresh}
            refreshing={refreshing}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIcon, { backgroundColor: themeColors.primaryMuted }]}>
                  <Ionicons name="time-outline" size={36} color={themeColors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No History</Text>
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>Your search history will appear here</Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={bookmarks}
            keyExtractor={(item) => `bookmark_${item.routeId}`}
            renderItem={renderBookmarkItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            onRefresh={onRefresh}
            refreshing={refreshing}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIcon, { backgroundColor: themeColors.primaryMuted }]}>
                  <Ionicons name="bookmark-outline" size={36} color={themeColors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Bookmarks</Text>
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>Save your favorite routes for quick access</Text>
              </View>
            }
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
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: BorderRadius.xxl,
    borderBottomRightRadius: BorderRadius.xxl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 4,
    borderRadius: BorderRadius.md,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#FFF',
  },
  toggleText: {
    color: '#FFF',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  clearButtonText: {
    color: '#FFF',
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  headerTitleContainer: {
    marginTop: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    fontWeight: '500',
  },
  body: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.mega,
    flexGrow: 1,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
    }),
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  busName: {
    fontSize: FontSize.base,
    fontWeight: '700',
  },
  busBn: {
    fontSize: FontSize.sm,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stopName: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
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
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  routePoint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  routeStopName: {
    fontSize: FontSize.sm,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  statText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.mega,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: FontSize.md,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});
