import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    const colaboradores = await db.all('SELECT * FROM colaboradores');
    await db.close();
    return NextResponse.json(colaboradores);
  } catch (error) {
    return NextResponse.json({ error: 'Erro no banco' }, { status: 500 });
  }
}
