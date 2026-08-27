import { Pool, types } from 'pg';

// Garante que colunas date/timestamp sempre retornem como string ISO, nunca como Date object.
// Sem isso, o pg pode retornar Date objects dependendo da versão/configuração,
// quebrando chamadas como .substring() no código da aplicação.
types.setTypeParser(1082, (v: string) => v);  // date → 'YYYY-MM-DD'
types.setTypeParser(1114, (v: string) => v);  // timestamp without time zone → ISO string
types.setTypeParser(1184, (v: string) => v);  // timestamp with time zone → ISO string

const pool = new Pool({
  host:     process.env.PG_HOST,
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DB,
  port:     5432,
  ssl:      { rejectUnauthorized: false },
  max:      10,
  idleTimeoutMillis: 30000,
});

type Params = (string | number | null | undefined)[];
type Row = Record<string, string | number | null>;

export class Database {
  async all<T = Row>(sql: string, params: Params = []): Promise<T[]> {
    const result = await pool.query(sql, params as unknown[]);
    return result.rows as T[];
  }

  async get<T = Row>(sql: string, params: Params = []): Promise<T | undefined> {
    const result = await pool.query(sql, params as unknown[]);
    return result.rows[0] as T | undefined;
  }

  async run(sql: string, params: Params = []): Promise<void> {
    await pool.query(sql, params as unknown[]);
  }

  // No-ops mantidos para compatibilidade com os call sites existentes
  save(): void {}
  async close(): Promise<void> {}
}

const _db = new Database();

export async function getDb(): Promise<Database> {
  return _db;
}
