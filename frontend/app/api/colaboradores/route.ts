import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

export async function GET() {
  try {
    const dbPath = path.resolve(process.cwd(), '../database/vendemmia_people.db');
    const db = await open({ filename: dbPath, driver: sqlite3.Database });
    const colaboradores = await db.all('SELECT * FROM colaboradores');
    await db.close();
    return NextResponse.json(colaboradores);
  } catch (error) {
    return NextResponse.json({ error: 'Erro no banco' }, { status: 500 });
  }
}
