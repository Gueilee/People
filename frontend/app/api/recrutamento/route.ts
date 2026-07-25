import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Vaga = {
  id: number;
  responsavel: string | null;
  data_abertura: string | null;
  data_fechamento: string | null;
  sla_dias: number | null;
  sla_meta_dias: number | null;
  cargo: string | null;
  novo_colaborador: string | null;
  status: string | null;
  motivo: string | null;
  tipo_substituicao: string | null;
  colaborador_substituido: string | null;
  centro_custo: string | null;
  unidade: string | null;
  gestor: string | null;
  data_inicio: string | null;
  fonte: string | null;
  observacoes: string | null;
  quantidade_vagas: number | null;
  faixa_salarial: string | null;
  modelo_contratacao: string | null;
  num_convocados: number | null;
  num_compareceu: number | null;
  criado_em: string | null;
};

function detectarSLAMeta(cargo: string): number {
  const c = (cargo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/\bgerente\b|\btrader\b/.test(c))                                           return 90;
  if (/\bespecialista\b|\bcoordenador\b/.test(c))                                 return 60;
  if (/\banalista\b|\bengenheiro\b|\bdesenvolvedor\b|\bdeveloper\b|\bsdr\b/.test(c)) return 30;
  if (/empilhadeira/.test(c))                                                     return 25;
  if (/\bmotorista\b|\bauxiliar\b|\bconferente\b/.test(c))                        return 20;
  if (/estagiario|jovem\s*aprendiz|\bassistente\b/.test(c))                       return 15;
  return 30;
}

let _tableReady = false;
async function ensureTable(db: Awaited<ReturnType<typeof getDb>>) {
  if (_tableReady) return;
  await db.run(`
    CREATE TABLE IF NOT EXISTS vagas_recrutamento (
      id                      SERIAL PRIMARY KEY,
      responsavel             TEXT,
      data_abertura           DATE,
      data_fechamento         DATE,
      sla_dias                INTEGER,
      cargo                   TEXT,
      novo_colaborador        TEXT,
      status                  TEXT DEFAULT 'Aberta',
      motivo                  TEXT,
      tipo_substituicao       TEXT,
      colaborador_substituido TEXT,
      centro_custo            TEXT,
      unidade                 TEXT,
      gestor                  TEXT,
      data_inicio             DATE,
      fonte                   TEXT,
      observacoes             TEXT,
      quantidade_vagas        INTEGER DEFAULT 1,
      faixa_salarial          TEXT,
      modelo_contratacao      TEXT,
      criado_em               TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.run(`ALTER TABLE vagas_recrutamento ADD COLUMN IF NOT EXISTS quantidade_vagas    INTEGER DEFAULT 1`);
  await db.run(`ALTER TABLE vagas_recrutamento ADD COLUMN IF NOT EXISTS faixa_salarial     TEXT`);
  await db.run(`ALTER TABLE vagas_recrutamento ADD COLUMN IF NOT EXISTS modelo_contratacao TEXT`);
  await db.run(`ALTER TABLE vagas_recrutamento ADD COLUMN IF NOT EXISTS num_convocados     INTEGER`);
  await db.run(`ALTER TABLE vagas_recrutamento ADD COLUMN IF NOT EXISTS num_compareceu     INTEGER`);
  await db.run(`ALTER TABLE vagas_recrutamento ADD COLUMN IF NOT EXISTS sla_meta_dias      INTEGER`);
  _tableReady = true;
}

function fmtMes(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function calcSla(abertura: string | null, fechamento: string | null): number | null {
  if (!abertura || !fechamento) return null;
  const ms = new Date(fechamento).getTime() - new Date(abertura).getTime();
  const dias = Math.round(ms / 86400000);
  return dias > 0 ? dias : null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filtroStatus    = (searchParams.get('status')     || '').split(',').filter(Boolean).map(s => s.trim());
    const filtroUnidade   = searchParams.get('unidade')     || '';
    const filtroResponsavel = searchParams.get('responsavel') || '';
    const filtroMeses     = parseInt(searchParams.get('meses') || '12', 10);
    const busca           = (searchParams.get('busca') || '').toLowerCase();

    const db   = await getDb();
    await ensureTable(db);
    const all: Vaga[] = await db.all('SELECT * FROM vagas_recrutamento ORDER BY data_abertura DESC');

    const hoje = new Date();
    const inicioStr = new Date(hoje.getFullYear(), hoje.getMonth() - filtroMeses, 1).toISOString().split('T')[0];

    let lista = all;
    if (filtroStatus.length > 0) lista = lista.filter(v => filtroStatus.includes(v.status || ''));
    if (filtroUnidade)   lista = lista.filter(v => v.unidade === filtroUnidade);
    if (filtroResponsavel) lista = lista.filter(v => v.responsavel === filtroResponsavel);
    if (busca) lista = lista.filter(v =>
      [v.cargo, v.novo_colaborador, v.gestor, v.colaborador_substituido, v.observacoes]
        .some(f => (f || '').toLowerCase().includes(busca))
    );

    const periodo = all.filter(v => !v.data_abertura || v.data_abertura >= inicioStr);

    const abertas    = all.filter(v => v.status === 'Aberta').length;
    const congeladas = all.filter(v => v.status === 'Congelada').length;
    const fechadasP  = periodo.filter(v => v.status === 'Fechada').length;
    const canceladas = all.filter(v => v.status === 'Cancelada').length;
    const fechadasSla = periodo.filter(v => v.status === 'Fechada' && v.sla_dias && v.sla_dias > 0);
    const slaMedia   = fechadasSla.length
      ? Math.round(fechadasSla.reduce((s, v) => s + (v.sla_dias || 0), 0) / fechadasSla.length)
      : 0;
    const totalP     = periodo.length;
    const taxaFechamento = totalP > 0 ? +((fechadasP / totalP) * 100).toFixed(1) : 0;

    const statusCt: Record<string, number> = {};
    all.forEach(v => { const s = v.status || 'Sem status'; statusCt[s] = (statusCt[s] || 0) + 1; });
    const porStatus = Object.entries(statusCt).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);

    const unidCt: Record<string, { total: number; abertas: number; fechadas: number }> = {};
    periodo.forEach(v => {
      const u = v.unidade || 'Não informado';
      if (!unidCt[u]) unidCt[u] = { total: 0, abertas: 0, fechadas: 0 };
      unidCt[u].total++;
      if (v.status === 'Aberta')  unidCt[u].abertas++;
      if (v.status === 'Fechada') unidCt[u].fechadas++;
    });
    const porUnidade = Object.entries(unidCt)
      .map(([unidade, d]) => ({ unidade, ...d }))
      .sort((a, b) => b.total - a.total);

    const fonteCt: Record<string, number> = {};
    periodo.filter(v => v.status === 'Fechada').forEach(v => {
      const f = v.fonte || 'Não informado';
      fonteCt[f] = (fonteCt[f] || 0) + 1;
    });
    const porFonte = Object.entries(fonteCt)
      .map(([fonte, count]) => ({ fonte, count }))
      .sort((a, b) => b.count - a.count);

    const motivoCt: Record<string, number> = {};
    periodo.forEach(v => { const m = v.motivo || 'Não informado'; motivoCt[m] = (motivoCt[m] || 0) + 1; });
    const porMotivo = Object.entries(motivoCt)
      .map(([motivo, count]) => ({ motivo, count }))
      .sort((a, b) => b.count - a.count);

    const slaPorMes = Array.from({ length: Math.min(filtroMeses, 12) }, (_, i) => {
      const mi = new Date(hoje.getFullYear(), hoje.getMonth() - (Math.min(filtroMeses, 12) - 1 - i), 1);
      const mf = new Date(hoje.getFullYear(), hoje.getMonth() - (Math.min(filtroMeses, 12) - 1 - i) + 1, 0);
      const miStr = mi.toISOString().split('T')[0];
      const mfStr = mf.toISOString().split('T')[0];
      const fechadasMes = all.filter(v =>
        v.status === 'Fechada' && v.data_fechamento &&
        v.data_fechamento >= miStr && v.data_fechamento <= mfStr &&
        v.sla_dias && v.sla_dias > 0
      );
      const sla = fechadasMes.length
        ? Math.round(fechadasMes.reduce((s, v) => s + (v.sla_dias || 0), 0) / fechadasMes.length)
        : null;
      return { mes: fmtMes(mi.toISOString()), slaMedia: sla, count: fechadasMes.length };
    });

    const opcoes = {
      responsaveis: [...new Set(all.map(v => v.responsavel).filter(Boolean))].sort() as string[],
      unidades:     [...new Set(all.map(v => v.unidade).filter(Boolean))].sort() as string[],
      centrosCusto: [...new Set(all.map(v => v.centro_custo).filter(Boolean))].sort() as string[],
      gestores:     [...new Set(all.map(v => v.gestor).filter(Boolean))].sort() as string[],
      fontes:       [...new Set(all.map(v => v.fonte).filter(Boolean))].sort() as string[],
    };

    // ── SLA Performance ────────────────────────────────────────────────────────
    const fechadasComSLA = all.filter(v => v.status === 'Fechada' && v.sla_dias != null && v.sla_meta_dias != null);
    const dentroPrazo    = fechadasComSLA.filter(v => (v.sla_dias ?? 0) <= (v.sla_meta_dias ?? 0));
    const eficienciaSLA  = fechadasComSLA.length > 0
      ? Math.round((dentroPrazo.length / fechadasComSLA.length) * 100)
      : null;
    const hojeMs = new Date().getTime();
    const abertasAtrasadas = all.filter(v => {
      if (v.status !== 'Aberta' || !v.data_abertura || !v.sla_meta_dias) return false;
      const diasDecorridos = Math.round((hojeMs - new Date(v.data_abertura).getTime()) / 86400000);
      return diasDecorridos > v.sla_meta_dias;
    }).length;

    return NextResponse.json({
      vagas: lista,
      kpis: { total: all.length, totalPeriodo: totalP, abertas, congeladas, fechadasPeriodo: fechadasP, canceladas, slaMedia, taxaFechamento },
      porStatus,
      porUnidade,
      porFonte,
      porMotivo,
      slaPorMes,
      opcoes,
      slaPerf: { eficienciaSLA, abertasAtrasadas, totalFechadas: fechadasComSLA.length, dentroPrazo: dentroPrazo.length },
    });
  } catch (err) {
    console.error('[Recrutamento] GET erro:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      responsavel, data_abertura, data_fechamento, cargo, novo_colaborador,
      status, motivo, tipo_substituicao, colaborador_substituido,
      centro_custo, unidade, gestor, data_inicio, fonte, observacoes,
      quantidade_vagas, faixa_salarial, modelo_contratacao,
      num_convocados, num_compareceu,
    } = body;

    const sla = calcSla(data_abertura, data_fechamento);
    const db  = await getDb();
    await ensureTable(db);

    const sla_meta_dias = detectarSLAMeta(cargo || '');
    const row = await db.get<{ id: number }>(
      `INSERT INTO vagas_recrutamento
        (responsavel, data_abertura, data_fechamento, sla_dias, cargo, novo_colaborador,
         status, motivo, tipo_substituicao, colaborador_substituido,
         centro_custo, unidade, gestor, data_inicio, fonte, observacoes,
         quantidade_vagas, faixa_salarial, modelo_contratacao,
         num_convocados, num_compareceu, sla_meta_dias)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING id`,
      [responsavel||null, data_abertura||null, data_fechamento||null, sla,
       cargo||null, novo_colaborador||null, status||'Aberta', motivo||null,
       tipo_substituicao||null, colaborador_substituido||null,
       centro_custo||null, unidade||null, gestor||null,
       data_inicio||null, fonte||null, observacoes||null,
       quantidade_vagas ? parseInt(quantidade_vagas) : 1,
       faixa_salarial||null, modelo_contratacao||null,
       num_convocados ? parseInt(num_convocados) : null,
       num_compareceu ? parseInt(num_compareceu) : null,
       sla_meta_dias]
    );

    return NextResponse.json({ ok: true, id: row?.id ?? 0 }, { status: 201 });
  } catch (err) {
    console.error('[Recrutamento] POST erro:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, data_fechamento, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

    const db = await getDb();
    await ensureTable(db);
    const existing = await db.get<Vaga>('SELECT * FROM vagas_recrutamento WHERE id = $1', [id]);
    if (!existing) return NextResponse.json({ error: 'Vaga não encontrada' }, { status: 404 });

    const merged = { ...existing, ...fields };
    const fechamento = data_fechamento !== undefined ? data_fechamento : existing.data_fechamento;
    const sla = calcSla(merged.data_abertura, fechamento);

    const sla_meta_dias = detectarSLAMeta(merged.cargo || '');
    await db.run(
      `UPDATE vagas_recrutamento SET
        responsavel=$1, data_abertura=$2, data_fechamento=$3, sla_dias=$4, cargo=$5, novo_colaborador=$6,
        status=$7, motivo=$8, tipo_substituicao=$9, colaborador_substituido=$10,
        centro_custo=$11, unidade=$12, gestor=$13, data_inicio=$14, fonte=$15, observacoes=$16,
        quantidade_vagas=$17, faixa_salarial=$18, modelo_contratacao=$19,
        num_convocados=$20, num_compareceu=$21, sla_meta_dias=$22
       WHERE id=$23`,
      [merged.responsavel, merged.data_abertura, fechamento, sla,
       merged.cargo, merged.novo_colaborador, merged.status, merged.motivo,
       merged.tipo_substituicao, merged.colaborador_substituido,
       merged.centro_custo, merged.unidade, merged.gestor,
       merged.data_inicio, merged.fonte, merged.observacoes,
       merged.quantidade_vagas ?? 1, merged.faixa_salarial, merged.modelo_contratacao,
       merged.num_convocados ?? null, merged.num_compareceu ?? null,
       sla_meta_dias, id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Recrutamento] PATCH erro:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
