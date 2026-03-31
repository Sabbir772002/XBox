import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

const demoRoutes = [
  { id: '1', name: 'Achim Paribahan', from: 'Gabtoli', to: 'Demra Staff Quarter' },
  { id: '2', name: 'Akash', from: 'Kadamtali', to: 'Tongi' },
  { id: '3', name: 'Anabil Super', from: 'Sign Board', to: 'Gazipur Chourasta' },
  { id: '4', name: 'Asmani', from: 'Dhour', to: 'Madanpur' },
  { id: '5', name: 'BRTC Route 6', from: 'Motijheel', to: 'Abdullahpur' },
  { id: '6', name: 'Bihanga', from: 'Mirpur 12', to: 'Notun Bazar' },
  { id: '7', name: 'Bondhu Paribahan', from: 'Sadarghat', to: 'Uttara' },
  { id: '8', name: 'Desh Travels', from: 'Shyamoli', to: 'Chittagong' },
  { id: '9', name: 'Dipon', from: 'Farmgate', to: 'Keraniganj' },
  { id: '10', name: 'Dhaka Metro', from: 'Jatrabari', to: 'Gabtoli' },
  { id: '11', name: 'Ena', from: 'Mohakhali', to: 'Sylhet' },
  { id: '12', name: 'Hanif', from: 'Kamalapur', to: 'Khulna' },
  { id: '13', name: 'Green Line', from: 'Dhaka', to: 'Cox’s Bazar' },
  { id: '14', name: 'London Express', from: 'Airport', to: 'Rajshahi' },
  { id: '15', name: 'Manjil', from: 'Badda', to: 'Banani' },
  { id: '16', name: 'Meghna', from: 'Demra', to: 'Savar' },
  { id: '17', name: 'Nabil', from: 'Mohakhali', to: 'Rangpur' },
  { id: '18', name: 'Prottasha', from: 'Gulistan', to: 'Mirpur 1' },
  { id: '19', name: 'Shanti', from: 'Uttara', to: 'Mohammadpur' },
  { id: '20', name: 'Silk Line', from: 'Shahbagh', to: 'Comilla' },
];
export default function RouteSearchScreen({ navigation }: any) {
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [showData, setShowData] = React.useState(false);

  // Filtered routes based on user input
  const filteredRoutes = demoRoutes.filter(
    (route) =>
      route.from.toLowerCase().includes(from.toLowerCase()) &&
      route.to.toLowerCase().includes(to.toLowerCase())
  );

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('Details', { from: item.from, to: item.to })}
    >
      <View style={styles.row}>
        <Ionicons name="bus-outline" size={24} color="#066D6D" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.busName}>{item.name}</Text>
          <Text style={styles.route}>
            {item.from} <Ionicons name="arrow-forward-outline" size={14} /> {item.to}
          </Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={22} color="#066D6D" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <LinearGradient
        colors={['#8D1117', '#C0191F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.inputCard}>
          <Ionicons name="search-outline" size={20} color="#9AA0A6" style={styles.icon} />
          <TextInput
            placeholder="Your location"
            placeholderTextColor="#B7BEC7"
            value={from}
            onChangeText={setFrom}
            style={styles.input}
            returnKeyType="next"
            onSubmitEditing={() => setShowData(true)}
          />
        </View>

        <View style={[styles.inputCard, { marginTop: 14 }]}>
          <Ionicons name="search-outline" size={20} color="#9AA0A6" style={styles.icon} />
          <TextInput
            placeholder="Your Destination"
            placeholderTextColor="#B7BEC7"
            value={to}
            onChangeText={setTo}
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={() => setShowData(true)}
          />
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {showData ? (
          filteredRoutes.length > 0 ? (
            <FlatList
              data={filteredRoutes}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingVertical: 12 }}
            />
          ) : (
            <Text style={styles.noRoutesText}>No matching routes found.</Text>
          )
        ) : (
          <Text style={styles.noRoutesText}>Enter location & destination to view routes.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F6EDF3',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 52,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#111',
    fontSize: 16,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  noRoutesText: {
    marginTop: 20,
    color: '#D12C2C',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  busName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  route: {
    fontSize: 14,
    color: '#555',
  },
});
