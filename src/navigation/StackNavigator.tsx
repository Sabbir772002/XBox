import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/RouteSearchScreen';
import FeedScreen from '../screens/DetailsScreen';

export type RootStackParamList = {
  Home: undefined;
  Feed: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function StackNavigator() {
  return (
    <Stack.Navigator initialRouteName="Home">
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Feed" component={FeedScreen} />
    </Stack.Navigator>
  );
}
