import React, { useEffect, useState, useMemo } from 'react';
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
import { DetailedRoute, RoutePathStop } from '../services/TransitNetworkService';
import DataMigrationService from '../services/DataMigrationService';

export default function RouteDetailsScreen({ route, navigation }: any) {
  const { isDark } = useTheme();
  const themeColors = isDark ? DarkColors : Colors;
  const safeArea = useDynamicSafeArea();

  // Can receive EITHER algorithm route OR legacy bus params
  const {
    algorithmRoute,
    busId,
    busName,
    busBn,
    fromStopName,
    toStopName,
    showFullRoute,
    transferRoute: passedTransferRoute,
  } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  // Algorithm route data
  const [detailedRoute, setDetailedRoute] = useState<DetailedRoute | null>(null);

  // Legacy fallback data
  const [legacyStoppages, setLegacyStoppages] = useState<BusStoppage[]>([]);
  const [legacySecondStoppages, setLegacySecondStoppages] = useState<BusStoppage[]>([]);
  const [journeyDistanceKm, setJourneyDistanceKm] = useState(0);
  const [serviceType, setServiceType] = useState('');
  const [fareRate, setFareRate] = useState(2.45);
  const [minFare, setMinFare] = useState(10);
  const [estimatedFare, setEstimatedFare] = useState(0);

  const isAlgorithmRoute = !!algorithmRoute;

  // Map coordinates from algorithm route
  const mapPoints: MapCoordinate[] = useMemo(() => {
    if (!detailedRoute) return [];
    return detailedRoute.path
      .filter((p) => p.coordinates && p.coordinates.length >= 2)
      .map((p) => ({
        lat: p.coordinates![0],
        lng: p.coordinates![1],
        stopName: p.stop_name,
      }));
  }, [detailedRoute]);

  useEffect(() => {
    if (isAlgorithmRoute) {
      setDetailedRoute(algorithmRoute);
      setLoading(false);
    } else if (passedTransferRoute) {
      loadTransferBusStoppages();
    } else if (busId) {
      loadBusStoppages();
    } else {
      setLoading(false);
    }
    if (busId) checkBookmarkStatus();
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
          segmentDistanceKm:
            index === 0 ? 0 : Math.max(0, (item.distance - fullStops[index - 1].distance) / 1000),
          cumulativeDistanceKm: item.distance / 1000,
          isInRoute: true,
          isJourneyStart: index === 0,
          isJourneyEnd: index === fullStops.length - 1,
          journeyDistanceKm: item.distance / 1000,
        }));
      }
      setLegacyStoppages(stoppages);

      const journeyStops = showFullRoute ? stoppages : stoppages.filter((s) => s.isInRoute);
      const lastStop = journeyStops[journeyStops.length - 1];
      const totalDist = Number((lastStop?.journeyDistanceKm ?? 0).toFixed(2));
      setJourneyDistanceKm(totalDist);

      const busInfo = DataMigrationService.busData.find((b) => b.id === busId);
      setServiceType(busInfo?.serviceType || 'Regular');
      const rate = busInfo?.fare_weight || 2.45;
      const min = busInfo?.min_fare || 10;
      setFareRate(rate);
      setMinFare(min);
      setEstimatedFare(Math.ceil(Math.max(min, totalDist * rate)));
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
      const tr = passedTransferRoute;

      const firstStops = await DatabaseService.getBusStoppagesWithRouteMatch(
        tr.firstBus.id,
        tr.firstBusFromStop,
        tr.transferStop.stopageEn,
      );
      setLegacyStoppages(firstStops);

      const secondStops = await DatabaseService.getBusStoppagesWithRouteMatch(
        tr.secondBus.id,
        tr.transferStop.stopageEn,
        tr.secondBusToStop,
      );
      setLegacySecondStoppages(secondStops);

      setJourneyDistanceKm(tr.totalDistance);
      // For transfer routes, we don't have a single rate/min easily accessible here without more lookups
      // but we can at least set the total estimated fare
      setEstimatedFare(Math.ceil(tr.estimatedFare || Math.max(10, tr.totalDistance * 2.45)));
    } catch (error) {
      console.error('Error loading transfer stoppages:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkBookmarkStatus = async () => {
    if (busId) {
      const bookmarked = await StorageService.isBookmarked(`bus_${busId}`, 1, 1);
      setIsBookmarked(bookmarked);
    }
  };

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('', message);
    }
  };

  const handleBookmarkToggle = async () => {
    const name = isAlgorithmRoute ? detailedRoute?.legs[0]?.busName : busName;
    if (!name) return;

    const id = isAlgorithmRoute ? `algo_route` : `bus_${busId}`;

    if (isBookmarked) {
      await StorageService.removeBookmark(id, 1, 1);
      setIsBookmarked(false);
      showToast('Bookmark removed');
    } else {
      const success = await StorageService.addBookmark(
        id,
        busId || 0,
        name,
        busBn || '',
        1,
        1,
        fromStopName,
        toStopName,
        isAlgorithmRoute ? detailedRoute!.total_distance_km : journeyDistanceKm,
        isAlgorithmRoute ? detailedRoute!.path.length : legacyStoppages.length,
      );
      if (success) {
        setIsBookmarked(true);
        showToast('Route bookmarked');
      }
    }
  };

  // Loading State
  if (loading) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: themeColors.background }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
            Loading route details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Algorithm Route View ──────────────────────────────────────────────────

  if (isAlgorithmRoute && detailedRoute) {
    const getTypeColor = () => {
      if (detailedRoute.type === 'Direct') return themeColors.routeDirect;
      if (detailedRoute.type === '1 Transfer') return themeColors.routeTransfer1;
      return themeColors.routeTransfer2;
    };

    const typeColor = getTypeColor();

    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: themeColors.background }]}
        edges={['top']}
      >
        {/* Header */}
        <LinearGradient
          colors={[themeColors.gradientStart, themeColors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.backIconButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <View style={styles.headerTitleRow}>
                {detailedRoute.legs.map((leg, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && (
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color="rgba(255,255,255,0.6)"
                        style={{ marginHorizontal: 4 }}
                      />
                    )}
                    <Text
                      style={[styles.headerTitle, { color: '#FFF' }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {leg.busName}
                    </Text>
                  </React.Fragment>
                ))}
              </View>
              <View style={styles.headerMetaRow}>
                <View style={[styles.headerBadge, { backgroundColor: typeColor + '33' }]}>
                  <Text style={[styles.headerBadgeText, { color: '#FFF' }]}>
                    {detailedRoute.type}
                  </Text>
                </View>
                <Text style={[styles.headerSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
                  {detailedRoute.path.length} stops
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.bookmarkButton} onPress={handleBookmarkToggle}>
              <Ionicons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color="#FFF"
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView
          style={[styles.body, { backgroundColor: themeColors.background }]}
          contentContainerStyle={{ paddingBottom: safeArea.bottom + 16 }}
        >
          {/* Summary Card */}
          <View style={[styles.summaryCard, { backgroundColor: themeColors.surface }]}>
            {/* Route summary row */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryIcon, { backgroundColor: themeColors.successLight || 'rgba(16,185,129,0.12)' }]}>
                <Ionicons name="location" size={18} color={themeColors.success} />
              </View>
              <View style={styles.summaryTextContainer}>
                <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>From</Text>
                <Text style={[styles.summaryValue, { color: themeColors.textPrimary }]}>
                  {fromStopName || detailedRoute.legs[0]?.from}
                </Text>
              </View>
            </View>

            <View style={[styles.summaryDivider, { backgroundColor: themeColors.borderLight }]} />

            {/* Transfer points */}
            {detailedRoute.transfer_points.map((tp, i) => (
              <React.Fragment key={i}>
                <View style={styles.summaryRow}>
                  <View style={[styles.summaryIcon, { backgroundColor: themeColors.warningLight || 'rgba(245,158,11,0.12)' }]}>
                    <Ionicons name="swap-horizontal" size={18} color={themeColors.warning} />
                  </View>
                  <View style={styles.summaryTextContainer}>
                    <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>
                      Transfer {i + 1}
                    </Text>
                    <Text style={[styles.summaryValue, { color: themeColors.textPrimary }]}>
                      {tp}
                    </Text>
                  </View>
                </View>
                <View
                  style={[styles.summaryDivider, { backgroundColor: themeColors.borderLight }]}
                />
              </React.Fragment>
            ))}

            <View style={styles.summaryRow}>
              <View style={[styles.summaryIcon, { backgroundColor: themeColors.errorLight || 'rgba(239,68,68,0.12)' }]}>
                <Ionicons name="flag" size={18} color={themeColors.error} />
              </View>
              <View style={styles.summaryTextContainer}>
                <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>To</Text>
                <Text style={[styles.summaryValue, { color: themeColors.textPrimary }]}>
                  {toStopName || detailedRoute.legs[detailedRoute.legs.length - 1]?.to}
                </Text>
              </View>
            </View>

            <View style={[styles.summaryDivider, { backgroundColor: themeColors.borderLight }]} />

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={[styles.statBox, { backgroundColor: themeColors.primaryMuted }]}>
                <Ionicons name="navigate-outline" size={16} color={themeColors.primary} />
                <Text style={[styles.statValue, { color: themeColors.textPrimary }]}>
                  {detailedRoute.total_distance_km.toFixed(1)} km
                </Text>
                <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>
                  Distance
                </Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: themeColors.successLight || 'rgba(16,185,129,0.12)' }]}>
                <Ionicons name="cash-outline" size={16} color={themeColors.success} />
                <Text style={[styles.statValue, { color: themeColors.textPrimary }]}>
                  ৳ {detailedRoute.total_cost_tk}
                </Text>
                <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>Fare</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: themeColors.infoLight || 'rgba(59,130,246,0.12)' }]}>
                <Ionicons name="ellipsis-horizontal" size={16} color={themeColors.info} />
                <Text style={[styles.statValue, { color: themeColors.textPrimary }]}>
                  {detailedRoute.path.length}
                </Text>
                <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>Stops</Text>
              </View>
            </View>

            {/* Fare breakdown */}
            {detailedRoute.fare_breakdown_tk.length > 1 && (
              <View style={styles.fareBreakdown}>
                <Text style={[styles.fareBreakdownTitle, { color: themeColors.textSecondary }]}>
                  Fare Breakdown
                </Text>
                <View style={styles.fareBreakdownRow}>
                  {detailedRoute.fare_breakdown_tk.map((fare, i) => (
                    <View
                      key={i}
                      style={[styles.fareChip, { backgroundColor: themeColors.pill }]}
                    >
                      <Text style={[styles.fareChipLabel, { color: themeColors.textSecondary }]}>
                        {detailedRoute.legs[i]?.busName?.split(' ').slice(0, 2).join(' ')}
                      </Text>
                      <Text style={[styles.fareChipValue, { color: themeColors.primary }]}>
                        ৳ {fare}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Map Toggle */}
          {mapPoints.length >= 2 && (
            <>
              <TouchableOpacity
                style={[styles.mapToggleButton, { backgroundColor: themeColors.surface }]}
                onPress={() => setMapExpanded(!mapExpanded)}
                activeOpacity={0.7}
              >
                <View style={styles.mapToggleContent}>
                  <View style={styles.mapToggleLeft}>
                    <Ionicons name="map" size={20} color={themeColors.primary} />
                    <Text style={[styles.mapToggleText, { color: themeColors.textPrimary }]}>
                      Route Map
                    </Text>
                  </View>
                  <Ionicons
                    name={mapExpanded ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color={themeColors.primary}
                  />
                </View>
              </TouchableOpacity>

              {mapExpanded && (
                <View
                  style={[
                    styles.mapCard,
                    {
                      backgroundColor: themeColors.surface,
                      borderColor: themeColors.borderLight,
                    },
                  ]}
                >
                  <RouteMap points={mapPoints} height={260} />
                </View>
              )}
            </>
          )}

          {/* Journey Timeline */}
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
            Journey Route
          </Text>

          <View style={styles.timelineContainer}>
            {detailedRoute.legs.map((leg, legIdx) => {
              // Find path stops for this leg
              const legStops = detailedRoute.path.filter((p) => {
                const busNames = p.bus_name.split(' -> ');
                return busNames.includes(leg.busName);
              });

              return (
                <React.Fragment key={legIdx}>
                  {/* Bus Leg Header */}
                  <View
                    style={[styles.legHeader, { backgroundColor: themeColors.primaryMuted }]}
                  >
                    <Ionicons name="bus" size={16} color={themeColors.primary} />
                    <Text style={[styles.legHeaderText, { color: themeColors.primary }]}>
                      {leg.busName}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.legHeaderMeta, { color: themeColors.textTertiary }]}>
                      {leg.dist.toFixed(1)} km · ৳ {Math.ceil(leg.cost)}
                    </Text>
                  </View>

                  {/* Stops in this leg */}
                  {detailedRoute.path.map((stop, stopIdx) => {
                    // Only render stops belonging to this leg
                    const isInLeg = stop.bus_name.includes(leg.busName);
                    if (!isInLeg) return null;

                    // Check if it's the first/last stop or a transfer
                    const isFirst = stopIdx === 0;
                    const isLast = stopIdx === detailedRoute.path.length - 1;
                    const isTransfer = stop.is_transfer_point;

                    let dotColor = themeColors.primary;
                    if (isFirst) dotColor = themeColors.success;
                    else if (isLast) dotColor = themeColors.error;
                    else if (isTransfer) dotColor = themeColors.warning;

                    return (
                      <View key={`${legIdx}_${stopIdx}`} style={styles.timelineStop}>
                        <View style={styles.timelineLine}>
                          {stopIdx > 0 && (
                            <View
                              style={[styles.lineSegment, { backgroundColor: themeColors.borderLight }]}
                            />
                          )}
                          <View style={[styles.timelineDot, { backgroundColor: dotColor }]}>
                            {isFirst && <Ionicons name="play" size={8} color="#FFF" />}
                            {isLast && <Ionicons name="flag" size={8} color="#FFF" />}
                            {isTransfer && <Ionicons name="swap-horizontal" size={8} color="#FFF" />}
                          </View>
                          {stopIdx < detailedRoute.path.length - 1 && (
                            <View
                              style={[styles.lineSegment, { backgroundColor: themeColors.borderLight }]}
                            />
                          )}
                        </View>
                        <View style={styles.timelineInfo}>
                          <Text
                            style={[
                              styles.timelineStopName,
                              {
                                color: themeColors.textPrimary,
                                fontWeight: isFirst || isLast || isTransfer ? '700' : '500',
                              },
                            ]}
                          >
                            {stop.stop_name}
                          </Text>
                          <View style={styles.timelineMetaRow}>
                            {stop.distance_from_prev_km > 0 && (
                              <Text
                                style={[styles.timelineMetaText, { color: themeColors.textTertiary }]}
                              >
                                +{stop.distance_from_prev_km.toFixed(2)} km
                              </Text>
                            )}
                            <Text
                              style={[styles.timelineMetaText, { color: themeColors.textMuted }]}
                            >
                              {stop.cumulative_distance_km.toFixed(2)} km total
                            </Text>
                          </View>
                          {(isFirst || isLast || isTransfer) && (
                            <View
                              style={[
                                styles.timelineBadge,
                                { backgroundColor: dotColor + '18' },
                              ]}
                            >
                              <Text style={[styles.timelineBadgeText, { color: dotColor }]}>
                                {isFirst ? 'SOURCE' : isLast ? 'DESTINATION' : 'TRANSFER'}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}

                  {/* Transfer indicator between legs */}
                  {legIdx < detailedRoute.legs.length - 1 && (
                    <View
                      style={[
                        styles.transferPointIndicator,
                        { backgroundColor: themeColors.warningLight || 'rgba(245,158,11,0.12)' },
                      ]}
                    >
                      <Ionicons name="swap-horizontal" size={18} color={themeColors.warning} />
                      <Text style={[styles.transferPointText, { color: themeColors.warning }]}>
                        Change bus at {detailedRoute.transfer_points[legIdx]}
                      </Text>
                    </View>
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Legacy Bus View (for Bus List tab navigation) ─────────────────────────

  const displayName = busName || 'Route Details';

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
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backIconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: '#FFF' }]} numberOfLines={1}>
              {displayName}
            </Text>
            {busBn && (
              <Text style={[styles.headerSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
                {busBn} • {serviceType}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.bookmarkButton} onPress={handleBookmarkToggle}>
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color="#FFF"
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={[styles.body, { backgroundColor: themeColors.background }]}
        contentContainerStyle={{ paddingBottom: safeArea.bottom + 16 }}
      >
        {/* Legacy Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: themeColors.surface }]}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryIcon, { backgroundColor: themeColors.successLight || 'rgba(16,185,129,0.12)' }]}>
              <Ionicons name="location" size={18} color={themeColors.success} />
            </View>
            <View style={styles.summaryTextContainer}>
              <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>From</Text>
              <Text style={[styles.summaryValue, { color: themeColors.textPrimary }]}>
                {fromStopName}
              </Text>
            </View>
          </View>

          <View style={[styles.summaryDivider, { backgroundColor: themeColors.borderLight }]} />

          <View style={styles.summaryRow}>
            <View style={[styles.summaryIcon, { backgroundColor: themeColors.errorLight || 'rgba(239,68,68,0.12)' }]}>
              <Ionicons name="flag" size={18} color={themeColors.error} />
            </View>
            <View style={styles.summaryTextContainer}>
              <Text style={[styles.summaryLabel, { color: themeColors.textTertiary }]}>To</Text>
              <Text style={[styles.summaryValue, { color: themeColors.textPrimary }]}>
                {toStopName}
              </Text>
            </View>
          </View>

          <View style={[styles.summaryDivider, { backgroundColor: themeColors.borderLight }]} />

          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: themeColors.primaryMuted }]}>
              <Ionicons name="navigate-outline" size={16} color={themeColors.primary} />
              <Text style={[styles.statValue, { color: themeColors.textPrimary }]}>
                {journeyDistanceKm.toFixed(1)} km
              </Text>
              <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>Distance</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: themeColors.successLight || 'rgba(16,185,129,0.12)' }]}>
              <Ionicons name="cash-outline" size={16} color={themeColors.success} />
              <Text style={[styles.statValue, { color: themeColors.textPrimary }]}>
                ৳ {estimatedFare.toFixed(0)}
              </Text>
              <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>Fare</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: themeColors.infoLight || 'rgba(59,130,246,0.12)' }]}>
              <Ionicons name="ellipsis-horizontal" size={16} color={themeColors.info} />
              <Text style={[styles.statValue, { color: themeColors.textPrimary }]}>
                {legacyStoppages.length}
              </Text>
              <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>Stops</Text>
            </View>
          </View>

          {/* Fare Policy Note */}
          <View style={[styles.farePolicyContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }]}>
            <Ionicons name="information-circle-outline" size={14} color={themeColors.textTertiary} />
            <Text style={[styles.farePolicyText, { color: themeColors.textSecondary }]}>
              Fare Calculation: Max(৳{minFare.toFixed(0)}, {fareRate} × km)
            </Text>
          </View>

          {/* Jump to Full Route Button */}
          {!showFullRoute && (
            <TouchableOpacity
              style={styles.fullRouteButton}
              onPress={() => navigation.push('RouteDetails', { busId, busName, busBn, showFullRoute: true })}
            >
              <Text style={styles.fullRouteButtonText}>View Full Bus Route</Text>
              <Ionicons name="chevron-forward" size={18} color={themeColors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Legacy Stoppages */}
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
          Route Stoppages
        </Text>

        <View style={styles.timelineContainer}>
          {legacyStoppages.map((stoppage, index) => {
            const isFirst = stoppage.isJourneyStart;
            const isLast = stoppage.isJourneyEnd;
            const isInRoute = stoppage.isInRoute;

            let dotColor = themeColors.textMuted;
            if (isFirst) dotColor = themeColors.success;
            else if (isLast) dotColor = themeColors.error;
            else if (isInRoute) dotColor = themeColors.primary;

            return (
              <View key={`${stoppage.stopId}-${index}`} style={styles.timelineStop}>
                <View style={styles.timelineLine}>
                  {index > 0 && (
                    <View
                      style={[styles.lineSegment, { backgroundColor: themeColors.borderLight }]}
                    />
                  )}
                  <View style={[styles.timelineDot, { backgroundColor: dotColor }]}>
                    {isFirst && <Ionicons name="play" size={8} color="#FFF" />}
                    {isLast && <Ionicons name="flag" size={8} color="#FFF" />}
                  </View>
                  {index < legacyStoppages.length - 1 && (
                    <View
                      style={[styles.lineSegment, { backgroundColor: themeColors.borderLight }]}
                    />
                  )}
                </View>
                <View style={styles.timelineInfo}>
                  <Text
                    style={[
                      styles.timelineStopName,
                      {
                        color: themeColors.textPrimary,
                        fontWeight: isFirst || isLast ? '700' : isInRoute ? '600' : '400',
                      },
                    ]}
                  >
                    {stoppage.stopageEn}
                  </Text>
                  <View style={styles.timelineMetaRow}>
                    <Text style={[styles.timelineMetaText, { color: themeColors.textTertiary }]}>
                      +{(stoppage.segmentDistanceKm ?? 0).toFixed(2)} km
                    </Text>
                    {typeof stoppage.journeyDistanceKm === 'number' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.timelineMetaText, { color: themeColors.textMuted }]}>
                          trip {stoppage.journeyDistanceKm.toFixed(1)} km
                        </Text>
                        <Text style={[styles.timelineMetaText, { color: themeColors.primary, fontWeight: '700', marginLeft: 8 }]}>
                           ৳ {Math.ceil(Math.max(minFare, stoppage.journeyDistanceKm * fareRate))}
                        </Text>
                      </View>
                    )}
                  </View>
                  {(isFirst || isLast) && (
                    <View style={[styles.timelineBadge, { backgroundColor: dotColor + '18' }]}>
                      <Text style={[styles.timelineBadgeText, { color: dotColor }]}>
                        {isFirst ? 'SOURCE' : 'DESTINATION'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
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
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  headerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
  },
  headerBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  fullRouteButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
    marginRight: 4,
  },
  farePolicyContainer: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  farePolicyText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  headerRouteBn: {
    fontSize: FontSize.base,
    fontWeight: '600',
    opacity: 0.95,
    marginTop: 2,
  },
  bookmarkButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  // Summary Card
  summaryCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
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
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTextContainer: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: FontSize.base,
    fontWeight: '600',
    marginTop: 2,
  },
  summaryDivider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  // Fare Breakdown
  fareBreakdown: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  fareBreakdownTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  fareBreakdownRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  fareChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    flex: 1,
    minWidth: 80,
  },
  fareChipLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  fareChipValue: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    marginTop: 2,
  },
  // Map
  mapToggleButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.md,
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
  mapToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  mapToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  mapToggleText: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  mapCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    borderWidth: 1,
  },
  // Section Title
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  // Timeline
  timelineContainer: {
    paddingHorizontal: Spacing.lg,
  },
  legHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  legHeaderText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  legHeaderMeta: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  timelineStop: {
    flexDirection: 'row',
    minHeight: 48,
  },
  timelineLine: {
    width: 24,
    alignItems: 'center',
  },
  lineSegment: {
    width: 2,
    flex: 1,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineInfo: {
    flex: 1,
    paddingLeft: Spacing.md,
    paddingBottom: Spacing.md,
  },
  timelineStopName: {
    fontSize: FontSize.base,
  },
  timelineMetaRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 2,
  },
  timelineMetaText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  timelineBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
    marginTop: 4,
  },
  timelineBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  transferPointIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  transferPointText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  // Loading/Error
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  fullRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
});
