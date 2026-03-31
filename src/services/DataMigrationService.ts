import { Bus, Stop } from './DatabaseService';

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
  static isLoaded = false;

  private static normalizeStopName(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\u0980-\u09ff]/g, '');
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
    return 6371 * c;
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
   * Load all data from JSON files
   */
  static async loadDataFromJSON(): Promise<void> {
    if (this.isLoaded) {
      console.log('✓ Data already loaded');
      return;
    }

    try {
      console.log('⏳ Loading data from JSON files...');
      const startTime = Date.now();
      
      // Load stop data
      await this.loadStopData();

      // Load bus data
      await this.loadBusData();
      
      this.isLoaded = true;
      const duration = Date.now() - startTime;
      console.log(`✓ Data loaded successfully: ${this.busData.length} buses, ${this.stopData.size} stops (${duration}ms)`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('✗ Error loading data:', errorMsg);
      console.error('Error details:', error);
      throw new Error(`Failed to load data: ${errorMsg}`);
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
            if (prevCoord && currentCoord) {
              segmentDistanceKm = this.calculateDistanceKm(prevCoord, currentCoord);
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
      const estimatedFare = Number(Math.max(10, estimatedDistanceKm * 2.5).toFixed(2));

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
    const lowerQuery = query.toLowerCase();
    const results: Stop[] = [];
    const seen = new Set<number>();

    this.stopsByName.forEach((stop) => {
      if (!seen.has(stop.id)) {
        if (stop.stopageEn.toLowerCase().includes(lowerQuery) || 
            stop.stopageBn.includes(query)) {
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
    this.isLoaded = false;
    console.log('✓ Data cleared');
  }
}

export default DataMigrationService;
