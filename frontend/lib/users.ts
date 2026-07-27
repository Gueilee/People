import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import { getDb } from './db';

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  login: string;
  role: 'admin' | 'viewer' | 'rh' | 'requisitante';
  ativo: number;
  tem_senha: number;
  created_at: number;
};

// ── Hashing ──────────────────────────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const hashBuf = Buffer.from(hash, 'hex');
    const verify  = scryptSync(password, salt, 64);
    return timingSafeEqual(hashBuf, verify);
  } catch {
    return false;
  }
}

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

// ── DB init ───────────────────────────────────────────────────────────────────

export async function ensureUsersTable() {
  const db = await getDb();
  await db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id              SERIAL PRIMARY KEY,
    nome            TEXT NOT NULL,
    email           TEXT,
    login           TEXT NOT NULL UNIQUE,
    senha_hash      TEXT,
    role            TEXT NOT NULL DEFAULT 'viewer',
    ativo           INTEGER NOT NULL DEFAULT 1,
    reset_token     TEXT,
    reset_expiry    INTEGER,
    created_at      INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
  )`);

  const count = await db.get<{ n: string }>('SELECT COUNT(*) as n FROM usuarios');
  if (!count || parseInt(count.n as unknown as string) === 0) {
    await db.run(
      `INSERT INTO usuarios (nome, email, login, senha_hash, role) VALUES ($1, $2, $3, $4, $5)`,
      ['Administrador', 'admin@vendemmia.com.br', 'admin', hashPassword('vendemmia@2025'), 'admin']
    );
  }
  await db.run(
    `UPDATE usuarios SET email = 'admin@vendemmia.com.br' WHERE login = 'admin' AND email IS NULL`
  );

  // Recuperação de emergência: se ADMIN_RESET_PASSWORD estiver definido no ambiente,
  // força a atualização do hash do admin. Remova a variável após o primeiro login.
  const resetPwd = process.env.ADMIN_RESET_PASSWORD;
  if (resetPwd) {
    await db.run(
      `UPDATE usuarios SET senha_hash = $1 WHERE login = 'admin'`,
      [hashPassword(resetPwd)]
    );
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function findByLogin(login: string) {
  const db = await getDb();
  return db.get<Usuario & { senha_hash: string }>(
    `SELECT id, nome, email, login, senha_hash, role, ativo FROM usuarios WHERE login = $1 AND ativo = 1`,
    [login]
  );
}

export async function findByEmail(email: string) {
  const db = await getDb();
  return db.get<Usuario & { senha_hash: string }>(
    `SELECT id, nome, email, login, senha_hash, role, ativo FROM usuarios WHERE LOWER(email) = LOWER($1) AND ativo = 1`,
    [email]
  );
}

export async function findByToken(token: string) {
  const db = await getDb();
  return db.get<Usuario & { reset_expiry: number }>(
    `SELECT id, nome, email, login, role, ativo, reset_expiry FROM usuarios WHERE reset_token = $1 AND ativo = 1`,
    [token]
  );
}

export async function findById(id: number) {
  const db = await getDb();
  return db.get<Usuario>(
    `SELECT id, nome, email, login, role, ativo FROM usuarios WHERE id = $1 AND ativo = 1`,
    [id]
  );
}

export async function listUsers(): Promise<Usuario[]> {
  const db = await getDb();
  return db.all<Usuario>(
    `SELECT id, nome, email, login, role, ativo, created_at,
            CASE WHEN senha_hash IS NOT NULL THEN 1 ELSE 0 END as tem_senha
     FROM usuarios ORDER BY ativo DESC, role DESC, nome ASC`
  );
}

export async function findByIdAdmin(id: number) {
  const db = await getDb();
  return db.get<Usuario & { tem_senha: number }>(
    `SELECT id, nome, email, login, role, ativo,
            CASE WHEN senha_hash IS NOT NULL THEN 1 ELSE 0 END as tem_senha
     FROM usuarios WHERE id = $1`,
    [id]
  );
}

export async function reactivateUser(id: number) {
  const db = await getDb();
  await db.run(`UPDATE usuarios SET ativo = 1 WHERE id = $1`, [id]);
}

export async function createUser(nome: string, email: string, login: string, role: 'admin' | 'viewer' | 'rh' | 'requisitante') {
  const db = await getDb();
  const row = await db.get<{ id: number }>(
    `INSERT INTO usuarios (nome, email, login, role) VALUES ($1, $2, $3, $4) RETURNING id`,
    [nome, email, login, role]
  );
  return row?.id ?? 0;
}

export async function setResetToken(id: number, token: string, expirySeconds: number) {
  const expiry = Math.floor(Date.now() / 1000) + expirySeconds;
  const db = await getDb();
  await db.run(
    `UPDATE usuarios SET reset_token = $1, reset_expiry = $2 WHERE id = $3`,
    [token, expiry, id]
  );
}

export async function setPassword(id: number, password: string) {
  const hash = hashPassword(password);
  const db = await getDb();
  await db.run(
    `UPDATE usuarios SET senha_hash = $1, reset_token = NULL, reset_expiry = NULL WHERE id = $2`,
    [hash, id]
  );
}

export async function deactivateUser(id: number) {
  const db = await getDb();
  await db.run(`UPDATE usuarios SET ativo = 0 WHERE id = $1`, [id]);
}

export async function deleteUser(id: number) {
  const db = await getDb();
  await db.run(`DELETE FROM usuarios WHERE id = $1`, [id]);
}
