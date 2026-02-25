import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DetailsScreen({ route }: any) {
  const { from, to } = route.params || {};

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        <Text style={styles.title}>This is the Details Page</Text>
        <Text style={styles.info}>From: {from || 'N/A'}</Text>
        <Text style={styles.info}>To: {to || 'N/A'}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F6EDF3',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
  },
  info: {
    fontSize: 16,
    marginTop: 6,
  },
});
