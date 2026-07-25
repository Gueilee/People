import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    if (q.length < 2) return NextResponse.json([]);

    const db = await getDb();
    const rows = await db.all<{ nome: string; email: string | null; cargo: string | null; unidade: string | null }>(
      `SELECT nome, email, cargo, unidade
       FROM colaboradores
       WHERE status = 'Ativo'
         AND nome ILIKE $1
       ORDER BY nome
       LIMIT 8`,
      [`%${q}%`]
    );

    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json([], { status: 500 });
  }
}
