import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import RouteSearchScreen from './screens/RouteSearchScreen';
import RouteDetailsScreen from './screens/RouteDetailsScreen';
import DetailsScreen from './screens/DetailsScreen';
import HistoryScreen from './screens/HistoryScreen';
import BookmarkScreen from './screens/BookmarkScreen';
import BusListScreen from './screens/BusListScreen';
import { Colors } from './theme/colors';
import DatabaseService from './services/DatabaseService';

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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Buses') {
            iconName = focused ? 'bus' : 'bus-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Bookmark') {
            iconName = focused ? 'bookmark' : 'bookmark-outline';
          } else {
            iconName = 'ellipse';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.borderLight,
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
        name="History" 
        component={HistoryScreen}
        options={{ tabBarLabel: 'History' }}
      />
      <Tab.Screen 
        name="Buses" 
        component={BusListScreen}
        options={{ tabBarLabel: 'Buses' }}
      />
      <Tab.Screen 
        name="Bookmark" 
        component={BookmarkScreen}
        options={{ tabBarLabel: 'Bookmarks' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialized, setInitialized] = React.useState(false);
  const [initError, setInitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🔄 Initializing application...');
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 10, color: Colors.textSecondary }}>Loading data...</Text>
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
        <Stack.Screen name="Details" component={DetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
