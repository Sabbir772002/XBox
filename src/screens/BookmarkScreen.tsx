import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import StorageService, { BookmarkedRoute, SearchHistory } from '../services/StorageService';
import { useTheme } from '../theme/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';
import { DarkColors } from '../theme/darkColors';

export default function BookmarkScreen({ navigation }: any) {
  const [bookmarks, setBookmarks] = useState<BookmarkedRoute[]>([]);
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDark } = useTheme();
  const themeColors = isDark ? DarkColors : Colors;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [bookmarkData, historyData] = await Promise.all([
        StorageService.getBookmarks(),
        StorageService.getSearchHistory(),
      ]);
      setBookmarks(bookmarkData);
      setHistory(historyData.slice(0, 5));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
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

  const renderBookmarkItem = ({ item }: { item: BookmarkedRoute }) => (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: themeColors.surface,
          borderColor: isDark ? themeColors.border : 'transparent',
          borderWidth: isDark ? 1 : 0,
        },
      ]}
      onPress={() => {
        if (item.busId && item.busId > 0) {
          navigation.navigate('RouteDetails', {
            busId: item.busId,
            busName: item.busName,
            busBn: item.busBn,
            fromStopName: item.fromStopName,
            toStopName: item.toStopName,
            fromStopId: item.fromStopId,
            toStopId: item.toStopId,
          });
        } else {
          navigation.navigate('Search', {
            fromStopName: item.fromStopName,
            toStopName: item.toStopName,
          });
        }
      }}
      activeOpacity={0.7}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: themeColors.primaryMuted }]}>
          <Ionicons name="bookmark" size={18} color={themeColors.primary} />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.busName, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {item.busName}
          </Text>
          {item.busBn ? (
            <Text style={[styles.busBn, { color: themeColors.textTertiary }]} numberOfLines={1}>
              {item.busBn}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.removeBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)' }]}
          onPress={() => handleRemoveBookmark(item.routeId)}
        >
          <Ionicons name="trash-outline" size={16} color={themeColors.error} />
        </TouchableOpacity>
      </View>

      <View style={[styles.routeRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
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
      onPress={() => {
        navigation.navigate('Search', {
          fromStopName: item.fromStopName,
          toStopName: item.toStopName,
        });
      }}
      activeOpacity={0.7}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: themeColors.primaryMuted }]}>
          <Ionicons name="search-outline" size={18} color={themeColors.primary} />
        </View>
        <View style={styles.cardContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.busName, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {item.fromStopName}
            </Text>
            <Ionicons name="arrow-forward" size={12} color={themeColors.textTertiary} style={{ marginHorizontal: 6 }} />
            <Text style={[styles.busName, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {item.toStopName}
            </Text>
          </View>
          <Text style={[styles.busBn, { color: themeColors.textTertiary }]}>
            {item.routesFound} routes found
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
        <Text style={styles.headerTitle}>Saved & Recent</Text>
        <Text style={styles.headerSubtitle}>
          {bookmarks.length} bookmarks · {history.length} recent
        </Text>
      </LinearGradient>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              Loading...
            </Text>
          </View>
        ) : bookmarks.length === 0 && history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: themeColors.primaryMuted }]}>
              <Ionicons name="bookmark-outline" size={36} color={themeColors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
              Nothing Saved
            </Text>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              Search and save routes to see them here
            </Text>
          </View>
        ) : (
          <FlatList
            data={bookmarks}
            keyExtractor={(item) => `bookmark_${item.id}`}
            renderItem={renderBookmarkItem}
            ListHeaderComponent={
              history.length > 0 ? (
                <View style={{ marginBottom: Spacing.md }}>
                  <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Recent Searches</Text>
                  {history.map((item) => (
                    <View key={`history_${item.id}`}>
                      {renderHistoryItem({ item })}
                    </View>
                  ))}
                  <Text style={[styles.sectionTitle, { color: themeColors.textPrimary, marginTop: Spacing.md }]}>Saved Routes</Text>
                </View>
              ) : null
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
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
  body: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    marginBottom: Spacing.md,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
    }),
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
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
  busName: {
    fontSize: FontSize.base,
    fontWeight: '700',
  },
  busBn: {
    fontSize: FontSize.sm,
    marginTop: 1,
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
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
    marginTop: Spacing.sm,
  },
  statChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
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
    lineHeight: 22,
  },
});
