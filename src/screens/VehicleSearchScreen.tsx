import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import FirebaseService from '../services/FirebaseService';
import DataMigrationService from '../services/DataMigrationService';
import { useTheme } from '../theme/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';
import { DarkColors } from '../theme/darkColors';

const VEHICLE_TYPES = ['CNG', 'Car', 'Bike', 'Others'];

export default function VehicleSearchScreen() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  // Modal State
  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('');
  const [newFare, setNewFare] = useState('');
  const [newDistance, setNewDistance] = useState('');
  const [newCarType, setNewCarType] = useState('CNG');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Suggestions
  const [fromSuggestions, setFromSuggestions] = useState<string[]>([]);
  const [toSuggestions, setToSuggestions] = useState<string[]>([]);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);

  const { isDark } = useTheme();
  const themeColors = isDark ? DarkColors : Colors;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  const handleSearch = async () => {
    if (!isConnected) {
      Alert.alert('Offline', 'You need internet to use this feature.');
      return;
    }

    if (!from.trim() || !to.trim()) {
      Alert.alert('Required', 'Please enter both From and To locations.');
      return;
    }

    setLoading(true);
    try {
      const data = await FirebaseService.searchOtherRoutes(from, to, selectedType);
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to fetch results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFromChange = (text: string) => {
    setNewFrom(text);
    if (text.length > 1) {
      const stops = DataMigrationService.getAllStops();
      const filtered = stops
        .filter(s => s.stopageEn.toLowerCase().includes(text.toLowerCase()))
        .map(s => s.stopageEn)
        .slice(0, 5);
      setFromSuggestions(filtered);
      setShowFromSuggestions(true);
    } else {
      setShowFromSuggestions(false);
    }
  };

  const handleToChange = (text: string) => {
    setNewTo(text);
    if (text.length > 1) {
      const stops = DataMigrationService.getAllStops();
      const filtered = stops
        .filter(s => s.stopageEn.toLowerCase().includes(text.toLowerCase()))
        .map(s => s.stopageEn)
        .slice(0, 5);
      setToSuggestions(filtered);
      setShowToSuggestions(true);
    } else {
      setShowToSuggestions(false);
    }
  };

  const selectFromSuggestion = (stop: string) => {
    setNewFrom(stop);
    setShowFromSuggestions(false);
  };

  const selectToSuggestion = (stop: string) => {
    setNewTo(stop);
    setShowToSuggestions(false);
  };

  const handleAddRoute = async () => {
    if (!newFrom.trim() || !newTo.trim() || !newFare.trim() || !newCarType) {
      Alert.alert('Required', 'From, To, Fare, and Vehicle Type are mandatory.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await FirebaseService.addOtherRoute({
        from: newFrom,
        to: newTo,
        fare: newFare,
        distance: newDistance,
        carType: newCarType,
      });

      if (success) {
        Alert.alert('Success', 'Route added successfully!');
        setIsModalVisible(false);
        resetModal();
        // Refresh results if they match current search
        if (from && to) handleSearch();
      } else {
        Alert.alert('Error', 'Failed to add route.');
      }
    } catch (error) {
      console.error('Add route error:', error);
      Alert.alert('Error', 'An error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetModal = () => {
    setNewFrom('');
    setNewTo('');
    setNewFare('');
    setNewDistance('');
    setNewCarType('CNG');
    setFromSuggestions([]);
    setToSuggestions([]);
    setShowFromSuggestions(false);
    setShowToSuggestions(false);
  };

  const renderResultItem = ({ item }: { item: any }) => {
    // Display from/to in user-input order.
    // New docs have separate `from` and `to` fields.
    // Old docs only have `stoppages` ("stop1,stop2") — parse as fallback.
    const displayFrom = item.from || (item.stoppages || '').split(',')[0] || '';
    const displayTo = item.to || (item.stoppages || '').split(',')[1] || '';

    return (
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border, borderWidth: isDark ? 1 : 0 }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: themeColors.primaryMuted }]}>
            <Ionicons 
              name={item.carType === 'Bike' ? 'bicycle' : item.carType === 'Car' ? 'car' : 'car-sport'} 
              size={14} 
              color={themeColors.primary} 
            />
            <Text style={[styles.typeText, { color: themeColors.primary }]}>{item.carType}</Text>
          </View>
          <Text style={[styles.fareText, { color: themeColors.success }]}>৳{item.fare}</Text>
        </View>

        {/* Route: From → To in user-input order */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: themeColors.success }} />
          <Text style={[styles.stoppagesText, { color: themeColors.textPrimary, flex: 1 }]} numberOfLines={1}>
            {displayFrom}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: themeColors.error }} />
          <Text style={[styles.stoppagesText, { color: themeColors.textPrimary, flex: 1 }]} numberOfLines={1}>
            {displayTo}
          </Text>
        </View>

        {item.distance ? (
          <View style={styles.distanceRow}>
            <Ionicons name="navigate-outline" size={12} color={themeColors.textTertiary} />
            <Text style={[styles.distanceText, { color: themeColors.textTertiary }]}>{item.distance} km</Text>
          </View>
        ) : null}
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
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Other Transport</Text>
          <TouchableOpacity 
            style={styles.addBtn}
            onPress={() => setIsModalVisible(true)}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FFF" />
            <Text style={styles.addBtnText}>Add Route</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.verticalInputs}>
            <View style={{ zIndex: 110 }}>
              <View style={[styles.inputWrapper, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
                <Ionicons name="location" size={18} color={themeColors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Starting Point"
                  placeholderTextColor={Colors.textTertiary}
                  value={from}
                  onChangeText={(text) => {
                    setFrom(text);
                    if (text.length > 1) {
                      const stops = DataMigrationService.getAllStops();
                      const filtered = stops
                        .filter(s => s.stopageEn.toLowerCase().includes(text.toLowerCase()))
                        .map(s => s.stopageEn)
                        .slice(0, 5);
                      setFromSuggestions(filtered);
                      setShowFromSuggestions(true);
                    } else {
                      setShowFromSuggestions(false);
                    }
                  }}
                />
              </View>
              {showFromSuggestions && fromSuggestions.length > 0 && !isModalVisible && (
                <View style={[styles.mainSuggestionsList, { backgroundColor: themeColors.surface, borderColor: themeColors.border, top: 45 }]}>
                  {fromSuggestions.map((stop, i) => (
                    <TouchableOpacity 
                      key={i} 
                      style={[styles.suggestionItem, { borderBottomColor: themeColors.borderLight }]}
                      onPress={() => {
                        setFrom(stop);
                        setShowFromSuggestions(false);
                      }}
                    >
                      <Text style={{ color: themeColors.textPrimary }}>{stop}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.inputDivider, { backgroundColor: themeColors.borderLight }]} />

            <View style={{ zIndex: 100 }}>
              <View style={[styles.inputWrapper, { borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
                <Ionicons name="flag" size={18} color={themeColors.accent} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Destination"
                  placeholderTextColor={Colors.textTertiary}
                  value={to}
                  onChangeText={(text) => {
                    setTo(text);
                    if (text.length > 1) {
                      const stops = DataMigrationService.getAllStops();
                      const filtered = stops
                        .filter(s => s.stopageEn.toLowerCase().includes(text.toLowerCase()))
                        .map(s => s.stopageEn)
                        .slice(0, 5);
                      setToSuggestions(filtered);
                      setShowToSuggestions(true);
                    } else {
                      setShowToSuggestions(false);
                    }
                  }}
                />
              </View>
              {showToSuggestions && toSuggestions.length > 0 && !isModalVisible && (
                <View style={[styles.mainSuggestionsList, { backgroundColor: themeColors.surface, borderColor: themeColors.border, top: 45 }]}>
                  {toSuggestions.map((stop, i) => (
                    <TouchableOpacity 
                      key={i} 
                      style={[styles.suggestionItem, { borderBottomColor: themeColors.borderLight }]}
                      onPress={() => {
                        setTo(stop);
                        setShowToSuggestions(false);
                      }}
                    >
                      <Text style={{ color: themeColors.textPrimary }}>{stop}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.typeSelector}
          >
            {['All', ...VEHICLE_TYPES].map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeTab,
                  selectedType === type && styles.typeTabActive
                ]}
                onPress={() => setSelectedType(type)}
              >
                <Text style={[
                  styles.typeTabText,
                  selectedType === type && { color: themeColors.primary }
                ]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity 
            style={[styles.searchBtn, { backgroundColor: '#FFFFFF' }]} 
            onPress={handleSearch}
          >
            {loading ? (
              <ActivityIndicator color={themeColors.primary} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="search" size={18} color={themeColors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.searchBtnText, { color: themeColors.primary }]}>Search Routes</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {!isConnected && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline" size={20} color="#FFF" />
            <Text style={styles.offlineText}>You are currently offline. Internet is required.</Text>
          </View>
        )}

        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={renderResultItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={themeColors.textMuted} />
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                {loading ? 'Searching...' : 'No routes found. Try different locations.'}
              </Text>
            </View>
          }
        />
      </View>

      {/* Add Route Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalContainer}
          >
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={() => {}} // Prevent closing when clicking inside
              style={[styles.modalContent, { backgroundColor: themeColors.surface }]}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>Add New Route</Text>
                  <Text style={[styles.modalSubtitle, { color: themeColors.textTertiary }]}>Contribute to the community</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setIsModalVisible(false)}>
                  <Ionicons name="close" size={24} color={themeColors.textTertiary} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.modalBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalRow}>
                  <View style={{ flex: 1, marginRight: 10, zIndex: 20 }}>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>From Stop *</Text>
                    <View style={[styles.modalInputWrapper, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                      <Ionicons name="location-outline" size={18} color={themeColors.primary} style={{ marginRight: 8 }} />
                      <TextInput
                        style={[styles.modalInput, { color: themeColors.textPrimary }]}
                        placeholder="e.g. Gazipur"
                        placeholderTextColor={themeColors.textTertiary}
                        value={newFrom}
                        onChangeText={handleFromChange}
                      />
                    </View>
                    {showFromSuggestions && fromSuggestions.length > 0 && (
                      <View style={[styles.suggestionsList, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                        {fromSuggestions.map((stop, i) => (
                          <TouchableOpacity 
                            key={i} 
                            style={[styles.suggestionItem, { borderBottomColor: themeColors.borderLight }]}
                            onPress={() => selectFromSuggestion(stop)}
                          >
                            <Text style={{ color: themeColors.textPrimary }}>{stop}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  
                  <View style={{ flex: 1, zIndex: 10 }}>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>To Stop *</Text>
                    <View style={[styles.modalInputWrapper, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                      <Ionicons name="flag-outline" size={18} color={themeColors.accent} style={{ marginRight: 8 }} />
                      <TextInput
                        style={[styles.modalInput, { color: themeColors.textPrimary }]}
                        placeholder="e.g. Farmgate"
                        placeholderTextColor={themeColors.textTertiary}
                        value={newTo}
                        onChangeText={handleToChange}
                      />
                    </View>
                    {showToSuggestions && toSuggestions.length > 0 && (
                      <View style={[styles.suggestionsList, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                        {toSuggestions.map((stop, i) => (
                          <TouchableOpacity 
                            key={i} 
                            style={[styles.suggestionItem, { borderBottomColor: themeColors.borderLight }]}
                            onPress={() => selectToSuggestion(stop)}
                          >
                            <Text style={{ color: themeColors.textPrimary }}>{stop}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.modalRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>Fare (৳) *</Text>
                    <View style={[styles.modalInputWrapper, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                      <Text style={{ color: themeColors.textTertiary, marginRight: 4, fontWeight: '600' }}>৳</Text>
                      <TextInput
                        style={[styles.modalInput, { color: themeColors.textPrimary }]}
                        placeholder="50"
                        placeholderTextColor={themeColors.textTertiary}
                        keyboardType="numeric"
                        value={newFare}
                        onChangeText={setNewFare}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>Distance (km)</Text>
                    <View style={[styles.modalInputWrapper, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                      <Ionicons name="map-outline" size={18} color={themeColors.textTertiary} style={{ marginRight: 8 }} />
                      <TextInput
                        style={[styles.modalInput, { color: themeColors.textPrimary }]}
                        placeholder="12.5"
                        placeholderTextColor={themeColors.textTertiary}
                        keyboardType="numeric"
                        value={newDistance}
                        onChangeText={setNewDistance}
                      />
                    </View>
                  </View>
                </View>

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>Vehicle Type *</Text>
                <View style={styles.modalTypeSelector}>
                  {VEHICLE_TYPES.map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.modalTypeBtn,
                        { backgroundColor: themeColors.background, borderColor: themeColors.border },
                        newCarType === type && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }
                      ]}
                      onPress={() => setNewCarType(type)}
                    >
                      <Ionicons 
                        name={type === 'Bike' ? 'bicycle' : type === 'Car' ? 'car' : type === 'CNG' ? 'car-sport' : 'bus'} 
                        size={16} 
                        color={newCarType === type ? '#FFF' : themeColors.textSecondary} 
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[
                        styles.modalTypeBtnText,
                        { color: themeColors.textSecondary },
                        newCarType === type && { color: '#FFF' }
                      ]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

              </ScrollView>

              <TouchableOpacity 
                style={[styles.submitBtn, { backgroundColor: themeColors.primary }]}
                onPress={handleAddRoute}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="cloud-upload-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>Submit Route</Text>
                  </View>
                )}
              </TouchableOpacity>

            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: BorderRadius.xxl,
    borderBottomRightRadius: BorderRadius.xxl,
    zIndex: 100,
    elevation: 5,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: '#FFF',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  searchContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    zIndex: 500,
    elevation: 10,
  },
  verticalInputs: {
    backgroundColor: '#FFF',
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
    zIndex: 100,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 50,
  },
  inputDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  inputIcon: {
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: '600',
    color: Colors.textPrimary,
    padding: 0,
    marginLeft: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  typeTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: BorderRadius.round,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  typeTabActive: {
    backgroundColor: '#FFF',
  },
  typeTabText: {
    color: '#FFF',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  searchBtn: {
    backgroundColor: Colors.accent,
    height: 60,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
  },
  searchBtnText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
  offlineBanner: {
    backgroundColor: Colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
  },
  offlineText: {
    color: '#FFF',
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  listContent: {
    padding: Spacing.lg,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  typeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  fareText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  stoppagesLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginBottom: 2,
  },
  stoppagesText: {
    fontSize: FontSize.base,
    fontWeight: '500',
    lineHeight: 20,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 4,
  },
  distanceText: {
    fontSize: FontSize.xs,
  },
  emptyContainer: {
    paddingTop: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 6,
    borderRadius: 20,
  },
  modalBody: {
    maxHeight: 500,
  },
  modalRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 12,
    height: 48,
  },
  modalInput: {
    flex: 1,
    fontSize: FontSize.base,
    height: '100%',
  },
  mainSuggestionsList: {
    position: 'absolute',
    top: 68,
    left: 0,
    right: 0,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    zIndex: 3000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
  },
  modalTypeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: Spacing.xl,
  },
  modalTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  modalTypeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  submitBtn: {
    height: 56,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 10,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: '800',
  },
});
