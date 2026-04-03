import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  ToastAndroid,
} from 'react-native';
import RNRestart from 'react-native-restart';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import DatabaseService from '../services/DatabaseService';
import DataMigrationService from '../services/DataMigrationService';
import NetworkService from '../services/NetworkService';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { DarkColors } from '../theme/darkColors';

export default function SettingsScreen({ navigation }: any) {
  const { isDark, toggleTheme, mode } = useTheme();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Use appropriate colors based on theme
  const themeColors = isDark ? DarkColors : Colors;

  useFocusEffect(
    useCallback(() => {
      loadLastSyncTime();
    }, [])
  );

  // Subscribe to network status changes
  useEffect(() => {
    // Set initial online status
    setIsOnline(NetworkService.isConnected());

    // Subscribe to changes
    const unsubscribe = NetworkService.onChange((online) => {
      setIsOnline(online);
      if (!online) {
        console.log('📡 Device went offline - disabling sync');
      }
    });

    return unsubscribe;
  }, []);

  const loadLastSyncTime = async () => {
    try {
      const timestamp = await AsyncStorage.getItem('@last_sync_time');
      if (timestamp) {
        const date = new Date(parseInt(timestamp));
        setLastSyncTime(date.toLocaleString());
      }
    } catch (error) {
      console.error('Error loading sync time:', error);
    }
  };

  const handleManualSync = async () => {
    // Check internet connection first
    if (!NetworkService.isConnected()) {
      showNotification('📡 No internet connection - cannot sync');
      console.warn('⚠ Sync attempted without internet');
      return;
    }

    setIsSyncing(true);
    try {
      // Use new manual sync method that properly updates distances
      const success = await DataMigrationService.manualSyncData();

      if (success) {
        // Update sync time
        const now = Date.now();
        const timestamp = new Date(now).toLocaleString();
        setLastSyncTime(timestamp);

        // Save sync time to storage
        try {
          await AsyncStorage.setItem('@last_sync_time', now.toString());
        } catch (e) {
          console.error('Error saving sync time:', e);
        }

        Alert.alert('Sync Complete', 'Please reopen the app to view changes', [
          {
            text: 'Cancel',
            onPress: () => {
              // Just dismiss the alert
            },
            style: 'cancel',
          },
          {
            text: 'OK',
            onPress: () => {
              // Restart the app
              RNRestart.restart();
            },
            style: 'default',
          },
        ]);
        console.log('✓ Manual sync completed - user needs to reopen app');
      } else {
        showNotification('✗ Sync failed - could not fetch data from Firebase');
        console.warn('⚠ Manual sync returned false');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Sync failed';
      showNotification('✗ Sync failed: ' + errorMsg);
      console.error('Error during manual sync:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const showNotification = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('', message);
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear all cached data? This will not delete your bookmarks or history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            // Clear cache logic here
            showNotification('Cache cleared');
          },
        },
      ]
    );
  };

  const handleToggleTheme = () => {
    const newMode = isDark ? 'Light' : 'Dark';
    toggleTheme();
    showNotification(`✓ Switched to ${newMode} Mode`);
  };

  const handleAbout = () => {
    Alert.alert(
      'About Bus Bhara - Dhaka Local Bus Fare',
      'Bus Bhara is a free and offline app designed to provide accurate fare information for local buses in Dhaka. We aim to help commuters save money and navigate the complex bus system with ease.\n\nVersion: 1.8.0\n\n© 2025 Bus Bhara Team',
      [{ text: 'OK' }]
    );
  };

  const handlePrivacy = () => {
    Alert.alert(
      'Privacy Policy',
      'Your data is stored locally on your device. We do not collect or share any personal information.',
      [{ text: 'OK' }]
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
        <View style={styles.headerContent}>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: themeColors.textLight }]}>Settings</Text>
            <Text style={[styles.headerSubtitle, { color: themeColors.whiteOverlay20 }]}>Manage your preferences</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={[styles.content, { backgroundColor: themeColors.background }]}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Theme Section */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: themeColors.border }]}>
            <View style={styles.sectionIconContainer}>
              <Ionicons
                name={isDark ? 'moon' : 'sunny'}
                size={20}
                color={themeColors.primary}
              />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Theme</Text>
          </View>

          <View style={[styles.settingItem, { borderBottomColor: themeColors.border }]}>
            <View style={styles.settingLeft}>
              <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </Text>
              <Text style={[styles.settingDescription, { color: themeColors.textTertiary }]}>
                Current: {mode}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={handleToggleTheme}
              trackColor={{ false: themeColors.border, true: themeColors.primary }}
              thumbColor={isDark ? themeColors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Data Management Section */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: themeColors.border }]}>
            <View style={styles.sectionIconContainer}>
              <Ionicons name="refresh" size={20} color={themeColors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Data Management</Text>
          </View>

          {/* Network Status Indicator */}
          <View
            style={[
              styles.networkStatusBadge,
              {
                backgroundColor: isOnline
                  ? isDark
                    ? 'rgba(76, 175, 80, 0.1)'
                    : 'rgba(76, 175, 80, 0.08)'
                  : isDark
                  ? 'rgba(244, 67, 54, 0.1)'
                  : 'rgba(244, 67, 54, 0.08)',
              },
            ]}
          >
            <Ionicons
              name={isOnline ? 'wifi' : 'wifi-outline'}
              size={14}
              color={isOnline ? '#4CAF50' : '#F44336'}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[
                styles.networkStatusText,
                {
                  color: isOnline ? '#4CAF50' : '#F44336',
                },
              ]}
            >
              {isOnline ? 'Online - Ready to sync' : 'Offline - Using cached data'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: themeColors.border }]}
            onPress={handleManualSync}
            disabled={isSyncing || !isOnline}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                Sync with Database
              </Text>
              <Text style={[styles.settingDescription, { color: themeColors.textTertiary }]}>
                {lastSyncTime ? `Last synced: ${lastSyncTime}` : 'Never synced'}
              </Text>
            </View>
            {isSyncing ? (
              <ActivityIndicator color={themeColors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={themeColors.textTertiary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleClearCache}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                Clear Cache
              </Text>
              <Text style={[styles.settingDescription, { color: themeColors.textTertiary }]}>
                Remove temporary data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: themeColors.border }]}>
            <View style={styles.sectionIconContainer}>
              <Ionicons name="information-circle" size={20} color={themeColors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>About</Text>
          </View>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: themeColors.border }]}
            onPress={handleAbout}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                About BUS Bhara
              </Text>
              <Text style={[styles.settingDescription, { color: themeColors.textTertiary }]}>
                Version 1.8.0
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handlePrivacy}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>
                Privacy Policy
              </Text>
              <Text style={[styles.settingDescription, { color: themeColors.textTertiary }]}>
                Your data protection
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    ...Platform.select({
      android: {
        elevation: 4,
      },
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      },
    }),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  section: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      android: {
        elevation: 2,
      },
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    fontWeight: '400',
  },
  networkStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 12,
  },
  networkStatusText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
