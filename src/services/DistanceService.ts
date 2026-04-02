import HaversineService from './HaversineService';
import ApiService from './ApiService';
import DataMigrationService from './DataMigrationService';

interface DistanceResult {
  distance: number;
  source: 'firebase' | 'local' | 'haversine';
  isEstimated: boolean;
}

/**
 * DistanceService - Now acts as a wrapper interface to DataMigrationService
 * All actual distance data loading is consolidated in DataMigrationService
 * This maintains backward compatibility while unifying data  operations
 */
class DistanceService {
  private initialized = false;

  /**
   * Initialize - now just marks as ready since DataMigrationService handles loading
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('🔄 Initializing DistanceService (uses consolidated DataMigrationService)...');
      const startTime = Date.now();

      // DistanceService now relies on DataMigrationService for all data
      const localCount = DataMigrationService.distanceData.size;
      const fbCount = DataMigrationService.firebaseDistanceData.size;
      const duration = Date.now() - startTime;

      this.initialized = true;
      console.log(`✓ DistanceService ready: ${fbCount} Firebase + ${localCount} Local routes (${duration}ms)`);
    } catch (error) {
      console.error('✗ Error in DistanceService initialization:', error);
      this.initialized = true;
    }
  }

  /**
   * Get distance between two stops
   * Uses consolidated data from DataMigrationService
   * Priority: Firebase > Local > Haversine
   */
  async getDistance(stopA: string, stopB: string): Promise<DistanceResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!stopA || !stopB) {
      return { distance: 0, source: 'local', isEstimated: false };
    }

    const normalizedA = stopA.trim();
    const normalizedB = stopB.trim();

    // Try Firebase first (consolidated in DataMigrationService)
    if (DataMigrationService.firebaseDistanceData.size > 0) {
      const fbDistance = this.getDistanceFromMap(normalizedA, normalizedB, DataMigrationService.firebaseDistanceData);
      if (fbDistance > 0) {
        console.log(`🔥 Firebase: ${normalizedA} → ${normalizedB} = ${fbDistance} km`);
        return { distance: fbDistance, source: 'firebase', isEstimated: false };
      }
    }

    // Try local data (consolidated in DataMigrationService)
    if (DataMigrationService.distanceData.size > 0) {
      const localDistance = this.getDistanceFromMap(normalizedA, normalizedB, DataMigrationService.distanceData);
      if (localDistance > 0) {
        console.log(`💾 Local: ${normalizedA} → ${normalizedB} = ${localDistance} km`);
        return { distance: localDistance, source: 'local', isEstimated: false };
      }
    }

    // Try Haversine as fallback
    const haversineDistance = await this.getHaversineDistance(normalizedA, normalizedB);
    if (haversineDistance > 0) {
      console.log(`📍 Haversine: ${normalizedA} → ${normalizedB} ≈ ${haversineDistance} km (estimated)`);
      return { distance: haversineDistance, source: 'haversine', isEstimated: true };
    }

    console.warn(`⚠️ No distance found for ${normalizedA} ↔ ${normalizedB}`);
    return { distance: 0, source: 'local', isEstimated: false };
  }

  /**
   * Get distance from a specific distance map
   * Note: Distance can be 0 (same location), but we distinguish from "not found"
   */
  private getDistanceFromMap(stopA: string, stopB: string, distanceMap: Map<string, number>): number {
    const key1 = `${stopA}-${stopB}`;
    const key2 = `${stopB}-${stopA}`;

    const direct = distanceMap.get(key1);
    const reverse = distanceMap.get(key2);

    // Collect valid distances (>= 0, not negative)
    const validDistances = [];
    if (typeof direct === 'number' && direct >= 0) {
      validDistances.push(direct);
    }
    if (typeof reverse === 'number' && reverse >= 0) {
      validDistances.push(reverse);
    }

    // Return minimum if both exist, otherwise return whichever exists
    if (validDistances.length > 0) {
      return Math.min(...validDistances);
    }

    return 0;
  }

  /**
   * Calculate distance using Haversine formula (fallback)
   */
  private async getHaversineDistance(stopA: string, stopB: string): Promise<number> {
    try {
      if (!ApiService || typeof ApiService.getStoppageLocation !== 'function') {
        return 0;
      }

      const coordA = await ApiService.getStoppageLocation(stopA);
      const coordB = await ApiService.getStoppageLocation(stopB);

      if (coordA && HaversineService.isValidCoordinate(coordA) &&
          coordB && HaversineService.isValidCoordinate(coordB)) {
        return HaversineService.calculateDistance(coordA, coordB);
      }
      return 0;
    } catch (error) {
      console.warn(`⚠️ Haversine calculation failed for ${stopA} ↔ ${stopB}:`, error);
      return 0;
    }
  }

  /**
   * Force sync - triggers reload from DataMigrationService
   */
  async forceSync(): Promise<void> {
    try {
      console.log('🔄 Force syncing distances (via DataMigrationService)...');
      // Just reinitialize to pick up fresh data from DataMigrationService
      this.initialized = false;
      await this.initialize();
      console.log('✓ Distance sync completed');
    } catch (error) {
      console.error('✗ Error during  force sync:', error);
      throw error;
    }
  }

  /**
   * Clear cache (delegates to DataMigrationService)
   */
  async clearCache(): Promise<void> {
    try {
      console.log('🗑️  Clearing distance cache...');
      DataMigrationService.distanceData.clear();
      DataMigrationService.firebaseDistanceData.clear();
      console.log('✓ Distance cache cleared');
    } catch (error) {
      console.error('✗ Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * Get  distance count from all sources
   */
  getDistanceCount(): { firebase: number; local: number; total: number } {
    return {
      firebase: DataMigrationService.firebaseDistanceData.size,
      local: DataMigrationService.distanceData.size,
      total: DataMigrationService.firebaseDistanceData.size + DataMigrationService.distanceData.size,
    };
  }
}

export default new DistanceService();
