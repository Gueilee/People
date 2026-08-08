import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { findById } from '@/lib/users';
import XLSX from 'xlsx';

const SESSION_TOKEN = process.env.SESSION_SECRET ?? 'vp-auth-ok-2025';

async function requireRH() {
  const cookieStore = await cookies();
  if (cookieStore.get('vp_session')?.value !== SESSION_TOKEN) return null;
  const uid = cookieStore.get('vp_uid')?.value;
  if (!uid) return null;
  const user = await findById(parseInt(uid, 10));
  if (!user || (user.role !== 'admin' && user.role !== 'rh')) return null;
  return user;
}

function parseExcelTime(val: unknown): number {
  if (val === '' || val == null) return 0;
  if (typeof val === 'string') {
    const str = val.trim();
    if (!str) return 0;
    const parts = str.split(':');
    if (parts.length === 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) return Math.max(0, h * 60 + m);
    }
    return 0;
  }
  if (typeof val === 'number') {
    // Excel stores duration as fraction of a day
    return Math.round(Math.max(0, val * 24 * 60));
  }
  return 0;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const competencia = searchParams.get('competencia');

  const db = await getDb();

  const compRows = await db.all<{ competencia: string }>(
    `SELECT DISTINCT TO_CHAR(competencia, 'YYYY-MM-DD') as competencia
     FROM motoristas_horas ORDER BY competencia DESC`
  );
  const competencias = compRows.map(r => r.competencia);

  if (!competencia) {
    return NextResponse.json({ competencias, rows: [] });
  }

  const rows = await db.all(
    `SELECT nome,
       TO_CHAR(competencia, 'YYYY-MM-DD') as competencia,
       hora_normal_min, hora_normal_not_min,
       hora_extra_50_min, hora_extra_50_not_min,
       hora_extra_100_min, hora_extra_100_not_min,
       TO_CHAR(uploaded_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as uploaded_at,
       uploaded_by
     FROM motoristas_horas
     WHERE DATE_TRUNC('month', competencia) = DATE_TRUNC('month', $1::date)
     ORDER BY nome`,
    [competencia]
  );

  return NextResponse.json({ competencias, rows });
}

export async function POST(req: NextRequest) {
  const user = await requireRH();
  if (!user) return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const competencia = formData.get('competencia') as string | null;

  if (!file || !competencia) {
    return NextResponse.json({ erro: 'Arquivo e competência são obrigatórios' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

  const dataRows = rawRows.slice(1).filter(r => {
    const row = r as unknown[];
    return row[0] && String(row[0]).trim();
  });

  if (dataRows.length === 0) {
    return NextResponse.json({ erro: 'Nenhuma linha de dados encontrada no arquivo' }, { status: 400 });
  }

  const db = await getDb();
  const uploadedBy = (user as Record<string, unknown>).email
    ? String((user as Record<string, unknown>).email)
    : String((user as Record<string, unknown>).id);

  for (const row of dataRows) {
    const r = row as unknown[];
    const nome = String(r[0]).trim();
    await db.run(
      `INSERT INTO motoristas_horas
        (nome, competencia, hora_normal_min, hora_normal_not_min,
         hora_extra_50_min, hora_extra_50_not_min,
         hora_extra_100_min, hora_extra_100_not_min, uploaded_by)
       VALUES ($1, DATE_TRUNC('month', $2::date), $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (nome, competencia) DO UPDATE SET
         hora_normal_min     = EXCLUDED.hora_normal_min,
         hora_normal_not_min = EXCLUDED.hora_normal_not_min,
         hora_extra_50_min   = EXCLUDED.hora_extra_50_min,
         hora_extra_50_not_min = EXCLUDED.hora_extra_50_not_min,
         hora_extra_100_min  = EXCLUDED.hora_extra_100_min,
         hora_extra_100_not_min = EXCLUDED.hora_extra_100_not_min,
         uploaded_at = NOW(),
         uploaded_by = EXCLUDED.uploaded_by`,
      [
        nome, competencia,
        parseExcelTime(r[1]), parseExcelTime(r[2]),
        parseExcelTime(r[3]), parseExcelTime(r[4]),
        parseExcelTime(r[5]), parseExcelTime(r[6]),
        uploadedBy,
      ]
    );
  }

  return NextResponse.json({ ok: true, processados: dataRows.length });
}
