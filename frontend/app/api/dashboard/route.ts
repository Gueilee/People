import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Colab = {
  id_colaborador: string;
  nome: string;
  email: string;
  unidade: string;
  departamento: string;
  cargo: string;
  gestor: string;
  data_admissao: string;
  birth_date: string | null;
  gender: string | null;
  etnia: string | null;
  vinculo: string | null;
  data_desligamento: string | null;
  tipo_desligamento: string | null;
  tenure_days: number | null;
  status: string;
};

function subMonths(d: Date, m: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() - m);
  return r;
}

type RiscoColab = {
  nome: string; cargo: string; unidade: string; departamento: string;
  gestor: string; diasEmpresa: number; score: number; nivel: 'alto' | 'medio' | 'baixo';
  fatores: string[];
};

function calcRisco(
  ativos: Colab[],
  txUnid: Record<string, number>,
  txGest: Record<string, number>
): RiscoColab[] {
  const hoje = new Date();
  return ativos.map(c => {
    const fatores: string[] = [];
    const dias = c.data_admissao
      ? Math.floor((hoje.getTime() - new Date(c.data_admissao).getTime()) / 86400000)
      : 9999;

    // ── Tempo de empresa: 0–40 pts (contínuo, decai com o tempo)
    // Fórmula: 40 * max(0, 1 - dias/540)  →  dia 0 = 40, dia 180 = 27, dia 365 = 13, dia 540+ = 0
    const tempoPts = Math.round(Math.max(0, 40 * (1 - dias / 540)));
    if (dias < 90)        fatores.push('Recém admitido (<3m)');
    else if (dias < 180)  fatores.push('Menos de 6 meses');
    else if (dias < 365)  fatores.push('Menos de 1 ano');

    // ── Turnover da unidade: 0–35 pts proporcional à taxa
    const tu = txUnid[c.unidade] || 0;
    const unidPts = Math.round(Math.min(35, tu * 0.53));   // 66% → 35, 20% → 11
    if (tu > 5) fatores.push(`Unidade ${tu.toFixed(0)}% turn.`);

    // ── Turnover do gestor: 0–20 pts proporcional
    const tg = txGest[c.gestor] || 0;
    const gestPts = Math.round(Math.min(20, tg * 0.4));    // 50% → 20, 15% → 6
    if (tg > 10) fatores.push(tg > 30 ? 'Gestor alto turnover' : 'Gestor médio turnover');

    // ── Vínculo: 0–5 pts
    const vin = (c.vinculo || '').toLowerCase();
    let vinPts = 0;
    if      (vin.includes('estag') || vin.includes('aprendiz'))    { vinPts = 5; fatores.push('Vínculo estágio'); }
    else if (vin.includes('tercei') || vin.includes('pj'))         { vinPts = 3; fatores.push('Vínculo flexível'); }

    const score = Math.min(100, tempoPts + unidPts + gestPts + vinPts);
    const nivel: RiscoColab['nivel'] = score >= 60 ? 'alto' : score >= 30 ? 'medio' : 'baixo';
    return { nome: c.nome, cargo: c.cargo, unidade: c.unidade, departamento: c.departamento,
             gestor: c.gestor, diasEmpresa: dias, score, nivel, fatores };
  }).sort((a, b) => b.score - a.score);
}

function idade(birthDate: string | null, ref: Date): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  return Math.floor((ref.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

function bucket<T>(items: T[], fn: (i: T) => string, keys: string[]): Record<string, number> {
  const r: Record<string, number> = Object.fromEntries(keys.map(k => [k, 0]));
  items.forEach(i => { const k = fn(i); if (k in r) r[k]++; });
  return r;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const meses          = parseInt(searchParams.get('meses') || '12', 10);
    const filtroUnidades = (searchParams.get('unidade') || '').split(',').filter(Boolean);
    const filtroAreas    = (searchParams.get('area')    || '').split(',').filter(Boolean);
    const filtroGestores = (searchParams.get('gestor')  || '').split(',').filter(Boolean);
    const filtroMeses    = (searchParams.get('mes')     || '').split(',').filter(Boolean);

    const db = await getDb();

    // Opções de filtro (sempre do total)
    const todosAll: Colab[] = await db.all('SELECT * FROM colaboradores');
    const unidadesOpcoes = [...new Set(todosAll.map(c => c.unidade))].filter(Boolean).sort();
    const areasOpcoes    = [...new Set(todosAll.map(c => c.departamento))].filter(Boolean).sort();
    const gestoresOpcoes = [...new Set(
      todosAll.filter(c => c.gestor && c.gestor !== 'Nao informado').map(c => c.gestor)
    )].sort();

    // Meses disponíveis derivados dos dados (adm + desl)
    const todasDatas = [
      ...todosAll.map(c => c.data_admissao),
      ...todosAll.filter(c => c.data_desligamento).map(c => c.data_desligamento!),
    ];
    const mesesDisponiveis = [...new Set(
      todasDatas.filter(Boolean).map(d => d.substring(0, 7))
    )].sort().reverse();

    // Dataset com filtros aplicados (suporta múltipla seleção via IN)
    const whereParts: string[] = [];
    const whereParams: string[] = [];
    if (filtroUnidades.length) {
      whereParts.push(`unidade IN (${filtroUnidades.map(() => '?').join(',')})`);
      whereParams.push(...filtroUnidades);
    }
    if (filtroAreas.length) {
      whereParts.push(`departamento IN (${filtroAreas.map(() => '?').join(',')})`);
      whereParams.push(...filtroAreas);
    }
    if (filtroGestores.length) {
      whereParts.push(`gestor IN (${filtroGestores.map(() => '?').join(',')})`);
      whereParams.push(...filtroGestores);
    }
    const whereSQL = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const todos: Colab[] = await db.all(`SELECT * FROM colaboradores ${whereSQL}`, whereParams);

    await db.close();

    const hoje     = new Date();
    const anoAtual = hoje.getFullYear();

    const ativos    = todos.filter(c => !c.data_desligamento);
    const todosDesl = todos.filter(c => !!c.data_desligamento);

    // Período: meses específicos (múltiplos) OU janela deslizante
    let deslPeriodo: Colab[];
    let admPeriodo: Colab[];
    let inicioRef: Date | null = null;

    if (filtroMeses.length > 0) {
      const mesesSet = new Set(filtroMeses);
      deslPeriodo = todosDesl.filter(c => mesesSet.has(c.data_desligamento!.substring(0, 7)));
      admPeriodo  = todos.filter(c => mesesSet.has(c.data_admissao.substring(0, 7)));
    } else {
      inicioRef = subMonths(hoje, meses);
      deslPeriodo = todosDesl.filter(c => {
        const d = new Date(c.data_desligamento!);
        return d >= inicioRef! && d <= hoje;
      });
      admPeriodo = todos.filter(c => {
        const d = new Date(c.data_admissao);
        return d >= inicioRef! && d <= hoje;
      });
    }

    // Headcount no início do período selecionado (responde ao 3m/6m/12m)
    const ativosNoPeriodo = inicioRef
      ? todos.filter(c => {
          const adm  = new Date(c.data_admissao);
          const desl = c.data_desligamento ? new Date(c.data_desligamento) : null;
          return adm <= inicioRef! && (desl === null || desl > inicioRef!);
        })
      : ativos;

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const hMedia      = Math.max((ativos.length + deslPeriodo.length) / 2, 1);
    const turnoverRate = (((deslPeriodo.length + admPeriodo.length) / 2) / hMedia) * 100;

    const tempoMedioAtivos = ativos.length > 0
      ? ativos.reduce((s, c) => s + (hoje.getTime() - new Date(c.data_admissao).getTime()) / (30.44 * 86400000), 0) / ativos.length
      : 0;

    // ── Turnover por Unidade ─────────────────────────────────────────────────
    const unidades = [...new Set(todos.map(c => c.unidade))].filter(Boolean);
    const turnoverPorUnidade = unidades.map(u => {
      const desl = deslPeriodo.filter(c => c.unidade === u).length;
      const ativ = ativos.filter(c => c.unidade === u).length;
      const taxa = (desl / Math.max((ativ + desl) / 2, 1)) * 100;
      return { unidade: u, total: todos.filter(c => c.unidade === u).length, ativos: ativ, desligados: desl, taxa: +taxa.toFixed(1) };
    }).sort((a, b) => b.taxa - a.taxa);

    // ── Turnover por Área ────────────────────────────────────────────────────
    const departamentos = [...new Set(todos.map(c => c.departamento))].filter(Boolean);
    const turnoverPorArea = departamentos.map(dep => {
      const desl = deslPeriodo.filter(c => c.departamento === dep).length;
      const ativ = ativos.filter(c => c.departamento === dep).length;
      const taxa = (desl / Math.max((ativ + desl) / 2, 1)) * 100;
      return { departamento: dep, ativos: ativ, desligados: desl, taxa: +taxa.toFixed(1) };
    }).sort((a, b) => b.taxa - a.taxa);

    // ── Ranking Gestores ─────────────────────────────────────────────────────
    const gestoresList = [...new Set(
      todos.filter(c => c.gestor && c.gestor !== 'Nao informado').map(c => c.gestor)
    )];
    const rankingGestores = gestoresList.map(g => {
      const equipe = todos.filter(c => c.gestor === g);
      const desl   = deslPeriodo.filter(c => c.gestor === g).length;
      const ativ   = ativos.filter(c => c.gestor === g).length;
      const taxa   = (desl / Math.max((ativ + desl) / 2, 1)) * 100;
      return { gestor: g, totalEquipe: equipe.length, ativos: ativ, desligados: desl,
               unidade: equipe[0]?.unidade || '', departamento: equipe[0]?.departamento || '',
               taxa: +taxa.toFixed(1) };
    }).filter(g => g.desligados > 0).sort((a, b) => b.desligados - a.desligados).slice(0, 20);

    // ── Tipos de Desligamento ────────────────────────────────────────────────
    const tiposCounts: Record<string, number> = {};
    deslPeriodo.forEach(c => {
      const t = c.tipo_desligamento || 'Nao informado';
      tiposCounts[t] = (tiposCounts[t] || 0) + 1;
    });
    const tiposDesligamento = Object.entries(tiposCounts)
      .map(([tipo, count]) => ({ tipo, count, pct: +((count / Math.max(deslPeriodo.length, 1)) * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);

    // ── Tendência Mensal ─────────────────────────────────────────────────────
    const tendenciaMensal = Array.from({ length: 12 }, (_, i) => {
      const mi = new Date(hoje.getFullYear(), hoje.getMonth() - (11 - i), 1);
      const mf = new Date(hoje.getFullYear(), hoje.getMonth() - (11 - i) + 1, 0);
      const label = mi.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const adm  = todos.filter(c => { const d = new Date(c.data_admissao); return d >= mi && d <= mf; }).length;
      const desl = todos.filter(c => { if (!c.data_desligamento) return false; const d = new Date(c.data_desligamento); return d >= mi && d <= mf; }).length;
      return { mes: label, admissoes: adm, desligamentos: desl };
    });

    // ── Headcount por Unidade ────────────────────────────────────────────────
    const headcountPorUnidade = unidades.map(u => ({
      unidade: u,
      ativos:     ativos.filter(c => c.unidade === u).length,
      desligados: todosDesl.filter(c => c.unidade === u).length,
    })).sort((a, b) => b.ativos - a.ativos);

    // ── Últimos Desligamentos ────────────────────────────────────────────────
    const ultimosDesligamentos = todosDesl
      .sort((a, b) => new Date(b.data_desligamento!).getTime() - new Date(a.data_desligamento!).getTime())
      .slice(0, 15)
      .map(c => ({ nome: c.nome, cargo: c.cargo, departamento: c.departamento, unidade: c.unidade,
                   gestor: c.gestor, data_desligamento: c.data_desligamento,
                   tipo_desligamento: c.tipo_desligamento || 'Nao informado', tenure_days: c.tenure_days }));

    // ════════════════════════════════════════════════════════════════════════
    //  NOVOS INDICADORES
    // ════════════════════════════════════════════════════════════════════════

    // ── Tenure (tempo de permanência) dos desligados ─────────────────────────
    const deslComTenure  = todosDesl.filter(c => c.tenure_days != null && c.tenure_days >= 0);
    const tenureMedioDias = deslComTenure.length
      ? deslComTenure.reduce((s, c) => s + c.tenure_days!, 0) / deslComTenure.length
      : 0;

    // Distribuição de tenure em faixas
    const tenureFaixas = [
      { faixa: 'Ate 1 mes',    min: 0,   max: 30  },
      { faixa: '1 a 3 meses',  min: 31,  max: 90  },
      { faixa: '3 a 6 meses',  min: 91,  max: 180 },
      { faixa: '6 a 12 meses', min: 181, max: 365 },
      { faixa: '1 a 2 anos',   min: 366, max: 730 },
      { faixa: 'Mais de 2 anos',min: 731, max: 99999 },
    ].map(f => ({
      faixa: f.faixa,
      count: deslComTenure.filter(c => c.tenure_days! >= f.min && c.tenure_days! <= f.max).length,
    }));

    // Tenure por tipo de desligamento
    const tenurePorTipo = Object.entries(
      deslComTenure.reduce<Record<string, number[]>>((acc, c) => {
        const t = c.tipo_desligamento || 'Nao informado';
        if (!acc[t]) acc[t] = [];
        acc[t].push(c.tenure_days!);
        return acc;
      }, {})
    ).map(([tipo, dias]) => ({
      tipo,
      mediaDias: Math.round(dias.reduce((s, d) => s + d, 0) / dias.length),
      count: dias.length,
    })).sort((a, b) => b.count - a.count).slice(0, 6);

    // ── Mortalidade Infantil ─────────────────────────────────────────────────
    const mortalidadeInfantil = (() => {
      const base     = deslPeriodo.filter(c => c.tenure_days != null);
      const ate3m    = base.filter(c => c.tenure_days! <= 90).length;
      const de3a6m   = base.filter(c => c.tenure_days! > 90 && c.tenure_days! <= 180).length;
      const total    = base.length;
      // Por unidade
      const porUnidade = unidades.map(u => {
        const b  = deslPeriodo.filter(c => c.unidade === u && c.tenure_days != null);
        return { unidade: u, ate3m: b.filter(c => c.tenure_days! <= 90).length, total: b.length };
      }).filter(u => u.total > 0).sort((a, b) => b.ate3m - a.ate3m);
      return { ate3m, de3a6m, ate6m: ate3m + de3a6m, total,
               pctAte3m: total ? +((ate3m / total) * 100).toFixed(1) : 0,
               pctAte6m: total ? +((ate3m + de3a6m) / total * 100).toFixed(1) : 0,
               porUnidade };
    })();

    // ── Headcount por Cargo (Top 20) ─────────────────────────────────────────
    const cargosCount: Record<string, number> = {};
    ativos.forEach(c => { const cargo = c.cargo || 'Nao informado'; cargosCount[cargo] = (cargosCount[cargo] || 0) + 1; });
    const headcountPorCargo = Object.entries(cargosCount)
      .map(([cargo, count]) => ({ cargo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // ── Span of Control ──────────────────────────────────────────────────────
    const gestoresAtivos = [...new Set(
      ativos.filter(c => c.gestor && c.gestor !== 'Nao informado').map(c => c.gestor)
    )];
    const spanDistrib = gestoresAtivos.map(g => ativos.filter(c => c.gestor === g).length);
    const spanMedio   = spanDistrib.length ? spanDistrib.reduce((s, n) => s + n, 0) / spanDistrib.length : 0;
    const spanBuckets = {
      'ate3':  spanDistrib.filter(n => n <= 3).length,
      'de4a7': spanDistrib.filter(n => n >= 4 && n <= 7).length,
      'de8a15':spanDistrib.filter(n => n >= 8 && n <= 15).length,
      'acima15':spanDistrib.filter(n => n > 15).length,
    };

    // ── Gênero ───────────────────────────────────────────────────────────────
    const ativosComGenero = ativos.filter(c => c.gender === 'M' || c.gender === 'F');
    const genM = ativos.filter(c => c.gender === 'M').length;
    const genF = ativos.filter(c => c.gender === 'F').length;
    const genND= ativos.filter(c => !c.gender || (c.gender !== 'M' && c.gender !== 'F')).length;

    // Gênero por liderança (gestores)
    const liderancaIds = new Set(rankingGestores.map(g => g.gestor));
    const lideres = ativos.filter(c => liderancaIds.has(c.nome) || liderancaIds.has(c.gestor));
    const generoLideranca = {
      M: ativos.filter(c => gestoresAtivos.includes(c.nome) && c.gender === 'M').length,
      F: ativos.filter(c => gestoresAtivos.includes(c.nome) && c.gender === 'F').length,
    };

    // Gênero por unidade
    const generoPorUnidade = unidades.map(u => {
      const g = ativos.filter(c => c.unidade === u);
      return { unidade: u, M: g.filter(c => c.gender === 'M').length, F: g.filter(c => c.gender === 'F').length };
    }).filter(u => u.M + u.F > 0).sort((a, b) => (b.M + b.F) - (a.M + a.F));

    const distribuicaoGenero = {
      geral: { M: genM, F: genF, ND: genND, total: ativos.length },
      pctF: ativos.length ? +((genF / ativos.length) * 100).toFixed(1) : 0,
      porUnidade: generoPorUnidade,
    };

    // ── Etnia / Raça ─────────────────────────────────────────────────────────
    const etniasCount: Record<string, number> = {};
    ativos.filter(c => c.etnia).forEach(c => { etniasCount[c.etnia!] = (etniasCount[c.etnia!] || 0) + 1; });
    const distribuicaoEtnia = Object.entries(etniasCount)
      .map(([etnia, count]) => ({ etnia, count, pct: +((count / ativos.length) * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);

    const naoBrancas = ['Parda','Preta','Amarela','Indigena'];
    const pctNaoBranca = ativos.length
      ? +((ativos.filter(c => naoBrancas.includes(c.etnia || '')).length / ativos.length) * 100).toFixed(1)
      : 0;

    // ── Pirâmide Etária / Gerações ───────────────────────────────────────────
    const ativosComIdade = ativos.filter(c => c.birth_date);
    const idadeFaixas = [
      { faixa: 'Ate 25 anos',    min: 0,  max: 25 },
      { faixa: '26 a 35 anos',   min: 26, max: 35 },
      { faixa: '36 a 45 anos',   min: 36, max: 45 },
      { faixa: '46 a 55 anos',   min: 46, max: 55 },
      { faixa: 'Acima de 55',    min: 56, max: 999 },
    ].map(f => ({
      faixa: f.faixa,
      M: ativosComIdade.filter(c => { const a = idade(c.birth_date, hoje); return a !== null && a >= f.min && a <= f.max && c.gender === 'M'; }).length,
      F: ativosComIdade.filter(c => { const a = idade(c.birth_date, hoje); return a !== null && a >= f.min && a <= f.max && c.gender === 'F'; }).length,
      total: ativosComIdade.filter(c => { const a = idade(c.birth_date, hoje); return a !== null && a >= f.min && a <= f.max; }).length,
    }));

    // Gerações (por ano de nascimento, ref 2026)
    const geracoes = [
      { nome: 'Gen Z (1997-2012)',       minAno: 2026-29, maxAno: 2026-14 },
      { nome: 'Millennials (1981-1996)', minAno: 2026-45, maxAno: 2026-30 },
      { nome: 'Gen X (1965-1980)',       minAno: 2026-61, maxAno: 2026-46 },
      { nome: 'Baby Boomers (1946-1964)',minAno: 2026-80, maxAno: 2026-62 },
    ].map(g => ({
      geracao: g.nome,
      count: ativosComIdade.filter(c => {
        const a = idade(c.birth_date, hoje);
        return a !== null && a >= (2026 - g.maxAno) && a <= (2026 - g.minAno);
      }).length,
    }));

    const idadeMedia = ativosComIdade.length
      ? +(ativosComIdade.reduce((s, c) => s + (idade(c.birth_date, hoje) || 0), 0) / ativosComIdade.length).toFixed(1)
      : 0;

    // ── Vínculo Empregatício ─────────────────────────────────────────────────
    const vinculoCount: Record<string, number> = {};
    ativos.forEach(c => { const v = c.vinculo || 'CLT'; vinculoCount[v] = (vinculoCount[v] || 0) + 1; });
    const distribuicaoVinculo = Object.entries(vinculoCount)
      .map(([vinculo, count]) => ({ vinculo, count, pct: +((count / ativos.length) * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);

    // ── Risco de Turnover por Colaborador ────────────────────────────────────
    const txUnidMap: Record<string, number> = {};
    turnoverPorUnidade.forEach(u => { txUnidMap[u.unidade] = u.taxa; });
    const txGestMap: Record<string, number> = {};
    rankingGestores.forEach(g => { txGestMap[g.gestor] = g.taxa; });
    // Calcular também sobre todosAll se filtro ativo (contexto completo)
    const ativosRisco = (filtroUnidades.length > 0 || filtroAreas.length > 0)
      ? todosAll.filter(c => !c.data_desligamento)
      : ativos;

    const riscoLista = calcRisco(ativosRisco, txUnidMap, txGestMap);
    const riscoTurnover = {
      alto:  riscoLista.filter(r => r.nivel === 'alto').length,
      medio: riscoLista.filter(r => r.nivel === 'medio').length,
      baixo: riscoLista.filter(r => r.nivel === 'baixo').length,
      top20: riscoLista.slice(0, 20),
    };

    // ── Response ─────────────────────────────────────────────────────────────
    return NextResponse.json({
      periodo: meses,
      atualizadoEm: hoje.toISOString(),
      filtros: { unidades: filtroUnidades, areas: filtroAreas, gestores: filtroGestores, meses: filtroMeses },
      opcoesFiltro: { unidades: unidadesOpcoes, areas: areasOpcoes, gestores: gestoresOpcoes, meses: mesesDisponiveis },

      // Indicadores existentes
      kpis: {
        headcountTotal: todos.length,
        headcountAtivo: ativosNoPeriodo.length,
        headcountHoje:  ativos.length,
        desligamentosPeriodo: deslPeriodo.length,
        admissoesPeriodo: admPeriodo.length,
        turnoverRate: +turnoverRate.toFixed(1),
        tempoMedioMeses: Math.round(tempoMedioAtivos),
      },
      turnoverPorUnidade,
      turnoverPorArea,
      rankingGestores,
      tiposDesligamento,
      tendenciaMensal,
      headcountPorUnidade,
      ultimosDesligamentos,

      // Risco de turnover
      riscoTurnover,

      // Novos indicadores
      tenure: {
        mediaDias: Math.round(tenureMedioDias),
        mediaMeses: +(tenureMedioDias / 30.44).toFixed(1),
        faixas: tenureFaixas,
        porTipo: tenurePorTipo,
      },
      mortalidadeInfantil,
      estrutura: {
        totalGestores: gestoresAtivos.length,
        spanMedio: +spanMedio.toFixed(1),
        spanBuckets,
        headcountPorCargo,
      },
      diversidade: {
        genero: distribuicaoGenero,
        etnia: {
          distribuicao: distribuicaoEtnia,
          pctNaoBranca,
          totalComInfo: Object.values(etniasCount).reduce((s, n) => s + n, 0),
        },
        idade: {
          media: idadeMedia,
          faixas: idadeFaixas,
          geracoes,
          totalComInfo: ativosComIdade.length,
        },
        vinculo: distribuicaoVinculo,
      },
    });

  } catch (err) {
    console.error('[Dashboard] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
