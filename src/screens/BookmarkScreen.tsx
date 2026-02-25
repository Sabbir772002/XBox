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

export default function BookmarkScreen({ navigation }: any) {
  const [bookmarks, setBookmarks] = useState<BookmarkedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [routeDetails, setRouteDetails] = useState<{ [key: string]: RouteStop[] }>({});
  const [loadingDetails, setLoadingDetails] = useState<{ [key: string]: boolean }>({});

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
    const newExpandedId = expandedId === item.id ? null : item.id;
    setExpandedId(newExpandedId);

    // Load route details if expanding and not already loaded
    if (newExpandedId && !routeDetails[item.id]) {
      setLoadingDetails({ ...loadingDetails, [item.id]: true });
      try {
        const details = await DatabaseService.getRouteDetails(
          item.routeId,
          item.fromStopId,
          item.toStopId
        );
        if (details) {
          setRouteDetails({ ...routeDetails, [item.id]: details.stops });
        }
      } catch (error) {
        console.error('Error loading route details:', error);
      } finally {
        setLoadingDetails({ ...loadingDetails, [item.id]: false });
      }
    }
  };

  const renderBookmarkItem = ({ item }: { item: BookmarkedRoute }) => {
    const isExpanded = expandedId === item.id;
    const stops = routeDetails[item.id] || [];
    const isLoadingStops = loadingDetails[item.id];

    return (
      <View style={styles.card}>
        {/* Main Card Header */}
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => toggleExpand(item)}
          activeOpacity={0.7}
        >
          <View style={styles.cardContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="bookmark" size={24} color="#C0191F" />
            </View>
            <View style={styles.textContainer}>
              <View style={styles.routeInfo}>
                <Text style={styles.stopName} numberOfLines={1}>{item.fromStopName}</Text>
                <Ionicons name="arrow-forward" size={16} color="#888" style={styles.arrow} />
                <Text style={styles.stopName} numberOfLines={1}>{item.toStopName}</Text>
              </View>
              <View style={styles.metaInfo}>
                <Text style={styles.routeId}>Route {item.routeId}</Text>
                <Text style={styles.separator}>•</Text>
                <Text style={styles.distance}>{item.distance.toFixed(1)} km</Text>
                <Text style={styles.separator}>•</Text>
                <Text style={styles.fare}>৳{item.fare.toFixed(0)}</Text>
              </View>
              {item.stopsCount && (
                <Text style={styles.stopsCount}>{item.stopsCount} stops</Text>
              )}
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.expandButton}
                onPress={() => toggleExpand(item)}
              >
                <Ionicons 
                  name={isExpanded ? "chevron-up" : "chevron-down"} 
                  size={24} 
                  color="#C0191F" 
                />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>

        {/* Expanded Details */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            {isLoadingStops ? (
              <View style={styles.loadingStops}>
                <Text style={styles.loadingStopsText}>Loading route details...</Text>
              </View>
            ) : stops.length > 0 ? (
              <View style={styles.stopsContainer}>
                <View style={styles.stopsHeader}>
                  <Ionicons name="map-outline" size={18} color="#C0191F" />
                  <Text style={styles.stopsHeaderText}>Route Stops</Text>
                </View>
                <ScrollView 
                  style={styles.stopsScrollView}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                >
                  {stops.map((stop, index) => {
                    const isFirst = index === 0;
                    const isLast = index === stops.length - 1;
                    const relativeDistance = Math.abs(stop.distance - stops[0].distance);
                    
                    return (
                      <View key={`${stop.stopId}-${index}`} style={styles.stopRow}>
                        <View style={styles.stopIndicatorContainer}>
                          {!isFirst && <View style={styles.stopLine} />}
                          <View style={[
                            styles.stopDot,
                            isFirst && styles.stopDotStart,
                            isLast && styles.stopDotEnd,
                            !isFirst && !isLast && styles.stopDotMiddle
                          ]}>
                            {isFirst && <Text style={styles.stopDotText}>🟢</Text>}
                            {isLast && <Text style={styles.stopDotText}>🔴</Text>}
                            {!isFirst && !isLast && <Text style={styles.stopDotText}>🟡</Text>}
                          </View>
                          {!isLast && <View style={styles.stopLine} />}
                        </View>
                        <View style={styles.stopInfo}>
                          <Text style={[
                            styles.stopNameText,
                            (isFirst || isLast) && styles.stopNameBold
                          ]}>
                            {stop.stopageEn}
                          </Text>
                          {stop.stopageBn && (
                            <Text style={styles.stopNameBn}>{stop.stopageBn}</Text>
                          )}
                          <Text style={styles.stopDistanceText}>
                            {relativeDistance.toFixed(2)} km
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                {/* Action Buttons */}
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={styles.detailsButton}
                    onPress={() => handleBookmarkClick(item)}
                  >
                    <Ionicons name="information-circle-outline" size={20} color="#FFF" />
                    <Text style={styles.detailsButtonText}>Full Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeButtonExpanded}
                    onPress={() => handleRemoveBookmark(item.routeId)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FFF" />
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.noStopsContainer}>
                <Text style={styles.noStopsText}>No route details available</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient
        colors={['#8D1117', '#C0191F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
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
    backgroundColor: '#F6EDF3',
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
    backgroundColor: '#FFFFFF22',
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
    color: '#FFF',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFFFFFCC',
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFF',
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
    backgroundColor: '#FFF',
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
    backgroundColor: '#FFF5F5',
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
    color: '#111',
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
    color: '#C0191F',
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
    color: '#066D6D',
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
    backgroundColor: '#F8F9FA',
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
    color: '#C0191F',
    marginLeft: 8,
  },
  stopsScrollView: {
    maxHeight: 300,
    backgroundColor: '#FFF',
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
    backgroundColor: '#066D6D',
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
    color: '#111',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
});
