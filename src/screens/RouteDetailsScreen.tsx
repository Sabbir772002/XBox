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
import { useTheme } from '../theme/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';
import { DarkColors } from '../theme/darkColors';
import RouteMap, { MapCoordinate } from '../components/RouteMap';

interface TransferRoute {
  id: string;
  firstBus: Bus;
  secondBus: Bus;
  transferStop: BusStoppage;
  firstBusFromStop: string;
  firstBusToStop: string;
  secondBusFromStop: string;
  secondBusToStop: string;
  firstBusDistance: number;
  secondBusDistance: number;
  totalDistance: number;
  estimatedFare?: number;
}

interface Bus {
  id: number;
  nameEnglish: string;
  nameBangla?: string;
  serviceType?: string;
  totalStops: number;
  stoppages?: BusStoppage[];
  estimatedDistanceKm?: number;
  estimatedFare?: number;
}

export default function RouteDetailsScreen({ route, navigation }: any) {
  const { isDark } = useTheme();
  const themeColors = isDark ? DarkColors : Colors;
  const { busId, busName, busBn, fromStopName, toStopName, showFullRoute, transferRoute: passedTransferRoute } = route.params;
  const [busStoppages, setBusStoppages] = useState<BusStoppage[]>([]);
  const [secondBusStoppages, setSecondBusStoppages] = useState<BusStoppage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [journeyDistanceKm, setJourneyDistanceKm] = useState(0);
  const [estimatedFare, setEstimatedFare] = useState(10);
  const [mapPoints, setMapPoints] = useState<MapCoordinate[]>([]);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [isTransfer, setIsTransfer] = useState(false);
  const safeArea = useDynamicSafeArea();

  useEffect(() => {
    if (passedTransferRoute) {
      setIsTransfer(true);
      loadTransferBusStoppages();
    } else {
      setIsTransfer(false);
      loadBusStoppages();
    }
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

  const loadTransferBusStoppages = async () => {
    try {
      if (!passedTransferRoute) {
        setLoading(false);
        return;
      }

      const transferRoute = passedTransferRoute as TransferRoute;

      // Load first bus stoppages
      let firstStoppages: BusStoppage[] = [];
      firstStoppages = await DatabaseService.getBusStoppagesWithRouteMatch(
        transferRoute.firstBus.id,
        transferRoute.firstBusFromStop,
        transferRoute.transferStop.stopageEn
      );
      setBusStoppages(firstStoppages);

      // Load second bus stoppages
      let secondStoppages: BusStoppage[] = [];
      secondStoppages = await DatabaseService.getBusStoppagesWithRouteMatch(
        transferRoute.secondBus.id,
        transferRoute.transferStop.stopageEn,
        transferRoute.secondBusToStop
      );
      setSecondBusStoppages(secondStoppages);

      // Calculate total journey distance and fare
      const totalDistance = transferRoute.totalDistance;
      setJourneyDistanceKm(totalDistance);
      setEstimatedFare(
        transferRoute.estimatedFare ??
          Number(Math.max(10, totalDistance * 2.5).toFixed(2))
      );

      // Note: Map coordinates handling for transfer routes might need extension
      // For now, we'll skip the map for transfer routes or calculate combined coordinates
    } catch (error) {
      console.error('Error loading transfer bus stoppages:', error);
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
        busId,
        busName,
        busBn || '',
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
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading bus details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!busName) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={themeColors.error} />
          <Text style={[styles.errorText, { color: themeColors.textPrimary }]}>Bus details not available</Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: themeColors.primary }]}
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

    let dotColor = themeColors.textMuted;
    let lineColor = themeColors.borderLight;
    let badgeText = '';
    let badgeBg = themeColors.pill;
    let fontWeight: '400' | '600' | '700' = '400';

    if (isFirst) {
      dotColor = themeColors.success;
      lineColor = themeColors.success;
      badgeText = 'SOURCE';
      badgeBg = themeColors.success;
      fontWeight = '700';
    } else if (isLast) {
      dotColor = themeColors.error;
      lineColor = themeColors.error;
      badgeText = 'DEST';
      badgeBg = themeColors.error;
      fontWeight = '700';
    } else if (isInRoute) {
      dotColor = themeColors.primary;
      lineColor = themeColors.primary;
      badgeText = 'VIA';
      badgeBg = themeColors.primary;
      fontWeight = '600';
    }

    return (
      <View key={`${stoppage.stopId}-${index}`} style={styles.stopContainer}>
        <View style={styles.stopIndicatorContainer}>
          {index > 0 && <View style={[styles.lineTop, { backgroundColor: lineColor }]} />}
          <View style={[styles.stopDot, { backgroundColor: dotColor }]}>
            {isFirst && <Ionicons name="play" size={12} color={themeColors.textLight} />}
            {isLast && <Ionicons name="stop" size={12} color={themeColors.textLight} />}
          </View>
          {index < busStoppages.length - 1 && (
            <View style={[styles.lineBottom, { backgroundColor: lineColor }]} />
          )}
        </View>

        <View style={styles.stopInfoContainer}>
          <View style={styles.stopLabelRow}>
            <Text style={[styles.stopName, { fontWeight, color: themeColors.textPrimary }]}>{stoppage.stopageEn}</Text>
            {badgeText && (
              <View style={[styles.stopBadge, { backgroundColor: badgeBg }]}>
                <Text style={styles.stopBadgeText}>{badgeText}</Text>
              </View>
            )}
          </View>
          {stoppage.stopageBn && (
            <Text style={[styles.stopNameBn, { fontWeight: '500', color: themeColors.textSecondary }]}>
              {stoppage.stopageBn}
            </Text>
          )}
          <View style={styles.distanceRow}>
            <Text style={[styles.distanceText, { color: themeColors.textPrimary }]}>
              +{(stoppage.segmentDistanceKm ?? 0).toFixed(2)} km
            </Text>
            {typeof stoppage.journeyDistanceKm === 'number' && (
              <Text style={[styles.distanceTextMuted, { color: themeColors.textTertiary }]}>
                trip {(stoppage.journeyDistanceKm ?? 0).toFixed(2)} km
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <LinearGradient
        colors={[themeColors.gradientStart, themeColors.gradientEnd]}
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
            {isTransfer && passedTransferRoute ? (
              <>
                <View style={styles.transferHeaderRow}>
                  <Text style={[styles.headerTitle, { color: themeColors.textLight }]} numberOfLines={1}>
                    {passedTransferRoute.firstBus.nameEnglish}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginHorizontal: Spacing.sm }} />
                  <Text style={[styles.headerTitle, { color: themeColors.textLight }]} numberOfLines={1}>
                    {passedTransferRoute.secondBus.nameEnglish}
                  </Text>
                </View>
                <Text style={[styles.headerSubtitle, { color: themeColors.whiteOverlay20 }]}>
                  Transfer at {passedTransferRoute.transferStop.stopageEn}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.headerTitle, { color: themeColors.textLight }]} numberOfLines={1}>
                  {busName}
                </Text>
                {busBn && (
                  <Text style={[styles.headerRouteBn, { color: themeColors.textLight }]} numberOfLines={1}>
                    {busBn}
                  </Text>
                )}
                <Text style={[styles.headerSubtitle, { color: themeColors.whiteOverlay20 }]}>
                  {busStoppages.length} stops
                </Text>
              </>
            )}
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
        style={[styles.body, { backgroundColor: themeColors.background }]}
        contentContainerStyle={{
          paddingBottom: safeArea.bottom + 16,
        }}
      >
        <View style={[styles.summaryCard, { backgroundColor: themeColors.surface }]}>
          {isTransfer && passedTransferRoute ? (
            <>
              <View style={styles.summaryRow}>
                <Ionicons name="location-outline" size={20} color={themeColors.primary} />
                <View style={styles.summaryTextContainer}>
                  <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>Starting Point</Text>
                  <Text style={[styles.summaryValue, { color: themeColors.textPrimary }]}>{passedTransferRoute.firstBusFromStop}</Text>
                </View>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: themeColors.borderLight }]} />

              <View style={styles.summaryRow}>
                <View style={[styles.transferPointBadge, { backgroundColor: themeColors.warning }]}>
                  <Ionicons name="swap-horizontal" size={16} color="#FFF" />
                </View>
                <View style={styles.summaryTextContainer}>
                  <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>Transfer Point</Text>
                  <Text style={[styles.summaryValue, { color: themeColors.textPrimary }]}>{passedTransferRoute.transferStop.stopageEn}</Text>
                </View>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: themeColors.borderLight }]} />

              <View style={styles.summaryRow}>
                <Ionicons name="flag-outline" size={20} color={themeColors.error} />
                <View style={styles.summaryTextContainer}>
                  <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>Destination</Text>
                  <Text style={[styles.summaryValue, { color: themeColors.textPrimary }]}>{passedTransferRoute.secondBusToStop}</Text>
                </View>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: themeColors.borderLight }]} />

              <View style={styles.summaryRow}>
                <Ionicons name="walk-outline" size={20} color={themeColors.info} />
                <View style={styles.summaryTextContainer}>
                  <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>Total Distance</Text>
                  <Text style={[styles.summaryValue, { color: themeColors.textPrimary }]}>{journeyDistanceKm.toFixed(2)} km</Text>
                </View>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: themeColors.borderLight }]} />

              <View style={styles.summaryRow}>
                <Ionicons name="cash-outline" size={20} color={themeColors.warning} />
                <View style={styles.summaryTextContainer}>
                  <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>Estimated Fare</Text>
                  <Text style={[styles.summaryValue, { color: themeColors.textPrimary }]}>৳ {estimatedFare.toFixed(2)}</Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.summaryRow}>
                <Ionicons name="location-outline" size={20} color={themeColors.primary} />
                <View style={styles.summaryTextContainer}>
                  <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>Starting Point</Text>
                  <Text style={[styles.summaryValue, { color: themeColors.textPrimary }]}>{fromStopName}</Text>
                </View>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: themeColors.borderLight }]} />

              <View style={styles.summaryRow}>
                <Ionicons name="flag-outline" size={20} color={themeColors.error} />
                <View style={styles.summaryTextContainer}>
                  <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>Destination</Text>
                  <Text style={[styles.summaryValue, { color: themeColors.textPrimary }]}>{toStopName}</Text>
                </View>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: themeColors.borderLight }]} />

              <View style={styles.summaryRow}>
                <Ionicons name="list" size={20} color={themeColors.primary} />
                <View style={styles.summaryTextContainer}>
                  <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>Total Stoppages</Text>
                  <Text style={[styles.summaryValue, { color: themeColors.textPrimary }]}>{busStoppages.length}</Text>
                </View>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: themeColors.borderLight }]} />

              <View style={styles.summaryRow}>
                <Ionicons name="walk-outline" size={20} color={themeColors.info} />
                <View style={styles.summaryTextContainer}>
                  <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>Journey Distance</Text>
                  <Text style={[styles.summaryValue, { color: themeColors.textPrimary }]}>{journeyDistanceKm.toFixed(2)} km</Text>
                </View>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: themeColors.borderLight }]} />

              <View style={styles.summaryRow}>
                <Ionicons name="cash-outline" size={20} color={themeColors.warning} />
                <View style={styles.summaryTextContainer}>
                  <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>Estimated Fare</Text>
                  <Text style={[styles.summaryValue, { color: themeColors.textPrimary }]}>৳ {estimatedFare.toFixed(2)}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
          {isTransfer ? 'Journey Route' : 'Route Stoppages'}
        </Text>

        {/* Collapsible Map Section */}
        <TouchableOpacity
          style={[styles.mapToggleButton, { backgroundColor: themeColors.surface }]}
          onPress={() => setMapExpanded(!mapExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.mapToggleContent}>
            <View style={styles.mapToggleLeft}>
              <Ionicons name="map" size={22} color={themeColors.primary} />
              <Text style={[styles.mapToggleText, { color: themeColors.textPrimary }]}>Live Route Map (OSM)</Text>
            </View>
            <Ionicons 
              name={mapExpanded ? "chevron-up" : "chevron-down"} 
              size={24} 
              color={themeColors.primary} 
            />
          </View>
        </TouchableOpacity>

        {mapExpanded && (
          <View style={[styles.mapCard, { backgroundColor: themeColors.surface, borderColor: themeColors.borderLight }]}>
            <RouteMap points={mapPoints} height={260} />
          </View>
        )}

        <View style={styles.stopsListContainer}>
          {isTransfer && passedTransferRoute ? (
            <>
              {/* First Bus Section */}
              <View style={[styles.busLegSection, { borderColor: themeColors.primary }]}>
                <View style={[styles.busLegHeader, { backgroundColor: themeColors.primary }]}>
                  <Ionicons name="bus" size={18} color="#FFF" />
                  <Text style={[styles.busLegTitle, { color: '#FFF' }]}>
                    {passedTransferRoute.firstBus.nameEnglish}
                  </Text>
                </View>
                <View style={styles.busLegContent}>
                  {busStoppages.length > 0 ? (
                    busStoppages.map((stoppage, index) => renderStoppage(stoppage, index))
                  ) : (
                    <Text style={[styles.noStoppagesText, { color: themeColors.textSecondary }]}>
                      No stoppages available
                    </Text>
                  )}
                </View>
              </View>

              {/* Transfer Point Indicator */}
              <View style={[styles.transferPointIndicator, { backgroundColor: themeColors.warning }]}>
                <View style={styles.transferPointContent}>
                  <Ionicons name="swap-horizontal" size={20} color="#FFF" />
                  <Text style={styles.transferPointText}>
                    Change at {passedTransferRoute.transferStop.stopageEn}
                  </Text>
                </View>
              </View>

              {/* Second Bus Section */}
              <View style={[styles.busLegSection, { borderColor: themeColors.info }]}>
                <View style={[styles.busLegHeader, { backgroundColor: themeColors.info }]}>
                  <Ionicons name="bus" size={18} color="#FFF" />
                  <Text style={[styles.busLegTitle, { color: '#FFF' }]}>
                    {passedTransferRoute.secondBus.nameEnglish}
                  </Text>
                </View>
                <View style={styles.busLegContent}>
                  {secondBusStoppages.length > 0 ? (
                    secondBusStoppages.map((stoppage, index) => renderStoppage(stoppage, index))
                  ) : (
                    <Text style={[styles.noStoppagesText, { color: themeColors.textSecondary }]}>
                      No stoppages available
                    </Text>
                  )}
                </View>
              </View>
            </>
          ) : (
            <>
              {busStoppages.length > 0 ? (
                busStoppages.map((stoppage, index) => renderStoppage(stoppage, index))
              ) : (
                <Text style={[styles.noStoppagesText, { color: themeColors.textSecondary }]}>
                  No stoppages available
                </Text>
              )}
            </>
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
  transferHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  transferPointBadge: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.warning,
  },
  busLegSection: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    shadowColor: Colors.shadowPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  busLegHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    gap: Spacing.md,
  },
  busLegTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textLight,
  },
  busLegContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  transferPointIndicator: {
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.warning,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferPointContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  transferPointText: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textLight,
  },
});
