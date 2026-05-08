import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

type Params = (string | number | null | undefined)[];
type Row = Record<string, string | number | null>;

export class Database {
  private _db: initSqlJs.Database;

  constructor(db: initSqlJs.Database) {
    this._db = db;
  }

  async all<T = Row>(sql: string, params: Params = []): Promise<T[]> {
    const stmt = this._db.prepare(sql);
    if (params.length) stmt.bind(params as (string | number | null)[]);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as T);
    }
    stmt.free();
    return rows;
  }

  async get<T = Row>(sql: string, params: Params = []): Promise<T | undefined> {
    const rows = await this.all<T>(sql, params);
    return rows[0];
  }

  async close(): Promise<void> {
    this._db.close();
  }
}

export async function getDb(): Promise<Database> {
  const wasmPath = path.resolve(process.cwd(), 'lib/sql-wasm.wasm');
  const wasmBinary = fs.readFileSync(wasmPath);
  const SQL = await initSqlJs({ wasmBinary });
  const dbPath = path.resolve(process.cwd(), 'database/vendemmia_people.db');
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(new Uint8Array(fileBuffer));
  return new Database(db);
}
