declare module 'react-native-sqlite-storage' {
  export interface DatabaseParams {
    name: string;
    location?: string;
    createFromLocation?: number;
  }

  export interface ResultSet {
    insertId: number;
    rowsAffected: number;
    rows: {
      length: number;
      item: (index: number) => any;
      raw: () => any[];
    };
  }

  export interface Transaction {
    executeSql: (
      sql: string,
      params?: any[],
      success?: (tx: Transaction, results: ResultSet) => void,
      error?: (tx: Transaction, error: any) => void
    ) => void;
  }

  export interface SQLiteDatabase {
    transaction: (
      fn: (tx: Transaction) => void,
      error?: (error: any) => void,
      success?: () => void
    ) => void;
    readTransaction: (
      fn: (tx: Transaction) => void,
      error?: (error: any) => void,
      success?: () => void
    ) => void;
    executeSql: (
      sql: string,
      params?: any[]
    ) => Promise<[ResultSet]>;
    close: () => Promise<void>;
  }

  export function openDatabase(
    params: DatabaseParams
  ): Promise<SQLiteDatabase>;

  export function DEBUG(debug: boolean): void;
  export function enablePromise(enable: boolean): void;

  const SQLite: {
    openDatabase: typeof openDatabase;
    DEBUG: typeof DEBUG;
    enablePromise: typeof enablePromise;
  };

  export default SQLite;
}
