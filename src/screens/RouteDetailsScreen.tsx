import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  ToastAndroid,
  Platform,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDynamicSafeArea } from '../hooks/useDynamicSafeArea';
import DatabaseService, { BusStoppage } from '../services/DatabaseService';
import StorageService from '../services/StorageService';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';
import RouteMap, { MapCoordinate } from '../components/RouteMap';

export default function RouteDetailsScreen({ route, navigation }: any) {
  const { busId, busName, busBn, fromStopName, toStopName, showFullRoute } = route.params;
  const [busStoppages, setBusStoppages] = useState<BusStoppage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [journeyDistanceKm, setJourneyDistanceKm] = useState(0);
  const [estimatedFare, setEstimatedFare] = useState(10);
  const [mapPoints, setMapPoints] = useState<MapCoordinate[]>([]);
  const [mapExpanded, setMapExpanded] = useState(false);
  const safeArea = useDynamicSafeArea();

  useEffect(() => {
    loadBusStoppages();
    checkBookmarkStatus();
  }, []);

  const loadBusStoppages = async () => {
    try {
      const fromName = showFullRoute ? undefined : fromStopName;
      const toName = showFullRoute ? undefined : toStopName;

      let stoppages: BusStoppage[] = [];
      if (fromName && toName) {
        stoppages = await DatabaseService.getBusStoppagesWithRouteMatch(busId, fromName, toName);
      } else {
        const fullStops = await DatabaseService.getBusDetails(busId);
        stoppages = fullStops.map((item, index) => ({
          stopOrder: item.stopOrder,
          stopId: item.stopId,
          stopageEn: item.stopageEn ?? '',
          stopageBn: item.stopageBn ?? '',
          segmentDistanceKm: index === 0 ? 0 : Math.max(0, (item.distance - fullStops[index - 1].distance) / 1000),
          cumulativeDistanceKm: item.distance / 1000,
          isInRoute: true,
          isJourneyStart: index === 0,
          isJourneyEnd: index === fullStops.length - 1,
          journeyDistanceKm: item.distance / 1000,
        }));
      }
      setBusStoppages(stoppages);

      const journeyStops = showFullRoute ? stoppages : stoppages.filter((s) => s.isInRoute);
      const lastJourneyStop = journeyStops[journeyStops.length - 1];
      const totalDistance = Number((lastJourneyStop?.journeyDistanceKm ?? 0).toFixed(2));
      setJourneyDistanceKm(totalDistance);
      setEstimatedFare(Number(Math.max(10, totalDistance * 2.5).toFixed(2)));

      const coords = await DatabaseService.getBusRouteCoordinates(busId, fromName, toName);
      setMapPoints(coords);
    } catch (error) {
      console.error('Error loading bus stoppages:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkBookmarkStatus = async () => {
    const bookmarked = await StorageService.isBookmarked(`bus_${busId}`, 1, 1);
    setIsBookmarked(bookmarked);
  };

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('', message);
    }
  };

  const handleBookmarkToggle = async () => {
    if (!busName) return;

    if (isBookmarked) {
      await StorageService.removeBookmark(`bus_${busId}`, 1, 1);
      setIsBookmarked(false);
      showToast('Bookmark removed');
    } else {
      const success = await StorageService.addBookmark(
        `bus_${busId}`,
        1,
        1,
        fromStopName,
        toStopName,
        journeyDistanceKm,
        busStoppages.length
      );
      if (success) {
        setIsBookmarked(true);
        showToast('Bus bookmarked');
      } else {
        showToast('Already bookmarked');
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C0191F" />
          <Text style={styles.loadingText}>Loading bus details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!busName) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#C0191F" />
          <Text style={styles.errorText}>Bus details not available</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderStoppage = (stoppage: BusStoppage, index: number) => {
    const isFirst = stoppage.isJourneyStart;
    const isLast = stoppage.isJourneyEnd;
    const isInRoute = stoppage.isInRoute;

    let dotColor = Colors.textMuted;
    let lineColor = Colors.borderLight;
    let badgeText = '';
    let badgeBg = Colors.pill;
    let fontWeight: '400' | '600' | '700' = '400';

    if (isFirst) {
      dotColor = Colors.success;
      lineColor = Colors.success;
      badgeText = 'SOURCE';
      badgeBg = Colors.success;
      fontWeight = '700';
    } else if (isLast) {
      dotColor = Colors.error;
      lineColor = Colors.error;
      badgeText = 'DEST';
      badgeBg = Colors.error;
      fontWeight = '700';
    } else if (isInRoute) {
      dotColor = Colors.primary;
      lineColor = Colors.primary;
      badgeText = 'VIA';
      badgeBg = Colors.primary;
      fontWeight = '600';
    }

    return (
      <View key={`${stoppage.stopId}-${index}`} style={styles.stopContainer}>
        <View style={styles.stopIndicatorContainer}>
          {index > 0 && <View style={[styles.lineTop, { backgroundColor: lineColor }]} />}
          <View style={[styles.stopDot, { backgroundColor: dotColor }]}>
            {isFirst && <Ionicons name="play" size={12} color={Colors.textLight} />}
            {isLast && <Ionicons name="stop" size={12} color={Colors.textLight} />}
          </View>
          {index < busStoppages.length - 1 && (
            <View style={[styles.lineBottom, { backgroundColor: lineColor }]} />
          )}
        </View>

        <View style={styles.stopInfoContainer}>
          <View style={styles.stopLabelRow}>
            <Text style={[styles.stopName, { fontWeight }]}>{stoppage.stopageEn}</Text>
            {badgeText && (
              <View style={[styles.stopBadge, { backgroundColor: badgeBg }]}>
                <Text style={styles.stopBadgeText}>{badgeText}</Text>
              </View>
            )}
          </View>
          {stoppage.stopageBn && (
            <Text style={[styles.stopNameBn, { fontWeight: '500' }]}>
              {stoppage.stopageBn}
            </Text>
          )}
          <View style={styles.distanceRow}>
            <Text style={styles.distanceText}>
              +{(stoppage.segmentDistanceKm ?? 0).toFixed(2)} km
            </Text>
            {typeof stoppage.journeyDistanceKm === 'number' && (
              <Text style={styles.distanceTextMuted}>
                trip {(stoppage.journeyDistanceKm ?? 0).toFixed(2)} km
              </Text>
            )}
          </View>
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
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {busName}
            </Text>
            {busBn && (
              <Text style={styles.headerRouteBn} numberOfLines={1}>
                {busBn}
              </Text>
            )}
            <Text style={styles.headerSubtitle}>
              {busStoppages.length} stops
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bookmarkButton}
            onPress={handleBookmarkToggle}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color="#FFF"
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.body}
        contentContainerStyle={{
          paddingBottom: safeArea.bottom + 16,
        }}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Ionicons name="location-outline" size={20} color={Colors.primary} />
            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryLabel}>Starting Point</Text>
              <Text style={styles.summaryValue}>{fromStopName}</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Ionicons name="flag-outline" size={20} color={Colors.error} />
            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryLabel}>Destination</Text>
              <Text style={styles.summaryValue}>{toStopName}</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Ionicons name="list" size={20} color={Colors.primary} />
            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryLabel}>Total Stoppages</Text>
              <Text style={styles.summaryValue}>{busStoppages.length}</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Ionicons name="walk-outline" size={20} color={Colors.info} />
            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryLabel}>Journey Distance</Text>
              <Text style={styles.summaryValue}>{journeyDistanceKm.toFixed(2)} km</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Ionicons name="cash-outline" size={20} color={Colors.warning} />
            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryLabel}>Estimated Fare</Text>
              <Text style={styles.summaryValue}>৳ {estimatedFare.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Route Stoppages</Text>

        {/* Collapsible Map Section */}
        <TouchableOpacity
          style={styles.mapToggleButton}
          onPress={() => setMapExpanded(!mapExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.mapToggleContent}>
            <View style={styles.mapToggleLeft}>
              <Ionicons name="map" size={22} color={Colors.primary} />
              <Text style={styles.mapToggleText}>Live Route Map (OSM)</Text>
            </View>
            <Ionicons 
              name={mapExpanded ? "chevron-up" : "chevron-down"} 
              size={24} 
              color={Colors.primary} 
            />
          </View>
        </TouchableOpacity>

        {mapExpanded && (
          <View style={styles.mapCard}>
            <RouteMap points={mapPoints} height={260} />
          </View>
        )}

        <View style={styles.stopsListContainer}>
          {busStoppages.length > 0 ? (
            busStoppages.map((stoppage, index) => renderStoppage(stoppage, index))
          ) : (
            <Text style={styles.noStoppagesText}>No stoppages available</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
    shadowColor: Colors.shadowPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backIconButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.whiteOverlay20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textLight,
  },
  headerRouteBn: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textLight,
    opacity: 0.95,
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    opacity: 0.9,
    marginTop: 4,
  },
  bookmarkButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.whiteOverlay20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  summaryCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    shadowColor: Colors.shadowPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryTextContainer: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginTop: 4,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  stopsListContainer: {
    paddingHorizontal: Spacing.lg,
  },
  mapCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  mapTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  stopContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  stopIndicatorContainer: {
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  lineTop: {
    width: 2,
    height: Spacing.lg,
  },
  stopDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineBottom: {
    width: 2,
    height: Spacing.lg,
  },
  stopInfoContainer: {
    flex: 1,
    paddingVertical: Spacing.sm,
  },
  stopLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  stopName: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  stopBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.sm,
  },
  stopBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    fontWeight: '600',
  },
  stopNameBn: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
    gap: Spacing.md,
  },
  distanceText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  distanceTextMuted: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  errorText: {
    marginTop: Spacing.lg,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  backButtonText: {
    color: Colors.textLight,
    fontWeight: '600',
  },
  noStoppagesText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: FontSize.base,
    marginVertical: Spacing.lg,
  },
  mapToggleButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  mapToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  mapToggleText: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.primary,
  },
});
