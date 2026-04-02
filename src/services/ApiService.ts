import { getDatabase, ref, get, child } from 'firebase/database';
import NetworkService from './NetworkService';

interface DistanceRecord {
  from: string;
  to: string;
  distance: number;
  distanceKm?: number;
}

interface StoppageData {
  id: number;
  stopageEn: string;
  stopageBn: string;
  latitude?: number;
  longitude?: number;
}

interface BusData {
  id: number;
  nameEnglish: string;
  nameBangla: string;
  serviceType?: string;
  totalStops: number;
}

class ApiService {
  private database: any = null;
  private initialized = false;
  private cache = new Map<string, any>();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
  private cacheTimestamps = new Map<string, number>();

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize Firebase
      const firebase = require('@react-native-firebase/app').default;
      const database = require('@react-native-firebase/database').default;

      this.database = database();
      this.initialized = true;
      console.log('✓ ApiService initialized with Firebase');
    } catch (error) {
      console.error('Error initializing ApiService:', error);
      // Fallback to fetch API
      this.initializeFetchApi();
    }
  }

  private initializeFetchApi(): void {
    console.log('⚠️ Firebase not available, using HTTP fetch API');
    this.initialized = true;
  }

  /**
   * Get distance data from Firebase
   */
  async getDistanceData(): Promise<Map<string, number>> {
    const cacheKey = 'distance_data';

    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      if (!NetworkService.isConnected()) {
        console.warn('⚠️ No internet connection - using cached distance data');
        return this.cache.get(cacheKey) || new Map();
      }

      const data = await this.fetchFromFirebase('Dist Data');

      if (data) {
        const distanceMap = new Map<string, number>();

        // Handle array format: [{ "A-B": 123 }, { "C-D": 456 }, ...]
        if (Array.isArray(data)) {
          data.forEach((item: any) => {
            if (item && typeof item === 'object') {
              Object.entries(item).forEach(([key, value]: [string, any]) => {
                // Accept 0 as valid distance (same location), reject negative
                if (typeof value === 'number' && value >= 0) {
                  distanceMap.set(key, value);
                }
              });
            }
          });
          console.log(`✓ Distance data loaded from array format: ${distanceMap.size} routes`);
        } else if (typeof data === 'object') {
          // Handle object format: { "A-B": 123, "C-D": 456 }
          Object.entries(data).forEach(([key, value]: [string, any]) => {
            if (typeof value === 'number') {
              distanceMap.set(key, value);
            } else if (value && typeof value === 'object' && value.distance) {
              distanceMap.set(key, value.distance);
            }
          });
          console.log(`✓ Distance data loaded from object format: ${distanceMap.size} routes`);
        }

        // Cache the data
        this.cache.set(cacheKey, distanceMap);
        this.cacheTimestamps.set(cacheKey, Date.now());

        return distanceMap;
      }

      return new Map();
    } catch (error) {
      console.error('Error fetching distance data:', error);
      // Return cached data if available
      return this.cache.get(cacheKey) || new Map();
    }
  }

  /**
   * Get all stoppages with location data
   */
  async getStoppages(): Promise<StoppageData[]> {
    const cacheKey = 'stoppages_data';

    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      if (!NetworkService.isConnected()) {
        console.warn('⚠️ No internet connection - using cached stoppage data');
        return this.cache.get(cacheKey) || [];
      }

      const data = await this.fetchFromFirebase('stoppages');

      if (data) {
        const stoppages: StoppageData[] = Array.isArray(data)
          ? data
          : Object.entries(data).map(([_, value]: [string, any]) => value);

        // Cache the data
        this.cache.set(cacheKey, stoppages);
        this.cacheTimestamps.set(cacheKey, Date.now());

        console.log(`✓ Stoppage data loaded: ${stoppages.length} stoppages`);
        return stoppages;
      }

      return [];
    } catch (error) {
      console.error('Error fetching stoppage data:', error);
      return this.cache.get(cacheKey) || [];
    }
  }

  /**
   * Get distance between two stoppages by name
   */
  async getDistanceBetweenStops(fromStop: string, toStop: string): Promise<number | null> {
    try {
      if (!NetworkService.isConnected()) {
        return null;
      }

      const distanceMap = await this.getDistanceData();

      // Try both directions
      const key1 = `${fromStop}-${toStop}`;
      const key2 = `${toStop}-${fromStop}`;

      const direct = distanceMap.get(key1);
      const reverse = distanceMap.get(key2);
      
      // distance can be 0 (same location), check >= 0 not > 0
      const validDirect = typeof direct === 'number' && direct >= 0 ? direct : null;
      const validReverse = typeof reverse === 'number' && reverse >= 0 ? reverse : null;

      // Return minimum distance if both exist, otherwise return whichever exists
      if (validDirect !== null && validReverse !== null) {
        return Math.min(validDirect, validReverse);
      }

      return validDirect ?? validReverse ?? null;
    } catch (error) {
      console.error('Error getting distance:', error);
      return null;
    }
  }

  /**
   * Get location data for a stoppage
   */
  async getStoppageLocation(stopName: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      if (!NetworkService.isConnected()) {
        return null;
      }

      const stoppages = await this.getStoppages();
      const stoppage = stoppages.find(
        s => s.stopageEn === stopName || s.stopageBn === stopName
      );

      if (stoppage && stoppage.latitude && stoppage.longitude) {
        return {
          latitude: stoppage.latitude,
          longitude: stoppage.longitude,
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting stoppage location:', error);
      return null;
    }
  }

  /**
   * Get multiple stoppage locations
   */
  async getMultipleStoppageLocations(
    stopNames: string[]
  ): Promise<Map<string, { latitude: number; longitude: number }>> {
    const locations = new Map<string, { latitude: number; longitude: number }>();

    try {
      const stoppages = await this.getStoppages();

      stopNames.forEach(stopName => {
        const stoppage = stoppages.find(
          s => s.stopageEn === stopName || s.stopageBn === stopName
        );

        if (stoppage && stoppage.latitude && stoppage.longitude) {
          locations.set(stopName, {
            latitude: stoppage.latitude,
            longitude: stoppage.longitude,
          });
        }
      });

      return locations;
    } catch (error) {
      console.error('Error getting multiple stoppage locations:', error);
      return locations;
    }
  }

  /**
   * Sync all data from Firebase (used in Settings)
   */
  async syncAllData(): Promise<boolean> {
    try {
      if (!NetworkService.isConnected()) {
        throw new Error('No internet connection');
      }

      console.log('🔄 Starting data synchronization...');

      // Clear cache to force refresh
      this.cache.clear();
      this.cacheTimestamps.clear();

      // Fetch all data
      await this.getDistanceData();
      await this.getStoppages();

      console.log('✓ Data synchronization completed');
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('✗ Data synchronization failed:', errorMsg);
      return false;
    }
  }

  /**
   * Internal method to fetch data from Firebase
   */
  private async fetchFromFirebase(path: string): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      if (this.database) {
        // Using Firebase SDK
        const snapshot = await this.database.ref(path).once('value');
        return snapshot.val();
      } else {
        // Fallback to HTTP fetch (requires backend API)
        return await this.fetchFromHttpApi(path);
      }
    } catch (error) {
      console.error(`Error fetching from Firebase path '${path}':`, error);
      throw error;
    }
  }

  /**
   * Fallback HTTP fetch API
   */
  private async fetchFromHttpApi(path: string): Promise<any> {
    try {
      // This would be your backend API URL
      const API_BASE_URL = 'https://your-api-backend.com/api';
      const response = await fetch(`${API_BASE_URL}/${path}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching from HTTP API:`, error);
      throw error;
    }
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(key: string): boolean {
    if (!this.cache.has(key)) {
      return false;
    }

    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) {
      return false;
    }

    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
    console.log('✓ Cache cleared');
  }

  /**
   * Get cache status
   */
  getCacheStatus(): { size: number; items: string[] } {
    return {
      size: this.cache.size,
      items: Array.from(this.cache.keys()),
    };
  }
}

export default new ApiService();
