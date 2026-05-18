import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase, ref, get, query, DatabaseReference, DataSnapshot } from 'firebase/database';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query as firestoreQuery, 
  where, 
  getDocs, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';

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
  private firestore: any = null;
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
      this.firestore = getFirestore(this.app);
      this.initialized = true;
      console.log('✓ Firebase initialized successfully with Firestore');
    } catch (error) {
      console.error('✗ Firebase initialization failed:', error);
      this.initialized = false;
    }
  }

  /**
   * Check if Firebase is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.db !== null && this.firestore !== null;
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
   * Add a new route to Firestore (CNG, Car, Bike, Others)
   */
  async addOtherRoute(routeData: {
    from: string;
    to: string;
    fare: string;
    distance?: string;
    carType: string;
  }): Promise<string | null> {
    if (!this.isInitialized()) {
      console.error('Firebase not initialized');
      return null;
    }

    try {
      const fromTrimmed = routeData.from.trim();
      const toTrimmed = routeData.to.trim();

      // Canonical sorted key: always store as "alphabetically_first,alphabetically_second"
      // This makes bidirectional search trivial — one key covers both directions.
      const canonicalKey = [fromTrimmed, toTrimmed]
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .join(',');

      const docRef = await addDoc(collection(this.firestore, 'other_routes'), {
        stoppages: canonicalKey,   // canonical sorted — used for querying
        from: fromTrimmed,          // user-input order — used for display
        to: toTrimmed,              // user-input order — used for display
        fare: parseInt(routeData.fare, 10) || 0,
        distance: parseFloat(routeData.distance || '0') || 0,
        carType: routeData.carType,
        createdAt: serverTimestamp(),
      });
      console.log('✓ Route added to Firestore with ID:', docRef.id);
      return docRef.id;
    } catch (error: any) {
      console.error('✗ Error adding route to Firestore:', error);
      if (error.code) console.error('Error Code:', error.code);
      if (error.message) console.error('Error Message:', error.message);
      return null;
    }
  }

  /**
   * Search for other routes in Firestore
   */
  async searchOtherRoutes(from: string, to: string, carType?: string): Promise<any[]> {
    if (!this.isInitialized()) {
      console.error('Firebase not initialized');
      return [];
    }

    try {
      // Build the same canonical key the writer uses
      const canonicalKey = [from.trim(), to.trim()]
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .join(',');

      // Normalise helper for fuzzy fallback
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normKey = normalize(canonicalKey);
      const normFrom = normalize(from.trim());
      const normTo = normalize(to.trim());

      // Fetch all other routes directly from the collection
      // This client-side approach ensures maximum offline/online robustness and completely avoids 
      // Firestore index limitations or "missing index" query errors.
      const routesCol = collection(this.firestore, 'other_routes');
      const querySnapshot = await getDocs(routesCol);
      const results: any[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const storedKey = normalize(data.stoppages || '');
        const storedCarType = data.carType;

        // Filter by carType if a specific filter is set
        if (carType && carType !== 'All' && storedCarType !== carType) {
          return;
        }

        // Primary match: canonical key equals stored key
        // Fallback: both stop names appear anywhere in stored string
        const matches =
          storedKey === normKey ||
          (storedKey.includes(normFrom) && storedKey.includes(normTo));

        if (matches) {
          results.push({ id: doc.id, ...data });
        }
      });

      // Sort client-side by createdAt descending (newest first)
      results.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });

      return results;
    } catch (error) {
      console.error('✗ Error searching Firestore routes:', error);
      return [];
    }
  }

  /**
   * Reset Firebase connection
   */
  reset(): void {
    this.app = null;
    this.db = null;
    this.firestore = null;
    this.initialized = false;
    console.log('✓ Firebase service reset');
  }
}

// Export singleton instance
export default new FirebaseService();
