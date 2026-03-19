import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';

// Enable debugging
SQLite.DEBUG(true);
SQLite.enablePromise(true);

export interface Stop {
  id: number;
  stopageEn: string;
  stopageBn: string;
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
}

export interface BusStoppage {
  stopOrder: number;
  stopId: number;
  stopageEn: string;
  stopageBn: string;
  isInRoute?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
}

class DatabaseService {
  private database: SQLiteDatabase | null = null;

  async openDatabase(): Promise<void> {
    if (this.database) {
      return;
    }

    try {
      // Open database - will create from assets on first launch
      this.database = await SQLite.openDatabase({
        name: 'bus_database.db',
        location: 'default',
        createFromLocation: '~bus_database.db',
      } as any);
      
      console.log('✓ Database opened successfully');
      
      // Verify tables exist
      const result = await this.database.executeSql(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'"
      );
      const tableCount = result[0].rows.item(0).count;
      console.log(`✓ Database has ${tableCount} tables`);
      
    } catch (error) {
      console.error('✗ Error opening database:', error);
      throw error;
    }
  }

  async closeDatabase(): Promise<void> {
    if (this.database) {
      await this.database.close();
      this.database = null;
      console.log('✓ Database closed');
    }
  }

  async getAllStops(): Promise<Stop[]> {
    await this.openDatabase();
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const results = await this.database.executeSql(
      'SELECT id, name_eng as stopageEn, name_bn as stopageBn FROM location_groups ORDER BY name_eng'
    );

    const stops: Stop[] = [];
    for (let i = 0; i < results[0].rows.length; i++) {
      stops.push(results[0].rows.item(i));
    }
    return stops;
  }

  async searchStops(query: string): Promise<Stop[]> {
    await this.openDatabase();
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const results = await this.database.executeSql(
      `SELECT id, name_eng as stopageEn, name_bn as stopageBn 
       FROM location_groups 
       WHERE name_eng LIKE ? COLLATE NOCASE OR name_bn LIKE ?
       ORDER BY name_eng
       LIMIT 20`,
      [`%${query}%`, `%${query}%`]
    );

    const stops: Stop[] = [];
    for (let i = 0; i < results[0].rows.length; i++) {
      stops.push(results[0].rows.item(i));
    }
    return stops;
  }

  async getRoutesBetweenStops(fromStopId: number, toStopId: number): Promise<Route[]> {
    await this.openDatabase();
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    // Find routes connecting both locations (bidirectional)
    const query = `
      SELECT DISTINCT 
        r.id as routePk,
        r.route_id as routeId,
        r.route_name_eng as routeNameEng,
        r.route_name_bn as routeNameBn,
        ABS(rs2.distance_from_start - rs1.distance_from_start) as distance
      FROM routes r
      JOIN route_stoppages rs1 ON r.id = rs1.route_id
      JOIN route_stoppages rs2 ON r.id = rs2.route_id
      WHERE ((rs1.location_group_id = ? AND rs2.location_group_id = ?)
         OR (rs1.location_group_id = ? AND rs2.location_group_id = ?))
        AND r.is_active = 1
        AND rs1.location_group_id != rs2.location_group_id
      ORDER BY distance ASC
    `;
    const results = await this.database.executeSql(query, [
      fromStopId, toStopId,
      toStopId, fromStopId
    ]);

    const routes: Route[] = [];
    const routeIdsSet = new Set<string>();
    for (let i = 0; i < results[0].rows.length; i++) {
      const row = results[0].rows.item(i);
      if(routeIdsSet.has(row.routeId)) {
        continue; // Skip duplicate routes
      }
      const routeDetails = await this.getRouteDetails(row.routeId, fromStopId, toStopId);

      if (routeDetails) {
        // Check if this is a reverse route by comparing first stop with user's source
        const firstStop = routeDetails.stops[0];
        const isReverse = firstStop && firstStop.stopId === toStopId;
        
        // If reverse, flip the stops array to match user's search direction
        if (isReverse) {
          routeDetails.stops = [...routeDetails.stops].reverse();
        }
        
        routeDetails.isReverse = isReverse;
        routeDetails.routeNameEng = row.routeNameEng;
        routeDetails.routeNameBn = row.routeNameBn;
        routes.push(routeDetails);
        routeIdsSet.add(row.routeId);
      }
    }

    return routes;
  }

  async getRouteDetails(routeId: string, fromStopId?: number, toStopId?: number): Promise<Route | null> {
    await this.openDatabase();
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    // Get route info
    const routeInfoQuery = `
      SELECT id, route_id, route_name_eng, route_name_bn
      FROM routes
      WHERE route_id = ? AND is_active = 1
    `;
    
    const routeInfoResult = await this.database.executeSql(routeInfoQuery, [routeId]);
    
    if (routeInfoResult[0].rows.length === 0) {
      return null;
    }

    const routeInfo = routeInfoResult[0].rows.item(0);
    const routePk = routeInfo.id;

    // Optimized query - single pass with all data
    let stopsQuery = `
      SELECT 
        rs.sequence_order as stopOrder,
        rs.location_group_id as stopId,
        rs.distance_from_start as distance,
        lg.name_eng as stopageEn,
        lg.name_bn as stopageBn
      FROM route_stoppages rs
      JOIN location_groups lg ON rs.location_group_id = lg.id
      WHERE rs.route_id = ?
    `;

    const params: any[] = [routePk];

    if (fromStopId && toStopId) {
      // Get stops between source and destination using optimized distance filtering
      stopsQuery += ` AND rs.distance_from_start BETWEEN 
                       (SELECT MIN(distance_from_start) FROM route_stoppages 
                        WHERE route_id = ? AND location_group_id IN (?, ?))
                       AND
                       (SELECT MAX(distance_from_start) FROM route_stoppages 
                        WHERE route_id = ? AND location_group_id IN (?, ?))`;
      params.push(routePk, fromStopId, toStopId, routePk, fromStopId, toStopId);
    }

    stopsQuery += ' ORDER BY rs.sequence_order';

    const results = await this.database.executeSql(stopsQuery, params);

    if (results[0].rows.length === 0) {
      return null;
    }

    const stops: RouteStop[] = [];
    let totalDistance = 0;

    for (let i = 0; i < results[0].rows.length; i++) {
      const stop = results[0].rows.item(i);
      stops.push({
        ...stop,
        routeId,
      });
      totalDistance = Math.max(totalDistance, stop.distance);
    }

    return {
      routeId,
      routeNameEng: routeInfo.route_name_eng,
      routeNameBn: routeInfo.route_name_bn,
      stops,
      totalDistance,
    };
  }

  // NEW: Get ALL route stoppages with color coding and match percentage
  async getAllRouteStoppagesWithDetails(
    routeId: string, 
    fromStopId: number, 
    toStopId: number
  ): Promise<RouteStop[]> {
    await this.openDatabase();
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    // Get route primary key
    const routeInfoQuery = `
      SELECT id FROM routes WHERE route_id = ? AND is_active = 1
    `;
    const routeInfoResult = await this.database.executeSql(routeInfoQuery, [routeId]);
    
    if (routeInfoResult[0].rows.length === 0) {
      return [];
    }

    const routePk = routeInfoResult[0].rows.item(0).id;

    // Get journey distance range in single query
    const journeyRangeQuery = `
      SELECT 
        MIN(distance_from_start) as minDist,
        MAX(distance_from_start) as maxDist
      FROM route_stoppages 
      WHERE route_id = ? AND location_group_id IN (?, ?)
    `;
    
    const rangeResult = await this.database.executeSql(journeyRangeQuery, [routePk, fromStopId, toStopId]);
    const { minDist, maxDist } = rangeResult[0].rows.item(0);

    // Get ALL stoppages with single optimized query
    const allStopsQuery = `
      SELECT 
        rs.sequence_order as stopOrder,
        rs.location_group_id as stopId,
        rs.distance_from_start as distance,
        lg.name_eng as stopageEn,
        lg.name_bn as stopageBn,
        CASE 
          WHEN rs.location_group_id = ? THEN 1
          ELSE 0
        END as isStart,
        CASE 
          WHEN rs.location_group_id = ? THEN 1
          ELSE 0
        END as isEnd,
        CASE 
          WHEN rs.distance_from_start >= ? AND rs.distance_from_start <= ? THEN 1
          ELSE 0
        END as isJourney
      FROM route_stoppages rs
      JOIN location_groups lg ON rs.location_group_id = lg.id
      WHERE rs.route_id = ?
      ORDER BY rs.sequence_order
    `;

    const results = await this.database.executeSql(allStopsQuery, [
      fromStopId, toStopId, minDist, maxDist, routePk
    ]);

    const stops: RouteStop[] = [];
    const totalStops = results[0].rows.length;
    let journeyStopsCount = 0;

    // First pass: collect stops and count journey stops
    for (let i = 0; i < results[0].rows.length; i++) {
      const stop = results[0].rows.item(i);
      if (stop.isJourney) journeyStopsCount++;
      stops.push({
        stopOrder: stop.stopOrder,
        stopId: stop.stopId,
        distance: stop.distance,
        routeId,
        stopageEn: stop.stopageEn,
        stopageBn: stop.stopageBn,
        isStart: stop.isStart === 1,
        isEnd: stop.isEnd === 1,
        isJourney: stop.isJourney === 1,
        matchPercentage: 0, // Will calculate in second pass
      });
    }

    // Second pass: calculate match percentage
    for (let stop of stops) {
      if (stop.isStart || stop.isEnd) {
        stop.matchPercentage = 100; // Start and end are 100% match
      } else if (stop.isJourney) {
        stop.matchPercentage = Math.round((journeyStopsCount / totalStops) * 100);
      } else {
        stop.matchPercentage = 0; // Not in journey
      }
    }

    return stops;
  }

  async getAllRoutes(): Promise<string[]> {
    await this.openDatabase();
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const results = await this.database.executeSql(
      'SELECT DISTINCT route_id as routeId FROM routes WHERE is_active = 1 ORDER BY route_id'
    );

    const routes: string[] = [];
    for (let i = 0; i < results[0].rows.length; i++) {
      routes.push(results[0].rows.item(i).routeId);
    }
    return routes;
  }

  async getStopById(stopId: number): Promise<Stop | null> {
    await this.openDatabase();
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const results = await this.database.executeSql(
      'SELECT id, name_eng as stopageEn, name_bn as stopageBn FROM location_groups WHERE id = ?',
      [stopId]
    );

    if (results[0].rows.length === 0) {
      return null;
    }

    return results[0].rows.item(0);
  }

  async getBusesForRoute(fromStopId: number, toStopId: number): Promise<Bus[]> {
    await this.openDatabase();
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    // Optimized query using indexes and EXISTS for faster lookup
    const query = `
      SELECT DISTINCT
        b.id,
        b.name_english as nameEnglish,
        b.name_bangla as nameBangla,
        b.service_type as serviceType,
        (SELECT COUNT(*) FROM bus_locations WHERE bus_id = b.id) as totalStops
      FROM buses b
      INDEXED BY idx_buses_active
      WHERE b.is_active = 1
        AND EXISTS (
          SELECT 1 FROM bus_locations bl1
          INDEXED BY idx_bus_locations_bus_location
          WHERE bl1.bus_id = b.id AND bl1.location_group_id = ?
        )
        AND EXISTS (
          SELECT 1 FROM bus_locations bl2
          INDEXED BY idx_bus_locations_bus_location
          WHERE bl2.bus_id = b.id AND bl2.location_group_id = ?
        )
      ORDER BY b.name_english
      LIMIT 50
    `;

    try {
      const results = await this.database.executeSql(query, [fromStopId, toStopId]);

      const buses: Bus[] = [];
      for (let i = 0; i < results[0].rows.length; i++) {
        buses.push(results[0].rows.item(i));
      }
      return buses;
    } catch (error) {
      // Fallback to non-indexed query if indexes don't exist
      console.warn('Using fallback bus query without indexes:', error);
      const fallbackQuery = `
        SELECT DISTINCT
          b.id,
          b.name_english as nameEnglish,
          b.name_bangla as nameBangla,
          b.service_type as serviceType,
          (SELECT COUNT(*) FROM bus_locations WHERE bus_id = b.id) as totalStops
        FROM buses b
        WHERE b.is_active = 1
          AND EXISTS (
            SELECT 1 FROM bus_locations 
            WHERE bus_id = b.id AND location_group_id = ?
          )
          AND EXISTS (
            SELECT 1 FROM bus_locations 
            WHERE bus_id = b.id AND location_group_id = ?
          )
        ORDER BY b.name_english
        LIMIT 50
      `;

      const results = await this.database.executeSql(fallbackQuery, [fromStopId, toStopId]);

      const buses: Bus[] = [];
      for (let i = 0; i < results[0].rows.length; i++) {
        buses.push(results[0].rows.item(i));
      }
      return buses;
    }
  }

  async getBusDetails(busId: number): Promise<RouteStop[]> {
    await this.openDatabase();
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT 
        bl.sequence_order as stopOrder,
        bl.location_group_id as stopId,
        lg.name_eng as stopageEn,
        lg.name_bn as stopageBn
      FROM bus_locations bl
      JOIN location_groups lg ON bl.location_group_id = lg.id
      WHERE bl.bus_id = ?
      ORDER BY bl.sequence_order
    `;

    const results = await this.database.executeSql(query, [busId]);

    const stops: RouteStop[] = [];
    for (let i = 0; i < results[0].rows.length; i++) {
      const stop = results[0].rows.item(i);
      stops.push({
        ...stop,
        distance: 0,
        routeId: '',
      });
    }
    return stops;
  }

  // Get bus stoppages with route matching indicators
  async getBusStoppagesWithRouteMatch(
    busId: number,
    fromStopId: number,
    toStopId: number
  ): Promise<BusStoppage[]> {
    await this.openDatabase();
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const query = `
      SELECT 
        bl.sequence_order as stopOrder,
        bl.location_group_id as stopId,
        lg.name_eng as stopageEn,
        lg.name_bn as stopageBn,
        CASE 
          WHEN bl.location_group_id = ? THEN 1
          ELSE 0
        END as isStart,
        CASE 
          WHEN bl.location_group_id = ? THEN 1
          ELSE 0
        END as isEnd
      FROM bus_locations bl
      JOIN location_groups lg ON bl.location_group_id = lg.id
      WHERE bl.bus_id = ?
      ORDER BY bl.sequence_order
    `;

    const results = await this.database.executeSql(query, [fromStopId, toStopId, busId]);

    const stoppages: BusStoppage[] = [];
    let startIndex = -1;
    let endIndex = -1;

    // First pass: collect stops and find start/end indices
    for (let i = 0; i < results[0].rows.length; i++) {
      const stop = results[0].rows.item(i);
      const stoppage: BusStoppage = {
        stopOrder: stop.stopOrder,
        stopId: stop.stopId,
        stopageEn: stop.stopageEn,
        stopageBn: stop.stopageBn,
        isStart: stop.isStart === 1,
        isEnd: stop.isEnd === 1,
        isInRoute: false,
      };

      if (stoppage.isStart) startIndex = i;
      if (stoppage.isEnd) endIndex = i;
      
      stoppages.push(stoppage);
    }

    // Second pass: mark stops between start and end as isInRoute
    if (startIndex !== -1 && endIndex !== -1) {
      const minIndex = Math.min(startIndex, endIndex);
      const maxIndex = Math.max(startIndex, endIndex);
      
      for (let i = minIndex; i <= maxIndex; i++) {
        stoppages[i].isInRoute = true;
      }
    }

    return stoppages;
  }

  async getStatistics(): Promise<{
    totalLocations: number;
    activeRoutes: number;
    activeBuses: number;
    totalRouteStops: number;
    totalBusStops: number;
  }> {
    await this.openDatabase();
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const queries = [
      'SELECT COUNT(*) as count FROM location_groups',
      'SELECT COUNT(*) as count FROM routes WHERE is_active = 1',
      'SELECT COUNT(*) as count FROM buses WHERE is_active = 1',
      'SELECT COUNT(*) as count FROM route_stoppages',
      'SELECT COUNT(*) as count FROM bus_locations',
    ];

    const results = await Promise.all(
      queries.map(query => this.database!.executeSql(query))
    );

    return {
      totalLocations: results[0][0].rows.item(0).count,
      activeRoutes: results[1][0].rows.item(0).count,
      activeBuses: results[2][0].rows.item(0).count,
      totalRouteStops: results[3][0].rows.item(0).count,
      totalBusStops: results[4][0].rows.item(0).count,
    };
  }
}

export default new DatabaseService();
