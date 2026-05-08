/**
 * TransitNetworkService — TypeScript port of algon.js TransitNetwork algorithm.
 * This is the CORE route-finding engine. Do NOT modify the algorithm logic.
 *
 * Features:
 * - Direct routes (0 transfers)
 * - 1-transfer routes
 * - 2-transfer routes
 * - Via-stop filtering
 * - Transfer-mode filtering
 * - 5-minute result caching for low-end device performance
 */

// ─── Input Types (Firebase data shape) ────────────────────────────────────────

export interface RawBusData {
  english?: string;
  bangla?: string;
  routes?: string[];
  serviceType?: string;
  time?: string;
  fare_weight?: number;
  min_fare?: number;
}

export interface RawStopData {
  id: number;
  names?: string[];
  coordinates?: number[][];
}

export interface RawDistData {
  [key: string]: number;
}

export interface RawFirebaseData {
  'Bus Data': RawBusData[];
  'Stop Data': RawStopData[];
  'Dist Data': RawDistData[];
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface InternalBus {
  id: number;
  name: string;
  route: string[];
  cumDists: number[];
  stopIndices: Map<string, number[]>;
  fareWeight: number;  // per-km fare rate (default 2.45)
  minFare: number;     // minimum fare in BDT (default 10)
  serviceType: string;
}

interface LegResult {
  cost: number;
  dist: number;
  sIdx: number;
  eIdx: number;
}

interface RouteSummary {
  type: string;
  legs: RouteLeg[];
  totalDist: number;
  totalCost: number;
  transfers: string[];
}

interface RouteLeg {
  busName: string;
  from: string;
  to: string;
  startIdx: number;
  endIdx: number;
  dist: number;
  cost: number;
  serviceType: string;
}

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface RoutePathStop {
  stop_name: string;
  bus_name: string;
  coordinates: number[] | null;
  distance_from_prev_km: number;
  cumulative_distance_km: number;
  is_transfer_point: boolean;
}

export interface DetailedRoute {
  type: string;
  total_distance_km: number;
  total_cost_tk: number;
  transfer_points: string[];
  fare_breakdown_tk: number[];
  legs: RouteLeg[];
  path: RoutePathStop[];
}

// ─── Cache Entry ──────────────────────────────────────────────────────────────

interface CacheEntry {
  results: DetailedRoute[];
  timestamp: number;
}

/**
 * Capitalize each word in a string
 */
function toTitleCase(str: string | undefined): string {
  if (!str) return '';
  // Check if it's mostly Bangla - if so, don't title case
  const hasLatin = /[a-zA-Z]/.test(str);
  if (!hasLatin) return str;

  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (word.length === 0) return '';
      if (/^[a-zA-Z]/.test(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(' ');
}

// ─── TransitNetwork Class (faithful port of algon.js) ─────────────────────────

class TransitNetwork {
  private stopCoords: Map<string, number[][]>;
  private precalcDists: Map<string, number>;
  private buses: InternalBus[];
  private stopToBuses: Map<string, Set<number>>;
  private intersections: Map<number, Map<number, string[]>>;
  private allStops: Set<string>;

  constructor(data: RawFirebaseData) {
    this.stopCoords = new Map();
    this.precalcDists = new Map();
    this.buses = [];
    this.stopToBuses = new Map();
    this.intersections = new Map();
    this.allStops = new Set();
    this.parseData(data);
    this.precompute();
  }

  private normalize(name: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\u0980-\u09FF\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371.0;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const a =
      Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private parseData(data: RawFirebaseData): void {
    (data['Stop Data'] || []).forEach((stop) => {
      if (!stop.names || !stop.coordinates) return;
      stop.names.forEach((name) => this.stopCoords.set(this.normalize(name), stop.coordinates!));
    });

    (data['Dist Data'] || []).forEach((distObj) => {
      Object.entries(distObj).forEach(([k, v]) => {
        const parts = k.split('-');
        if (parts.length === 2) {
          this.precalcDists.set(`${this.normalize(parts[0])}-${this.normalize(parts[1])}`, v);
          this.precalcDists.set(`${this.normalize(parts[1])}-${this.normalize(parts[0])}`, v);
        }
      });
    });

    (data['Bus Data'] || []).forEach((bus, idx) => {
      if (!bus.routes) return;
      const normRoute = bus.routes.map((s) => this.normalize(s));
      this.buses.push({
        id: idx,
        name: bus.english || `Bus ${idx}`,
        route: normRoute,
        cumDists: [],
        stopIndices: new Map(),
        fareWeight: bus.fare_weight ?? 2.45,
        minFare: bus.min_fare ?? 10,
        serviceType: bus.serviceType || 'Regular',
      });
      normRoute.forEach((s) => this.allStops.add(s));
    });
  }

  private getDistance(u: string, v: string): number {
    u = this.normalize(u);
    v = this.normalize(v);
    const key = `${u}-${v}`;
    if (this.precalcDists.has(key)) return this.precalcDists.get(key)! / 1000.0;
    const cU = this.stopCoords.get(u) || [];
    const cV = this.stopCoords.get(v) || [];
    if (!cU.length || !cV.length) return 0.0;
    let minD = Infinity;
    cU.forEach(([l1, n1]) =>
      cV.forEach(([l2, n2]) => (minD = Math.min(minD, this.haversine(l1, n1, l2, n2)))),
    );
    return minD === Infinity ? 0.0 : minD;
  }

  private precompute(): void {
    this.buses.forEach((bus) => {
      const cum = [0.0];
      bus.route.forEach((stop, i) => {
        if (!bus.stopIndices.has(stop)) bus.stopIndices.set(stop, []);
        bus.stopIndices.get(stop)!.push(i);
        if (!this.stopToBuses.has(stop)) this.stopToBuses.set(stop, new Set());
        this.stopToBuses.get(stop)!.add(bus.id);
        if (i > 0) cum.push(cum[cum.length - 1] + this.getDistance(bus.route[i - 1], stop));
      });
      bus.cumDists = cum;
    });

    this.buses.forEach((b) => this.intersections.set(b.id, new Map()));
    this.stopToBuses.forEach((busIds, stop) => {
      const arr = Array.from(busIds);
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const [b1, b2] = [arr[i], arr[j]];
          if (!this.intersections.get(b1)!.has(b2)) this.intersections.get(b1)!.set(b2, []);
          if (!this.intersections.get(b2)!.has(b1)) this.intersections.get(b2)!.set(b1, []);
          this.intersections.get(b1)!.get(b2)!.push(stop);
          this.intersections.get(b2)!.get(b1)!.push(stop);
        }
      }
    });
  }

  private calcLeg(busId: number, stopA: string, stopB: string): LegResult {
    const bus = this.buses[busId];
    const iA = bus.stopIndices.get(stopA) || [];
    const iB = bus.stopIndices.get(stopB) || [];
    if (!iA.length || !iB.length) return { cost: Infinity, dist: 0, sIdx: -1, eIdx: -1 };

    let minD = Infinity;
    let bestStart = -1;
    let bestEnd = -1;

    iA.forEach((a) => {
      iB.forEach((b) => {
        if (a === b) return; // source and destination index must be different
        const d = Math.abs(bus.cumDists[a] - bus.cumDists[b]);
        if (d < minD) {
          minD = d;
          bestStart = a;
          bestEnd = b;
        }
      });
    });

    if (minD === 0 || bestStart === -1 || bestEnd === -1) {
      return { cost: Infinity, dist: 0, sIdx: -1, eIdx: -1 };
    }

    const fare = Math.ceil(Math.max(bus.minFare, minD * bus.fareWeight));
    return { cost: fare, dist: minD, sIdx: bestStart, eIdx: bestEnd };
  }

  private buildDetailedRoute(routeSummary: RouteSummary): DetailedRoute {
    const path: RoutePathStop[] = [];
    let cumDist = 0.0;
    let lastStopNormalized = '';

    for (let i = 0; i < routeSummary.legs.length; i++) {
      const leg = routeSummary.legs[i];
      const bus = this.buses.find((b) => b.name === leg.busName);
      if (!bus) continue;

      const sIdx = leg.startIdx;
      const eIdx = leg.endIdx;
      const step = sIdx <= eIdx ? 1 : -1;

      let currentIdx = sIdx;
      while (true) {
        const stopName = bus.route[currentIdx]; // This is already normalized
        const coordsList = this.stopCoords.get(stopName) || [];
        const coord = coordsList.length > 0 ? coordsList[0] : null;

        if (path.length > 0 && lastStopNormalized === stopName) {
          // It's a transfer point, merge bus name if not already present
          if (!path[path.length - 1].bus_name.includes(bus.name)) {
            path[path.length - 1].bus_name += ` -> ${bus.name}`;
            path[path.length - 1].is_transfer_point = true;
          }
        } else {
          let distFromPrev = 0.0;
          if (path.length > 0) {
            // Both are normalized, ensuring correct distance lookup
            distFromPrev = this.getDistance(lastStopNormalized, stopName);
            cumDist += distFromPrev;
          }

          path.push({
            stop_name: toTitleCase(stopName),
            bus_name: bus.name,
            coordinates: coord,
            distance_from_prev_km: parseFloat(distFromPrev.toFixed(3)),
            cumulative_distance_km: parseFloat(cumDist.toFixed(3)),
            is_transfer_point: false,
          });
          lastStopNormalized = stopName;
        }

        if (currentIdx === eIdx) break;
        currentIdx += step;
      }
    }

    return {
      type: routeSummary.type,
      total_distance_km: parseFloat(routeSummary.totalDist.toFixed(3)),
      total_cost_tk: Math.ceil(routeSummary.totalCost),
      transfer_points: routeSummary.transfers.map(tp => toTitleCase(tp)),
      fare_breakdown_tk: routeSummary.legs.map((l) => Math.ceil(l.cost)),
      legs: routeSummary.legs,
      path: path,
    };
  }

  findRoutes(
    src: string,
    dst: string,
    viaStop: string = '',
    transferMode: number = -1,
  ): DetailedRoute[] {
    src = this.normalize(src);
    dst = this.normalize(dst);
    viaStop = this.normalize(viaStop);
    const srcBuses = this.stopToBuses.get(src) || new Set();
    const dstBuses = this.stopToBuses.get(dst) || new Set();
    let allRoutes: RouteSummary[] = [];

    // --- EXACT 0 TRANSFERS (Direct) ---
    if (transferMode === 0 || transferMode === -1) {
      srcBuses.forEach((bId) => {
        if (dstBuses.has(bId)) {
          const leg = this.calcLeg(bId, src, dst);
          allRoutes.push({
            type: 'Direct',
            legs: [
              {
                busName: this.buses[bId].name,
                from: src,
                to: dst,
                startIdx: leg.sIdx,
                endIdx: leg.eIdx,
                dist: leg.dist,
                cost: leg.cost,
                serviceType: this.buses[bId].serviceType,
              },
            ],
            totalDist: leg.dist,
            totalCost: leg.cost,
            transfers: [],
          });
        }
      });
    }

    // --- EXACT 1 TRANSFER ---
    if (transferMode === 1 || transferMode === -1) {
      srcBuses.forEach((b1) => {
        dstBuses.forEach((b2) => {
          if (b1 === b2) return;
          (this.intersections.get(b1)!.get(b2) || []).forEach((mid) => {
            const l1 = this.calcLeg(b1, src, mid);
            const l2 = this.calcLeg(b2, mid, dst);
            allRoutes.push({
              type: '1 Transfer',
              legs: [
                {
                  busName: this.buses[b1].name,
                  from: src,
                  to: mid,
                  startIdx: l1.sIdx,
                  endIdx: l1.eIdx,
                  dist: l1.dist,
                  cost: l1.cost,
                  serviceType: this.buses[b1].serviceType,
                },
                {
                  busName: this.buses[b2].name,
                  from: mid,
                  to: dst,
                  startIdx: l2.sIdx,
                  endIdx: l2.eIdx,
                  dist: l2.dist,
                  cost: l2.cost,
                  serviceType: this.buses[b2].serviceType,
                },
              ],
              totalDist: l1.dist + l2.dist,
              totalCost: l1.cost + l2.cost,
              transfers: [mid],
            });
          });
        });
      });
    }

    // --- EXACT 2 TRANSFERS ---
    if (transferMode === 2 || transferMode === -1) {
      let found2 = 0;
      const TARGET_2 = transferMode === -1 ? 20 : 50;

      search2Transfers: for (const b1 of srcBuses) {
        for (const b2 of dstBuses) {
          for (let b3 = 0; b3 < this.buses.length; b3++) {
            if (b3 === b1 || b3 === b2) continue;
            const m1s = this.intersections.get(b1)!.get(b3) || [];
            const m2s = this.intersections.get(b3)!.get(b2) || [];

            for (const m1 of m1s) {
              for (const m2 of m2s) {
                if (viaStop !== '' && m1 !== viaStop && m2 !== viaStop) continue;

                const l1 = this.calcLeg(b1, src, m1);
                const l2 = this.calcLeg(b3, m1, m2);
                const l3 = this.calcLeg(b2, m2, dst);

                allRoutes.push({
                  type: '2 Transfers',
                  legs: [
                    {
                      busName: this.buses[b1].name,
                      from: src,
                      to: m1,
                      startIdx: l1.sIdx,
                      endIdx: l1.eIdx,
                      dist: l1.dist,
                      cost: l1.cost,
                      serviceType: this.buses[b1].serviceType,
                    },
                    {
                      busName: this.buses[b3].name,
                      from: m1,
                      to: m2,
                      startIdx: l2.sIdx,
                      endIdx: l2.eIdx,
                      dist: l2.dist,
                      cost: l2.cost,
                      serviceType: this.buses[b3].serviceType,
                    },
                    {
                      busName: this.buses[b2].name,
                      from: m2,
                      to: dst,
                      startIdx: l3.sIdx,
                      endIdx: l3.eIdx,
                      dist: l3.dist,
                      cost: l3.cost,
                      serviceType: this.buses[b2].serviceType,
                    },
                  ],
                  totalDist: l1.dist + l2.dist + l3.dist,
                  totalCost: l1.cost + l2.cost + l3.cost,
                  transfers: [m1, m2],
                });

                found2++;
                if (found2 >= TARGET_2) break search2Transfers;
              }
            }
          }
        }
      }
    }

    // --- POST-PROCESSING ---
    if (viaStop !== '') {
      allRoutes = allRoutes.filter((r) => r.transfers.includes(viaStop));
    }

    // Deduplicate: direct routes are kept as-is.
    // For transfer routes, keep only the best (lowest fare) route per unique ordered bus-pair.
    // e.g. BusA→BusB via StopX and BusA→BusB via StopY → keep whichever is cheaper.
    const directRoutes: RouteSummary[] = [];
    const transferBestMap = new Map<string, RouteSummary>();

    allRoutes.forEach((r) => {
      if (r.type === 'Direct') {
        directRoutes.push(r);
      } else {
        // Key = ordered bus names joined (not the transfer stops)
        const pairKey = r.legs.map((l) => l.busName).join('|');
        const existing = transferBestMap.get(pairKey);
        if (!existing) {
          transferBestMap.set(pairKey, r);
        } else if (
          r.totalCost < existing.totalCost ||
          (r.totalCost === existing.totalCost && r.totalDist < existing.totalDist)
        ) {
          transferBestMap.set(pairKey, r);
        }
      }
    });

    allRoutes = directRoutes.concat(Array.from(transferBestMap.values()));

    allRoutes.sort((a, b) => {
      if (a.totalCost === b.totalCost) return a.totalDist - b.totalDist;
      return a.totalCost - b.totalCost;
    });

    const topRoutes = allRoutes.slice(0, 50);
    return topRoutes.map((r) => this.buildDetailedRoute(r));
  }

  /**
   * Get all unique stop names (for autocomplete)
   */
  getAllStopNames(): string[] {
    return Array.from(this.allStops).sort();
  }

  /**
   * Get bus count
   */
  getBusCount(): number {
    return this.buses.length;
  }

  /**
   * Get stop count
   */
  getStopCount(): number {
    return this.allStops.size;
  }
}

// ─── Singleton Service Wrapper with Caching ──────────────────────────────────

class TransitNetworkService {
  private network: TransitNetwork | null = null;
  private initialized = false;
  private resultCache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private rawData: RawFirebaseData | null = null;

  /**
   * Initialize with raw Firebase data
   */
  initialize(data: RawFirebaseData): void {
    if (this.initialized && this.network) {
      console.log('✓ TransitNetwork already initialized');
      return;
    }

    try {
      console.log('🔄 Initializing TransitNetwork...');
      const startTime = Date.now();
      this.rawData = data;
      this.network = new TransitNetwork(data);
      this.initialized = true;
      this.resultCache.clear();
      const duration = Date.now() - startTime;
      console.log(
        `✓ TransitNetwork initialized (${duration}ms): ${this.network.getBusCount()} buses, ${this.network.getStopCount()} stops`,
      );
    } catch (error) {
      console.error('✗ TransitNetwork initialization failed:', error);
      this.initialized = false;
    }
  }

  /**
   * Re-initialize (for data sync)
   */
  reinitialize(data: RawFirebaseData): void {
    this.initialized = false;
    this.network = null;
    this.resultCache.clear();
    this.initialize(data);
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.network !== null;
  }

  /**
   * Find routes with caching
   */
  findRoutes(
    src: string,
    dst: string,
    viaStop: string = '',
    transferMode: number = -1,
  ): DetailedRoute[] {
    if (!this.network) {
      console.error('TransitNetwork not initialized');
      return [];
    }

    // Build cache key
    const cacheKey = `${src.trim().toLowerCase()}|${dst.trim().toLowerCase()}|${viaStop.trim().toLowerCase()}|${transferMode}`;

    // Check cache
    const cached = this.resultCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      console.log(`✓ Cache hit for: ${cacheKey}`);
      return cached.results;
    }

    // Compute
    console.log(`🔍 Computing routes: ${src} → ${dst} (mode=${transferMode}, via=${viaStop || 'none'})`);
    const startTime = Date.now();
    const results = this.network.findRoutes(src, dst, viaStop, transferMode);
    const duration = Date.now() - startTime;
    console.log(`✓ Found ${results.length} routes in ${duration}ms`);

    // Cache results
    this.resultCache.set(cacheKey, {
      results,
      timestamp: Date.now(),
    });

    // Limit cache size (LRU-like: remove oldest if > 50 entries)
    if (this.resultCache.size > 50) {
      const firstKey = this.resultCache.keys().next().value;
      if (firstKey) this.resultCache.delete(firstKey);
    }

    return results;
  }

  /**
   * Get all stop names for autocomplete
   */
  getAllStopNames(): string[] {
    if (!this.network) return [];
    return this.network.getAllStopNames();
  }

  /**
   * Clear result cache
   */
  clearCache(): void {
    this.resultCache.clear();
    console.log('✓ TransitNetwork result cache cleared');
  }

  /**
   * Get raw data (for other services that need it)
   */
  getRawData(): RawFirebaseData | null {
    return this.rawData;
  }

  /**
   * Reset everything
   */
  reset(): void {
    this.network = null;
    this.initialized = false;
    this.resultCache.clear();
    this.rawData = null;
    console.log('✓ TransitNetwork service reset');
  }
}

export default new TransitNetworkService();
