import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, TouchableOpacity, StatusBar, Platform } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import RouteSearchScreen from './screens/RouteSearchScreen';
import RouteDetailsScreen from './screens/RouteDetailsScreen';
import ActivityScreen from './screens/ActivityScreen';
import VehicleSearchScreen from './screens/VehicleSearchScreen';
import BusListScreen from './screens/BusListScreen';
import SettingsScreen from './screens/SettingsScreen';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from './theme/colors';
import { DarkColors } from './theme/darkColors';
import DatabaseService from './services/DatabaseService';
import NetworkService from './services/NetworkService';
import { ThemeProvider, useTheme } from './theme/ThemeContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

interface ErrorScreenProps {
  error: string;
  onRetry: () => void;
}

function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  const { isDark } = useTheme();
  const themeColors = isDark ? DarkColors : Colors;

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <StatusBar 
        backgroundColor={themeColors.background} 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
      />
      
      <View style={{
        alignItems: 'center',
        padding: 32,
        borderRadius: 24,
        backgroundColor: themeColors.surface,
        width: '100%',
        maxWidth: 340,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 8,
        borderWidth: 1,
        borderColor: themeColors.borderLight,
      }}>
        {/* Glow / Icon container */}
        <View style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 24,
        }}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
        </View>

        <Text style={{
          fontSize: 22,
          fontWeight: 'bold',
          color: themeColors.textPrimary,
          marginBottom: 12,
          textAlign: 'center',
          fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
        }}>
          Initialization Failed
        </Text>

        <Text style={{
          fontSize: 14,
          color: themeColors.textSecondary,
          textAlign: 'center',
          marginBottom: 24,
          lineHeight: 20,
        }}>
          {error || 'An unexpected error occurred during database setup.'}
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onRetry}
          style={{ width: '100%' }}
        >
          <LinearGradient
            colors={isDark ? ['#4f46e5', '#3730a3'] : ['#6366f1', '#4f46e5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingVertical: 14,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#6366f1',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="refresh-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: 'bold',
                fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
              }}>
                Try Again
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MainTabs() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const themeColors = isDark ? DarkColors : Colors;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Others') {
            iconName = focused ? 'navigate' : 'navigate-outline';
          } else if (route.name === 'Saved') {
            iconName = focused ? 'bookmark' : 'bookmark-outline';
          } else if (route.name === 'Buses') {
            iconName = focused ? 'bus' : 'bus-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'ellipse';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: themeColors.primary,
        tabBarInactiveTintColor: themeColors.textTertiary,
        tabBarStyle: {
          height: 60 + (insets.bottom > 0 ? insets.bottom - 10 : 0),
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
          backgroundColor: themeColors.surface,
          borderTopWidth: 1,
          borderTopColor: themeColors.borderLight,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Search" 
        component={RouteSearchScreen}
        options={{ tabBarLabel: 'Search' }}
      />
      <Tab.Screen 
        name="Others" 
        component={VehicleSearchScreen}
        options={{ tabBarLabel: 'Others' }}
      />
      <Tab.Screen 
        name="Saved" 
        component={ActivityScreen}
        options={{ tabBarLabel: 'Saved' }}
      />
      <Tab.Screen 
        name="Buses" 
        component={BusListScreen}
        options={{ tabBarLabel: 'Buses' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

function AppContent() {
  const [initialized, setInitialized] = React.useState(false);
  const [initError, setInitError] = React.useState<string | null>(null);
  const { isDark } = useTheme();
  const themeColors = isDark ? DarkColors : Colors;

  const initializeApp = async () => {
    try {
      setInitError(null);
      setInitialized(false);
      console.log('🔄 Initializing application...');
      
      // Initialize services in order
      await NetworkService.initialize();
      await DatabaseService.initialize();
      
      setInitialized(true);
      console.log('✅ Application initialized successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ Application initialization failed:', errorMsg);
      setInitError(errorMsg);
    }
  };

  React.useEffect(() => {
    initializeApp();
  }, []);

  if (initError) {
    return <ErrorScreen error={initError} onRetry={initializeApp} />;
  }

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.background }}>
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={{ marginTop: 10, color: themeColors.textSecondary }}>Loading data...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Main"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="Main"
          component={MainTabs}
        />
        <Stack.Screen 
          name="RouteDetails" 
          component={RouteDetailsScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen 
          name="RouteSearch" 
          component={RouteSearchScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
