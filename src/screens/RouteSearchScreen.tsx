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
import DatabaseService, { Stop, Bus, TransferRoute } from '../services/DatabaseService';
import StorageService from '../services/StorageService';
import { useTheme } from '../theme/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';
import { DarkColors } from '../theme/darkColors';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { TransferBusCard } from '../components/TransferBusCard';

export default function RouteSearchScreen({ navigation, route }: any) {
  const { isDark } = useTheme();
  const themeColors = isDark ? DarkColors : Colors;
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [fromStopName, setFromStopName] = useState<string | null>(null);
  const [toStopName, setToStopName] = useState<string | null>(null);
  const [showData, setShowData] = React.useState(false);
  const [allBuses, setAllBuses] = useState<Bus[]>([]); // All buses loaded
  const [buses, setBuses] = useState<Bus[]>([]); // Displayed buses (paginated)
  const [displayedBusesCount, setDisplayedBusesCount] = useState(50); // Initial display count
  const [transferRoutes, setTransferRoutes] = useState<TransferRoute[]>([]);
  const [allTransferRoutes, setAllTransferRoutes] = useState<TransferRoute[]>([]); // Store all for filtering
  const [displayedTransfersCount, setDisplayedTransfersCount] = useState(50); // Transfer pagination
  const [loading, setLoading] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transfersLoaded, setTransfersLoaded] = useState(false); // Lazy load flag
  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [fromSuggestions, setFromSuggestions] = useState<Stop[]>([]);
  const [toSuggestions, setToSuggestions] = useState<Stop[]>([]);
  const [uniqueTransferPoints, setUniqueTransferPoints] = useState<Array<{ id: number; name: string; nameBn: string }>>([]);
  const [selectedTransferPointIds, setSelectedTransferPointIds] = useState<number[]>([]); // All by default
  const [searchDate, setSearchDate] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<string | null>(null);
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
      const lowerText = text.toLowerCase();
      const filtered = allStops.filter(
        stop =>
          (stop.stopageEn && stop.stopageEn.toLowerCase().includes(lowerText)) ||
          (stop.stopageBn && stop.stopageBn.toLowerCase().includes(lowerText))
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
      const lowerText = text.toLowerCase();
      const filtered = allStops.filter(
        stop =>
          (stop.stopageEn && stop.stopageEn.toLowerCase().includes(lowerText)) ||
          (stop.stopageBn && stop.stopageBn.toLowerCase().includes(lowerText))
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
    setTransfersLoaded(false); // Reset lazy load flag
    setAllTransferRoutes([]); // Clear previous transfers
    setTransferRoutes([]);
    setUniqueTransferPoints([]);
    setSelectedTransferPointIds([]);

    // Set search date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-BD', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', hour12: true });
    setSearchDate(dateStr);
    setSearchTime(timeStr);

    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    try {
      // Search for direct buses only (lazy load transfers)
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

  // Lazy load transfers when user clicks to expand
  const loadTransfers = async (fStopName: string, tStopName: string) => {
    if (transfersLoaded) return; // Already loaded
    
    setTransferLoading(true);
    try {
      const foundTransfers = await DatabaseService.getBusesWithOneTransfer(fStopName, tStopName);
      setAllTransferRoutes(foundTransfers);
      
      // Display first 50 transfers
      const displayedTransfers = foundTransfers.slice(0, 50);
      setTransferRoutes(displayedTransfers);
      
      // Get unique transfer points
      const uniquePoints = await DatabaseService.getUniqueTransferPoints(foundTransfers);
      setUniqueTransferPoints(uniquePoints);
      setSelectedTransferPointIds(uniquePoints.map(p => p.id)); // Select all by default
      
      setTransfersLoaded(true);
      console.log('Loaded transfers:', foundTransfers.length);
    } catch (error) {
      console.error('Error loading transfers:', error);
      setAllTransferRoutes([]);
      setTransferRoutes([]);
    } finally {
      setTransferLoading(false);
    }
  };

  // Filter transfers by selected transfer points
  const handleTransferPointFilterChange = (pointId: number) => {
    let newSelected = [...selectedTransferPointIds];
    
    if (newSelected.includes(pointId)) {
      newSelected = newSelected.filter(id => id !== pointId);
    } else {
      newSelected.push(pointId);
    }
    
    setSelectedTransferPointIds(newSelected);
    
    // Update displayed routes based on filter with current display count
    const filtered = DatabaseService.filterTransferRoutesByPoint(allTransferRoutes, newSelected);
    const displayedTransfers = filtered.slice(0, displayedTransfersCount);
    setTransferRoutes(displayedTransfers);
  };

  // Load more buses (add 50 more)
  const loadMoreBuses = () => {
    const newCount = displayedBusesCount + 50;
    setDisplayedBusesCount(newCount);
    const moreBuses = allBuses.slice(0, newCount);
    setBuses(moreBuses);
  };

  // Load all remaining buses
  const loadAllBuses = () => {
    setDisplayedBusesCount(allBuses.length);
    setBuses(allBuses);
  };

  // Load more transfers (add 50 more)
  const loadMoreTransfers = () => {
    const newCount = displayedTransfersCount + 50;
    setDisplayedTransfersCount(newCount);
    
    // Apply current filter to new count
    const filtered = DatabaseService.filterTransferRoutesByPoint(allTransferRoutes, selectedTransferPointIds);
    const moreTransfers = filtered.slice(0, newCount);
    setTransferRoutes(moreTransfers);
  };

  // Load all remaining transfers
  const loadAllTransfers = () => {
    setDisplayedTransfersCount(allTransferRoutes.length);
    
    // Apply current filter to all
    const filtered = DatabaseService.filterTransferRoutesByPoint(allTransferRoutes, selectedTransferPointIds);
    setTransferRoutes(filtered);
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
          buses.length > 0 || transferRoutes.length > 0 ? (
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Spacing.lg }}
            >
              {/* Direct Buses Section */}
              {buses.length > 0 && (
                <CollapsibleSection
                  title={`Direct Bus (${buses.length} of ${allBuses.length})`}
                  count={buses.length}
                  defaultExpanded={true}
                  icon="bus"
                >
                  <FlatList
                    data={buses}
                    keyExtractor={(item) => `bus_${item.id}`}
                    renderItem={renderBusItem}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                  />
                  
                  {/* Pagination Controls for Buses */}
                  {buses.length < allBuses.length && (
                    <View style={styles.paginationContainer}>
                      <TouchableOpacity
                        style={[styles.paginationButton, { backgroundColor: themeColors.primary }]}
                        onPress={loadMoreBuses}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="arrow-down" size={16} color="#FFF" />
                        <Text style={[styles.paginationButtonText, { color: '#FFF' }]}>
                          Load 50 More
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.paginationButton, { backgroundColor: themeColors.badge }]}
                        onPress={loadAllBuses}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="download" size={16} color="#FFF" />
                        <Text style={[styles.paginationButtonText, { color: '#FFF' }]}>
                          Load All
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </CollapsibleSection>
              )}

              {/* Transfer Buses Section - Lazy Load */}
              {!transfersLoaded && fromStopName && toStopName && (
                <TouchableOpacity
                  style={[styles.lazyLoadButton, { backgroundColor: themeColors.primary }]}
                  onPress={() => loadTransfers(fromStopName, toStopName)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="swap-horizontal" size={20} color="#FFF" />
                  <Text style={[styles.lazyLoadButtonText, { color: '#FFF' }]}>
                    {transferLoading ? 'Loading transfers...' : 'Show Buses with 1 Change'}
                  </Text>
                  {transferLoading && <ActivityIndicator color="#FFF" style={{ marginLeft: 10 }} />}
                </TouchableOpacity>
              )}

              {/* Filter Section for Transfer Points */}
              {transfersLoaded && uniqueTransferPoints.length > 0 && (
                <View style={[styles.filterSection, { backgroundColor: themeColors.surface }]}>
                  <Text style={[styles.filterTitle, { color: themeColors.textPrimary }]}>
                    Filter by Transfer Point
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterContainer}
                  >
                    {uniqueTransferPoints.map((point) => (
                      <TouchableOpacity
                        key={point.id}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: selectedTransferPointIds.includes(point.id)
                              ? themeColors.primary
                              : themeColors.borderLight,
                          },
                        ]}
                        onPress={() => handleTransferPointFilterChange(point.id)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            {
                              color: selectedTransferPointIds.includes(point.id)
                                ? '#FFF'
                                : themeColors.textSecondary,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {point.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Transfer Buses List */}
              {transfersLoaded && transferRoutes.length > 0 && (
                <CollapsibleSection
                  title={`Buses with 1 Change (${transferRoutes.length} of ${allTransferRoutes.length})`}
                  count={transferRoutes.length}
                  defaultExpanded={buses.length === 0}
                  icon="swap-horizontal"
                >
                  <FlatList
                    data={transferRoutes}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TransferBusCard
                        transfer={item}
                        onPress={(transfer) => {
                          // Navigate to route details for the first bus in the transfer
                          // This gives the user information about the first leg of the journey
                          navigation.navigate('RouteDetails', {
                            busId: transfer.firstBus.id,
                            busName: transfer.firstBus.nameEnglish,
                            busBn: transfer.firstBus.nameBangla,
                            fromStopName: transfer.firstBusFromStop,
                            toStopName: transfer.firstBusToStop,
                            transferRoute: transfer, // Pass the full transfer for reference
                          });
                        }}
                      />
                    )}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                  />
                  
                  {/* Pagination Controls for Transfers */}
                  {transferRoutes.length < allTransferRoutes.length && (
                    <View style={styles.paginationContainer}>
                      <TouchableOpacity
                        style={[styles.paginationButton, { backgroundColor: themeColors.primary }]}
                        onPress={loadMoreTransfers}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="arrow-down" size={16} color="#FFF" />
                        <Text style={[styles.paginationButtonText, { color: '#FFF' }]}>
                          Load 50 More
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.paginationButton, { backgroundColor: themeColors.badge }]}
                        onPress={loadAllTransfers}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="download" size={16} color="#FFF" />
                        <Text style={[styles.paginationButtonText, { color: '#FFF' }]}>
                          Load All
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </CollapsibleSection>
              )}

              {/* No transfers message */}
              {transfersLoaded && transferRoutes.length === 0 && (
                <View style={[styles.noTransfersContainer, { backgroundColor: themeColors.surface }]}>
                  <Ionicons name="alert-circle-outline" size={48} color={themeColors.textSecondary} />
                  <Text style={[styles.noTransfersText, { color: themeColors.textSecondary }]}>
                    No transfer options available
                  </Text>
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.noResultsContainer}>
              <Ionicons name="sad-outline" size={64} color={themeColors.textMuted} />
              <Text style={[styles.noRoutesTitle, { color: themeColors.textPrimary }]}>No Buses Found</Text>
              
              {/* Route Details */}
              <View style={[styles.noRoutesText, { marginTop: Spacing.md, marginBottom: Spacing.md }]}>
                <View style={styles.routeStops}>
                  <Text style={[styles.route, { color: themeColors.textSecondary }]}>
                    {fromStopName} → {toStopName}
                  </Text>
                </View>
                
                {/* Search Date and Time */}
                {(searchDate || searchTime) && (
                  <View style={styles.dateTimeRow}>
                    <Ionicons name="calendar-outline" size={16} color={themeColors.textMuted} />
                    <Text style={[styles.routeEmptyText, { color: themeColors.textMuted }]}>
                      {searchDate}
                    </Text>
                    <Text style={[styles.routeEmptyText, { color: themeColors.textMuted, marginLeft: Spacing.sm }]}>
                      {searchTime}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={[styles.noRoutesText, { color: themeColors.textSecondary }]}>
                No direct buses or transfer options found.{'\n'}Try different locations or times.
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
  routeEmptyText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  lazyLoadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
    shadowColor: Colors.shadowPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  lazyLoadButtonText: {
    fontSize: FontSize.base,
    fontWeight: '600',
    color: '#FFF',
  },
  filterSection: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
  },
  filterTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  filterChip: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.borderLight,
  },
  filterChipText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  noTransfersContainer: {
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.xl,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
  },
  noTransfersText: {
    fontSize: FontSize.base,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  paginationContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    justifyContent: 'center',
  },
  paginationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
    shadowColor: Colors.shadowPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  paginationButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: '#FFF',
  },
});

