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
    <TouchableOpacity
      style={styles.card}
      onPress={() => openBusDetails(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="bus" size={24} color={themeColors.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name}>{item.nameEnglish}</Text>
        <Text style={styles.nameBn}>{item.nameBangla}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{item.stoppages?.length || 0} stops</Text>
          {!!item.serviceType && <Text style={styles.meta}>{item.serviceType}</Text>}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
    </TouchableOpacity>
  );



  const styles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    header: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.lg,
      borderBottomLeftRadius: BorderRadius.xl,
      borderBottomRightRadius: BorderRadius.xl,
    },
    title: {
      color: themeColors.textLight,
      fontWeight: '800',
      fontSize: FontSize.xxl,
    },
    subtitle: {
      color: themeColors.whiteOverlay30,
      marginTop: 4,
      marginBottom: Spacing.md,
      fontWeight: '600',
    },
    searchWrap: {
      backgroundColor: themeColors.surface,
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
      color: themeColors.textPrimary,
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
      backgroundColor: themeColors.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: isDark ? '#333' : Colors.borderLight,
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: themeColors.hoverAccent,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    cardBody: {
      flex: 1,
    },
    name: {
      color: themeColors.textPrimary,
      fontWeight: '700',
      fontSize: FontSize.lg,
    },
    nameBn: {
      color: themeColors.textSecondary,
      marginTop: 2,
      fontSize: FontSize.base,
    },
    metaRow: {
      flexDirection: 'row',
      marginTop: 6,
      gap: 10,
    },
    meta: {
      color: themeColors.primaryDark,
      backgroundColor: themeColors.hoverAccent,
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
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
  }), [themeColors, isDark]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={[isDark ? DarkColors.gradientStart : Colors.gradientStart, isDark ? DarkColors.gradientEnd : Colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.title}>All Buses</Text>
        <Text style={styles.subtitle}>Browse and search every bus route</Text>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={themeColors.inputIcon} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search bus by English/Bangla name"
            placeholderTextColor={themeColors.inputPlaceholder}
            style={styles.input}
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
                <Ionicons name="bus-outline" size={42} color={themeColors.textMuted} />
                <Text style={styles.centerText}>No buses found</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
