import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
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

function ErrorScreen({ error }: { error: string }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: Colors.background }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'red', marginBottom: 10 }}>
        Failed to Initialize App
      </Text>
      <Text style={{ fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' }}>
        {error}
      </Text>
      <Text style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
        Please restart the application.
      </Text>
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

  React.useEffect(() => {
    const initializeApp = async () => {
      try {
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

    initializeApp();
  }, []);

  if (initError) {
    return <ErrorScreen error={initError} />;
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
