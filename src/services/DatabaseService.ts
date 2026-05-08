import DataMigrationService from './DataMigrationService';

export interface Stop {
  id: number;
  stopageEn: string;
  stopageBn: string;
  latitude?: number;
  longitude?: number;
}

export interface RouteStop {
  stopOrder: number;
  stopId: number;
  distance: number;
  routeId: string;
  stopageEn?: string;
  stopageBn?: string;
  isStart?: boolean;
  isEnd?: boolean;
  isJourney?: boolean;
  matchPercentage?: number;
}

export interface Route {
  routeId: string;
  routeNameEng?: string;
  routeNameBn?: string;
  stops: RouteStop[];
  totalDistance: number;
  isReverse?: boolean;
}

export interface Bus {
  id: number;
  nameEnglish: string;
  nameBangla: string;
  serviceType?: string;
  totalStops: number;
  stoppages?: BusStoppage[];
  estimatedDistanceKm?: number;
  estimatedFare?: number;
  fare_weight?: number;
  min_fare?: number;
}

export interface BusStoppage {
  stopOrder: number;
  stopId: number;
  stopageEn: string;
  stopageBn: string;
  segmentDistanceKm?: number;
  cumulativeDistanceKm?: number;
  isInRoute?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
  isJourneyStart?: boolean;
  isJourneyEnd?: boolean;
  journeyDistanceKm?: number;
}

export interface RouteCoordinate {
  lat: number;
  lng: number;
  stopName: string;
}

export interface TransferStop {
  stopId: number;
  stopageEn: string;
  stopageBn: string;
}

export interface TransferRoute {
  id: string; // Unique identifier for this transfer combination
  firstBus: Bus & { stoppages: BusStoppage[] };
  secondBus: Bus & { stoppages: BusStoppage[] };
  transferStop: TransferStop;
  firstBusDistance: number;
  secondBusDistance: number;
  totalDistance: number;
  firstBusFare: number;
  secondBusFare: number;
  estimatedFare?: number;
  firstBusFromStop: string;
  firstBusToStop: string;
  secondBusFromStop: string;
  secondBusToStop: string;
}

class DatabaseService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const startTime = Date.now();
      console.log('🔄 Initializing DatabaseService...');
      // Load all 3 data types: buses, stops, distances
      await this.loadAllDataTypes(startTime);
      this.initialized = true;
      console.log('✓ DatabaseService initialized with all data types');
    } catch (error) {
      console.error('✗ Error initializing DatabaseService:', error);
      // Still mark as initialized to prevent blocking the app
      this.initialized = true;
      console.warn('⚠ DatabaseService initialized with minimal data');
    }
  }

  /**
   * Load all 3 data types: buses, stops, and distances
   * Priority: Firebase > Cache > Local JSON
   */
  private async loadAllDataTypes(startTime: number): Promise<void> {
    try {
      // DataMigrationService handles all data types (buses, stops, distances)
      await DataMigrationService.loadDataFromJSON();
      const dataMigrationTime = Date.now() - startTime;
      console.log(`✓ Core data loaded (${dataMigrationTime}ms)`);
      
      const totalTime = Date.now() - startTime;
      console.log(`✓ All data types loaded together (${totalTime}ms total)`);
    } catch (error) {
      console.error('✗ Error loading data types:', error);
      throw error;
    }
  }

  /**
   * Force refresh all data from Firebase (for manual sync)
   * Syncs all 3 data types: buses, stops, and distances
   * Resets the initialized flag and reloads fresh data
   */
  async forceSync(): Promise<void> {
    try {
      console.log('🔄 Force syncing all data types from Firebase...');
      
      // Reset initialized flags
      this.initialized = false;
      DataMigrationService.isLoaded = false;
      DataMigrationService.clearData();
      
      // Sync all 3 data types from Firebase
      await this.syncAllDataTypes();
      
      this.initialized = true;
      console.log('✓ Force sync completed - all 3 data types synced from Firebase');
    } catch (error) {
      console.error('✗ Error during force sync:', error);
      this.initialized = true;
      throw new Error(`Failed to sync data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync all 3 data types from Firebase
   * All data types (buses, stops, distances) are now consolidated in DataMigrationService
   */
  private async syncAllDataTypes(): Promise<void> {
    try {
      console.log('📡 Syncing all 3 data types from Firebase...');
      
      // Reset and reload all data (buses, stops, AND distances together)
      DataMigrationService.clearData();
      await DataMigrationService.loadDataFromJSON();
      
      console.log('✓ All 3 data types synced (buses, stops, distances)');
    } catch (error) {
      console.error('✗ Error syncing data types:', error);
      throw error;
    }
  }

  async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async getAllStops(): Promise<Stop[]> {
    await this.ensureInitialized();
    return DataMigrationService.getAllStops();
  }

  async getAllBuses(): Promise<Bus[]> {
    await this.ensureInitialized();
    return DataMigrationService.busData;
  }

  async searchStops(query: string): Promise<Stop[]> {
    await this.ensureInitialized();
    return DataMigrationService.searchStops(query);
  }

  /**
   * Get buses that connect two stops
   * This replaces getRoutesBetweenStops - now returns buses instead of routes
   */
  async getBusesBetweenStops(fromStopName: string, toStopName: string): Promise<Bus[]> {
    await this.ensureInitialized();
    return DataMigrationService.findBusesBetweenStops(fromStopName, toStopName);
  }



  async getBusDetails(busId: number): Promise<RouteStop[]> {
    await this.ensureInitialized();
    const buses = DataMigrationService.busData;
    const bus = buses.find(b => b.id === busId);

    if (!bus || !bus.stoppages) {
      return [];
    }

    return bus.stoppages.map(stoppage => ({
      stopOrder: stoppage.stopOrder,
      stopId: stoppage.stopId,
      distance: (stoppage.cumulativeDistanceKm ?? 0) * 1000,
      routeId: `bus_${busId}`,
      stopageEn: stoppage.stopageEn,
      stopageBn: stoppage.stopageBn,
      isStart: stoppage.isStart,
      isEnd: stoppage.isEnd,
    }));
  }

  async getBusStoppagesWithRouteMatch(
    busId: number,
    fromStopName: string,
    toStopName: string
  ): Promise<BusStoppage[]> {
    await this.ensureInitialized();
    const buses = DataMigrationService.busData;
    const bus = buses.find(b => b.id === busId);

    if (!bus || !bus.stoppages) {
      return [];
    }

    // Simple matching - trim and exact comparison, case-insensitive
    const isStopMatch = (candidate: string, target: string): boolean => {
      const c = candidate.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const t = target.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return c === t || c.includes(t) || t.includes(c);
    };

    let orderedStoppages: BusStoppage[] = [...bus.stoppages];
    let fromIndex = orderedStoppages.findIndex(s => isStopMatch(s.stopageEn, fromStopName));
    let toIndex = orderedStoppages.findIndex(s => isStopMatch(s.stopageEn, toStopName));

    if (fromIndex === -1 || toIndex === -1) {
      return orderedStoppages;
    }

    let isReverse = false;
    if (fromIndex > toIndex) {
      isReverse = true;
      orderedStoppages = [...orderedStoppages].reverse();
      fromIndex = orderedStoppages.findIndex(s => isStopMatch(s.stopageEn, fromStopName));
      toIndex = orderedStoppages.findIndex(s => isStopMatch(s.stopageEn, toStopName));
    }

    // Properly recalculate segment distances in the correct order
    // Get the stoppages from fromIndex to toIndex to calculate segment distances correctly
    const routeStoppages = orderedStoppages.slice(0, toIndex + 1);
    
    let runningDistanceKm = 0;
    const distanceEnriched = routeStoppages.map((stoppage, index) => {
      let segmentDistance = 0;
      
      if (index > 0) {
        const prevStop = routeStoppages[index - 1];
        const currCumulative = stoppage.cumulativeDistanceKm ?? 0;
        const prevCumulative = prevStop.cumulativeDistanceKm ?? 0;
        
        // Calculate segment distance using absolute difference, accounting for reverse
        if (isReverse) {
          // For reverse routes, use the difference between cumulative distances
          segmentDistance = Math.abs(currCumulative - prevCumulative);
        } else {
          // For forward routes, calculate normally
          segmentDistance = Math.abs(currCumulative - prevCumulative);
        }
        
        runningDistanceKm += segmentDistance;
      }
      
      return {
        ...stoppage,
        segmentDistanceKm: Number(segmentDistance.toFixed(2)),
        isStart: index === 0,
        isEnd: index === routeStoppages.length - 1,
        cumulativeDistanceKm: Number(runningDistanceKm.toFixed(2)),
      };
    });

    const fromDistance = fromIndex >= 0 ? distanceEnriched[fromIndex].cumulativeDistanceKm ?? 0 : 0;

    return distanceEnriched.map((stoppage, index) => {
      const isInRoute = index >= fromIndex && index <= toIndex;
      return {
        ...stoppage,
        isInRoute,
        isJourneyStart: index === fromIndex,
        isJourneyEnd: index === toIndex,
        journeyDistanceKm: isInRoute
          ? Number(Math.max(0, (stoppage.cumulativeDistanceKm ?? 0) - fromDistance).toFixed(2))
          : undefined,
      };
    });
  }

  async getBusRouteCoordinates(
    busId: number,
    fromStopName?: string,
    toStopName?: string
  ): Promise<RouteCoordinate[]> {
    await this.ensureInitialized();
    const bus = DataMigrationService.busData.find((item) => item.id === busId);
    if (!bus || !bus.stoppages || bus.stoppages.length === 0) {
      return [];
    }

    const allCoordinates: RouteCoordinate[] = bus.stoppages
      .map((stoppage) => {
        const coordinate =
          DataMigrationService.getStopCoordinateById(stoppage.stopId) ??
          DataMigrationService.getStopCoordinateByName(stoppage.stopageEn);
        if (!coordinate) {
          return null;
        }

        return {
          lat: coordinate[0],
          lng: coordinate[1],
          stopName: stoppage.stopageEn,
        };
      })
      .filter((item): item is RouteCoordinate => item !== null);

    if (!fromStopName || !toStopName) {
      return allCoordinates;
    }

    const matchedStoppages = await this.getBusStoppagesWithRouteMatch(busId, fromStopName, toStopName);
    const inRouteNames = new Set(
      matchedStoppages.filter((item) => item.isInRoute).map((item) => item.stopageEn)
    );

    const routeCoordinates = allCoordinates.filter((item) => inRouteNames.has(item.stopName));
    return routeCoordinates.length >= 2 ? routeCoordinates : allCoordinates;
  }

  async getStatistics(): Promise<{
    totalLocations: number;
    activeRoutes: number;
    activeBuses: number;
    totalRouteStops: number;
    totalBusStops: number;
  }> {
    await this.ensureInitialized();
    const buses = DataMigrationService.busData;
    const stops = DataMigrationService.getAllStops();
    const totalBusStops = buses.reduce((sum, bus) => sum + (bus.totalStops || 0), 0);

    return {
      totalLocations: stops.length,
      activeRoutes: 0,
      activeBuses: buses.length,
      totalRouteStops: 0,
      totalBusStops,
    };
  }

  async clearData(): Promise<void> {
    DataMigrationService.clearData();
    this.initialized = false;
    console.log('✓ All data cleared');
  }
}

export default new DatabaseService();
