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
import { useTheme } from '../theme/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';
import { DarkColors } from '../theme/darkColors';

export default function RouteSearchScreen({ navigation, route }: any) {
  const { isDark } = useTheme();
  const themeColors = isDark ? DarkColors : Colors;
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
        style={[styles.card, { backgroundColor: themeColors.surface, borderLeftColor: themeColors.primary }]}
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
          <View style={[styles.busIconContainer, { backgroundColor: themeColors.badge }]}>
            <Ionicons name="bus" size={32} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.busName, { color: themeColors.textPrimary }]}>{item.nameEnglish}</Text>
            {item.nameBangla && <Text style={[styles.busNameBn, { color: themeColors.textSecondary }]}>{item.nameBangla}</Text>}
            {item.serviceType && <Text style={[styles.serviceType, { color: themeColors.textTertiary }]}>{item.serviceType}</Text>}
            <View style={styles.routeStops}>
              <Text style={[styles.route, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {fromStopName}
              </Text>
              <Ionicons name="arrow-forward" size={14} color={themeColors.primary} style={{ marginHorizontal: 6 }} />
              <Text style={[styles.route, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {toStopName}
              </Text>
            </View>
            <View style={styles.routeStats}>
              <View style={[styles.statPill, { backgroundColor: themeColors.background }]}>
                <Ionicons name="location-outline" size={12} color={themeColors.primary} />
                <Text style={[styles.statText, { color: themeColors.textSecondary }]}>{item.totalStops} stops</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: themeColors.background }]}>
                <Ionicons name="walk-outline" size={12} color={themeColors.info} />
                <Text style={[styles.statText, { color: themeColors.textSecondary }]}>{(item.estimatedDistanceKm ?? 0).toFixed(2)} km</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: themeColors.background }]}>
                <Ionicons name="cash-outline" size={12} color={themeColors.warning} />
                <Text style={[styles.statText, { color: themeColors.textSecondary }]}>৳ {(item.estimatedFare ?? 10).toFixed(0)}</Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color={themeColors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderSuggestion = (item: Stop, onSelect: (stop: Stop) => void) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.suggestionItem, { backgroundColor: themeColors.surface }]}
      onPress={() => onSelect(item)}
      activeOpacity={0.7}
    >
      <Ionicons name="location-outline" size={20} color={themeColors.primary} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.suggestionText, { color: themeColors.textPrimary }]}>{item.stopageEn}</Text>
        {item.stopageBn && <Text style={[styles.suggestionTextBn, { color: themeColors.textSecondary }]}>{item.stopageBn}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={[themeColors.gradientStart, themeColors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        {/* Compact Header with Title Only 
        <View style={styles.headerTop}>
          <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>🚌 Find Bus</Text>
        </View>
        */}
        
        {/* Search Card Container */}
        <View style={[styles.searchCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.1)' }]}>
          <View style={[styles.inputCard, { backgroundColor: themeColors.surface, borderColor: themeColors.borderLight }]}>
            <Ionicons name="location" size={20} color={themeColors.primary} style={styles.icon} />
            <TextInput
              placeholder="Source Stoppage (e.g., Gabtoli)"
              placeholderTextColor={themeColors.textTertiary}
              value={from}
              onChangeText={handleFromSearch}
              style={[styles.input, { color: themeColors.text }]}
              returnKeyType="next"
            />
            {from.length > 0 && (
              <TouchableOpacity onPress={() => { setFrom(''); setFromStopName(null); setFromSuggestions([]); }}>
                <Ionicons name="close-circle" size={20} color={themeColors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* From Suggestions Dropdown */}
          {fromSuggestions.length > 0 && (
            <View style={[styles.suggestionsDropdown, { backgroundColor: themeColors.background }]}>
              <ScrollView 
                style={styles.suggestionsScroll}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                {fromSuggestions.map(stop => renderSuggestion(stop, selectFromStop))}
              </ScrollView>
            </View>
          )}

          <View style={[styles.inputCard, { marginTop: 8, backgroundColor: themeColors.surface, borderColor: themeColors.borderLight }]}>
            <Ionicons name="navigate" size={20} color={themeColors.primary} style={styles.icon} />
            <TextInput
              placeholder="Destination Stoppage (e.g., Uttara)"
              placeholderTextColor={themeColors.textTertiary}
              value={to}
              onChangeText={handleToSearch}
              style={[styles.input, { color: themeColors.textPrimary }]}
              returnKeyType="search"
              onSubmitEditing={searchBuses}
            />
            {to.length > 0 && (
              <TouchableOpacity onPress={() => { setTo(''); setToStopName(null); setToSuggestions([]); }}>
                <Ionicons name="close-circle" size={20} color={themeColors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* To Suggestions Dropdown */}
          {toSuggestions.length > 0 && (
            <View style={[styles.suggestionsDropdown, { backgroundColor: themeColors.background }]}>
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
            style={[styles.searchButton, { backgroundColor: themeColors.primary }, (!fromStopName || !toStopName) && styles.searchButtonDisabled]}
            onPress={searchBuses}
            disabled={!fromStopName || !toStopName}
            activeOpacity={0.8}
          >
            <Ionicons name="search" size={18} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={[styles.searchButtonText, { color: '#FFF' }]}>Search</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View
        style={[
          styles.body,
          {
            backgroundColor: themeColors.background,
            marginBottom: safeArea.bottom + 8, // Dynamic bottom margin for navigation bar
          },
        ]}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Finding buses...</Text>
          </View>
        ) : showData ? (
          buses.length > 0 ? (
            <>
              <View style={[styles.resultsHeader, { borderBottomColor: themeColors.primary }]}>
                <Text style={[styles.resultsTitle, { color: themeColors.textPrimary }]}>Available Buses</Text>
                <Text style={[styles.resultsCount, { color: themeColors.textSecondary }]}>{buses.length} bus{buses.length > 1 ? 'es' : ''} found</Text>
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
              <Ionicons name="sad-outline" size={64} color={themeColors.textMuted} />
              <Text style={[styles.noRoutesTitle, { color: themeColors.textPrimary }]}>No Buses Found</Text>
              <Text style={[styles.noRoutesText, { color: themeColors.textSecondary }]}>
                No direct buses found between these stops.{'\n'}Try different locations.
              </Text>
            </View>
          )
        ) : (
          <View style={styles.instructionsContainer}>
            <Ionicons name="information-circle-outline" size={64} color={themeColors.primary} />
            <Text style={[styles.instructionsTitle, { color: themeColors.textPrimary }]}>Find Your Bus</Text>
            <Text style={[styles.instructionsText, { color: themeColors.textSecondary }]}>
              📍 Select your starting location{' \n'}
              📍 Choose your destination{' \n'}
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
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
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
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xl,
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
    display: 'none',
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
    padding: Spacing.sm,
    // Theme colors applied inline at runtime
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    height: 54,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    // Theme colors applied inline at runtime
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
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadowPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
    // Theme colors applied inline at runtime
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: Colors.primary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    // Theme color applied inline at runtime
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
    // Theme colors applied inline at runtime
  },
  resultsTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
    // Theme color applied inline at runtime
  },
  resultsCount: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    // Theme color applied inline at runtime
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
    // Theme colors applied inline at runtime
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
