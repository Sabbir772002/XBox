import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase, ref, get, query, DatabaseReference, DataSnapshot } from 'firebase/database';

/**
 * FirebaseService - Handles all Firebase Realtime Database operations
 * Fetches bus and stop data from Firebase with fallback error handling
 */

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

interface BusData {
  [key: string]: any;
}

interface StopsData {
  [key: string]: any;
}

class FirebaseService {
  private app: any = null;
  private db: any = null;
  private initialized = false;
  private readonly TIMEOUT_MS = 5000; // 5 second timeout for Firebase calls

  private normalizeDistancePayload(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Handle new array format: [{ "A-B": 123 }, { "C-D": 456 }, ...]
    if (Array.isArray(data)) {
      const merged: Record<string, number> = {};
      data.forEach((item: any) => {
        if (item && typeof item === 'object') {
          Object.entries(item).forEach(([key, value]: [string, any]) => {
            const distance = typeof value === 'number' ? value : null;
            // Allow 0 as valid distance (same location), reject null or negative
            if (distance !== null && distance >= 0) {
              merged[key] = distance;
            }
          });
        }
      });
      console.log(`✓ Converted array format with ${data.length} entries to flat object (${Object.keys(merged).length} valid routes)`);
      return merged;
    }

    // Common RTDB shape in this project: Dist Data -> { "0": { "A-B": 123 } }
    const rootKeys = Object.keys(data);
    if (rootKeys.length === 1 && rootKeys[0] === '0' && data['0'] && typeof data['0'] === 'object') {
      return data['0'];
    }

    return data;
  }

  /**
   * Initialize Firebase with provided config
   */
  initialize(firebaseConfig: FirebaseConfig): void {
    if (this.initialized) {
      console.log('✓ Firebase already initialized');
      return;
    }

    try {
      // Reuse existing default app if one is already present.
      this.app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      this.db = getDatabase(this.app);
      this.initialized = true;
      console.log('✓ Firebase initialized successfully');
    } catch (error) {
      console.error('✗ Firebase initialization failed:', error);
      this.initialized = false;
    }
  }

  /**
   * Check if Firebase is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.db !== null;
  }

  /**
   * Fetch all buses from Firebase with timeout
   */
  async fetchBuses(timeout: number = this.TIMEOUT_MS): Promise<BusData | null> {
    if (!this.isInitialized()) {
      console.error('Firebase not initialized');
      return null;
    }

    return this.fetchWithTimeout(async () => {
      try {
        const busesRef = ref(this.db, 'Bus Data');
        const snapshot = await get(busesRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          console.log('✓ Buses fetched from Firebase');
          return data;
        } else {
          console.warn('⚠ No buses data found in Firebase');
          return null;
        }
      } catch (error) {
        console.error('✗ Error fetching buses:', error);
        return null;
      }
    }, timeout);
  }

  /**
   * Fetch all stops from Firebase with timeout
   */
  async fetchStops(timeout: number = this.TIMEOUT_MS): Promise<StopsData | null> {
    if (!this.isInitialized()) {
      console.error('Firebase not initialized');
      return null;
    }

    return this.fetchWithTimeout(async () => {
      try {
        const stopsRef = ref(this.db, 'Stop Data');
        const snapshot = await get(stopsRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          console.log('✓ Stops fetched from Firebase');
          return data;
        } else {
          console.warn('⚠ No stops data found in Firebase');
          return null;
        }
      } catch (error) {
        console.error('✗ Error fetching stops:', error);
        return null;
      }
    }, timeout);
  }

  /**
   * Fetch specific bus by ID
   */
  async fetchBusById(busId: string | number, timeout: number = this.TIMEOUT_MS): Promise<any | null> {
    if (!this.isInitialized()) {
      console.error('Firebase not initialized');
      return null;
    }

    return this.fetchWithTimeout(async () => {
      try {
        const busRef = ref(this.db, `Bus Data/${busId}`);
        const snapshot = await get(busRef);

        if (snapshot.exists()) {
          console.log(`✓ Bus ${busId} fetched from Firebase`);
          return snapshot.val();
        } else {
          console.warn(`⚠ Bus ${busId} not found in Firebase`);
          return null;
        }
      } catch (error) {
        console.error(`✗ Error fetching bus ${busId}:`, error);
        return null;
      }
    }, timeout);
  }

  /**
   * Fetch specific stop by ID
   */
  async fetchStopById(stopId: string | number, timeout: number = this.TIMEOUT_MS): Promise<any | null> {
    if (!this.isInitialized()) {
      console.error('Firebase not initialized');
      return null;
    }

    return this.fetchWithTimeout(async () => {
      try {
        const stopRef = ref(this.db, `Stop Data/${stopId}`);
        const snapshot = await get(stopRef);

        if (snapshot.exists()) {
          console.log(`✓ Stop ${stopId} fetched from Firebase`);
          return snapshot.val();
        } else {
          console.warn(`⚠ Stop ${stopId} not found in Firebase`);
          return null;
        }
      } catch (error) {
        console.error(`✗ Error fetching stop ${stopId}:`, error);
        return null;
      }
    }, timeout);
  }

  /**
   * Fetch all distance data from Firebase
   */
  async fetchDistanceData(timeout: number = this.TIMEOUT_MS): Promise<any | null> {
    if (!this.isInitialized()) {
      console.error('Firebase not initialized');
      return null;
    }

    return this.fetchWithTimeout(async () => {
      try {
        const candidatePaths = ['Dist Data', 'distances', 'Distance Data'];

        for (const path of candidatePaths) {
          const distRef = ref(this.db, path);
          const snapshot = await get(distRef);

          if (snapshot.exists()) {
            const data = this.normalizeDistancePayload(snapshot.val());
            console.log(`✓ Distance data fetched from Firebase path: ${path}`);
            return data;
          }
        }

        console.warn('⚠ No distance data found in Firebase (checked Dist Data/distances/Distance Data)');
        return null;
      } catch (error) {
        console.error('✗ Error fetching distance data:', error);
        return null;
      }
    }, timeout);
  }

  /**
   * Fetch distance between two stops from Firebase
   * Checks both directions and returns minimum if both exist
   */
  async fetchDistanceBetweenStops(
    fromStop: string,
    toStop: string,
    timeout: number = this.TIMEOUT_MS
  ): Promise<number | null> {
    if (!this.isInitialized()) {
      console.error('Firebase not initialized');
      return null;
    }

    return this.fetchWithTimeout(async () => {
      try {
        // Try both directions: from->to and to->from
        const key1 = `${fromStop}-${toStop}`;
        const key2 = `${toStop}-${fromStop}`;

        let direct: number | null = null;
        let reverse: number | null = null;

        // Fetch direct direction
        const distRef = ref(this.db, `Dist Data/${key1}`);
        let snapshot = await get(distRef);

        if (snapshot.exists()) {
          direct = Number(snapshot.val());
          console.log(`✓ Distance ${key1} fetched from Firebase: ${direct} km`);
        }

        // Fetch reverse direction
        const distRef2 = ref(this.db, `Dist Data/${key2}`);
        snapshot = await get(distRef2);

        if (snapshot.exists()) {
          reverse = Number(snapshot.val());
          console.log(`✓ Distance ${key2} fetched from Firebase: ${reverse} km`);
        }

        // If both exist, return minimum
        if (direct !== null && reverse !== null) {
          const min = Math.min(direct, reverse);
          console.log(`✓ Found both directions for ${fromStop}<->${toStop}, returning minimum: ${min} km`);
          return min;
        }

        // Return whichever exists
        if (direct !== null) return direct;
        if (reverse !== null) return reverse;

        // Fallback for wrapped structure: Dist Data/0/{from-to}
        let nestedDirect: number | null = null;
        let nestedReverse: number | null = null;

        const nestedRef1 = ref(this.db, `Dist Data/0/${key1}`);
        snapshot = await get(nestedRef1);
        if (snapshot.exists()) {
          nestedDirect = Number(snapshot.val());
          console.log(`✓ Distance Dist Data/0/${key1} fetched from Firebase: ${nestedDirect} km`);
        }

        const nestedRef2 = ref(this.db, `Dist Data/0/${key2}`);
        snapshot = await get(nestedRef2);
        if (snapshot.exists()) {
          nestedReverse = Number(snapshot.val());
          console.log(`✓ Distance Dist Data/0/${key2} fetched from Firebase: ${nestedReverse} km`);
        }

        // If both nested exist, return minimum
        if (nestedDirect !== null && nestedReverse !== null) {
          const min = Math.min(nestedDirect, nestedReverse);
          console.log(`✓ Found both nested directions for ${fromStop}<->${toStop}, returning minimum: ${min} km`);
          return min;
        }

        // Return whichever nested exists
        if (nestedDirect !== null) return nestedDirect;
        if (nestedReverse !== null) return nestedReverse;

        console.warn(`⚠ No distance found for ${fromStop} <-> ${toStop}`);
        return null;
      } catch (error) {
        console.error('✗ Error fetching distance:', error);
        return null;
      }
    }, timeout);
  }

  /**
   * Helper method to wrap fetch calls with timeout
   */
  private async fetchWithTimeout<T>(
    fetchFn: () => Promise<T>,
    timeout: number
  ): Promise<T | null> {
    return new Promise((resolve) => {
      let timeoutId: any;

      const timeoutPromise = new Promise<null>((res) => {
        timeoutId = setTimeout(() => {
          console.warn(`⚠ Firebase fetch timeout after ${timeout}ms`);
          res(null);
        }, timeout);
      });

      Promise.race([fetchFn(), timeoutPromise]).then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      });
    });
  }

  /**
   * Get database reference (advanced usage)
   */
  getDatabase() {
    return this.db;
  }

  /**
   * Get app instance (advanced usage)
   */
  getApp() {
    return this.app;
  }

  /**
   * Reset Firebase connection
   */
  reset(): void {
    this.app = null;
    this.db = null;
    this.initialized = false;
    console.log('✓ Firebase service reset');
  }
}

// Export singleton instance
export default new FirebaseService();
