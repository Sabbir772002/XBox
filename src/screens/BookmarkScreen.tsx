import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import StorageService, { BookmarkedRoute } from '../services/StorageService';
import DatabaseService, { RouteStop } from '../services/DatabaseService';
import { Colors } from '../theme/colors';

export default function BookmarkScreen({ navigation }: any) {
  const [bookmarks, setBookmarks] = useState<BookmarkedRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadBookmarks();
    }, [])
  );

  const loadBookmarks = async () => {
    try {
      const data = await StorageService.getBookmarks();
      setBookmarks(data);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookmarkClick = (item: BookmarkedRoute) => {
    navigation.navigate('RouteDetails', {
      routeId: item.routeId,
      fromStopId: item.fromStopId,
      toStopId: item.toStopId,
      fromStopName: item.fromStopName,
      toStopName: item.toStopName,
    });
  };

  const handleRemoveBookmark = async (routeId: string) => {
    Alert.alert(
      'Remove Bookmark',
      'Are you sure you want to remove this bookmark?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await StorageService.removeBookmark(routeId);
            loadBookmarks();
          },
        },
      ]
    );
  };

  const toggleExpand = async (item: BookmarkedRoute) => {
    // Directly navigate to details
    handleBookmarkClick(item);
  };

  const renderBookmarkItem = ({ item }: { item: BookmarkedRoute }) => {
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => handleBookmarkClick(item)}
          activeOpacity={0.7}
        >
          <View style={styles.cardContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="bookmark" size={24} color={Colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <View style={styles.routeInfo}>
                <Text style={styles.stopName} numberOfLines={1}>{item.fromStopName}</Text>
                <Ionicons name="arrow-forward" size={16} color="#888" style={styles.arrow} />
                <Text style={styles.stopName} numberOfLines={1}>{item.toStopName}</Text>
              </View>
              <View style={styles.metaInfo}>
                <Text style={styles.routeId}>Bus {item.routeId}</Text>
                <Text style={styles.separator}>•</Text>
                <Text style={styles.distance}>{item.distance.toFixed(1)} km</Text>
                <Text style={styles.separator}>•</Text>
                <Text style={styles.fare}>৳{item.fare.toFixed(0)}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={Colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => handleBookmarkClick(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="information-circle-outline" size={18} color="#FFF" />
            <Text style={styles.detailsButtonText}>View Details</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeButtonExpanded}
            onPress={() => handleRemoveBookmark(item.routeId)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color="#FFF" />
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient
        colors={[Colors.gradientStart, Colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.backButton}>
            <Ionicons name="bookmark-outline" size={20} color={Colors.textLight} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Bookmarks</Text>
            <Text style={styles.headerSubtitle}>{bookmarks.length} saved routes</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : bookmarks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={64} color="#CCC" />
            <Text style={styles.emptyTitle}>No Bookmarks</Text>
            <Text style={styles.emptyText}>
              Bookmark your favorite routes for quick access
            </Text>
          </View>
        ) : (
          <FlatList
            data={bookmarks}
            keyExtractor={(item) => item.id}
            renderItem={renderBookmarkItem}
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
    backgroundColor: Colors.backgroundLight,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    ...Platform.select({
      android: {
        elevation: 4,
      },
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      },
    }),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.whiteOverlay20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textLight,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.whiteOverlay30,
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    ...Platform.select({
      android: {
        elevation: 3,
      },
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
    }),
  },
  cardHeader: {
    backgroundColor: Colors.surface,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.hoverAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  stopName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    maxWidth: '40%',
  },
  arrow: {
    marginHorizontal: 8,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  routeId: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
  },
  separator: {
    marginHorizontal: 8,
    color: '#CCC',
    fontSize: 12,
  },
  distance: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  fare: {
    fontSize: 13,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  stopsCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'column',
    alignItems: 'center',
    marginLeft: 8,
  },
  expandButton: {
    padding: 4,
  },
  removeButton: {
    marginLeft: 8,
    padding: 4,
  },
  expandedContent: {
    backgroundColor: Colors.hover,
    borderTopWidth: 1,
    borderTopColor: '#E8EAED',
    paddingTop: 12,
  },
  loadingStops: {
    padding: 20,
    alignItems: 'center',
  },
  loadingStopsText: {
    fontSize: 14,
    color: '#666',
  },
  stopsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  stopsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stopsHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 8,
  },
  stopsScrollView: {
    maxHeight: 300,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  stopRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stopIndicatorContainer: {
    alignItems: 'center',
    width: 30,
    marginRight: 12,
  },
  stopLine: {
    width: 3,
    flex: 1,
    backgroundColor: '#DDD',
  },
  stopDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#DDD',
  },
  stopDotStart: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  stopDotEnd: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  stopDotMiddle: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFC107',
  },
  stopDotText: {
    fontSize: 14,
  },
  stopInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  stopNameText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  stopNameBold: {
    fontWeight: '700',
    fontSize: 15,
    color: '#111',
  },
  stopNameBn: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  stopDistanceText: {
    fontSize: 11,
    color: '#999',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  detailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDark,
    paddingVertical: 12,
    borderRadius: 10,
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 6,
  },
  removeButtonExpanded: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4444',
    paddingVertical: 12,
    borderRadius: 10,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 6,
  },
  noStopsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noStopsText: {
    fontSize: 14,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
});
