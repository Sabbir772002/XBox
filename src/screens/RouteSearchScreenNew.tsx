import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatabaseService, { Stop, Route } from '../services/DatabaseService';
import StorageService from '../services/StorageService';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';

export default function RouteSearchScreen({ navigation, route }: any) {
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [fromStopId, setFromStopId] = useState<number | null>(null);
  const [toStopId, setToStopId] = useState<number | null>(null);
  const [showData, setShowData] = React.useState(false);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [fromSuggestions, setFromSuggestions] = useState<Stop[]>([]);
  const [toSuggestions, setToSuggestions] = useState<Stop[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadStops();
    
    // Handle navigation params (from history click)
    if (route?.params) {
      const { fromStopId: paramFromStopId, toStopId: paramToStopId, fromStopName, toStopName } = route.params;
      if (paramFromStopId && paramToStopId && fromStopName && toStopName) {
        setFrom(fromStopName);
        setTo(toStopName);
        setFromStopId(paramFromStopId);
        setToStopId(paramToStopId);
        // Trigger search after a short delay to ensure state is set
        setTimeout(() => {
          searchRoutesWithParams(paramFromStopId, paramToStopId);
        }, 100);
      }
    }
  }, [route?.params]);

  const loadStops = async () => {
    try {
      const stops = await DatabaseService.getAllStops();
      setAllStops(stops);
    } catch (error) {
      console.error('Error loading stops:', error);
    }
  };

  const handleFromSearch = (text: string) => {
    setFrom(text);
    if (text.length > 0) {
      const filtered = allStops.filter(
        stop =>
          (stop.stopageEn && stop.stopageEn.toLowerCase().includes(text.toLowerCase())) ||
          (stop.stopageBn && stop.stopageBn.includes(text))
      );
      setFromSuggestions(filtered.slice(0, 10));
    } else {
      setFromSuggestions([]);
    }
  };

  const handleToSearch = (text: string) => {
    setTo(text);
    if (text.length > 0) {
      const filtered = allStops.filter(
        stop =>
          (stop.stopageEn && stop.stopageEn.toLowerCase().includes(text.toLowerCase())) ||
          (stop.stopageBn && stop.stopageBn.includes(text))
      );
      setToSuggestions(filtered.slice(0, 10));
    } else {
      setToSuggestions([]);
    }
  };

  const selectFromStop = (stop: Stop) => {
    setFrom(stop.stopageEn);
    setFromStopId(stop.id);
    setFromSuggestions([]);
  };

  const selectToStop = (stop: Stop) => {
    setTo(stop.stopageEn);
    setToStopId(stop.id);
    setToSuggestions([]);
  };

  const searchRoutesWithParams = async (fStopId: number, tStopId: number) => {
    setLoading(true);
    setShowData(true);

    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    try {
      // Search for routes in both directions
      const forwardRoutes = await DatabaseService.getRoutesBetweenStops(fStopId, tStopId);
      const reverseRoutes = await DatabaseService.getRoutesBetweenStops(tStopId, fStopId);
      
      // Combine both directions without duplicates
      const allRoutes = [...forwardRoutes, ...reverseRoutes];
      
      // Remove duplicates based on routeId and direction
      const uniqueRoutes = allRoutes.filter((route, index, self) =>
        index === self.findIndex(r => 
          r.routeId === route.routeId && 
          r.stops[0]?.stopId === route.stops[0]?.stopId
        )
      );
      
      setRoutes(uniqueRoutes);
      
      // Save to history
      if (from && to) {
        await StorageService.addSearchHistory(fStopId, tStopId, from, to, uniqueRoutes.length);
      }
    } catch (error) {
      console.error('Error searching routes:', error);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  const searchRoutes = async () => {
    if (!fromStopId || !toStopId) {
      return;
    }
    await searchRoutesWithParams(fromStopId, toStopId);
  };

  const renderRouteItem = ({ item }: { item: Route }) => {
    const firstStop = item.stops[0];
    const lastStop = item.stops[item.stops.length - 1];
    
    // Calculate relative distance (from first stop to last stop)
    const sourceDistance = firstStop?.distance || 0;
    const destinationDistance = lastStop?.distance || 0;
    const relativeDistance = Math.abs(destinationDistance - sourceDistance);
    const estimatedFare = relativeDistance * 2.5;

    // Use route name if available, otherwise fall back to route ID
    const displayName = item.routeNameEng || `Route ${item.routeId}`;
    const displayNameBn = item.routeNameBn;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate('RouteDetails', {
            routeId: item.routeId,
            fromStopId: firstStop?.stopId,
            toStopId: lastStop?.stopId,
            fromStopName: firstStop?.stopageEn,
            toStopName: lastStop?.stopageEn,
            isReverse: item.isReverse || false,
          })
        }
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <View style={styles.routeBadge}>
            <Text style={styles.routeBadgeText}>{item.routeId}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.busName}>{displayName}</Text>
            {displayNameBn && <Text style={styles.busNameBn}>{displayNameBn}</Text>}
            <View style={styles.routeStops}>
              <Text style={styles.route} numberOfLines={1}>
                {firstStop?.stopageEn || 'Unknown'}
              </Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.primary} style={{ marginHorizontal: 6 }} />
              <Text style={styles.route} numberOfLines={1}>
                {lastStop?.stopageEn || 'Unknown'}
              </Text>
            </View>
            <View style={styles.routeStats}>
              <View style={styles.statPill}>
                <Ionicons name="resize-outline" size={12} color={Colors.primary} />
                <Text style={styles.statText}>{relativeDistance.toFixed(1)} km</Text>
              </View>
              <View style={styles.statPill}>
                <Ionicons name="location-outline" size={12} color={Colors.primary} />
                <Text style={styles.statText}>{item.stops.length} stops</Text>
              </View>
              <View style={styles.statPill}>
                <Ionicons name="cash-outline" size={12} color={Colors.primary} />
                <Text style={styles.statText}>৳{estimatedFare.toFixed(0)}</Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color={Colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderSuggestion = (item: Stop, onSelect: (stop: Stop) => void) => (
    <TouchableOpacity
      key={item.id}
      style={styles.suggestionItem}
      onPress={() => onSelect(item)}
      activeOpacity={0.7}
    >
      <Ionicons name="location-outline" size={20} color={Colors.primary} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.suggestionText}>{item.stopageEn}</Text>
        {item.stopageBn && <Text style={styles.suggestionTextBn}>{item.stopageBn}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={[Colors.gradientStart, Colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        {/* Header with Title and Action Buttons */}
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>🚌 Bus Route Finder</Text>
            <Text style={styles.headerSubtitle}>Find the best route between stops</Text>
          </View>
          <View style={styles.menuButtons}>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => navigation.navigate('History')}
            >
              <Ionicons name="time-outline" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => navigation.navigate('Bookmark')}
            >
              <Ionicons name="bookmark-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Search Card Container */}
        <View style={styles.searchCard}>
          <View style={styles.inputCard}>
            <Ionicons name="location" size={20} color={Colors.inputIcon} style={styles.icon} />
            <TextInput
              placeholder="Source Stoppage (e.g., Gabtoli)"
              placeholderTextColor={Colors.inputPlaceholder}
              value={from}
              onChangeText={handleFromSearch}
              style={styles.input}
              returnKeyType="next"
            />
            {from.length > 0 && (
              <TouchableOpacity onPress={() => { setFrom(''); setFromStopId(null); setFromSuggestions([]); }}>
                <Ionicons name="close-circle" size={20} color={Colors.inputIcon} />
              </TouchableOpacity>
            )}
          </View>

          {/* From Suggestions Dropdown */}
          {fromSuggestions.length > 0 && (
            <View style={styles.suggestionsDropdown}>
              <ScrollView 
                style={styles.suggestionsScroll}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                {fromSuggestions.map(stop => renderSuggestion(stop, selectFromStop))}
              </ScrollView>
            </View>
          )}

          <View style={[styles.inputCard, { marginTop: 14 }]}>
            <Ionicons name="navigate" size={20} color={Colors.inputIcon} style={styles.icon} />
            <TextInput
              placeholder="Destination Stoppage (e.g., Uttara)"
              placeholderTextColor={Colors.inputPlaceholder}
              value={to}
              onChangeText={handleToSearch}
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={searchRoutes}
            />
            {to.length > 0 && (
              <TouchableOpacity onPress={() => { setTo(''); setToStopId(null); setToSuggestions([]); }}>
                <Ionicons name="close-circle" size={20} color={Colors.inputIcon} />
              </TouchableOpacity>
            )}
          </View>

          {/* To Suggestions Dropdown */}
          {toSuggestions.length > 0 && (
            <View style={styles.suggestionsDropdown}>
              <ScrollView 
                style={styles.suggestionsScroll}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                {toSuggestions.map(stop => renderSuggestion(stop, selectToStop))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            style={[styles.searchButton, (!fromStopId || !toStopId) && styles.searchButtonDisabled]}
            onPress={searchRoutes}
            disabled={!fromStopId || !toStopId}
            activeOpacity={0.8}
          >
            <Ionicons name="search" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.searchButtonText}>Search Routes</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Finding routes...</Text>
          </View>
        ) : showData ? (
          routes.length > 0 ? (
            <>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>Available Routes</Text>
                <Text style={styles.resultsCount}>{routes.length} route{routes.length > 1 ? 's' : ''} found</Text>
              </View>
              <FlatList
                data={routes}
                keyExtractor={(item) => item.routeId}
                renderItem={renderRouteItem}
                contentContainerStyle={{ paddingBottom: 12 }}
                showsVerticalScrollIndicator={false}
              />
            </>
          ) : (
            <View style={styles.noResultsContainer}>
              <Ionicons name="sad-outline" size={64} color={Colors.textMuted} />
              <Text style={styles.noRoutesTitle}>No Routes Found</Text>
              <Text style={styles.noRoutesText}>
                No direct routes found between these stops.{'\n'}Try different locations.
              </Text>
            </View>
          )
        ) : (
          <View style={styles.instructionsContainer}>
            <Ionicons name="information-circle-outline" size={64} color={Colors.primary} />
            <Text style={styles.instructionsTitle}>Find Your Route</Text>
            <Text style={styles.instructionsText}>
              📍 Select your starting location{'\n'}
              📍 Choose your destination{'\n'}
              🔍 Tap Search to find available routes
            </Text>
          </View>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
    shadowColor: Colors.shadowPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  headerTitle: {
    fontSize: FontSize.huge,
    fontWeight: '700',
    color: Colors.textLight,
    textShadowColor: Colors.blackOverlay20,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textLight,
    opacity: 0.9,
    marginTop: 4,
  },
  menuButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.whiteOverlay20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCard: {
    backgroundColor: Colors.whiteOverlay10,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    height: 54,
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
  },
  searchButton: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadowPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: Colors.primary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    marginTop: Spacing.mega,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  resultsHeader: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  resultsTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  resultsCount: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
    borderLeftWidth: 5,
    borderLeftColor: Colors.borderAccent,
    shadowColor: Colors.shadowCard,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeBadge: {
    backgroundColor: Colors.badge,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    minWidth: 50,
    alignItems: 'center',
  },
  routeBadgeText: {
    color: Colors.badgeText,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  busName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  busNameBn: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 6,
  },
  routeStops: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  route: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    flex: 0,
    flexShrink: 1,
  },
  routeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    gap: 4,
  },
  statText: {
    fontSize: FontSize.xs,
    color: Colors.pillAccent,
    fontWeight: '600',
  },
  suggestionsDropdown: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    maxHeight: 200,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  suggestionsScroll: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  suggestionText: {
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  suggestionTextBn: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  noResultsContainer: {
    alignItems: 'center',
    marginTop: Spacing.mega,
    paddingHorizontal: Spacing.xl,
  },
  noRoutesTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  noRoutesText: {
    marginTop: Spacing.sm,
    color: Colors.textSecondary,
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: 22,
  },
  instructionsContainer: {
    alignItems: 'center',
    marginTop: Spacing.mega,
    paddingHorizontal: Spacing.xl,
  },
  instructionsTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  instructionsText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'left',
    lineHeight: 28,
  },
});
