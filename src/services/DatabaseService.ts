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

class DatabaseService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await DataMigrationService.loadDataFromJSON();
      this.initialized = true;
      console.log('✓ DatabaseService initialized with JSON data');
    } catch (error) {
      console.error('✗ Error initializing DatabaseService:', error);
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

  async getAllBuses(query?: string): Promise<Bus[]> {
    await this.ensureInitialized();
    const buses = [...DataMigrationService.busData];
    if (!query || !query.trim()) {
      return buses;
    }

    const q = query.toLowerCase();
    return buses.filter((bus) =>
      bus.nameEnglish.toLowerCase().includes(q) || bus.nameBangla.toLowerCase().includes(q)
    );
  }

  // Keep legacy methods for compatibility but they're deprecated
  async getRouteDetails(routeId: string, fromStopId?: number, toStopId?: number): Promise<Route | null> {
    console.warn('getRouteDetails is deprecated, use getBusesBetweenStops instead');
    return null;
  }

  async getAllRouteStoppagesWithDetails(
    routeId: string,
    fromStopId: number,
    toStopId: number
  ): Promise<RouteStop[]> {
    console.warn('getAllRouteStoppagesWithDetails is deprecated');
    return [];
  }

  async getAllRoutes(): Promise<string[]> {
    console.warn('getAllRoutes is deprecated');
    return [];
  }

  async getStopById(stopId: number): Promise<Stop | null> {
    await this.ensureInitialized();
    const stops = DataMigrationService.getAllStops();
    return stops.find(s => s.id === stopId) || null;
  }

  async getBusesForRoute(fromStopId: number, toStopId: number): Promise<Bus[]> {
    console.warn('getBusesForRoute is deprecated, use getBusesBetweenStops instead');
    return [];
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

    const normalize = (value: string): string =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9\u0980-\u09ff]/g, '');

    const isStopMatch = (candidate: string, target: string): boolean => {
      const c = candidate.toLowerCase();
      const t = target.toLowerCase();
      const cn = normalize(candidate);
      const tn = normalize(target);
      return c.includes(t) || t.includes(c) || cn.includes(tn) || tn.includes(cn);
    };

    let orderedStoppages: BusStoppage[] = [...bus.stoppages];
    let fromIndex = orderedStoppages.findIndex(s => isStopMatch(s.stopageEn, fromStopName));
    let toIndex = orderedStoppages.findIndex(s => isStopMatch(s.stopageEn, toStopName));

    if (fromIndex === -1 || toIndex === -1) {
      return orderedStoppages;
    }

    if (fromIndex > toIndex) {
      orderedStoppages = [...orderedStoppages]
        .reverse()
        .map((s, index) => ({
          ...s,
          stopOrder: index,
        }));
      fromIndex = orderedStoppages.findIndex(s => isStopMatch(s.stopageEn, fromStopName));
      toIndex = orderedStoppages.findIndex(s => isStopMatch(s.stopageEn, toStopName));
    }

    let runningDistanceKm = 0;
    const distanceEnriched = orderedStoppages.map((stoppage, index) => {
      if (index > 0) {
        runningDistanceKm += Math.max(0, stoppage.segmentDistanceKm ?? 0);
      }
      return {
        ...stoppage,
        isStart: index === 0,
        isEnd: index === orderedStoppages.length - 1,
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
      matchedStoppages.filter((item) => item.isInRoute).map((item) => item.stopageEn.toLowerCase())
    );

    const routeCoordinates = allCoordinates.filter((item) => inRouteNames.has(item.stopName.toLowerCase()));
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
