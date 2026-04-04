import DataMigrationService from './DataMigrationService';
import DistanceService from './DistanceService';

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
      console.log('🔄 Initializing DatabaseService...');
      // Load all 3 data types: buses, stops, distances
      await this.loadAllDataTypes();
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
  private async loadAllDataTypes(): Promise<void> {
    try {
      console.log('🔄 Loading all data types together...');
      const startTime = Date.now();
      
      // Load buses and stops data
      await DataMigrationService.loadDataFromJSON();
      const dataMigrationTime = Date.now() - startTime;
      console.log(`✓ Buses and stops loaded (${dataMigrationTime}ms)`);
      
      // Initialize and load distance data in parallel
      if (DistanceService && DistanceService.initialize) {
        try {
          await DistanceService.initialize();
          const distanceTime = Date.now() - startTime - dataMigrationTime;
          console.log(`✓ Distance data loaded (${distanceTime}ms)`);
        } catch (err) {
          console.warn('⚠ Distance loading failed but continuing with local data:', err);
          // Don't throw - distance is optional
        }
      }
      
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

  /**
   * Find buses that connect two stops with exactly 1 transfer
   * Returns array of transfer routes with alternative combinations
   * EXCLUDES buses that have direct routes (source->destination) from being first bus
   * This ensures transfers only show alternative paths, not direct routes repackaged
   * For each unique bus pair, keeps the transfer with minimum fare
   */
  async getBusesWithOneTransfer(fromStopName: string, toStopName: string): Promise<TransferRoute[]> {
    await this.ensureInitialized();
    const allBuses = DataMigrationService.busData;
    const allStops = DataMigrationService.getAllStops();
    const fromNormalized = fromStopName.trim();
    const toNormalized = toStopName.trim();
    
    // Get all direct buses to exclude from transfer options
    const directBuses = DataMigrationService.findBusesBetweenStops(fromStopName, toStopName);
    const directBusIds = new Set(directBuses.map(bus => bus.id));
    
    // Map to store best transfer for each unique bus pair
    const busPairMap = new Map<string, TransferRoute>();

    const stopByExactName = new Map<string, Stop>();
    allStops.forEach((stop) => stopByExactName.set(stop.stopageEn.trim(), stop));

    type StopRef = { index: number; stoppage: BusStoppage };
    type BusIndex = {
      bus: Bus;
      stopRefs: Map<string, StopRef>;
      stopIndices: Map<string, number[]>;
    };

    const busIndices = new Map<number, BusIndex>();
    const busesByStop = new Map<string, Array<{ bus: Bus; ref: StopRef }>>();

    for (const bus of allBuses) {
      if (!bus.stoppages) continue;

      const stopRefs = new Map<string, StopRef>();
      const stopIndices = new Map<string, number[]>();

      for (let idx = 0; idx < bus.stoppages.length; idx++) {
        const stoppage = bus.stoppages[idx];
        const name = stoppage.stopageEn.trim();

        if (!stopRefs.has(name)) {
          const ref = { index: idx, stoppage };
          stopRefs.set(name, ref);
          if (!busesByStop.has(name)) {
            busesByStop.set(name, []);
          }
          busesByStop.get(name)!.push({ bus, ref });
        }

        if (!stopIndices.has(name)) {
          stopIndices.set(name, []);
        }
        stopIndices.get(name)!.push(idx);
      }

      busIndices.set(bus.id, { bus, stopRefs, stopIndices });
    }

    // Baseline includes best direct route distance when available.
    const directBaselineDistance = directBuses.reduce((best, bus) => {
      const indexed = busIndices.get(bus.id);
      if (!indexed) return best;
      const fromRef = indexed.stopRefs.get(fromNormalized);
      const toRef = indexed.stopRefs.get(toNormalized);
      if (!fromRef || !toRef || fromRef.index === toRef.index) return best;
      const distance = Math.abs(
        (toRef.stoppage.cumulativeDistanceKm ?? 0) - (fromRef.stoppage.cumulativeDistanceKm ?? 0)
      );
      return Math.min(best, distance);
    }, Infinity);

    const firstBusCandidates = busesByStop.get(fromNormalized) ?? [];

    // Check first buses that have the source stop, excluding direct-route buses.
    for (const firstCandidate of firstBusCandidates) {
      const firstBus = firstCandidate.bus;
      const firstBusIndex = busIndices.get(firstBus.id);
      if (!firstBusIndex || !firstBus.stoppages) continue;
      if (directBusIds.has(firstBus.id)) continue;

      const fromResult = firstBusIndex.stopRefs.get(fromNormalized);
      if (!fromResult) continue;

      const midpoint = fromResult.index;
      let bestFoundDistance = directBaselineDistance;
      let stopForward = false;
      let stopBackward = false;

      // Explore from source index to both sides one by one.
      for (let offset = 1; offset < firstBus.stoppages.length; offset++) {
        if (!stopForward) {
          const i = midpoint + offset;
          if (i < firstBus.stoppages.length) {
            const transferStoppage = firstBus.stoppages[i];
            const transferName = transferStoppage.stopageEn.trim();

            if (transferName !== toNormalized) {
              const distanceToTransferPoint = Math.abs(
                (transferStoppage.cumulativeDistanceKm ?? 0) - (fromResult.stoppage.cumulativeDistanceKm ?? 0)
              );

              if (distanceToTransferPoint > bestFoundDistance + 2) {
                stopForward = true;
              } else {
                const transferStop = stopByExactName.get(transferName);
                const secondBusCandidates = busesByStop.get(transferName) ?? [];

                if (transferStop && secondBusCandidates.length > 0) {
                  for (const secondCandidate of secondBusCandidates) {
                    const secondBus = secondCandidate.bus;
                    if (secondBus.id === firstBus.id) continue;
                    if (directBusIds.has(secondBus.id)) continue;

                    const secondBusIndex = busIndices.get(secondBus.id);
                    if (!secondBusIndex) continue;

                    const transferResult = secondCandidate.ref;
                    const toResult = secondBusIndex.stopRefs.get(toNormalized);
                    if (!toResult || transferResult.index === toResult.index) continue;

                    // Avoid second leg that passes through source stop.
                    const sourceIndices = secondBusIndex.stopIndices.get(fromNormalized) ?? [];
                    const segmentStart = Math.min(transferResult.index, toResult.index);
                    const segmentEnd = Math.max(transferResult.index, toResult.index);
                    const sourceInSecondSegment = sourceIndices.some(
                      (idx) => idx >= segmentStart && idx <= segmentEnd
                    );
                    if (sourceInSecondSegment) continue;

                    const firstBusDistance = distanceToTransferPoint;
                    const secondBusDistance = Math.abs(
                      (toResult.stoppage.cumulativeDistanceKm ?? 0) -
                        (transferResult.stoppage.cumulativeDistanceKm ?? 0)
                    );
                    const totalDistance = firstBusDistance + secondBusDistance;
                    const firstBusFare = Math.max(firstBusDistance * 2.5, 10);
                    const secondBusFare = Math.max(secondBusDistance * 2.5, 10);
                    const totalFare = firstBusFare + secondBusFare;

                    const transferRoute: TransferRoute = {
                      id: `${firstBus.id}_${secondBus.id}_${transferStop.id}`,
                      firstBus: firstBus as Bus & { stoppages: BusStoppage[] },
                      secondBus: secondBus as Bus & { stoppages: BusStoppage[] },
                      transferStop: {
                        stopId: transferStop.id,
                        stopageEn: transferStop.stopageEn,
                        stopageBn: transferStop.stopageBn,
                      },
                      firstBusDistance: Number(firstBusDistance.toFixed(2)),
                      secondBusDistance: Number(secondBusDistance.toFixed(2)),
                      totalDistance: Number(totalDistance.toFixed(2)),
                      firstBusFare: Number(firstBusFare.toFixed(2)),
                      secondBusFare: Number(secondBusFare.toFixed(2)),
                      estimatedFare: totalFare,
                      firstBusFromStop: fromStopName,
                      firstBusToStop: transferStoppage.stopageEn,
                      secondBusFromStop: transferStoppage.stopageEn,
                      secondBusToStop: toStopName,
                    };

                    const routeKey = `${firstBus.id}_${secondBus.id}`;
                    const existing = busPairMap.get(routeKey);
                    const existingFare = existing?.estimatedFare ?? Infinity;

                    if (
                      !existing ||
                      totalFare < existingFare ||
                      (totalFare === existingFare && totalDistance < existing.totalDistance)
                    ) {
                      busPairMap.set(routeKey, transferRoute);
                      if (totalDistance < bestFoundDistance) {
                        bestFoundDistance = totalDistance;
                      }
                    }
                  }
                }
              }
            }
          } else {
            stopForward = true;
          }
        }

        if (!stopBackward) {
          const i = midpoint - offset;
          if (i >= 0) {
            const transferStoppage = firstBus.stoppages[i];
            const transferName = transferStoppage.stopageEn.trim();

            if (transferName !== toNormalized) {
              const distanceToTransferPoint = Math.abs(
                (transferStoppage.cumulativeDistanceKm ?? 0) - (fromResult.stoppage.cumulativeDistanceKm ?? 0)
              );

              if (distanceToTransferPoint > bestFoundDistance + 2) {
                stopBackward = true;
              } else {
                const transferStop = stopByExactName.get(transferName);
                const secondBusCandidates = busesByStop.get(transferName) ?? [];

                if (transferStop && secondBusCandidates.length > 0) {
                  for (const secondCandidate of secondBusCandidates) {
                    const secondBus = secondCandidate.bus;
                    if (secondBus.id === firstBus.id) continue;
                    if (directBusIds.has(secondBus.id)) continue;

                    const secondBusIndex = busIndices.get(secondBus.id);
                    if (!secondBusIndex) continue;

                    const transferResult = secondCandidate.ref;
                    const toResult = secondBusIndex.stopRefs.get(toNormalized);
                    if (!toResult || transferResult.index === toResult.index) continue;

                    const sourceIndices = secondBusIndex.stopIndices.get(fromNormalized) ?? [];
                    const segmentStart = Math.min(transferResult.index, toResult.index);
                    const segmentEnd = Math.max(transferResult.index, toResult.index);
                    const sourceInSecondSegment = sourceIndices.some(
                      (idx) => idx >= segmentStart && idx <= segmentEnd
                    );
                    if (sourceInSecondSegment) continue;

                    const firstBusDistance = distanceToTransferPoint;
                    const secondBusDistance = Math.abs(
                      (toResult.stoppage.cumulativeDistanceKm ?? 0) -
                        (transferResult.stoppage.cumulativeDistanceKm ?? 0)
                    );
                    const totalDistance = firstBusDistance + secondBusDistance;
                    const firstBusFare = Math.max(firstBusDistance * 2.5, 10);
                    const secondBusFare = Math.max(secondBusDistance * 2.5, 10);
                    const totalFare = firstBusFare + secondBusFare;

                    const transferRoute: TransferRoute = {
                      id: `${firstBus.id}_${secondBus.id}_${transferStop.id}`,
                      firstBus: firstBus as Bus & { stoppages: BusStoppage[] },
                      secondBus: secondBus as Bus & { stoppages: BusStoppage[] },
                      transferStop: {
                        stopId: transferStop.id,
                        stopageEn: transferStop.stopageEn,
                        stopageBn: transferStop.stopageBn,
                      },
                      firstBusDistance: Number(firstBusDistance.toFixed(2)),
                      secondBusDistance: Number(secondBusDistance.toFixed(2)),
                      totalDistance: Number(totalDistance.toFixed(2)),
                      firstBusFare: Number(firstBusFare.toFixed(2)),
                      secondBusFare: Number(secondBusFare.toFixed(2)),
                      estimatedFare: Number(totalFare.toFixed(2)),
                      firstBusFromStop: fromStopName,
                      firstBusToStop: transferStoppage.stopageEn,
                      secondBusFromStop: transferStoppage.stopageEn,
                      secondBusToStop: toStopName,
                    };

                    const routeKey = `${firstBus.id}_${secondBus.id}`;
                    const existing = busPairMap.get(routeKey);
                    const existingFare = existing?.estimatedFare ?? Infinity;

                    if (
                      !existing ||
                      totalFare < existingFare ||
                      (totalFare === existingFare && totalDistance < existing.totalDistance)
                    ) {
                      busPairMap.set(routeKey, transferRoute);
                      if (totalDistance < bestFoundDistance) {
                        bestFoundDistance = totalDistance;
                      }
                    }
                  }
                }
              }
            }
          } else {
            stopBackward = true;
          }
        }

        if (stopForward && stopBackward) {
          break;
        }
      }
    }

    // Convert map to array, sort by distance and limit results
    const transferRoutes = Array.from(busPairMap.values())
      .sort((a, b) => {
        // Primary sort: by total fare (individual fares summation, ascending)
        const aFareSum = a.firstBusFare + a.secondBusFare;
        const bFareSum = b.firstBusFare + b.secondBusFare;
        if (aFareSum !== bFareSum) {
          return aFareSum - bFareSum;
        }
        // Secondary sort: by distance (ascending)
        return a.totalDistance - b.totalDistance;
      })
      .slice(0, 50); // Limit to 50 results

    return transferRoutes;
  }

  /**
   * Get all unique transfer points for a given route search
   * Used for filtering transfer routes by transfer point
   */
  async getUniqueTransferPoints(transferRoutes: TransferRoute[]): Promise<Array<{ id: number; name: string; nameBn: string }>> {
    const uniquePoints = new Map<number, { id: number; name: string; nameBn: string }>();
    
    transferRoutes.forEach(route => {
      if (!uniquePoints.has(route.transferStop.stopId)) {
        uniquePoints.set(route.transferStop.stopId, {
          id: route.transferStop.stopId,
          name: route.transferStop.stopageEn,
          nameBn: route.transferStop.stopageBn,
        });
      }
    });
    
    return Array.from(uniquePoints.values());
  }

  /**
   * Filter transfer routes by selected transfer points
   */
  filterTransferRoutesByPoint(
    transferRoutes: TransferRoute[],
    selectedPointIds: number[]
  ): TransferRoute[] {
    if (selectedPointIds.length === 0) {
      return transferRoutes; // No filter, return all
    }
    
    return transferRoutes.filter(route =>
      selectedPointIds.includes(route.transferStop.stopId)
    );
  }

  async getAllBuses(): Promise<Bus[]> {
    await this.ensureInitialized();
    return [...DataMigrationService.busData];
  }

  async searchBuses(query: string): Promise<Bus[]> {
    await this.ensureInitialized();
    const buses = [...DataMigrationService.busData];
    if (!query || !query.trim()) {
      return buses;
    }

    const q = query.trim();
    return buses.filter((bus) =>
      bus.nameEnglish.includes(q) || bus.nameBangla.includes(q)
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

    // Simple matching - trim and exact comparison, case-insensitive
    const isStopMatch = (candidate: string, target: string): boolean => {
      const c = candidate.trim().toLowerCase();
      const t = target.trim().toLowerCase();
      return c === t; // Exact match, case-insensitive
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
