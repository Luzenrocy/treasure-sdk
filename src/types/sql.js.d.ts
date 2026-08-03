declare module 'sql.js' {
  export class Database {
    constructor(data?: Uint8Array);
    run(sql: string, params?: unknown[]): void;
    exec(sql: string, params?: unknown[]): unknown[];
    prepare(sql: string, params?: unknown[]): Statement;
    getRowsModified(): number;
    export(): Uint8Array;
    close(): void;
  }

  export class Statement {
    bind(values?: unknown[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): boolean;
  }

  interface SqlJs {
    Database: typeof Database;
  }

  const initSqlJs: () => Promise<SqlJs>;
  export default initSqlJs;
}
