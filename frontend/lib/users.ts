import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import { getDb } from './db';

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  login: string;
  role: 'admin' | 'viewer';
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
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nome            TEXT NOT NULL,
    email           TEXT,
    login           TEXT NOT NULL UNIQUE,
    senha_hash      TEXT,
    role            TEXT NOT NULL DEFAULT 'viewer',
    ativo           INTEGER NOT NULL DEFAULT 1,
    reset_token     TEXT,
    reset_expiry    INTEGER,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  // Cria admin padrão se tabela vazia
  const count = await db.get<{ n: number }>('SELECT COUNT(*) as n FROM usuarios');
  if (!count || count.n === 0) {
    await db.run(
      `INSERT INTO usuarios (nome, email, login, senha_hash, role) VALUES (?, ?, ?, ?, ?)`,
      ['Administrador', 'admin@vendemmia.com.br', 'admin', hashPassword('vendemmia@2025'), 'admin']
    );
  }
  // Migração: garante email no admin (banco criado antes desta versão)
  await db.run(
    `UPDATE usuarios SET email = 'admin@vendemmia.com.br' WHERE login = 'admin' AND email IS NULL`
  );
  db.save();
  await db.close();
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function findByLogin(login: string) {
  const db = await getDb();
  const u = await db.get<Usuario & { senha_hash: string }>(
    `SELECT id, nome, email, login, senha_hash, role, ativo FROM usuarios WHERE login = ? AND ativo = 1`,
    [login]
  );
  await db.close();
  return u;
}

export async function findByEmail(email: string) {
  const db = await getDb();
  const u = await db.get<Usuario & { senha_hash: string }>(
    `SELECT id, nome, email, login, senha_hash, role, ativo FROM usuarios WHERE LOWER(email) = LOWER(?) AND ativo = 1`,
    [email]
  );
  await db.close();
  return u;
}

export async function findByToken(token: string) {
  const db = await getDb();
  const u = await db.get<Usuario & { reset_expiry: number }>(
    `SELECT id, nome, email, login, role, ativo, reset_expiry FROM usuarios WHERE reset_token = ? AND ativo = 1`,
    [token]
  );
  await db.close();
  return u;
}

export async function findById(id: number) {
  const db = await getDb();
  const u = await db.get<Usuario>(
    `SELECT id, nome, email, login, role, ativo FROM usuarios WHERE id = ? AND ativo = 1`,
    [id]
  );
  await db.close();
  return u;
}

export async function listUsers(): Promise<Usuario[]> {
  const db = await getDb();
  const rows = await db.all<Usuario>(
    `SELECT id, nome, email, login, role, ativo, created_at,
            CASE WHEN senha_hash IS NOT NULL THEN 1 ELSE 0 END as tem_senha
     FROM usuarios ORDER BY ativo DESC, role DESC, nome ASC`
  );
  await db.close();
  return rows;
}

export async function findByIdAdmin(id: number) {
  const db = await getDb();
  const u = await db.get<Usuario & { tem_senha: number }>(
    `SELECT id, nome, email, login, role, ativo,
            CASE WHEN senha_hash IS NOT NULL THEN 1 ELSE 0 END as tem_senha
     FROM usuarios WHERE id = ?`,
    [id]
  );
  await db.close();
  return u;
}

export async function reactivateUser(id: number) {
  const db = await getDb();
  await db.run(`UPDATE usuarios SET ativo = 1 WHERE id = ?`, [id]);
  db.save();
  await db.close();
}

export async function createUser(nome: string, email: string, login: string, role: 'admin' | 'viewer') {
  const db = await getDb();
  await db.run(
    `INSERT INTO usuarios (nome, email, login, role) VALUES (?, ?, ?, ?)`,
    [nome, email, login, role]
  );
  const id = await db.lastId();
  db.save();
  await db.close();
  return id;
}

export async function setResetToken(id: number, token: string, expirySeconds: number) {
  const expiry = Math.floor(Date.now() / 1000) + expirySeconds;
  const db = await getDb();
  await db.run(
    `UPDATE usuarios SET reset_token = ?, reset_expiry = ? WHERE id = ?`,
    [token, expiry, id]
  );
  db.save();
  await db.close();
}

export async function setPassword(id: number, password: string) {
  const hash = hashPassword(password);
  const db = await getDb();
  await db.run(
    `UPDATE usuarios SET senha_hash = ?, reset_token = NULL, reset_expiry = NULL WHERE id = ?`,
    [hash, id]
  );
  db.save();
  await db.close();
}

export async function deleteUser(id: number) {
  const db = await getDb();
  await db.run(`UPDATE usuarios SET ativo = 0 WHERE id = ?`, [id]);
  db.save();
  await db.close();
}
