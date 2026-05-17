import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
  Dimensions,
  useColorScheme,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useDynamicSafeArea } from '../hooks/useDynamicSafeArea';
import DatabaseService, { Stop } from '../services/DatabaseService';
import TransitNetworkService, { DetailedRoute } from '../services/TransitNetworkService';
import StorageService from '../services/StorageService';
import { useTheme } from '../theme/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';
import { DarkColors } from '../theme/darkColors';

// Transfer mode mapping
const TRANSFER_MODES = [
  { key: 'best', label: 'Best', mode: -1, icon: 'trophy-outline' },
  { key: 'direct', label: 'Direct', mode: 0, icon: 'bus-outline' },
  { key: '1t', label: '1T', mode: 1, icon: 'swap-horizontal-outline' },
  { key: '2t', label: '2T', mode: 2, icon: 'git-merge-outline' },
];

export default function RouteSearchScreen({ navigation, route }: any) {
  const { isDark } = useTheme();
  const themeColors = isDark ? DarkColors : Colors;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [viaStop, setViaStop] = useState('');
  const [fromStopName, setFromStopName] = useState<string | null>(null);
  const [toStopName, setToStopName] = useState<string | null>(null);
  const [showData, setShowData] = useState(false);
  const [results, setResults] = useState<DetailedRoute[]>([]);
  const [displayedCount, setDisplayedCount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [fromSuggestions, setFromSuggestions] = useState<Stop[]>([]);
  const [toSuggestions, setToSuggestions] = useState<Stop[]>([]);
  const [viaSuggestions, setViaSuggestions] = useState<Stop[]>([]);
  const [selectedMode, setSelectedMode] = useState<number>(-1); // -1 = Best
  const [searchDate, setSearchDate] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<string | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<any[]>([]);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const safeArea = useDynamicSafeArea();

  const showViaStop = selectedMode === 1 || selectedMode === 2;

  useFocusEffect(
    useCallback(() => {
      loadStops();
    }, [])
  );

  useEffect(() => {
    if (route?.params) {
      const { fromStopName: paramFrom, toStopName: paramTo } = route.params;
      if (paramFrom && paramTo) {
        setFrom(paramFrom);
        setTo(paramTo);
        setFromStopName(paramFrom);
        setToStopName(paramTo);
        setTimeout(() => {
          searchRoutes(paramFrom, paramTo, '', selectedMode);
        }, 100);
      }
    }
  }, [route?.params]);

  const loadStops = async () => {
    try {
      const stops = await DatabaseService.getAllStops();
      setAllStops(stops);
      
      const history = await StorageService.getSearchHistory();
      setRecentHistory(history.slice(0, 5)); // Keep history smaller
      
      const bookmarks = await StorageService.getBookmarks();
      setSavedRoutes(bookmarks.slice(0, 10));
    } catch (error) {
      console.error('Error loading stops, history or bookmarks:', error);
    }
  };

  const filterStops = (text: string): Stop[] => {
    if (text.length === 0) return [];
    const lowerText = text.toLowerCase();
    return allStops
      .filter(
        (stop) =>
          (stop.stopageEn && stop.stopageEn.toLowerCase().includes(lowerText)) ||
          (stop.stopageBn && stop.stopageBn.toLowerCase().includes(lowerText)),
      )
      .slice(0, 4);
  };

  const findExactStop = (text: string): Stop | null => {
    if (!text.trim()) return null;
    
    const normalizeInternal = (s: string) => 
      s.toLowerCase()
       .replace(/[^a-z0-9\u0980-\u09FF\s]/g, ' ')
       .replace(/\s+/g, ' ')
       .trim();

    const normalizedInput = normalizeInternal(text);
    
    return allStops.find(
      (s) =>
        normalizeInternal(s.stopageEn) === normalizedInput ||
        (s.stopageBn && normalizeInternal(s.stopageBn) === normalizedInput),
    ) || null;
  };

  const handleFromSearch = (text: string) => {
    setFrom(text);
    setFromSuggestions(filterStops(text));
    // Only set confirmed stop name if exact match
    const exact = findExactStop(text);
    setFromStopName(exact ? exact.stopageEn : null);
  };

  const handleToSearch = (text: string) => {
    setTo(text);
    setToSuggestions(filterStops(text));
    const exact = findExactStop(text);
    setToStopName(exact ? exact.stopageEn : null);
  };

  const handleViaSearch = (text: string) => {
    setViaStop(text);
    setViaSuggestions(filterStops(text));
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

  const selectViaStop = (stop: Stop) => {
    setViaStop(stop.stopageEn);
    setViaSuggestions([]);
  };

  const swapStops = () => {
    const tempFrom = from;
    const tempFromName = fromStopName;
    setFrom(to);
    setFromStopName(toStopName);
    setTo(tempFrom);
    setToStopName(tempFromName);
  };

  const searchRoutes = async (
    fStop: string,
    tStop: string,
    via: string = '',
    mode: number = -1,
  ) => {
    setLoading(true);
    setShowData(true);
    setDisplayedCount(20);

    const now = new Date();
    setSearchDate(
      now.toLocaleDateString('en-BD', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    );
    setSearchTime(
      now.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', hour12: true }),
    );

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    try {
      if (!TransitNetworkService.isInitialized()) {
        console.warn('TransitNetwork not initialized, falling back');
        setResults([]);
        return;
      }

      const foundRoutes = TransitNetworkService.findRoutes(fStop, tStop, via, mode);
      setResults(foundRoutes);

      // Save to history
      if (fStop && tStop) {
        const fromStop = findExactStop(fStop);
        const toStop = findExactStop(tStop);
        
        if (fromStop && toStop) {
          await StorageService.addSearchHistory(
            fromStop.id, 
            toStop.id, 
            fromStop.stopageEn, 
            toStop.stopageEn, 
            foundRoutes.length
          );
          const history = await StorageService.getSearchHistory();
          setRecentHistory(history.slice(0, 10));
        }
      }
    } catch (error) {
      console.error('Error searching routes:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!fromStopName || !toStopName) return;
    searchRoutes(fromStopName, toStopName, showViaStop ? viaStop : '', selectedMode);
  };

  const handleModeChange = (mode: number) => {
    setSelectedMode(mode);
    // Clear via if switching away from transfer modes
    if (mode !== 1 && mode !== 2) {
      setViaStop('');
    }
    // Re-search if we already have results
    if (fromStopName && toStopName && showData) {
      searchRoutes(fromStopName, toStopName, mode === 1 || mode === 2 ? viaStop : '', mode);
    }
  };

  const loadMore = () => {
    setDisplayedCount((prev) => Math.min(prev + 20, results.length));
  };

  const displayedResults = useMemo(() => results.slice(0, displayedCount), [results, displayedCount]);

  const getRouteTypeColor = (type: string) => {
    if (type === 'Direct') return themeColors.routeDirect;
    if (type === '1 Transfer') return themeColors.routeTransfer1;
    return themeColors.routeTransfer2;
  };

  const getRouteTypeIcon = (type: string) => {
    if (type === 'Direct') return 'bus';
    if (type === '1 Transfer') return 'swap-horizontal';
    return 'git-merge';
  };

  const renderRouteCard = ({ item, index }: { item: DetailedRoute; index: number }) => {
    const typeColor = getRouteTypeColor(item.type);

    return (
      <TouchableOpacity
        style={[
          styles.routeCard,
          {
            backgroundColor: themeColors.surface,
            borderColor: isDark ? themeColors.border : 'transparent',
            borderWidth: isDark ? 1 : 0,
          },
        ]}
        onPress={() => {
          const fromExact = findExactStop(fromStopName || '');
          const toExact = findExactStop(toStopName || '');
          navigation.navigate('RouteDetails', {
            algorithmRoute: item,
            fromStopName: fromStopName,
            toStopName: toStopName,
            fromStopId: fromExact?.id,
            toStopId: toExact?.id,
          });
        }}
        activeOpacity={0.7}
      >
        {/* Top Row: Type badge + Fare */}
        <View style={styles.routeCardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + '18' }]}>
            <Ionicons name={getRouteTypeIcon(item.type)} size={14} color={typeColor} />
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>{item.type}</Text>
          </View>
          <View style={[styles.fareBadge, { backgroundColor: themeColors.primaryMuted }]}>
            <Text style={[styles.fareText, { color: themeColors.primary }]}>
              ৳ {item.total_cost_tk}
            </Text>
          </View>
        </View>

        {/* Bus Legs */}
        <View style={styles.legsContainer}>
          {item.legs.map((leg, legIdx) => (
            <View key={legIdx}>
              <View style={styles.legRow}>
                <View style={[styles.legDot, { backgroundColor: typeColor }]} />
                <View style={styles.legInfo}>
                  <Text
                    style={[styles.legBusName, { color: themeColors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {leg.busName}
                  </Text>
                  <View style={styles.legStops}>
                    <Text
                      style={[styles.legStopText, { color: themeColors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {leg.from}
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={12}
                      color={themeColors.textTertiary}
                      style={{ marginHorizontal: 4 }}
                    />
                    <Text
                      style={[styles.legStopText, { color: themeColors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {leg.to}
                    </Text>
                  </View>
                </View>
                <View style={styles.legMeta}>
                  <Text style={[styles.legDist, { color: themeColors.textTertiary }]}>
                    {leg.dist.toFixed(1)} km
                  </Text>
                  <Text style={[styles.legFare, { color: themeColors.textSecondary }]}>
                    ৳ {Math.ceil(leg.cost)}
                  </Text>
                </View>
              </View>
              {legIdx < item.legs.length - 1 && (
                <View style={styles.transferIndicator}>
                  <View style={[styles.transferLine, { backgroundColor: themeColors.warning }]} />
                  <View
                    style={[styles.transferBadge, { backgroundColor: themeColors.warningLight }]}
                  >
                    <Ionicons name="swap-horizontal" size={12} color={themeColors.warning} />
                    <Text style={[styles.transferText, { color: themeColors.warning }]}>
                      {item.transfer_points[legIdx] || 'Transfer'}
                    </Text>
                  </View>
                  <View style={[styles.transferLine, { backgroundColor: themeColors.warning }]} />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Bottom Row: Distance + Arrow */}
        <View style={styles.routeCardFooter}>
          <View style={styles.footerStats}>
            <Ionicons name="navigate-outline" size={13} color={themeColors.textTertiary} />
            <Text style={[styles.footerStatText, { color: themeColors.textTertiary }]}>
              {item.total_distance_km.toFixed(1)} km
            </Text>
            {item.path.length > 0 && (
              <>
                <Text style={[styles.footerDot, { color: themeColors.textMuted }]}>·</Text>
                <Ionicons name="ellipsis-horizontal" size={13} color={themeColors.textTertiary} />
                <Text style={[styles.footerStatText, { color: themeColors.textTertiary }]}>
                  {item.path.length} stops
                </Text>
              </>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={themeColors.primary} />
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
      <View style={[styles.suggestionDot, { backgroundColor: themeColors.primaryMuted }]}>
        <Ionicons name="location" size={14} color={themeColors.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.suggestionText, { color: themeColors.textPrimary }]}>
          {item.stopageEn}
        </Text>
        {item.stopageBn && item.stopageBn !== item.stopageEn && (
          <Text style={[styles.suggestionTextBn, { color: themeColors.textTertiary }]}>
            {item.stopageBn}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const dismissSuggestions = () => {
    Keyboard.dismiss();
    setFromSuggestions([]);
    setToSuggestions([]);
    setViaSuggestions([]);
  };

  return (
    <TouchableWithoutFeedback onPress={dismissSuggestions}>
      <SafeAreaView
        style={[styles.safe, { backgroundColor: themeColors.background }]}
        edges={['top', 'left', 'right']}
      >
        <LinearGradient
        colors={[themeColors.gradientStart, themeColors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        {/* Search Card */}
        <View
          style={[
            styles.searchCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)',
            },
          ]}
        >
          {/* From Input */}
          <View
            style={[
              styles.inputCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.inputBorder,
              },
            ]}
          >
            <View style={[styles.inputDot, { backgroundColor: themeColors.success }]} />
            <TextInput
              placeholder="From where?"
              placeholderTextColor={themeColors.inputPlaceholder}
              value={from}
              onChangeText={handleFromSearch}
              style={[styles.input, { color: themeColors.textPrimary }]}
              returnKeyType="next"
              onSubmitEditing={() => setFromSuggestions([])}
            />
            {from.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setFrom('');
                  setFromStopName(null);
                  setFromSuggestions([]);
                }}
              >
                <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {fromSuggestions.length > 0 && (
            <View
              style={[styles.suggestionsDropdown, { backgroundColor: themeColors.background, top: 65 }]}
            >
              <ScrollView
                style={styles.suggestionsScroll}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                {fromSuggestions.slice(0, 10).map((stop) => renderSuggestion(stop, selectFromStop))}
              </ScrollView>
            </View>
          )}

          {/* Swap Button */}
          <TouchableOpacity
            style={[styles.swapButton, { backgroundColor: themeColors.surface }]}
            onPress={swapStops}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-vertical" size={18} color={themeColors.primary} />
          </TouchableOpacity>

          {/* To Input */}
          <View
            style={[
              styles.inputCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.inputBorder,
              },
            ]}
          >
            <View style={[styles.inputDot, { backgroundColor: themeColors.error }]} />
            <TextInput
              placeholder="To where?"
              placeholderTextColor={themeColors.inputPlaceholder}
              value={to}
              onChangeText={handleToSearch}
              style={[styles.input, { color: themeColors.textPrimary }]}
              returnKeyType="search"
              onSubmitEditing={() => {
                setToSuggestions([]);
                handleSearch();
              }}
            />
            {to.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setTo('');
                  setToStopName(null);
                  setToSuggestions([]);
                }}
              >
                <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {toSuggestions.length > 0 && (
            <View
              style={[styles.suggestionsDropdown, { backgroundColor: themeColors.background, top: 120 }]}
            >
              <ScrollView
                style={styles.suggestionsScroll}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                {toSuggestions.slice(0, 10).map((stop) => renderSuggestion(stop, selectToStop))}
              </ScrollView>
            </View>
          )}

          {/* Via Stop (conditional) */}
          {showViaStop && (
            <>
              <View
                style={[
                  styles.inputCard,
                  {
                    marginTop: 8,
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.inputBorder,
                  },
                ]}
              >
                <View style={[styles.inputDot, { backgroundColor: themeColors.warning }]} />
                <TextInput
                  placeholder="Via stoppage (optional)"
                  placeholderTextColor={themeColors.inputPlaceholder}
                  value={viaStop}
                  onChangeText={handleViaSearch}
                  style={[styles.input, { color: themeColors.textPrimary }]}
                  returnKeyType="search"
                  onSubmitEditing={() => {
                    setViaSuggestions([]);
                    handleSearch();
                  }}
                />
                {viaStop.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setViaStop('');
                      setViaSuggestions([]);
                    }}
                  >
                    <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {viaSuggestions.length > 0 && (
                <View
                  style={[
                    styles.suggestionsDropdown,
                    { backgroundColor: themeColors.background, top: 175 },
                  ]}
                >
                  <ScrollView
                    style={styles.suggestionsScroll}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                  >
                    {viaSuggestions.slice(0, 10).map((stop) => renderSuggestion(stop, selectViaStop))}
                  </ScrollView>
                </View>
              )}
            </>
          )}

          {/* Segmented Control */}
          <View style={[styles.segmentContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
            {TRANSFER_MODES.map((tm) => (
              <TouchableOpacity
                key={tm.key}
                style={[
                  styles.segmentButton,
                  selectedMode === tm.mode && [
                    styles.segmentButtonActive,
                    { backgroundColor: themeColors.surface },
                  ],
                ]}
                onPress={() => handleModeChange(tm.mode)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={tm.icon as any}
                  size={14}
                  color={selectedMode === tm.mode ? themeColors.primary : themeColors.textTertiary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color:
                        selectedMode === tm.mode
                          ? themeColors.primary
                          : themeColors.textTertiary,
                      fontWeight: selectedMode === tm.mode ? '700' : '500',
                    },
                  ]}
                >
                  {tm.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search Button */}
          <TouchableOpacity
            style={[
              styles.searchButton,
              { backgroundColor: '#FFFFFF' },
              (!fromStopName || !toStopName) && styles.searchButtonDisabled,
            ]}
            onPress={handleSearch}
            disabled={!fromStopName || !toStopName}
            activeOpacity={0.8}
          >
            <Ionicons
              name="search"
              size={18}
              color={themeColors.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.searchButtonText, { color: themeColors.primary }]}>
              Find Routes
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Results Body */}
      <View
        style={[
          styles.body,
          {
            backgroundColor: themeColors.background,
            marginBottom: safeArea.bottom + 8,
          },
        ]}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
              Finding best routes...
            </Text>
          </View>
        ) : showData ? (
          displayedResults.length > 0 ? (
            <FlatList
              data={displayedResults}
              keyExtractor={(item, index) => `route_${index}`}
              renderItem={renderRouteCard}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: Spacing.md, paddingBottom: Spacing.lg }}
              ListHeaderComponent={
                <View style={styles.resultsHeader}>
                  <Text style={[styles.resultsTitle, { color: themeColors.textPrimary }]}>
                    {results.length} route{results.length !== 1 ? 's' : ''} found
                  </Text>
                  {searchDate && (
                    <Text style={[styles.resultsSubtitle, { color: themeColors.textTertiary }]}>
                      {searchDate} · {searchTime}
                    </Text>
                  )}
                </View>
              }
              ListFooterComponent={
                displayedCount < results.length ? (
                  <TouchableOpacity
                    style={[styles.loadMoreButton, { backgroundColor: themeColors.primaryMuted }]}
                    onPress={loadMore}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={themeColors.primary} />
                    <Text style={[styles.loadMoreText, { color: themeColors.primary }]}>
                      Show {Math.min(20, results.length - displayedCount)} more
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="map-outline" size={56} color={themeColors.textMuted} />
              <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
                No routes found
              </Text>
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                {fromStopName} → {toStopName}
              </Text>
              <Text style={[styles.emptyHint, { color: themeColors.textTertiary }]}>
                Try different stops or search modes
              </Text>
            </View>
          )
        ) : (
          <View style={{ flex: 1 }}>
            {savedRoutes.length > 0 ? (
              <View style={styles.recentSection}>
                <View style={styles.recentHeader}>
                  <Text style={[styles.recentTitle, { color: themeColors.textPrimary }]}>
                    Saved Routes
                  </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Saved')}>
                    <Text style={[styles.seeAllText, { color: themeColors.primary }]}>See All</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recentScrollContent}
                >
                  {savedRoutes.map((item, idx) => (
                    <TouchableOpacity
                      key={item.routeId || idx}
                      style={[
                        styles.recentCard,
                        { 
                          backgroundColor: themeColors.surface,
                          borderColor: isDark ? themeColors.border : 'rgba(0,0,0,0.05)',
                          borderWidth: 1
                        }
                      ]}
                      onPress={() => {
                        if (item.busId && item.busId > 0) {
                          navigation.navigate('RouteDetails', {
                            busId: item.busId,
                            busName: item.busName,
                            busBn: item.busBn,
                            fromStopName: item.fromStopName,
                            toStopName: item.toStopName,
                            fromStopId: item.fromStopId,
                            toStopId: item.toStopId,
                            showFullRoute: true,
                          });
                        } else {
                          // Algorithm route — re-trigger search
                          setFrom(item.fromStopName);
                          setTo(item.toStopName);
                          setFromStopName(item.fromStopName);
                          setToStopName(item.toStopName);
                          setTimeout(() => {
                            searchRoutes(item.fromStopName, item.toStopName, '', selectedMode);
                          }, 100);
                        }
                      }}
                    >
                      <View style={styles.recentRouteRow}>
                        <Text style={[styles.recentStopText, { color: themeColors.textPrimary }]} numberOfLines={1}>
                          {item.busName}
                        </Text>
                      </View>
                      <Text style={[styles.recentMetaText, { color: themeColors.textTertiary }]} numberOfLines={1}>
                        {item.fromStopName} → {item.toStopName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : recentHistory.length > 0 ? (
              <View style={styles.recentSection}>
                <View style={styles.recentHeader}>
                  <Text style={[styles.recentTitle, { color: themeColors.textPrimary }]}>
                    Recent Searches
                  </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Saved')}>
                    <Text style={[styles.seeAllText, { color: themeColors.primary }]}>See All</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recentScrollContent}
                >
                  {recentHistory.map((item, idx) => (
                    <TouchableOpacity
                      key={item.id || idx}
                      style={[
                        styles.recentCard,
                        { 
                          backgroundColor: themeColors.surface,
                          borderColor: isDark ? themeColors.border : 'rgba(0,0,0,0.05)',
                          borderWidth: 1
                        }
                      ]}
                      onPress={() => {
                        setFrom(item.fromStopName);
                        setTo(item.toStopName);
                        setFromStopName(item.fromStopName);
                        setToStopName(item.toStopName);
                        searchRoutes(item.fromStopName, item.toStopName, '', selectedMode);
                      }}
                    >
                      <View style={styles.recentRouteRow}>
                        <Text style={[styles.recentStopText, { color: themeColors.textPrimary }]} numberOfLines={1}>
                          {item.fromStopName}
                        </Text>
                        <Ionicons name="arrow-forward" size={10} color={themeColors.textTertiary} style={{ marginHorizontal: 4 }} />
                        <Text style={[styles.recentStopText, { color: themeColors.textPrimary }]} numberOfLines={1}>
                          {item.toStopName}
                        </Text>
                      </View>
                      <Text style={[styles.recentMetaText, { color: themeColors.textTertiary }]}>
                        {item.routesFound} routes found
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}


            <View style={styles.emptyContainer}>
              <View
                style={[styles.heroIcon, { backgroundColor: themeColors.primaryMuted }]}
              >
                <Ionicons name="bus" size={36} color={themeColors.primary} />
              </View>
              <Text style={[styles.heroTitle, { color: themeColors.textPrimary }]}>
                Find Your Bus
              </Text>
              <Text style={[styles.heroText, { color: themeColors.textSecondary }]}>
                Search for the best bus routes{'\n'}between any two stops in Dhaka
              </Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xxl,
    borderBottomRightRadius: BorderRadius.xxl,
    zIndex: 999,
    ...Platform.select({
      android: { elevation: 15 },
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        zIndex: 999,
      },
    }),
  },
  searchCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 50,
    borderWidth: 1,
    marginBottom: 0,
  },
  inputDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.md,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  swapButton: {
    position: 'absolute',
    left: Spacing.xxl,
    top: 56,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: 3,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  segmentButtonActive: {
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
    }),
  },
  segmentText: {
    fontSize: FontSize.sm,
  },
  searchButton: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      android: { elevation: 4 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
    }),
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  suggestionsDropdown: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: BorderRadius.md,
    marginTop: 4,
    marginBottom: 4,
    maxHeight: 400,
    overflow: 'hidden',
    zIndex: 5000,
    ...Platform.select({
      android: { elevation: 8 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
    }),
  },
  suggestionsScroll: {
    maxHeight: 400,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  suggestionDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: {
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  suggestionTextBn: {
    fontSize: FontSize.sm,
    marginTop: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    zIndex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  resultsHeader: {
    marginBottom: Spacing.md,
  },
  resultsTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  resultsSubtitle: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  // Route Card
  routeCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
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
  routeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  typeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fareBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  fareText: {
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  legsContainer: {
    marginBottom: Spacing.sm,
  },
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  legDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.md,
  },
  legInfo: {
    flex: 1,
  },
  legBusName: {
    fontSize: FontSize.base,
    fontWeight: '700',
  },
  legStops: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  legStopText: {
    fontSize: FontSize.sm,
    flex: 1,
  },
  legMeta: {
    alignItems: 'flex-end',
    marginLeft: Spacing.sm,
  },
  legDist: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  legFare: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginTop: 1,
  },
  transferIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingLeft: 3,
  },
  transferLine: {
    flex: 1,
    height: 1,
  },
  transferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
    marginHorizontal: Spacing.sm,
  },
  transferText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginLeft: 4,
  },
  routeCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
    paddingTop: Spacing.sm,
  },
  footerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerStatText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  footerDot: {
    fontSize: FontSize.sm,
    marginHorizontal: 2,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    gap: 6,
  },
  loadMoreText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginTop: Spacing.lg,
  },
  emptyText: {
    fontSize: FontSize.base,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  heroText: {
    fontSize: FontSize.base,
    marginTop: Spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  recentSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm + 2,
    paddingHorizontal: 2,
  },
  recentTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  seeAllText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  recentScrollContent: {
    paddingRight: Spacing.lg,
    gap: 12,
  },
  recentCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    minWidth: 160,
    maxWidth: 240,
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
    }),
  },
  recentRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  recentStopText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    maxWidth: 80,
  },
  recentMetaText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
});
