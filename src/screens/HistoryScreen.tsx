import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import StorageService, { SearchHistory } from '../services/StorageService';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { DarkColors } from '../theme/darkColors';

export default function HistoryScreen({ navigation }: any) {
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { isDark } = useTheme();
  const themeColors = isDark ? DarkColors : Colors;

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    try {
      const data = await StorageService.getSearchHistory();
      setHistory(data);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const handleHistoryClick = (item: SearchHistory) => {
    // Navigate to search screen which will handle stop IDs
    navigation.navigate('RouteSearch', {
      fromStopName: item.fromStopName,
      toStopName: item.toStopName,
    });
  };

  const handleDeleteHistory = async (id: string) => {
    Alert.alert(
      'Delete History',
      'Are you sure you want to delete this history item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await StorageService.deleteSearchHistoryItem(id);
            loadHistory();
          },
        },
      ]
    );
  };

  const handleClearAll = async () => {
    Alert.alert(
      'Clear All History',
      'Are you sure you want to clear all history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await StorageService.clearSearchHistory();
            loadHistory();
          },
        },
      ]
    );
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, []);

  const renderHistoryItem = ({ item }: { item: SearchHistory }) => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => handleHistoryClick(item)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="history" size={20} color={themeColors.primary} />
        </View>
        <View style={styles.textContainer}>
          <View style={styles.routeInfo}>
            <Text style={styles.stopName} numberOfLines={1}>{item.fromStopName}</Text>
            <Ionicons name="arrow-forward" size={14} color="#888" style={styles.arrow} />
            <Text style={styles.stopName} numberOfLines={1}>{item.toStopName}</Text>
          </View>
          <View style={styles.metaInfo}>
            <Text style={styles.routesFound}>{item.routesFound} routes</Text>
            <Text style={styles.separator}>•</Text>
            <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleDateString()}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteHistory(item.id)}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={18} color={themeColors.primary} />
      </TouchableOpacity>
    </View>
  );

  const styles = useMemo(() => StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomLeftRadius: 22,
      borderBottomRightRadius: 22,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: themeColors.whiteOverlay20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTextContainer: {
      flex: 1,
      marginLeft: 12,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: themeColors.textLight,
    },
    headerSubtitle: {
      fontSize: 14,
      color: themeColors.whiteOverlay30,
      marginTop: 2,
    },
    clearButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: themeColors.whiteOverlay20,
      borderRadius: 8,
    },
    clearButtonText: {
      color: themeColors.textLight,
      fontSize: 14,
      fontWeight: '600',
    },
    body: {
      flex: 1,
    },
    listContent: {
      padding: 16,
    },
    card: {
      backgroundColor: themeColors.surface,
      borderRadius: 12,
      marginBottom: 12,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      flexDirection: 'row',
      alignItems: 'center',
    },
    cardContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: themeColors.hoverAccent,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
    },
    routeInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    stopName: {
      fontSize: 15,
      fontWeight: '600',
      color: themeColors.textPrimary,
      flexShrink: 1,
    },
    arrow: {
      marginHorizontal: 8,
    },
    metaInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    timestamp: {
      fontSize: 13,
      color: isDark ? '#999' : '#888',
    },
    separator: {
      marginHorizontal: 8,
      color: isDark ? '#555' : '#CCC',
    },
    routesFound: {
      fontSize: 13,
      color: themeColors.primaryDark,
      fontWeight: '500',
    },
    deleteButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: themeColors.hoverAccent,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: themeColors.textPrimary,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 15,
      color: isDark ? '#999' : '#666',
      textAlign: 'center',
    },
  }), [themeColors, isDark]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient
        colors={[isDark ? DarkColors.gradientStart : Colors.gradientStart, isDark ? DarkColors.gradientEnd : Colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerBadge}>
            <Ionicons name="time-outline" size={20} color={themeColors.textLight} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Search History</Text>
            <Text style={styles.headerSubtitle}>{history.length} recent searches</Text>
          </View>
          {history.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearAll}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={64} color={isDark ? '#444' : '#DDD'} />
            <Text style={styles.emptyTitle}>No History</Text>
            <Text style={styles.emptyText}>
              Your search history will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            renderItem={renderHistoryItem}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
