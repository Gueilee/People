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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRH();
  if (!user) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });

  const { id } = await params;
  const url = new URL(req.url);
  const entidade = url.searchParams.get('entidade') ?? 'atividade';

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 });
  }

  const db = await getDb();

  if (entidade === 'iniciativa') {
    const titulo = body.titulo as string | undefined;
    const tipo = body.tipo_iniciativa as string | undefined;
    const descricao = body.descricao as string | undefined;
    await db.run(
      `UPDATE dho_iniciativas
       SET titulo = COALESCE($1, titulo),
           tipo = COALESCE($2, tipo),
           descricao = COALESCE($3, descricao)
       WHERE id = $4`,
      [titulo ?? null, tipo ?? null, descricao ?? null, parseInt(id)]
    );
    return NextResponse.json({ ok: true });
  }

  // atividade
  if ('titulo' in body) {
    // full update from edit modal
    const titulo = body.titulo as string;
    const descricao = (body.descricao as string) || null;
    const responsavel = (body.responsavel as string) || null;
    const prazo = (body.prazo as string) || null;
    const status = body.status as string;
    const iniciativa_id = body.iniciativa_id as number;
    await db.run(
      `UPDATE dho_atividades
       SET titulo = $1, descricao = $2, responsavel = $3, prazo = $4,
           status = $5, iniciativa_id = $6, atualizado_em = NOW()
       WHERE id = $7`,
      [titulo, descricao, responsavel, prazo, status, iniciativa_id, parseInt(id)]
    );
  } else if ('status' in body) {
    // status-only update from kanban drag
    await db.run(
      `UPDATE dho_atividades SET status = $1, atualizado_em = NOW() WHERE id = $2`,
      [body.status as string, parseInt(id)]
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRH();
  if (!user) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });

  const { id } = await params;
  const url = new URL(req.url);
  const entidade = url.searchParams.get('entidade') ?? 'atividade';

  const db = await getDb();

  if (entidade === 'iniciativa') {
    await db.run(`DELETE FROM dho_iniciativas WHERE id = $1`, [parseInt(id)]);
  } else {
    await db.run(`DELETE FROM dho_atividades WHERE id = $1`, [parseInt(id)]);
  }

  return NextResponse.json({ ok: true });
}
