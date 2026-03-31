import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatabaseService, { Bus } from '../services/DatabaseService';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';

export default function BusListScreen({ navigation }: any) {
  const [allBuses, setAllBuses] = useState<Bus[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBuses = async () => {
      try {
        const buses = await DatabaseService.getAllBuses();
        setAllBuses(buses);
      } catch (error) {
        console.error('Error loading buses:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBuses();
  }, []);

  const filteredBuses = useMemo(() => {
    if (!query.trim()) {
      return allBuses;
    }

    const q = query.toLowerCase();
    return allBuses.filter(
      (item) => item.nameEnglish.toLowerCase().includes(q) || item.nameBangla.toLowerCase().includes(q)
    );
  }, [allBuses, query]);

  const openBusDetails = (bus: Bus) => {
    const firstStop = bus.stoppages?.[0]?.stopageEn ?? 'Start';
    const lastStop = bus.stoppages?.[bus.stoppages.length - 1]?.stopageEn ?? 'End';

    navigation.navigate('RouteDetails', {
      busId: bus.id,
      busName: bus.nameEnglish,
      busBn: bus.nameBangla,
      fromStopName: firstStop,
      toStopName: lastStop,
      showFullRoute: true,
    });
  };

  const renderBus = ({ item }: { item: Bus }) => (
    <TouchableOpacity style={styles.card} onPress={() => openBusDetails(item)} activeOpacity={0.8}>
      <View style={styles.iconWrap}>
        <Ionicons name="bus" size={24} color={Colors.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name}>{item.nameEnglish}</Text>
        {!!item.nameBangla && <Text style={styles.nameBn}>{item.nameBangla}</Text>}
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{item.totalStops} stops</Text>
          {!!item.serviceType && <Text style={styles.meta}>{item.serviceType}</Text>}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
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
        <Text style={styles.title}>All Buses</Text>
        <Text style={styles.subtitle}>Browse and search every bus route</Text>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Colors.inputIcon} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search bus by English/Bangla name"
            placeholderTextColor={Colors.inputPlaceholder}
            style={styles.input}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.inputIcon} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.centerText}>Loading buses...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredBuses}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderBus}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.centerWrap}>
                <Ionicons name="bus-outline" size={42} color={Colors.textMuted} />
                <Text style={styles.centerText}>No buses found</Text>
              </View>
            }
          />
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
  },
  title: {
    color: Colors.textLight,
    fontWeight: '800',
    fontSize: FontSize.xxl,
  },
  subtitle: {
    color: Colors.whiteOverlay30,
    marginTop: 4,
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  searchWrap: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  body: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.hoverAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  cardBody: {
    flex: 1,
  },
  name: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: FontSize.lg,
  },
  nameBn: {
    color: Colors.textSecondary,
    marginTop: 2,
    fontSize: FontSize.base,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 10,
  },
  meta: {
    color: Colors.primaryDark,
    backgroundColor: Colors.hoverAccent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  centerWrap: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    marginTop: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
