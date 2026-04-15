import { Bus, Stop } from './DatabaseService';
import FirebaseService from './FirebaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TransitNetworkService, { RawFirebaseData } from './TransitNetworkService';

// Firebase config
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDkOssauXNwf6N6CJqf9ICbyvUAaHEoRQ4',
  authDomain: 'busd-6a8ab.firebaseapp.com',
  databaseURL: 'https://busd-6a8ab-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'busd-6a8ab',
  storageBucket: 'busd-6a8ab.firebasestorage.app',
  messagingSenderId: '852892913090',
  appId: '1:852892913090:web:4c2139f3bb2f4de2915a5b',
  measurementId: 'G-WPE2WDZ59T',
};

// Cache keys
const CACHE_KEY_BUSES = '@cached_buses';
const CACHE_KEY_STOPS = '@cached_stops';
const CACHE_KEY_DISTANCES = '@cached_distances';
const CACHE_KEY_TIMESTAMP = '@cache_timestamp';
const CACHE_KEY_RAW_FIREBASE = '@cached_raw_firebase';

// Bus data structure from final_buss.json
interface BusData {
  english: string;
  bangla: string;
  routes: string[];
  time: string;
  service_type: string;
}

interface BusDataFile {
  data: BusData[];
}

// Stop data structure from final_safe.json
interface StopDataItem {
  id: number;
  names: string[];
  coordinates: number[][];
}

export class DataMigrationService {
  static busData: Bus[] = [];
  static stopData: Map<string, Stop> = new Map();
  static stopsByName: Map<string, Stop> = new Map();
  static stopCoordinatesById: Map<number, [number, number]> = new Map();
  
  // Distance data - same level as buses and stops
  static distanceData: Map<string, number> = new Map();
  static firebaseDistanceData: Map<string, number> = new Map();
  
  // Raw Firebase data for TransitNetwork algorithm
  static rawFirebaseData: RawFirebaseData | null = null;
  
  static isLoaded = false;

  private static normalizeStopName(value: string): string {
    if (!value) return '';
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\u0980-\u09FF\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  private static getDistanceKeyVariants(rawKey: string): string[] {
    const compact = rawKey.replace(/\s*-\s*/g, '-').trim();
    const idx = compact.indexOf('-');
    if (idx <= 0 || idx >= compact.length - 1) {
      return compact ? [compact] : [];
    }

    // Return as-is - names are already consistent
    return [compact];
  }

  private static addDistanceEntry(target: Map<string, number>, rawKey: string, value: any, isAlreadyKm: boolean = false): void {
    const rawDistance = typeof value === 'number' ? value : (value?.distance ? value.distance : null);
    // Allow 0 as valid distance (same location), reject null, undefined, or negative
    if (rawDistance === null || rawDistance === undefined || rawDistance < 0) {
      return;
    }

    // Convert meters to kilometers only if not already in km (from cache)
    const distanceKm = isAlreadyKm ? rawDistance : (rawDistance / 1000);

    const variants = this.getDistanceKeyVariants(rawKey);
    variants.forEach((variant) => target.set(variant, distanceKm));
  }

  private static extractPrimaryCoordinate(coordinates: number[][]): [number, number] | null {
    if (!Array.isArray(coordinates) || coordinates.length === 0 || !Array.isArray(coordinates[0])) {
      return null;
    }

    const first = coordinates[0];
    if (first.length < 2) {
      return null;
    }

    const lat = Number(first[0]);
    const lon = Number(first[1]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return null;
    }

    return [lat, lon];
  }

  private static calculateDistanceKm(from: [number, number], to: [number, number]): number {
    const toRadians = (deg: number): number => (deg * Math.PI) / 180;
    const [lat1, lon1] = from;
    const [lat2, lon2] = to;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371 * c
  }

  private static resolveStopByName(stopName: string): Stop | undefined {
    const normalized = this.normalizeStopName(stopName);
    if (!normalized) {
      return undefined;
    }

    if (this.stopsByName.has(normalized)) {
      return this.stopsByName.get(normalized);
    }

    for (const [key, stop] of this.stopsByName.entries()) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return stop;
      }
    }

    return undefined;
  }

  /**
   * Load all data from Firebase or JSON files (with fallback)
   * PRIORITY: 1) Cache (immediate), 2) Firebase (background), 3) JSON (fallback)
   */
  static async loadDataFromJSON(): Promise<void> {
    if (this.isLoaded) {
      console.log('✓ Data already loaded');
      return;
    }

    try {
      console.log('⏳ Starting data loading...');
      const startTime = Date.now();

      // PRIORITY 1: Load from cache immediately (for offline support)
      const cacheSuccess = await this.loadFromCache();
      if (cacheSuccess) {
        this.isLoaded = true;
        const duration = Date.now() - startTime;
        console.log(`✓ Data loaded from cache (${duration}ms) - Using previous data`);
        console.log(`📊 Cache data: ${this.busData.length} buses, ${this.stopData.size} stops`);
        
        // Ensure engine is initialized even from cache
        this.initializeTransitNetwork();
        
        // Trigger Firebase update in background (don't wait)
        this.updateFromFirebaseBackground();
        return;
      }

      console.log('💾 No cache found, loading from Firebase/JSON...');

      // PRIORITY 2: Initialize and try Firebase
      let firebaseSuccess = false;
      try {
        FirebaseService.initialize(FIREBASE_CONFIG);
        console.log('✓ Firebase initialized');
        firebaseSuccess = await this.loadFromFirebase();
        if (firebaseSuccess) {
          console.log(`✓ Data loaded from Firebase: ${this.busData.length} buses, ${this.stopData.size} stops`);
          // Cache the Firebase data
          await this.cacheData();
        } else {
          console.warn('⚠ Firebase returned no data');
        }
      } catch (err) {
        console.warn('⚠ Firebase loading failed:', err);
        firebaseSuccess = false;
      }

      // PRIORITY 3: Load from bundled JSON as final fallback
      if (!firebaseSuccess) {
        console.log('📦 Loading from bundled JSON...');
        await this.loadFromJSON();
        console.log(`✓ JSON loaded: ${this.busData.length} buses, ${this.stopData.size} stops`);
        // Cache the JSON data too
        await this.cacheData();
      }

      this.isLoaded = true;
      const duration = Date.now() - startTime;
      console.log(`✓ Data loading complete (${duration}ms): ${this.busData.length} buses, ${this.stopData.size} stops`);

      // Initialize TransitNetwork with raw Firebase data
      this.initializeTransitNetwork();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('✗ Critical error loading data:', errorMsg);
      // Still mark as loaded to prevent infinite retry loops
      this.isLoaded = true;
      // Try to initialize TransitNetwork anyway if we have any data
      this.initializeTransitNetwork();
      throw new Error(`Failed to load data: ${errorMsg}`);
    }
  }

  /**
   * Manual sync data from Firebase (call from UI to refresh)
   * Simply resets isLoaded flag and calls the proven loadDataFromJSON flow
   */
  static async manualSyncData(): Promise<boolean> {
    try {
      console.log('🔄 Manual sync started...');
      
      // Clear loaded flag to force reload
      this.isLoaded = false;
      
      // Clear in-memory maps
      this.busData = [];
      this.stopData.clear();
      this.stopsByName.clear();
      this.stopCoordinatesById.clear();
      this.distanceData.clear();
      this.firebaseDistanceData.clear();
      this.rawFirebaseData = null;
      TransitNetworkService.reset();
      
      // Use same proven initial load code
      await this.loadDataFromJSON();
      
      console.log(`✓ Manual sync completed: ${this.busData.length} buses, ${this.stopData.size} stops`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('✗ Manual sync failed:', errorMsg);
      return false;
    }
  }

  /**
   * Initialize TransitNetwork with raw Firebase data.
   * Called after data loading completes from any source.
   */
  private static initializeTransitNetwork(): void {
    if (!this.rawFirebaseData) {
      console.warn('⚠ No raw Firebase data available for TransitNetwork');
      return;
    }

    try {
      TransitNetworkService.reinitialize(this.rawFirebaseData);
      console.log('✓ TransitNetwork initialized with raw Firebase data');
    } catch (error) {
      console.error('✗ TransitNetwork initialization failed:', error);
    }
  }

  /**
   * Build rawFirebaseData from already-loaded in-memory data.
   * Used when loading from bundled JSON files.
   */
  private static buildRawFirebaseData(): void {
    try {
      // Build Bus Data array from busData
      const rawBuses: any[] = this.busData.map((bus) => ({
        english: bus.nameEnglish,
        bangla: bus.nameBangla,
        routes: bus.stoppages?.map((s) => s.stopageEn) || [],
        service_type: bus.serviceType || 'Regular',
      }));

      // Build Stop Data array from stopData
      const rawStops: any[] = [];
      this.stopData.forEach((stop) => {
        const coords = this.stopCoordinatesById.get(stop.id);
        rawStops.push({
          id: stop.id,
          names: [stop.stopageEn],
          coordinates: coords ? [[coords[0], coords[1]]] : [],
        });
      });

      // Build Dist Data from ALL distance sources (meters)
      const distMap: { [key: string]: number } = {};
      this.distanceData.forEach((distKm, key) => {
        distMap[key] = distKm * 1000; // Convert km back to meters for algorithm
      });
      this.firebaseDistanceData.forEach((distKm, key) => {
        distMap[key] = distKm * 1000;
      });

      this.rawFirebaseData = {
        'Bus Data': rawBuses,
        'Stop Data': rawStops,
        'Dist Data': [distMap],
      };

      console.log(`✓ Built raw Firebase data: ${rawBuses.length} buses, ${rawStops.length} stops, ${Object.keys(distMap).length} distances`);
    } catch (error) {
      console.error('✗ Failed to build raw Firebase data:', error);
    }
  }

  /**
   * Update data from Firebase in background (non-blocking)
   */
  private static async updateFromFirebaseBackground(): Promise<void> {
    try {
      if (!FirebaseService.isInitialized()) {
        FirebaseService.initialize(FIREBASE_CONFIG);
      }
      
      const stopsData = await FirebaseService.fetchStops();
      const busesData = await FirebaseService.fetchBuses();
      const distancesData = await FirebaseService.fetchDistanceData(8000);

      if (stopsData && busesData) {
        // Clear and reload
        this.busData = [];
        this.stopData.clear();
        this.stopsByName.clear();
        this.stopCoordinatesById.clear();
        this.firebaseDistanceData.clear();

        await this.processFirebaseStops(stopsData);
        await this.processFirebaseBuses(busesData);

        if (distancesData) {
          Object.entries(distancesData).forEach(([key, value]: [string, any]) => {
            this.addDistanceEntry(this.firebaseDistanceData, key, value);
          });
          console.log(`✓ Background Firebase distances updated: ${this.firebaseDistanceData.size} routes`);
        }

        await this.cacheData();
        
        console.log('✓ Background Firebase update completed');
      }
    } catch (error) {
      console.warn('⚠ Background Firebase update failed (using cached data)');
    }
  }

  /**
   * Load data from Firebase (primary source)
   */
  private static async loadFromFirebase(): Promise<boolean> {
    try {
      if (!FirebaseService.isInitialized()) {
        console.warn('⚠ Firebase not initialized, skipping');
        return false;
      }

      console.log('📡 Attempting to load data from Firebase...');

      // Load stops first (needed for bus processing)
      const stopsData = await FirebaseService.fetchStops();
      if (!stopsData) {
        console.warn('⚠ Firebase stops fetch returned null');
        return false;
      }

      // Load buses
      const busesData = await FirebaseService.fetchBuses();
      if (!busesData) {
        console.warn('⚠ Firebase buses fetch returned null');
        return false;
      }

      // Load distances
      const distancesData = await FirebaseService.fetchDistanceData(8000);
      if (distancesData) {
        this.firebaseDistanceData.clear();
        Object.entries(distancesData).forEach(([key, value]: [string, any]) => {
          this.addDistanceEntry(this.firebaseDistanceData, key, value);
        });
        console.log(`✓ Loaded ${this.firebaseDistanceData.size} distance routes from Firebase`);
      }

      // Process stops
      await this.processFirebaseStops(stopsData);

      // Process buses
      await this.processFirebaseBuses(busesData);

      // Build raw Firebase data for TransitNetwork
      // Convert Firebase object format to arrays expected by algorithm
      const rawBuses: any[] = Object.values(busesData);
      const rawStops: any[] = Object.values(stopsData);
      const rawDists: any[] = distancesData ? (Array.isArray(distancesData) ? distancesData : [distancesData]) : [];
      this.rawFirebaseData = {
        'Bus Data': rawBuses,
        'Stop Data': rawStops,
        'Dist Data': rawDists,
      };

      // Cache the data for offline access (including raw data)
      await this.cacheData();

      console.log('✓ All data successfully loaded from Firebase');
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠ Firebase load failed: ${errorMsg}`);
      return false;
    }
  }

  /**
   * Load data from AsyncStorage cache
   */
  private static async loadFromCache(): Promise<boolean> {
    try {
      console.log('💾 Attempting to load data from cache...');

      const cachedBuses = await AsyncStorage.getItem(CACHE_KEY_BUSES);
      const cachedStops = await AsyncStorage.getItem(CACHE_KEY_STOPS);
      const cachedDistances = await AsyncStorage.getItem(CACHE_KEY_DISTANCES);
      const cachedRawFirebase = await AsyncStorage.getItem(CACHE_KEY_RAW_FIREBASE);

      if (!cachedBuses || !cachedStops) {
        console.warn('⚠ No cached data found');
        return false;
      }

      const busesData = JSON.parse(cachedBuses);
      const stopsData = JSON.parse(cachedStops);

      await this.processFirebaseStops(stopsData);
      await this.processFirebaseBuses(busesData);

      // Load distances if available
      if (cachedDistances) {
        const distancesData = JSON.parse(cachedDistances);
        Object.entries(distancesData).forEach(([key, distance]: [string, any]) => {
          this.addDistanceEntry(this.distanceData, key, distance, true); // true = already in km
        });
        console.log(`✓ Loaded ${this.distanceData.size} cached distance routes`);
      }

      // Load raw Firebase data for TransitNetwork
      if (cachedRawFirebase) {
        this.rawFirebaseData = JSON.parse(cachedRawFirebase);
        console.log('✓ Loaded cached raw Firebase data for TransitNetwork');
      } else {
        // Build from loaded data if no raw cache exists
        this.buildRawFirebaseData();
      }

      console.log('✓ All data successfully loaded from cache');
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠ Cache load failed: ${errorMsg}`);
      return false;
    }
  }

  /**
   * Load data from bundled JSON files (fallback)
   */
  private static async loadFromJSON(): Promise<void> {
    try {
      console.log('📦 Loading data from bundled JSON files...');

      // Load stop data first
      await this.loadStopData();

      // Load distance data BEFORE buses so they're available for segment calculation
      await this.loadDistanceData();

      // Load bus data
      await this.loadBusData();

      // Build raw Firebase data for TransitNetwork from loaded JSON data
      this.buildRawFirebaseData();

      // Cache for future use
      await this.cacheData();

      console.log('✓ All data successfully loaded from JSON files');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('✗ JSON load failed:', errorMsg);
      throw new Error(`Fallback JSON load failed: ${errorMsg}`);
    }
  }

  /**
   * Process stops data from Firebase
   * Handles both formats: {id, names[], coordinates[]} (Firebase) and {id, english, bangla, coordinates[]} (JSON)
   */
  private static async processFirebaseStops(stopsData: any): Promise<void> {
    try {
      Object.keys(stopsData).forEach((key) => {
        const item = stopsData[key];

        // Skip invalid items
        if (!item || (!item.id && !item.names && !item.english)) {
          return;
        }

        // Handle Firebase format: {id, names: [...], coordinates: [...]}
        const isDynamoFormat = item.names && Array.isArray(item.names);
        const stopId = item.id || parseInt(key);
        const englishName = isDynamoFormat ? (item.names[0] || 'Unknown') : (item.english || 'Unknown');
        const bengaliName = isDynamoFormat ? (item.names[0] || 'Unknown') : (item.bangla || englishName);

        const stop: Stop = {
          id: stopId,
          stopageEn: englishName,
          stopageBn: bengaliName,
        };

        this.stopData.set(String(stopId), stop);

        // Index by English name
        const keyEn = this.normalizeStopName(englishName);
        if (keyEn) {
          this.stopsByName.set(keyEn, stop);
        }

        // Index by Bengali name if available and different
        if (bengaliName && bengaliName !== englishName) {
          const keyBn = this.normalizeStopName(bengaliName);
          if (keyBn) {
            this.stopsByName.set(keyBn, stop);
          }
        }

        // Extract coordinates
        if (item.coordinates && Array.isArray(item.coordinates)) {
          const coord = this.extractPrimaryCoordinate(item.coordinates);
          if (coord) {
            this.stopCoordinatesById.set(stopId, coord);
          }
        }
      });

      console.log(`✓ Processed ${this.stopData.size} stops`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Stop processing failed: ${errorMsg}`);
    }
  }

  /**
   * Process buses data from Firebase
   */
  private static async processFirebaseBuses(busesData: any): Promise<void> {
    try {
      this.busData = [];

      Object.keys(busesData).forEach((key) => {
        const bus = busesData[key];

        if (!bus.english || !Array.isArray(bus.routes)) {
          console.warn(`⚠️ Skipping invalid bus item:`, bus);
          return;
        }

        let cumulativeDistanceKm = 0;
        const routes = bus.routes || [];

        const stoppages = routes.map((stopName: string, order: number) => {
          const resolvedStop = this.resolveStopByName(stopName || '');
          const currentCoord = resolvedStop ? this.stopCoordinatesById.get(resolvedStop.id) : undefined;

          let segmentDistanceKm = 0;
          if (order > 0) {
            const prevStop = this.resolveStopByName(routes[order - 1] || '');
            const prevCoord = prevStop ? this.stopCoordinatesById.get(prevStop.id) : undefined;
            
            if (prevStop && resolvedStop) {
              // Check both directions in loaded data and take minimum
              const directKey = `${prevStop.stopageEn}-${resolvedStop.stopageEn}`;
              const reverseKey = `${resolvedStop.stopageEn}-${prevStop.stopageEn}`;
              
              const directDistance = this.distanceData.get(directKey) ?? this.firebaseDistanceData.get(directKey);
              const reverseDistance = this.distanceData.get(reverseKey) ?? this.firebaseDistanceData.get(reverseKey);
              
              // Use loaded distance if available, preferring minimum
              if (directDistance !== undefined && directDistance !== null && reverseDistance !== undefined && reverseDistance !== null) {
                segmentDistanceKm = Math.min(directDistance, reverseDistance);
              } else if (directDistance !== undefined && directDistance !== null) {
                segmentDistanceKm = directDistance;
              } else if (reverseDistance !== undefined && reverseDistance !== null) {
                segmentDistanceKm = reverseDistance;
              } else if (prevCoord && currentCoord) {
                // Only use Haversine if no distance data found
                segmentDistanceKm = this.calculateDistanceKm(prevCoord, currentCoord);
              }
            }
          }

          cumulativeDistanceKm += segmentDistanceKm;

          return {
            stopOrder: order,
            stopId: resolvedStop?.id ?? 0,
            stopageEn: stopName || '',
            stopageBn: stopName || '',
            segmentDistanceKm: Number(segmentDistanceKm.toFixed(2)),
            cumulativeDistanceKm: Number(cumulativeDistanceKm.toFixed(2)),
            isStart: order === 0,
            isEnd: order === routes.length - 1,
          };
        });

        const busId = Number(key) || this.busData.length + 1;

        this.busData.push({
          id: busId,
          nameEnglish: bus.english || `Bus ${busId}`,
          nameBangla: bus.bangla || '',
          serviceType: bus.service_type || 'Regular',
          totalStops: routes.length,
          stoppages,
        });
      });

      console.log(`✓ Processed ${this.busData.length} buses from Firebase`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Bus processing failed: ${errorMsg}`);
    }
  }

  /**
   * Cache data to AsyncStorage for offline access
   */
  private static async cacheData(): Promise<void> {
    try {
      const busesMap: { [key: number]: any } = {};
      const stopsMap: { [key: number]: any } = {};
      const distancesMap: { [key: string]: number } = {};

      // Convert to firebase format for caching
      this.busData.forEach((bus) => {
        busesMap[bus.id] = {
          english: bus.nameEnglish,
          bangla: bus.nameBangla,
          service_type: bus.serviceType,
          routes: bus.stoppages?.map((s) => s.stopageEn) || [],
        };
      });

      this.stopData.forEach((stop) => {
        const coords = this.stopCoordinatesById.get(stop.id);
        stopsMap[stop.id] = {
          id: stop.id,
          english: stop.stopageEn,
          bangla: stop.stopageBn,
          coordinates: coords ? [[coords[0], coords[1]]] : [],
        };
      });

      // Convert distance maps to cacheable format - BOTH sources
      this.distanceData.forEach((distance, key) => {
        distancesMap[key] = distance;
      });
      this.firebaseDistanceData.forEach((distance, key) => {
        distancesMap[key] = distance;
      });

      await AsyncStorage.setItem(CACHE_KEY_BUSES, JSON.stringify(busesMap));
      await AsyncStorage.setItem(CACHE_KEY_STOPS, JSON.stringify(stopsMap));
      await AsyncStorage.setItem(CACHE_KEY_DISTANCES, JSON.stringify(distancesMap));
      await AsyncStorage.setItem(CACHE_KEY_TIMESTAMP, new Date().toISOString());

      // Cache raw Firebase data for TransitNetwork
      if (this.rawFirebaseData) {
        await AsyncStorage.setItem(CACHE_KEY_RAW_FIREBASE, JSON.stringify(this.rawFirebaseData));
      }

      console.log(`✓ Cache saved: ${Object.keys(busesMap).length} buses, ${Object.keys(stopsMap).length} stops, ${Object.keys(distancesMap).length} distances`);
    } catch (error) {
      console.error('✗ Failed to cache data:', error);
      // Don't throw - cache failure is not critical
    }
  }

  /**
   * Load bus data from final_buss.json
   */
  private static async loadBusData(): Promise<void> {
    try {
      console.log('📦 Loading bus data...');
      // Load raw JSON data - in production this would come from files
      const busDataJSON: BusDataFile = require('../assets/final_buss.json');
      
      if (!busDataJSON || !busDataJSON.data || !Array.isArray(busDataJSON.data)) {
        throw new Error('Invalid bus data format: missing or malformed data array');
      }
      
      this.busData = busDataJSON.data.map((bus, index) => {
        let cumulativeDistanceKm = 0;
        const routes = bus.routes || [];

        const stoppages = routes.map((stopName, order) => {
          const resolvedStop = this.resolveStopByName(stopName || '');
          const currentCoord = resolvedStop ? this.stopCoordinatesById.get(resolvedStop.id) : undefined;

          let segmentDistanceKm = 0;
          if (order > 0) {
            const prevStop = this.resolveStopByName(routes[order - 1] || '');
            const prevCoord = prevStop ? this.stopCoordinatesById.get(prevStop.id) : undefined;
            
            if (prevStop && resolvedStop) {
              // Check both directions in loaded data and take minimum
              const directKey = `${prevStop.stopageEn}-${resolvedStop.stopageEn}`;
              const reverseKey = `${resolvedStop.stopageEn}-${prevStop.stopageEn}`;
              
              const directDistance = this.distanceData.get(directKey) ?? this.firebaseDistanceData.get(directKey);
              const reverseDistance = this.distanceData.get(reverseKey) ?? this.firebaseDistanceData.get(reverseKey);
              
              // Use loaded distance if available, preferring minimum
              if (directDistance !== undefined && directDistance !== null && reverseDistance !== undefined && reverseDistance !== null) {
                segmentDistanceKm = Math.min(directDistance, reverseDistance);
              } else if (directDistance !== undefined && directDistance !== null) {
                segmentDistanceKm = directDistance;
              } else if (reverseDistance !== undefined && reverseDistance !== null) {
                segmentDistanceKm = reverseDistance;
              } else if (prevCoord && currentCoord) {
                // Only use Haversine if no distance data found
                segmentDistanceKm = this.calculateDistanceKm(prevCoord, currentCoord);
              }
            }
          }

          cumulativeDistanceKm += segmentDistanceKm;

          return {
            stopOrder: order,
            stopId: resolvedStop?.id ?? 0,
            stopageEn: stopName || '',
            stopageBn: stopName || '',
            segmentDistanceKm: Number(segmentDistanceKm.toFixed(2)),
            cumulativeDistanceKm: Number(cumulativeDistanceKm.toFixed(2)),
            isStart: order === 0,
            isEnd: order === routes.length - 1,
          };
        });

        return {
          id: index + 1,
          nameEnglish: bus.english || `Bus ${index + 1}`,
          nameBangla: bus.bangla || '',
          serviceType: bus.service_type || 'Regular',
          totalStops: routes.length,
          stoppages,
        };
      });

      console.log(`✓ Loaded ${this.busData.length} buses`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('✗ Error loading bus data:', errorMsg);
      throw new Error(`Bus data load failed: ${errorMsg}`);
    }
  }

  /**
   * Load stop data from final_safe.json
   */
  private static async loadStopData(): Promise<void> {
    try {
      console.log('📍 Loading stop data...');
      // Load raw JSON data - in production this would come from files
      const stopDataArray: StopDataItem[] = require('../assets/final_safe.json');
      
      if (!Array.isArray(stopDataArray)) {
        throw new Error('Invalid stop data format: expected array');
      }
      
      stopDataArray.forEach((item) => {
        try {
          if (!item.id || !item.names || !Array.isArray(item.names) || item.names.length === 0) {
            console.warn(`⚠️ Skipping invalid stop item:`, item);
            return;
          }

          const stopName = item.names[0]; // Use first name as primary
          const stop: Stop = {
            id: item.id,
            stopageEn: stopName,
            stopageBn: stopName,
          };
          
          this.stopData.set(String(item.id), stop);

          item.names.forEach((name) => {
            const key = this.normalizeStopName(name);
            if (key) {
              this.stopsByName.set(key, stop);
            }
          });

          const coord = this.extractPrimaryCoordinate(item.coordinates);
          if (coord) {
            this.stopCoordinatesById.set(item.id, coord);
          }
        } catch (itemError) {
          console.warn(`⚠️ Error processing stop item:`, itemError);
        }
      });

      console.log(`✓ Loaded ${this.stopData.size} stops`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('✗ Error loading stop data:', errorMsg);
      throw new Error(`Stop data load failed: ${errorMsg}`);
    }
  }

  /**
   * Load distance data from bundled mem_lvl2.json
   */
  private static async loadDistanceData(): Promise<void> {
    try {
      console.log('📏 Loading distance data...');
      const distanceDataFile = require('../assets/mem_lvl2.json');
      
      if (typeof distanceDataFile !== 'object' || !distanceDataFile) {
        console.warn('⚠️ Distance data file is empty or invalid');
        return;
      }

      let loadedCount = 0;

      // Handle array format: [{ "A-B": 123 }, { "C-D": 456 }, ...]
      if (Array.isArray(distanceDataFile)) {
        distanceDataFile.forEach((item: any) => {
          if (item && typeof item === 'object') {
            Object.entries(item).forEach(([key, value]: [string, any]) => {
              try {
                const before = this.distanceData.size;
                this.addDistanceEntry(this.distanceData, key, value);
                if (this.distanceData.size > before) {
                  loadedCount++;
                }
              } catch (err) {
                // Silently skip invalid entries
              }
            });
          }
        });
      } else {
        // Handle object format: { "A-B": 123, "C-D": 456 }
        Object.entries(distanceDataFile).forEach(([key, value]: [string, any]) => {
          try {
            const before = this.distanceData.size;
            this.addDistanceEntry(this.distanceData, key, value);
            if (this.distanceData.size > before) {
              loadedCount++;
            }
          } catch (err) {
            // Silently skip invalid entries
          }
        });
      }

      console.log(`✓ Loaded ${loadedCount} distance routes from bundled JSON`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ Distance data load warning (non-critical): ${errorMsg}`);
      // Don't throw - distances are optional, app works without them
    }
  }

  /**
   * Find buses that connect two stops
   */
  static findBusesBetweenStops(fromStopName: string, toStopName: string): Bus[] {
    const fromNormalized = this.normalizeStopName(fromStopName);
    const toNormalized = this.normalizeStopName(toStopName);

    const results: Bus[] = [];

    this.busData.forEach((bus) => {
      const routes = bus.stoppages || [];
      const fromIdx = routes.findIndex((s) => {
        const key = this.normalizeStopName(s.stopageEn);
        return key.includes(fromNormalized) || fromNormalized.includes(key);
      });
      const toIdx = routes.findIndex((s) => {
        const key = this.normalizeStopName(s.stopageEn);
        return key.includes(toNormalized) || toNormalized.includes(key);
      });

      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
        return;
      }
      const fromDistance = routes[fromIdx].cumulativeDistanceKm ?? 0;
      const toDistance = routes[toIdx].cumulativeDistanceKm ?? 0;
      const estimatedDistanceKm = Number(Math.abs(toDistance - fromDistance).toFixed(2));
      const estimatedFare = Number(Math.max(10, estimatedDistanceKm * 2.45).toFixed(2));

      results.push({
        ...bus,
        estimatedDistanceKm,
        estimatedFare,
      });
    });

    return results;
  }

  /**
   * Search stops by name
   */
  static searchStops(query: string): Stop[] {
    const trimmedQuery = query.trim();
    const results: Stop[] = [];
    const seen = new Set<number>();

    this.stopsByName.forEach((stop) => {
      if (!seen.has(stop.id)) {
        if (stop.stopageEn.includes(trimmedQuery) || 
            stop.stopageBn.includes(trimmedQuery)) {
          results.push(stop);
          seen.add(stop.id);
        }
      }
    });

    return results.slice(0, 20);
  }

  /**
   * Get all stops
   */
  static getAllStops(): Stop[] {
    return Array.from(this.stopData.values()).sort((a, b) => 
      a.stopageEn.localeCompare(b.stopageEn)
    );
  }

  static getStopCoordinateById(stopId: number): [number, number] | null {
    return this.stopCoordinatesById.get(stopId) ?? null;
  }

  static getStopCoordinateByName(stopName: string): [number, number] | null {
    const stop = this.resolveStopByName(stopName);
    if (!stop) {
      return null;
    }
    return this.stopCoordinatesById.get(stop.id) ?? null;
  }

  /**
   * Clear all loaded data
   */
  static clearData(): void {
    this.busData = [];
    this.stopData.clear();
    this.stopsByName.clear();
    this.stopCoordinatesById.clear();
    this.distanceData.clear();
    this.firebaseDistanceData.clear();
    this.rawFirebaseData = null;
    TransitNetworkService.reset();
    this.isLoaded = false;
    console.log('✓ All data cleared (buses, stops, distances, TransitNetwork)');
  }
}

export default DataMigrationService;
