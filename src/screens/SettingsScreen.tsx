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
import TransitNetworkService from '../services/TransitNetworkService';
import { useTheme } from '../theme/ThemeContext';
import { Colors, Spacing, BorderRadius, FontSize } from '../theme/colors';
import { DarkColors } from '../theme/darkColors';

export default function SettingsScreen({ navigation }: any) {
  const { isDark, toggleTheme, mode } = useTheme();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const themeColors = isDark ? DarkColors : Colors;

  useFocusEffect(
    useCallback(() => {
      loadLastSyncTime();
    }, []),
  );

  useEffect(() => {
    setIsOnline(NetworkService.isConnected());
    const unsubscribe = NetworkService.onChange((online) => {
      setIsOnline(online);
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
    if (!NetworkService.isConnected()) {
      showNotification('📡 No internet connection');
      return;
    }

    setIsSyncing(true);
    try {
      const success = await DataMigrationService.manualSyncData();
      if (success) {
        const now = Date.now();
        setLastSyncTime(new Date(now).toLocaleString());
        try {
          await AsyncStorage.setItem('@last_sync_time', now.toString());
        } catch (e) {
          console.error('Error saving sync time:', e);
        }

        Alert.alert('Sync Complete', 'Please reopen the app to view changes', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restart',
            onPress: () => RNRestart.restart(),
            style: 'default',
          },
        ]);
      } else {
        showNotification('Sync failed — could not fetch data');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Sync failed';
      showNotification(`Sync failed: ${errorMsg}`);
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
      'This will clear cached route data. Your bookmarks and history will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            TransitNetworkService.clearCache();
            showNotification('Cache cleared');
          },
        },
      ],
    );
  };

  const handleToggleTheme = () => {
    const newMode = isDark ? 'Light' : 'Dark';
    toggleTheme();
    showNotification(`Switched to ${newMode} Mode`);
  };

  const handleAbout = () => {
    Alert.alert(
      'About Bus Bhara',
      'Bus Bhara helps commuters navigate Dhaka\'s bus network with accurate fare information.\n\nVersion: 2.0.0\nPowered by TransitNetwork Algorithm\n\n© 2025 Bus Bhara Team',
      [{ text: 'OK' }],
    );
  };

  const handlePrivacy = () => {
    Alert.alert(
      'Privacy Policy',
      'Your data is stored locally on your device. We do not collect or share any personal information.',
      [{ text: 'OK' }],
    );
  };

  const SettingItem = ({
    icon,
    label,
    description,
    onPress,
    rightElement,
    disabled,
  }: {
    icon: string;
    label: string;
    description?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.settingItem, { borderBottomColor: themeColors.borderLight }]}
      onPress={onPress}
      disabled={!onPress || disabled}
      activeOpacity={0.7}
    >
      <View style={[styles.settingIcon, { backgroundColor: themeColors.primaryMuted }]}>
        <Ionicons name={icon as any} size={18} color={themeColors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>{label}</Text>
        {description && (
          <Text style={[styles.settingDescription, { color: themeColors.textTertiary }]}>
            {description}
          </Text>
        )}
      </View>
      {rightElement || (
        onPress && <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: themeColors.background }]}
      edges={['top']}
    >
      <LinearGradient
        colors={[themeColors.gradientStart, themeColors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Manage your preferences</Text>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Appearance */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: themeColors.borderLight }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              Appearance
            </Text>
          </View>

          <SettingItem
            icon={isDark ? 'moon' : 'sunny'}
            label={isDark ? 'Dark Mode' : 'Light Mode'}
            description={`Theme: ${mode}`}
            rightElement={
              <Switch
                value={isDark}
                onValueChange={handleToggleTheme}
                trackColor={{ false: themeColors.border, true: themeColors.primary }}
                thumbColor={isDark ? themeColors.primaryLight : '#f4f3f4'}
              />
            }
          />
        </View>

        {/* Data */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: themeColors.borderLight }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              Data Management
            </Text>
          </View>

          {/* Network status */}
          <View
            style={[
              styles.networkBadge,
              {
                backgroundColor: isOnline
                  ? (themeColors.successLight || 'rgba(16,185,129,0.12)')
                  : (themeColors.errorLight || 'rgba(239,68,68,0.12)'),
              },
            ]}
          >
            <View
              style={[
                styles.networkDot,
                { backgroundColor: isOnline ? themeColors.success : themeColors.error },
              ]}
            />
            <Text
              style={[
                styles.networkText,
                { color: isOnline ? themeColors.success : themeColors.error },
              ]}
            >
              {isOnline ? 'Online — Ready to sync' : 'Offline — Using cached data'}
            </Text>
          </View>

          <SettingItem
            icon="sync"
            label="Sync with Database"
            description={lastSyncTime ? `Last: ${lastSyncTime}` : 'Never synced'}
            onPress={handleManualSync}
            disabled={isSyncing || !isOnline}
            rightElement={
              isSyncing ? (
                <ActivityIndicator color={themeColors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
              )
            }
          />

          <SettingItem
            icon="trash-outline"
            label="Clear Cache"
            description="Remove temporary route data"
            onPress={handleClearCache}
          />
        </View>

        {/* About */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: themeColors.borderLight }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>About</Text>
          </View>

          <SettingItem
            icon="information-circle"
            label="About Bus Bhara"
            description="Version 2.0.0"
            onPress={handleAbout}
          />

          <SettingItem
            icon="shield-checkmark"
            label="Privacy Policy"
            description="Your data protection"
            onPress={handlePrivacy}
          />
        </View>

        {/* Stats */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: themeColors.borderLight }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>
              Engine Status
            </Text>
          </View>

          <View style={styles.engineStatus}>
            <View style={styles.engineRow}>
              <View
                style={[
                  styles.engineDot,
                  {
                    backgroundColor: TransitNetworkService.isInitialized()
                      ? themeColors.success
                      : themeColors.error,
                  },
                ]}
              />
              <Text style={[styles.engineText, { color: themeColors.textPrimary }]}>
                TransitNetwork:{' '}
                {TransitNetworkService.isInitialized() ? 'Active' : 'Not initialized'}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
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
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  section: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
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
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  settingContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingLabel: {
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  networkText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  engineStatus: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  engineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  engineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  engineText: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
});
