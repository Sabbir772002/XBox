/**
 * Alternative DatabaseService that creates and populates database from scratch
 * Use this if asset copying doesn't work
 */
import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';

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
}

export interface Route {
  routeId: string;
  stops: RouteStop[];
  totalDistance: number;
}

class DatabaseService {
  private database: SQLiteDatabase | null = null;

  async openDatabase(): Promise<void> {
    if (this.database) {
      return;
    }

    try {
      // Open or create database
      this.database = await SQLite.openDatabase({
        name: 'mad_database.db',
        location: 'default',
      });
      console.log('✓ Database connection established');

      // Check if tables exist
      const tableCheck = await this.database.executeSql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('allstop', 'distance')"
      );

      if (tableCheck[0].rows.length < 2) {
        console.log('⚠ Tables not found, attempting to create from assets...');
        await this.createTablesFromAssets();
      } else {
        // Verify data exists
        const countCheck = await this.database.executeSql('SELECT COUNT(*) as count FROM allstop');
        const count = countCheck[0].rows.item(0).count;
        console.log(`✓ Database ready with ${count} stops`);
      }
    } catch (error) {
      console.error('✗ Error opening database:', error);
      throw error;
    }
  }

  private async createTablesFromAssets(): Promise<void> {
    if (!this.database) return;

    try {
      // Try to attach the database from assets
      await this.database.executeSql('ATTACH DATABASE ? AS asset_db', [
        'file:///android_asset/mad_database.db',
      ]);

      // Copy tables
      await this.database.executeSql('CREATE TABLE IF NOT EXISTS allstop AS SELECT * FROM asset_db.allstop');
      await this.database.executeSql('CREATE TABLE IF NOT EXISTS distance AS SELECT * FROM asset_db.distance');

      console.log('✓ Tables created from assets');
    } catch (error) {
      console.error('✗ Could not create from assets:', error);
      throw new Error('Database initialization failed. Please ensure mad_database.db is in assets folder.');
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
      'SELECT "Stopage ID" as id, "Stopage En" as stopageEn, "Stopage Bn" as stopageBn FROM allstop ORDER BY "Stopage En"'
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
      `SELECT "Stopage ID" as id, "Stopage En" as stopageEn, "Stopage Bn" as stopageBn 
       FROM allstop 
       WHERE "Stopage En" LIKE ? OR "Stopage Bn" LIKE ?
       ORDER BY "Stopage En"
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

    const query = `
      SELECT DISTINCT d1."Route ID" as routeId
      FROM distance d1
      INNER JOIN distance d2 ON d1."Route ID" = d2."Route ID"
      WHERE d1."Stop ID" = ? AND d2."Stop ID" = ?
      AND d1."Stop Order" < d2."Stop Order"
    `;

    const results = await this.database.executeSql(query, [fromStopId, toStopId]);

    const routes: Route[] = [];
    for (let i = 0; i < results[0].rows.length; i++) {
      const routeId = results[0].rows.item(i).routeId;
      const routeDetails = await this.getRouteDetails(routeId, fromStopId, toStopId);
      if (routeDetails) {
        routes.push(routeDetails);
      }
    }

    return routes;
  }

  async getRouteDetails(routeId: string, fromStopId?: number, toStopId?: number): Promise<Route | null> {
    await this.openDatabase();
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    let query = `
      SELECT 
        d."Stop Order" as stopOrder,
        d."Stop ID" as stopId,
        d.Distance as distance,
        d."Route ID" as routeId,
        s."Stopage En" as stopageEn,
        s."Stopage Bn" as stopageBn
      FROM distance d
      LEFT JOIN allstop s ON d."Stop ID" = s."Stopage ID"
      WHERE d."Route ID" = ?
    `;

    const params: any[] = [routeId];

    if (fromStopId && toStopId) {
      query += ` AND d."Stop Order" >= (SELECT "Stop Order" FROM distance WHERE "Route ID" = ? AND "Stop ID" = ?)
                 AND d."Stop Order" <= (SELECT "Stop Order" FROM distance WHERE "Route ID" = ? AND "Stop ID" = ?)`;
      params.push(routeId, fromStopId, routeId, toStopId);
    }

    query += ' ORDER BY d."Stop Order"';

    const results = await this.database.executeSql(query, params);

    if (results[0].rows.length === 0) {
      return null;
    }

    const stops: RouteStop[] = [];
    let totalDistance = 0;

    for (let i = 0; i < results[0].rows.length; i++) {
      const stop = results[0].rows.item(i);
      stops.push(stop);
      totalDistance = Math.max(totalDistance, stop.distance);
    }

    return {
      routeId,
      stops,
      totalDistance,
    };
  }

  async getAllRoutes(): Promise<string[]> {
    await this.openDatabase();
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const results = await this.database.executeSql(
      'SELECT DISTINCT "Route ID" as routeId FROM distance ORDER BY "Route ID"'
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
      'SELECT "Stopage ID" as id, "Stopage En" as stopageEn, "Stopage Bn" as stopageBn FROM allstop WHERE "Stopage ID" = ?',
      [stopId]
    );

    if (results[0].rows.length === 0) {
      return null;
    }

    return results[0].rows.item(0);
  }
}

export default new DatabaseService();
