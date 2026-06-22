import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Vaga = {
  id: number;
  responsavel: string | null;
  data_abertura: string | null;
  data_fechamento: string | null;
  sla_dias: number | null;
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
  criado_em: string | null;
};

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
    const all: Vaga[] = await db.all('SELECT * FROM vagas_recrutamento ORDER BY data_abertura DESC');
    await db.close();

    const hoje = new Date();
    const inicioStr = new Date(hoje.getFullYear(), hoje.getMonth() - filtroMeses, 1).toISOString().split('T')[0];

    // Aplicar filtros
    let lista = all;
    if (filtroStatus.length > 0) lista = lista.filter(v => filtroStatus.includes(v.status || ''));
    if (filtroUnidade)   lista = lista.filter(v => v.unidade === filtroUnidade);
    if (filtroResponsavel) lista = lista.filter(v => v.responsavel === filtroResponsavel);
    if (busca) lista = lista.filter(v =>
      [v.cargo, v.novo_colaborador, v.gestor, v.colaborador_substituido, v.observacoes]
        .some(f => (f || '').toLowerCase().includes(busca))
    );

    // Para KPIs e charts usar apenas o período (sem filtros de status/unidade)
    const periodo = all.filter(v => !v.data_abertura || v.data_abertura >= inicioStr);

    // KPIs
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

    // Por status (tudo)
    const statusCt: Record<string, number> = {};
    all.forEach(v => { const s = v.status || 'Sem status'; statusCt[s] = (statusCt[s] || 0) + 1; });
    const porStatus = Object.entries(statusCt).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);

    // Por unidade (período)
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

    // Por fonte (período, só fechadas)
    const fonteCt: Record<string, number> = {};
    periodo.filter(v => v.status === 'Fechada').forEach(v => {
      const f = v.fonte || 'Não informado';
      fonteCt[f] = (fonteCt[f] || 0) + 1;
    });
    const porFonte = Object.entries(fonteCt)
      .map(([fonte, count]) => ({ fonte, count }))
      .sort((a, b) => b.count - a.count);

    // Por motivo (período)
    const motivoCt: Record<string, number> = {};
    periodo.forEach(v => { const m = v.motivo || 'Não informado'; motivoCt[m] = (motivoCt[m] || 0) + 1; });
    const porMotivo = Object.entries(motivoCt)
      .map(([motivo, count]) => ({ motivo, count }))
      .sort((a, b) => b.count - a.count);

    // SLA por mês (últimos 12m, só fechadas)
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

    // Opções para filtros/select
    const opcoes = {
      responsaveis: [...new Set(all.map(v => v.responsavel).filter(Boolean))].sort() as string[],
      unidades:     [...new Set(all.map(v => v.unidade).filter(Boolean))].sort() as string[],
      centrosCusto: [...new Set(all.map(v => v.centro_custo).filter(Boolean))].sort() as string[],
      gestores:     [...new Set(all.map(v => v.gestor).filter(Boolean))].sort() as string[],
      fontes:       [...new Set(all.map(v => v.fonte).filter(Boolean))].sort() as string[],
    };

    return NextResponse.json({
      vagas: lista,
      kpis: { total: all.length, totalPeriodo: totalP, abertas, congeladas, fechadasPeriodo: fechadasP, canceladas, slaMedia, taxaFechamento },
      porStatus,
      porUnidade,
      porFonte,
      porMotivo,
      slaPorMes,
      opcoes,
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
    } = body;

    const sla = calcSla(data_abertura, data_fechamento);
    const db  = await getDb();

    await db.run(
      `INSERT INTO vagas_recrutamento
        (responsavel, data_abertura, data_fechamento, sla_dias, cargo, novo_colaborador,
         status, motivo, tipo_substituicao, colaborador_substituido,
         centro_custo, unidade, gestor, data_inicio, fonte, observacoes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [responsavel||null, data_abertura||null, data_fechamento||null, sla,
       cargo||null, novo_colaborador||null, status||'Aberta', motivo||null,
       tipo_substituicao||null, colaborador_substituido||null,
       centro_custo||null, unidade||null, gestor||null,
       data_inicio||null, fonte||null, observacoes||null]
    );

    const id = await db.lastId();
    db.save();
    await db.close();

    return NextResponse.json({ ok: true, id }, { status: 201 });
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
    const existing = await db.get<Vaga>('SELECT * FROM vagas_recrutamento WHERE id = ?', [id]);
    if (!existing) { await db.close(); return NextResponse.json({ error: 'Vaga não encontrada' }, { status: 404 }); }

    const merged = { ...existing, ...fields };
    const fechamento = data_fechamento !== undefined ? data_fechamento : existing.data_fechamento;
    const sla = calcSla(merged.data_abertura, fechamento);

    await db.run(
      `UPDATE vagas_recrutamento SET
        responsavel=?, data_abertura=?, data_fechamento=?, sla_dias=?, cargo=?, novo_colaborador=?,
        status=?, motivo=?, tipo_substituicao=?, colaborador_substituido=?,
        centro_custo=?, unidade=?, gestor=?, data_inicio=?, fonte=?, observacoes=?
       WHERE id=?`,
      [merged.responsavel, merged.data_abertura, fechamento, sla,
       merged.cargo, merged.novo_colaborador, merged.status, merged.motivo,
       merged.tipo_substituicao, merged.colaborador_substituido,
       merged.centro_custo, merged.unidade, merged.gestor,
       merged.data_inicio, merged.fonte, merged.observacoes, id]
    );

    db.save();
    await db.close();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Recrutamento] PATCH erro:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
