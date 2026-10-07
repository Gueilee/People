import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { findById } from '@/lib/users';

const SESSION_TOKEN = process.env.SESSION_SECRET ?? 'vp-auth-ok-2025';

async function requireRH() {
  const cookieStore = await cookies();
  if (cookieStore.get('vp_session')?.value !== SESSION_TOKEN) return null;
  const uid = cookieStore.get('vp_uid')?.value;
  if (!uid) return null;
  const user = await findById(parseInt(uid));
  if (!user || (user.role !== 'admin' && user.role !== 'rh')) return null;
  return user;
}

async function ensureTables() {
  const db = await getDb();
  await db.run(`
    CREATE TABLE IF NOT EXISTS dho_iniciativas (
      id SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      tipo TEXT NOT NULL,
      descricao TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.run(`
    CREATE TABLE IF NOT EXISTS dho_atividades (
      id SERIAL PRIMARY KEY,
      iniciativa_id INTEGER REFERENCES dho_iniciativas(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      descricao TEXT,
      responsavel TEXT,
      prazo DATE,
      status TEXT DEFAULT 'planejamento',
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `);
}

export async function GET() {
  try {
    const db = await getDb();
    await ensureTables();
    const iniciativas = await db.all(`SELECT * FROM dho_iniciativas ORDER BY criado_em DESC`);
    const atividades = await db.all(`SELECT * FROM dho_atividades ORDER BY criado_em ASC`);
    return NextResponse.json({ iniciativas, atividades });
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await requireRH();
  if (!user) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 });
  }

  const db = await getDb();
  await ensureTables();
  const tipo = body.tipo as string;

  if (tipo === 'iniciativa') {
    const titulo = body.titulo as string;
    const tipo_iniciativa = body.tipo_iniciativa as string;
    const descricao = (body.descricao as string) || null;
    if (!titulo?.trim() || !tipo_iniciativa) {
      return NextResponse.json({ erro: 'Título e tipo são obrigatórios' }, { status: 400 });
    }
    const row = await db.get(
      `INSERT INTO dho_iniciativas (titulo, tipo, descricao) VALUES ($1, $2, $3) RETURNING id`,
      [titulo.trim(), tipo_iniciativa, descricao]
    );
    return NextResponse.json({ ok: true, id: row.id });
  }

  if (tipo === 'atividade') {
    const iniciativa_id = body.iniciativa_id as number;
    const titulo = body.titulo as string;
    const descricao = (body.descricao as string) || null;
    const responsavel = (body.responsavel as string) || null;
    const prazo = (body.prazo as string) || null;
    if (!titulo?.trim() || !iniciativa_id) {
      return NextResponse.json({ erro: 'Título e iniciativa são obrigatórios' }, { status: 400 });
    }
    const row = await db.get(
      `INSERT INTO dho_atividades (iniciativa_id, titulo, descricao, responsavel, prazo)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [iniciativa_id, titulo.trim(), descricao, responsavel, prazo]
    );
    return NextResponse.json({ ok: true, id: row.id });
  }

  return NextResponse.json({ erro: 'tipo inválido' }, { status: 400 });
}
