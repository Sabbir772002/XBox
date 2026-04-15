import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatabaseService, { Bus } from '../services/DatabaseService';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';
import { DarkColors } from '../theme/darkColors';
import { useTheme } from '../theme/ThemeContext';

export default function BusListScreen({ navigation }: any) {
  const [allBuses, setAllBuses] = useState<Bus[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { isDark } = useTheme();
  const themeColors = isDark ? DarkColors : Colors;

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
    if (!query.trim()) return allBuses;
    const q = query.toLowerCase();
    return allBuses.filter(
      (item) =>
        item.nameEnglish.toLowerCase().includes(q) ||
        item.nameBangla.toLowerCase().includes(q),
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
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: themeColors.surface,
          borderColor: isDark ? themeColors.border : 'transparent',
          borderWidth: isDark ? 1 : 0,
        },
      ]}
      onPress={() => openBusDetails(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: themeColors.primaryMuted }]}>
        <Ionicons name="bus" size={22} color={themeColors.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.name, { color: themeColors.textPrimary }]} numberOfLines={1}>
          {item.nameEnglish}
        </Text>
        <Text style={[styles.nameBn, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {item.nameBangla}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.metaChip, { backgroundColor: themeColors.pill }]}>
            <Ionicons name="ellipsis-horizontal" size={10} color={themeColors.primary} />
            <Text style={[styles.metaText, { color: themeColors.primary }]}>
              {item.stoppages?.length || 0} stops
            </Text>
          </View>
          {!!item.serviceType && (
            <View style={[styles.metaChip, { backgroundColor: themeColors.pill }]}>
              <Ionicons name="information-circle-outline" size={10} color={themeColors.primary} />
              <Text style={[styles.metaText, { color: themeColors.primary }]} numberOfLines={1}>
                {item.serviceType}
              </Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
    </TouchableOpacity>
  );

  return (
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
        <Text style={styles.title}>All Buses</Text>
        <Text style={styles.subtitle}>
          {loading ? 'Loading...' : `${filteredBuses.length} bus routes`}
        </Text>

        <View
          style={[
            styles.searchWrap,
            {
              backgroundColor: themeColors.surface,
            },
          ]}
        >
          <Ionicons name="search" size={18} color={themeColors.inputIcon} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search bus by name..."
            placeholderTextColor={themeColors.inputPlaceholder}
            style={[styles.input, { color: themeColors.textPrimary }]}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={themeColors.inputIcon} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={[styles.centerText, { color: themeColors.textSecondary }]}>
              Loading buses...
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredBuses}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderBus}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.centerWrap}>
                <Ionicons name="bus-outline" size={48} color={themeColors.textMuted} />
                <Text style={[styles.centerText, { color: themeColors.textSecondary }]}>
                  No buses found
                </Text>
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
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
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
  title: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: FontSize.xxl,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
    marginBottom: Spacing.md,
    fontWeight: '500',
    fontSize: FontSize.md,
  },
  searchWrap: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
    }),
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: '500',
  },
  body: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
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
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  cardBody: {
    flex: 1,
  },
  name: {
    fontWeight: '700',
    fontSize: FontSize.base,
  },
  nameBn: {
    marginTop: 2,
    fontSize: FontSize.sm,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 6,
    flexWrap: 'wrap',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
    gap: 4,
  },
  metaText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  centerWrap: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    marginTop: Spacing.md,
    fontWeight: '500',
    fontSize: FontSize.base,
  },
});
