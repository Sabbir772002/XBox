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
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDynamicSafeArea } from '../hooks/useDynamicSafeArea';
import DatabaseService, { Stop, Bus } from '../services/DatabaseService';
import StorageService from '../services/StorageService';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';

export default function RouteSearchScreen({ navigation, route }: any) {
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [fromStopName, setFromStopName] = useState<string | null>(null);
  const [toStopName, setToStopName] = useState<string | null>(null);
  const [showData, setShowData] = React.useState(false);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(false);
  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [fromSuggestions, setFromSuggestions] = useState<Stop[]>([]);
  const [toSuggestions, setToSuggestions] = useState<Stop[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const safeArea = useDynamicSafeArea();

  useEffect(() => {
    loadStops();
    
    // Handle navigation params (from history click)
    if (route?.params) {
      const { fromStopName: paramFromStopName, toStopName: paramToStopName } = route.params;
      if (paramFromStopName && paramToStopName) {
        setFrom(paramFromStopName);
        setTo(paramToStopName);
        setFromStopName(paramFromStopName);
        setToStopName(paramToStopName);
        // Trigger search after a short delay to ensure state is set
        setTimeout(() => {
          searchBusesWithParams(paramFromStopName, paramToStopName);
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
    setFromStopName(text);
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
    setToStopName(text);
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
    setFromStopName(stop.stopageEn);
    setFromSuggestions([]);
  };

  const selectToStop = (stop: Stop) => {
    setTo(stop.stopageEn);
    setToStopName(stop.stopageEn);
    setToSuggestions([]);
  };

  const searchBusesWithParams = async (fStopName: string, tStopName: string) => {
    setLoading(true);
    setShowData(true);

    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    try {
      // Search for buses that have both stops in their route
      const foundBuses = await DatabaseService.getBusesBetweenStops(fStopName, tStopName);
      
      setBuses(foundBuses);
      
      // Save to history
      if (fStopName && tStopName) {
        await StorageService.addSearchHistory(1, 1, fStopName, tStopName, foundBuses.length);
      }
    } catch (error) {
      console.error('Error searching buses:', error);
      setBuses([]);
    } finally {
      setLoading(false);
    }
  };

  const searchBuses = async () => {
    if (!fromStopName || !toStopName) {
      return;
    }
    await searchBusesWithParams(fromStopName, toStopName);
  };

  const renderBusItem = ({ item }: { item: Bus }) => {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate('RouteDetails', {
            busId: item.id,
            busName: item.nameEnglish,
            busBn: item.nameBangla,
            fromStopName: fromStopName,
            toStopName: toStopName,
          })
        }
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <View style={styles.busIconContainer}>
            <Ionicons name="bus" size={32} color={Colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.busName}>{item.nameEnglish}</Text>
            {item.nameBangla && <Text style={styles.busNameBn}>{item.nameBangla}</Text>}
            {item.serviceType && <Text style={styles.serviceType}>{item.serviceType}</Text>}
            <View style={styles.routeStops}>
              <Text style={styles.route} numberOfLines={1}>
                {fromStopName}
              </Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.primary} style={{ marginHorizontal: 6 }} />
              <Text style={styles.route} numberOfLines={1}>
                {toStopName}
              </Text>
            </View>
            <View style={styles.routeStats}>
              <View style={styles.statPill}>
                <Ionicons name="location-outline" size={12} color={Colors.primary} />
                <Text style={styles.statText}>{item.totalStops} stops</Text>
              </View>
              <View style={styles.statPill}>
                <Ionicons name="walk-outline" size={12} color={Colors.info} />
                <Text style={styles.statText}>{(item.estimatedDistanceKm ?? 0).toFixed(2)} km</Text>
              </View>
              <View style={styles.statPill}>
                <Ionicons name="cash-outline" size={12} color={Colors.warning} />
                <Text style={styles.statText}>৳ {(item.estimatedFare ?? 10).toFixed(0)}</Text>
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
            <Text style={styles.headerTitle}>🚌 Mama Bhara Kto?</Text>
            <Text style={styles.headerSubtitle}>Find the best route between stops</Text>
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
              <TouchableOpacity onPress={() => { setFrom(''); setFromStopName(null); setFromSuggestions([]); }}>
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
              onSubmitEditing={searchBuses}
            />
            {to.length > 0 && (
              <TouchableOpacity onPress={() => { setTo(''); setToStopName(null); setToSuggestions([]); }}>
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
            style={[styles.searchButton, (!fromStopName || !toStopName) && styles.searchButtonDisabled]}
            onPress={searchBuses}
            disabled={!fromStopName || !toStopName}
            activeOpacity={0.8}
          >
            <Ionicons name="search" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.searchButtonText}>Search Buses</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View
        style={[
          styles.body,
          {
            marginBottom: safeArea.bottom + 8, // Dynamic bottom margin for navigation bar
          },
        ]}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Finding buses...</Text>
          </View>
        ) : showData ? (
          buses.length > 0 ? (
            <>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>Available Buses</Text>
                <Text style={styles.resultsCount}>{buses.length} bus{buses.length > 1 ? 'es' : ''} found</Text>
              </View>
              <FlatList
                data={buses}
                keyExtractor={(item) => `bus_${item.id}`}
                renderItem={renderBusItem}
                contentContainerStyle={{ paddingBottom: 12 }}
                showsVerticalScrollIndicator={false}
              />
            </>
          ) : (
            <View style={styles.noResultsContainer}>
              <Ionicons name="sad-outline" size={64} color={Colors.textMuted} />
              <Text style={styles.noRoutesTitle}>No Buses Found</Text>
              <Text style={styles.noRoutesText}>
                No direct buses found between these stops.{'\n'}Try different locations.
              </Text>
            </View>
          )
        ) : (
          <View style={styles.instructionsContainer}>
            <Ionicons name="information-circle-outline" size={64} color={Colors.primary} />
            <Text style={styles.instructionsTitle}>Find Your Bus</Text>
            <Text style={styles.instructionsText}>
              📍 Select your starting location{'\n'}
              📍 Choose your destination{'\n'}
              🔍 Tap Search to find available buses
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
  busIconContainer: {
    backgroundColor: Colors.badge,
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
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
  serviceType: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: 6,
    fontStyle: 'italic',
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
