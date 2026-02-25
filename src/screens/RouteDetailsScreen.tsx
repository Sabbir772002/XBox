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
import DatabaseService, { Route, RouteStop, Bus, BusStoppage } from '../services/DatabaseService';
import StorageService from '../services/StorageService';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';

export default function RouteDetailsScreen({ route, navigation }: any) {
  const { routeId, fromStopId, toStopId, fromStopName, toStopName, isReverse } = route.params;
  const [routeDetails, setRouteDetails] = useState<Route | null>(null);
  const [allStops, setAllStops] = useState<RouteStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [busesLoading, setBusesLoading] = useState(true);
  const [isBusesExpanded, setIsBusesExpanded] = useState(true);
  const [showAllStops, setShowAllStops] = useState(false);
  const [expandedBuses, setExpandedBuses] = useState<Set<number>>(new Set());
  const [busStoppagesLoading, setBusStoppagesLoading] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadRouteDetails();
    loadAllStops();
    checkBookmarkStatus();
    loadBuses();
  }, []);

  const loadAllStops = async () => {
    try {
      const stops = await DatabaseService.getAllRouteStoppagesWithDetails(routeId, fromStopId, toStopId);
      
      // Ensure stops are ordered from user's source to destination
      if (stops.length > 0) {
        const firstStopId = stops[0]?.stopId;
        // Find start and end indices
        const startIdx = stops.findIndex(s => s.isStart);
        const endIdx = stops.findIndex(s => s.isEnd);
        
        // If end comes before start in the array, reverse the entire array
        if (startIdx > endIdx && startIdx !== -1 && endIdx !== -1) {
          setAllStops([...stops].reverse());
        } else {
          setAllStops(stops);
        }
      } else {
        setAllStops(stops);
      }
    } catch (error) {
      console.error('Error loading all stops:', error);
    }
  };

  const loadRouteDetails = async () => {
    try {
      // Always pass fromStopId and toStopId to filter stops between source and destination
      const details = await DatabaseService.getRouteDetails(routeId, fromStopId, toStopId);
      
      if (details) {
        // Ensure stops are ordered from user's source to destination
        // Check if first stop matches user's fromStopId
        const firstStopId = details.stops[0]?.stopId;
        const lastStopId = details.stops[details.stops.length - 1]?.stopId;
        
        // If the order doesn't match user's search, reverse it
        if (firstStopId === toStopId || lastStopId === fromStopId) {
          details.stops = [...details.stops].reverse();
        }
      }
      
      setRouteDetails(details);
    } catch (error) {
      console.error('Error loading route details:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBuses = async () => {
    setBusesLoading(true);
    try {
      const busesData = await DatabaseService.getBusesForRoute(fromStopId, toStopId);
      setBuses(busesData);
    } catch (error) {
      console.error('Error loading buses:', error);
    } finally {
      setBusesLoading(false);
    }
  };

  const toggleBusExpansion = async (busId: number) => {
    const newExpandedBuses = new Set(expandedBuses);
    
    if (expandedBuses.has(busId)) {
      // Collapse
      newExpandedBuses.delete(busId);
      setExpandedBuses(newExpandedBuses);
    } else {
      // Expand and load stoppages if not already loaded
      newExpandedBuses.add(busId);
      setExpandedBuses(newExpandedBuses);
      
      const bus = buses.find(b => b.id === busId);
      if (bus && !bus.stoppages) {
        // Load stoppages
        setBusStoppagesLoading(new Set(busStoppagesLoading).add(busId));
        try {
          const stoppages = await DatabaseService.getBusStoppagesWithRouteMatch(
            busId,
            fromStopId,
            toStopId
          );
          
          // Update bus with stoppages
          setBuses(buses.map(b => 
            b.id === busId ? { ...b, stoppages } : b
          ));
        } catch (error) {
          console.error('Error loading bus stoppages:', error);
        } finally {
          const loadingSet = new Set(busStoppagesLoading);
          loadingSet.delete(busId);
          setBusStoppagesLoading(loadingSet);
        }
      }
    }
  };

  const checkBookmarkStatus = async () => {
    const bookmarked = await StorageService.isBookmarked(routeId.toString(), fromStopId, toStopId);
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
    if (!routeDetails || !routeDetails.stops || routeDetails.stops.length === 0) return;

    const firstStop = routeDetails.stops[0];
    const lastStop = routeDetails.stops[routeDetails.stops.length - 1];
    const distance = Math.abs(lastStop.distance - firstStop.distance);

    // Use the passed fromStopName and toStopName (user's search terms)
    const sourceStopName = fromStopName || firstStop.stopageEn || 'Unknown';
    const destStopName = toStopName || lastStop.stopageEn || 'Unknown';

    if (isBookmarked) {
      await StorageService.removeBookmark(routeId.toString(), fromStopId, toStopId);
      setIsBookmarked(false);
      showToast('Bookmark removed');
    } else {
      const success = await StorageService.addBookmark(
        routeId.toString(),
        fromStopId,
        toStopId,
        sourceStopName,
        destStopName,
        distance,
        routeDetails.stops.length
      );
      if (success) {
        setIsBookmarked(true);
        showToast('Route bookmarked');
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
          <Text style={styles.loadingText}>Loading route details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!routeDetails) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#C0191F" />
          <Text style={styles.errorText}>Route details not available</Text>
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

  // Calculate relative total distance
  // For reverse routes, first and last are already swapped in stops array
  const firstStopDistance = routeDetails.stops[0]?.distance || 0;
  const lastStopDistance = routeDetails.stops[routeDetails.stops.length - 1]?.distance || 0;
  const relativeTotalDistance = Math.abs(lastStopDistance - firstStopDistance);

  const renderStop = (stop: RouteStop, index: number) => {
    const isFirst = index === 0;
    const isLast = index === routeDetails.stops.length - 1;
    
    // Calculate relative distance from the first stop shown (user's starting point)
    const baseDistance = routeDetails.stops[0].distance;
    const relativeDistance = Math.abs(stop.distance - baseDistance);

    return (
      <View key={`${stop.stopId}-${index}`} style={styles.stopContainer}>
        <View style={styles.stopIndicatorContainer}>
          {!isFirst && <View style={styles.lineTop} />}
          <View style={[styles.stopDot, isFirst || isLast ? styles.stopDotLarge : null]}>
            {isFirst && <Ionicons name="location" size={16} color={Colors.textLight} />}
            {isLast && <Ionicons name="flag" size={16} color={Colors.textLight} />}
          </View>
          {!isLast && <View style={styles.lineBottom} />}
        </View>

        <View style={styles.stopInfoContainer}>
          <View style={styles.stopLabelRow}>
            <Text style={styles.stopNumber}>Stop {index + 1}</Text>
            {isFirst && <Text style={styles.stopLabel}>START</Text>}
            {isLast && <Text style={styles.stopLabelEnd}>END</Text>}
          </View>
          <Text style={styles.stopName}>{stop.stopageEn}</Text>
          <Text style={styles.stopNameBn}>{stop.stopageBn}</Text>
          <Text style={styles.stopDistance}>
            {relativeDistance.toFixed(1)} km from source
          </Text>
        </View>
      </View>
    );
  };

  // NEW: Render all stops with color coding
  const renderAllStop = (stop: RouteStop, index: number) => {
    // Determine stop color based on type
    let stopColor = Colors.textMuted; // Default gray for non-journey stops
    let dotColor = Colors.textMuted;
    let lineColor = Colors.borderLight;
    let badgeText = '';
    let badgeBg = Colors.pill;

    if (stop.isStart) {
      stopColor = Colors.success; // Green for start
      dotColor = Colors.success;
      lineColor = Colors.success;
      badgeText = 'START';
      badgeBg = Colors.success;
    } else if (stop.isEnd) {
      stopColor = Colors.error; // Red for end
      dotColor = Colors.error;
      lineColor = Colors.error;
      badgeText = 'END';
      badgeBg = Colors.error;
    } else if (stop.isJourney) {
      stopColor = Colors.primary; // Blue for journey stops
      dotColor = Colors.primary;
      lineColor = Colors.primary;
      badgeText = `${stop.matchPercentage}%`;
      badgeBg = Colors.primary;
    }

    const isFirst = index === 0;
    const isLast = index === allStops.length - 1;

    return (
      <View key={`all-${stop.stopId}-${index}`} style={styles.allStopContainer}>
        <View style={styles.stopIndicatorContainer}>
          {!isFirst && <View style={[styles.lineTop, { backgroundColor: lineColor }]} />}
          <View 
            style={[
              styles.stopDot, 
              (stop.isStart || stop.isEnd) && styles.stopDotLarge,
              { backgroundColor: dotColor }
            ]}
          >
            {stop.isStart && <Ionicons name="location" size={16} color={Colors.textLight} />}
            {stop.isEnd && <Ionicons name="flag" size={16} color={Colors.textLight} />}
          </View>
          {!isLast && <View style={[styles.lineBottom, { backgroundColor: lineColor }]} />}
        </View>

        <View style={styles.allStopInfoContainer}>
          <View style={styles.allStopHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.allStopName, { color: stopColor }]}>
                {stop.stopageEn}
              </Text>
              <Text style={styles.stopNameBn}>{stop.stopageBn}</Text>
            </View>
            {badgeText && (
              <View style={[styles.stopBadge, { backgroundColor: badgeBg }]}>
                <Text style={styles.stopBadgeText}>{badgeText}</Text>
              </View>
            )}
          </View>
          <View style={styles.allStopMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="list" size={12} color={Colors.textSecondary} />
              <Text style={styles.metaText}>#{stop.stopOrder}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="navigate" size={12} color={Colors.textSecondary} />
              <Text style={styles.metaText}>{stop.distance.toFixed(1)} km</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // Render bus stoppage item
  const renderBusStoppage = (stoppage: BusStoppage, index: number, totalStops: number) => {
    let stopColor = Colors.textMuted; // Gray for non-route stops
    let dotColor = Colors.textMuted;
    let dotSize = 10;
    let lineColor = Colors.borderLight;
    let badgeText = '';
    let badgeBg = Colors.pill;
    let showIcon = false;

    if (stoppage.isStart) {
      stopColor = Colors.success; // Green for start
      dotColor = Colors.success;
      lineColor = Colors.success;
      badgeText = 'START';
      badgeBg = Colors.success;
      dotSize = 14;
      showIcon = true;
    } else if (stoppage.isEnd) {
      stopColor = Colors.error; // Red for end
      dotColor = Colors.error;
      lineColor = Colors.error;
      badgeText = 'END';
      badgeBg = Colors.error;
      dotSize = 14;
      showIcon = true;
    } else if (stoppage.isInRoute) {
      stopColor = Colors.primary; // Blue for on-route stops
      dotColor = Colors.primary;
      lineColor = Colors.primary;
      badgeText = 'ON ROUTE';
      badgeBg = Colors.primary;
      dotSize = 12;
    } else {
      // Not on route - gray/muted
      stopColor = Colors.textMuted;
      dotColor = Colors.textMuted;
      lineColor = Colors.borderLight;
      badgeText = '';
      badgeBg = Colors.pill;
    }

    const isFirst = index === 0;
    const isLast = index === totalStops - 1;

    return (
      <View key={`bus-stop-${stoppage.stopId}-${index}`} style={styles.busStoppageContainer}>
        <View style={styles.busStoppageIndicator}>
          {!isFirst && <View style={[styles.busStoppageLine, { backgroundColor: lineColor }]} />}
          <View 
            style={[
              styles.busStoppageDot, 
              { 
                backgroundColor: dotColor,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
              }
            ]}
          >
            {showIcon && stoppage.isStart && (
              <Ionicons name="play" size={8} color={Colors.textLight} />
            )}
            {showIcon && stoppage.isEnd && (
              <Ionicons name="stop" size={8} color={Colors.textLight} />
            )}
          </View>
          {!isLast && <View style={[styles.busStoppageLine, { backgroundColor: lineColor }]} />}
        </View>
        
        <View style={styles.busStoppageInfo}>
          <View style={styles.busStoppageHeader}>
            <Text 
              style={[
                styles.busStoppageName, 
                { 
                  color: stopColor,
                  fontWeight: stoppage.isStart || stoppage.isEnd ? '700' : stoppage.isInRoute ? '600' : '400'
                }
              ]} 
              numberOfLines={1}
            >
              {stoppage.stopageEn}
            </Text>
            {badgeText && (
              <View style={[styles.busStoppageBadge, { backgroundColor: badgeBg }]}>
                <Text style={styles.busStoppageBadgeText}>{badgeText}</Text>
              </View>
            )}
          </View>
          {stoppage.stopageBn && (
            <Text 
              style={[
                styles.busStoppageNameBn,
                { 
                  color: stopColor,
                  opacity: 0.7,
                }
              ]} 
              numberOfLines={1}
            >
              {stoppage.stopageBn}
            </Text>
          )}
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
            <Text style={styles.headerTitle}>
              {routeDetails.routeNameEng || `Route ${routeDetails.routeId}`}
            </Text>
            {routeDetails.routeNameBn && (
              <Text style={styles.headerRouteBn}>{routeDetails.routeNameBn}</Text>
            )}
            <Text style={styles.headerSubtitle}>
              {routeDetails.stops.length} stops • {relativeTotalDistance.toFixed(1)} km
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bookmarkButton}
            onPress={handleBookmarkToggle}
          >
            <Ionicons 
              name={isBookmarked ? "bookmark" : "bookmark-outline"} 
              size={24} 
              color="#FFF" 
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Ionicons name="location-outline" size={20} color="#066D6D" />
            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryLabel}>Starting Point</Text>
              <Text style={styles.summaryValue}>{routeDetails.stops[0]?.stopageEn}</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Ionicons name="flag-outline" size={20} color="#C0191F" />
            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryLabel}>Destination</Text>
              <Text style={styles.summaryValue}>
                {routeDetails.stops[routeDetails.stops.length - 1]?.stopageEn}
              </Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Ionicons name="cash-outline" size={20} color="#066D6D" />
            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryLabel}>Estimated Fare</Text>
              <Text style={styles.fareValue}>৳ {(relativeTotalDistance * 2.5).toFixed(2)}</Text>
              <Text style={styles.fareNote}>Base rate: ৳2.5/km</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>All Stops</Text>

        <View style={styles.stopsListContainer}>
          {routeDetails.stops.map((stop, index) => renderStop(stop, index))}
        </View>

        {/* NEW: All Route Stoppages Section with Toggle */}
        <View style={styles.allStopsSection}>
          <TouchableOpacity 
            style={styles.allStopsSectionHeader}
            onPress={() => setShowAllStops(!showAllStops)}
            activeOpacity={0.7}
          >
            <View style={styles.allStopsSectionHeaderLeft}>
              <Ionicons name="map" size={24} color={Colors.primary} />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={styles.allStopsSectionTitle}>
                  Complete Route Map
                </Text>
                <Text style={styles.allStopsSectionSubtitle}>
                  {allStops.length} total stops • Tap to view
                </Text>
              </View>
            </View>
            <Ionicons 
              name={showAllStops ? "chevron-up" : "chevron-down"} 
              size={24} 
              color={Colors.textSecondary} 
            />
          </TouchableOpacity>

          {showAllStops && (
            <View style={styles.allStopsContent}>
              <View style={styles.legendContainer}>
                <Text style={styles.legendTitle}>Legend:</Text>
                <View style={styles.legendItems}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
                    <Text style={styles.legendText}>Start</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
                    <Text style={styles.legendText}>End</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                    <Text style={styles.legendText}>Your Journey</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.textMuted }]} />
                    <Text style={styles.legendText}>Other Stops</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.allStopsList}>
                {allStops.map((stop, index) => renderAllStop(stop, index))}
              </View>
            </View>
          )}
        </View>

        {/* Buses Section */}
        <View style={styles.busesSection}>
          <TouchableOpacity 
            style={styles.busesSectionHeader}
            onPress={() => setIsBusesExpanded(!isBusesExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.busesSectionHeaderLeft}>
              <Ionicons name="bus" size={24} color="#C0191F" />
              <Text style={styles.busesSectionTitle}>
                Available Buses {buses.length > 0 && `(${buses.length})`}
              </Text>
            </View>
            <Ionicons 
              name={isBusesExpanded ? "chevron-up" : "chevron-down"} 
              size={24} 
              color="#666" 
            />
          </TouchableOpacity>

          {isBusesExpanded && (
            <View style={styles.busesContent}>
              {busesLoading ? (
                <View style={styles.busesLoadingContainer}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.busesLoadingText}>Loading buses...</Text>
                </View>
              ) : buses.length > 0 ? (
                buses.map((bus, index) => {
                  const isExpanded = expandedBuses.has(bus.id);
                  const isLoadingStoppages = busStoppagesLoading.has(bus.id);
                  
                  return (
                    <View 
                      key={bus.id} 
                      style={[
                        styles.busCard,
                        index === buses.length - 1 && !isExpanded && styles.busCardLast
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.busCardContent}
                        onPress={() => toggleBusExpansion(bus.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.busCardHeader}>
                          <View style={styles.busBadge}>
                            <Ionicons name="bus" size={24} color={Colors.badgeText} />
                          </View>
                          <View style={styles.busCardInfo}>
                            <Text style={styles.busName}>{bus.nameEnglish}</Text>
                            <Text style={styles.busNameBn}>{bus.nameBangla}</Text>
                          </View>
                          <Ionicons 
                            name={isExpanded ? "chevron-up" : "chevron-down"} 
                            size={24} 
                            color={Colors.primary} 
                          />
                        </View>
                        
                        <View style={styles.busDetailsContainer}>
                          {bus.serviceType && (
                            <View style={styles.busDetailPill}>
                              <Ionicons name="pricetag" size={14} color={Colors.primary} />
                              <Text style={styles.busDetailText}>{bus.serviceType}</Text>
                            </View>
                          )}
                          <View style={styles.busDetailPill}>
                            <Ionicons name="location" size={14} color={Colors.primary} />
                            <Text style={styles.busDetailText}>{bus.totalStops} stops</Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      {/* Stoppages Section */}
                      {isExpanded && (
                        <View style={styles.busStoppagesSection}>
                          <View style={styles.busStoppagesHeader}>
                            <Ionicons name="list" size={18} color={Colors.primary} />
                            <Text style={styles.busStoppagesTitle}>
                              All Stoppages ({bus.stoppages?.length || 0})
                            </Text>
                          </View>
                          
                          {/* Legend for bus stoppages */}
                          <View style={styles.busStoppagesLegend}>
                            <View style={styles.busLegendItem}>
                              <View style={[styles.busLegendDot, { backgroundColor: Colors.success }]} />
                              <Text style={styles.busLegendText}>Start</Text>
                            </View>
                            <View style={styles.busLegendItem}>
                              <View style={[styles.busLegendDot, { backgroundColor: Colors.error }]} />
                              <Text style={styles.busLegendText}>End</Text>
                            </View>
                            <View style={styles.busLegendItem}>
                              <View style={[styles.busLegendDot, { backgroundColor: Colors.primary }]} />
                              <Text style={styles.busLegendText}>Your Route</Text>
                            </View>
                            <View style={styles.busLegendItem}>
                              <View style={[styles.busLegendDot, { backgroundColor: Colors.textMuted }]} />
                              <Text style={styles.busLegendText}>Other</Text>
                            </View>
                          </View>
                          
                          {isLoadingStoppages ? (
                            <View style={styles.busStoppagesLoading}>
                              <ActivityIndicator size="small" color={Colors.primary} />
                              <Text style={styles.busStoppagesLoadingText}>Loading stoppages...</Text>
                            </View>
                          ) : bus.stoppages && bus.stoppages.length > 0 ? (
                            <View style={styles.busStoppagesList}>
                              <ScrollView 
                                style={styles.busStoppagesScroll}
                                nestedScrollEnabled={true}
                                showsVerticalScrollIndicator={false}
                              >
                                {bus.stoppages.map((stoppage, idx) => 
                                  renderBusStoppage(stoppage, idx, bus.stoppages?.length || 0)
                                )}
                              </ScrollView>
                            </View>
                          ) : (
                            <Text style={styles.noStoppagesText}>No stoppages available</Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              ) : (
                <View style={styles.noBusesContainer}>
                  <Ionicons name="information-circle-outline" size={48} color="#999" />
                  <Text style={styles.noBusesText}>No buses available for this route</Text>
                  <Text style={styles.noBusesSubtext}>Please check back later</Text>
                </View>
              )}
            </View>
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
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textLight,
    textShadowColor: Colors.blackOverlay20,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    marginLeft: Spacing.sm,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderLeftWidth: 5,
    borderLeftColor: Colors.borderAccent,
    shadowColor: Colors.shadowCard,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryTextContainer: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  stopsListContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stopContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  stopIndicatorContainer: {
    width: 40,
    alignItems: 'center',
  },
  lineTop: {
    width: 3,
    height: 20,
    backgroundColor: Colors.primary,
  },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    zIndex: 1,
  },
  stopDotLarge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineBottom: {
    width: 3,
    flex: 1,
    backgroundColor: Colors.primary,
  },
  stopInfoContainer: {
    flex: 1,
    paddingLeft: Spacing.md,
  },
  stopLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  stopNumber: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginRight: Spacing.xs,
  },
  stopLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textLight,
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  stopLabelEnd: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textLight,
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  stopName: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  stopNameBn: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  stopDistance: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    marginTop: Spacing.lg,
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.error,
    textAlign: 'center',
  },
  backButton: {
    marginTop: Spacing.xxl,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: BorderRadius.md,
    shadowColor: Colors.shadowPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  backButtonText: {
    color: Colors.textLight,
    fontSize: FontSize.base,
    fontWeight: '700',
  },
  fareValue: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 2,
  },
  fareNote: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  // Buses Section Styles
  busesSection: {
    marginTop: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  busesSectionHeader: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 5,
    borderLeftColor: Colors.borderAccent,
    shadowColor: Colors.shadowCard,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  busesSectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  busesSectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  busesContent: {
    marginTop: Spacing.md,
  },
  busesLoadingContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxxl,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  busesLoadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  busCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderLeftWidth: 5,
    borderLeftColor: Colors.borderAccent,
    shadowColor: Colors.shadowCard,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  busCardLast: {
    marginBottom: 0,
  },
  busCardContent: {
    flex: 1,
  },
  busCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  busBadge: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.badge,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    shadowColor: Colors.shadowPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  busCardInfo: {
    flex: 1,
  },
  busName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  busNameBn: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  busDetailsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  busDetailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    gap: 6,
  },
  busDetailText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.pillAccent,
  },
  noBusesContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.mega,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  noBusesText: {
    marginTop: Spacing.lg,
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  noBusesSubtext: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  // All Stops Section Styles
  allStopsSection: {
    marginTop: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  allStopsSectionHeader: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 5,
    borderLeftColor: Colors.borderAccent,
    shadowColor: Colors.shadowCard,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  allStopsSectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  allStopsSectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  allStopsSectionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  allStopsContent: {
    marginTop: Spacing.md,
  },
  legendContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  legendTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  allStopsList: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  allStopContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  allStopInfoContainer: {
    flex: 1,
    paddingLeft: Spacing.md,
  },
  allStopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  allStopName: {
    fontSize: FontSize.base,
    fontWeight: '600',
    marginBottom: 2,
  },
  stopBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  stopBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textLight,
  },
  allStopMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  // Bus Stoppages Styles
  busStoppagesSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  busStoppagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  busStoppagesTitle: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  busStoppagesLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.sm,
  },
  busLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  busLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  busLegendText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  busStoppagesLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  busStoppagesLoadingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  busStoppagesList: {
    maxHeight: 300,
  },
  busStoppagesScroll: {
    maxHeight: 300,
  },
  busStoppageContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    paddingVertical: 4,
  },
  busStoppageIndicator: {
    width: 24,
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  busStoppageLine: {
    flex: 1,
    width: 2,
    marginVertical: 2,
  },
  busStoppageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  busStoppageInfo: {
    flex: 1,
  },
  busStoppageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  busStoppageName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    flex: 1,
  },
  busStoppageNameBn: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  busStoppageBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  busStoppageBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textLight,
  },
  noStoppagesText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    padding: Spacing.lg,
  },
});