import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Historico = {
  id: number;
  nome: string;
  cpf: string;
  vinculo: string;
  cargo: string;
  departamento: string;
  area: string;
  unidade: string;
  centro_custo: string;
  motivo: string;
  tipo_evento: string;
  data_inicio: string | null;
  data_fim: string | null;
  is_current: number;
  duracao_dias: number | null;
};

function subMonths(d: Date, m: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() - m);
  return r;
}

function fmtMes(d: Date) {
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

const LABEL_TIPO: Record<string, string> = {
  admissao:          'Admissão',
  promocao:          'Promoção / Enquadramento de Função',
  reajuste_merito:   'Mérito / Reajuste',
  reajuste_coletivo: 'Acordo Coletivo / Dissídio',
  reajuste_salarial: 'Enquadramento Salarial',
  reestruturacao:    'Reestruturação',
  outro:             'Outro',
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const meses = parseInt(searchParams.get('meses') || '12', 10);

    const db  = await getDb();
    const all: Historico[] = await db.all('SELECT * FROM historico_cargo_salario ORDER BY nome, data_inicio');
    await db.close();

    if (!all.length) {
      return NextResponse.json({ error: 'Tabela historico_cargo_salario vazia. Execute etl_historico.py.' }, { status: 404 });
    }

    const hoje  = new Date();
    const inicio = subMonths(hoje, meses);
    const inicioStr = inicio.toISOString().split('T')[0];

    // ── Partição por tipo ─────────────────────────────────────────────────────
    const promocoes    = all.filter(r => r.tipo_evento === 'promocao');
    const reajustes    = all.filter(r => ['reajuste_merito','reajuste_coletivo','reajuste_salarial'].includes(r.tipo_evento));
    const promPeriodo  = promocoes.filter(r => r.data_inicio && r.data_inicio >= inicioStr);
    const reajPeriodo  = reajustes.filter(r => r.data_inicio && r.data_inicio >= inicioStr);

    // ── KPIs ─────────────────────────────────────────────────────────────────
    // Tempo médio na função: duracao média de todos os registros com duracao_dias
    const comDuracao = all.filter(r => r.duracao_dias != null && r.duracao_dias > 0);
    const tempoMedioNaFuncaoDias = comDuracao.length
      ? Math.round(comDuracao.reduce((s, r) => s + r.duracao_dias!, 0) / comDuracao.length)
      : 0;

    // Tempo médio para promoção: para cada promoção, pegar duracao_dias do registro anterior do mesmo colaborador
    const byNome = new Map<string, Historico[]>();
    all.forEach(r => {
      const k = r.nome;
      if (!byNome.has(k)) byNome.set(k, []);
      byNome.get(k)!.push(r);
    });

    // Colaboradores com promoção
    const nomesComPromocao = new Set(promocoes.map(r => r.nome));
    const totalColabs = byNome.size;

    // Tempo até primeira promoção (dias desde admissão até 1ª promoção)
    const diasAtePromocao: number[] = [];
    byNome.forEach((registros) => {
      const sorted = registros.sort((a, b) => (a.data_inicio || '').localeCompare(b.data_inicio || ''));
      const admissao = sorted.find(r => r.tipo_evento === 'admissao');
      const primeiraPromo = sorted.find(r => r.tipo_evento === 'promocao');
      if (admissao?.data_inicio && primeiraPromo?.data_inicio) {
        const dias = (new Date(primeiraPromo.data_inicio).getTime() - new Date(admissao.data_inicio).getTime()) / 86400000;
        if (dias > 0) diasAtePromocao.push(Math.round(dias));
      }
    });
    const tempoMedioPromocaoDias = diasAtePromocao.length
      ? Math.round(diasAtePromocao.reduce((s, d) => s + d, 0) / diasAtePromocao.length)
      : 0;

    // ── Promoções por área ────────────────────────────────────────────────────
    const promArea: Record<string, number> = {};
    promPeriodo.forEach(r => { promArea[r.area || 'Não informado'] = (promArea[r.area || 'Não informado'] || 0) + 1; });
    const promocoesPorArea = Object.entries(promArea)
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count);

    // ── Promoções por unidade ─────────────────────────────────────────────────
    const promUnid: Record<string, number> = {};
    promPeriodo.forEach(r => { promUnid[r.unidade || 'Não informado'] = (promUnid[r.unidade || 'Não informado'] || 0) + 1; });
    const promocoesPorUnidade = Object.entries(promUnid)
      .map(([unidade, count]) => ({ unidade, count }))
      .sort((a, b) => b.count - a.count);

    // ── Tendência mensal ──────────────────────────────────────────────────────
    const tendenciaPromocoes = Array.from({ length: Math.min(meses, 24) }, (_, i) => {
      const mi = new Date(hoje.getFullYear(), hoje.getMonth() - (Math.min(meses, 24) - 1 - i), 1);
      const mf = new Date(hoje.getFullYear(), hoje.getMonth() - (Math.min(meses, 24) - 1 - i) + 1, 0);
      const miStr = mi.toISOString().split('T')[0];
      const mfStr = mf.toISOString().split('T')[0];
      const prom = promocoes.filter(r => r.data_inicio && r.data_inicio >= miStr && r.data_inicio <= mfStr).length;
      const reaj = reajustes.filter(r => r.data_inicio && r.data_inicio >= miStr && r.data_inicio <= mfStr).length;
      return { mes: fmtMes(mi), promocoes: prom, reajustes: reaj };
    });

    // ── Top promovidos ────────────────────────────────────────────────────────
    const promCount: Record<string, { count: number; area: string; unidade: string; cargo: string; ultima: string }> = {};
    promocoes.forEach(r => {
      if (!promCount[r.nome]) {
        promCount[r.nome] = { count: 0, area: r.area, unidade: r.unidade, cargo: r.cargo, ultima: r.data_inicio || '' };
      }
      promCount[r.nome].count++;
      if ((r.data_inicio || '') > promCount[r.nome].ultima) {
        promCount[r.nome].ultima = r.data_inicio || '';
        promCount[r.nome].cargo  = r.cargo;
        promCount[r.nome].area   = r.area;
        promCount[r.nome].unidade= r.unidade;
      }
    });
    const topPromovidos = Object.entries(promCount)
      .map(([nome, d]) => ({ nome, totalPromocoes: d.count, cargo: d.cargo, area: d.area, unidade: d.unidade, ultimaPromocao: d.ultima }))
      .sort((a, b) => b.totalPromocoes - a.totalPromocoes)
      .slice(0, 15);

    // ── Últimas promoções com cargo anterior ─────────────────────────────────
    const ultimasPromocoes: { nome: string; cargo_anterior: string; cargo_novo: string; area: string; unidade: string; data: string; motivo: string }[] = [];
    byNome.forEach((registros, nome) => {
      const sorted = registros.sort((a, b) => (a.data_inicio || '').localeCompare(b.data_inicio || ''));
      sorted.forEach((r, i) => {
        if (r.tipo_evento === 'promocao' && r.data_inicio && r.data_inicio >= inicioStr) {
          const anterior = sorted.slice(0, i).reverse().find(x => x.cargo !== r.cargo);
          ultimasPromocoes.push({
            nome,
            cargo_anterior: anterior?.cargo || '—',
            cargo_novo:     r.cargo,
            area:           r.area,
            unidade:        r.unidade,
            data:           r.data_inicio,
            motivo:         r.motivo,
          });
        }
      });
    });
    ultimasPromocoes.sort((a, b) => b.data.localeCompare(a.data));

    // ── Reajustes por tipo ────────────────────────────────────────────────────
    const reajTipo: Record<string, number> = {};
    reajPeriodo.forEach(r => { reajTipo[r.tipo_evento] = (reajTipo[r.tipo_evento] || 0) + 1; });
    const totalReaj = reajPeriodo.length;
    const reajustesPorTipo = Object.entries(reajTipo)
      .map(([tipo, count]) => ({
        tipo,
        label: LABEL_TIPO[tipo] || tipo,
        count,
        pct: totalReaj ? +((count / totalReaj) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // ── Reajustes por área ────────────────────────────────────────────────────
    const reajAreaMap: Record<string, { coletivo: number; merito: number; salarial: number }> = {};
    reajPeriodo.forEach(r => {
      const area = r.area || 'Não informado';
      if (!reajAreaMap[area]) reajAreaMap[area] = { coletivo: 0, merito: 0, salarial: 0 };
      if (r.tipo_evento === 'reajuste_coletivo') reajAreaMap[area].coletivo++;
      if (r.tipo_evento === 'reajuste_merito')   reajAreaMap[area].merito++;
      if (r.tipo_evento === 'reajuste_salarial') reajAreaMap[area].salarial++;
    });
    const reajustesPorArea = Object.entries(reajAreaMap)
      .map(([area, d]) => ({ area, ...d, total: d.coletivo + d.merito + d.salarial }))
      .sort((a, b) => b.total - a.total);

    // ── Distribuição tempo na função ──────────────────────────────────────────
    const faixasTempo = [
      { faixa: 'Até 3 meses',   min: 0,    max: 90   },
      { faixa: '3 a 6 meses',   min: 91,   max: 180  },
      { faixa: '6 a 12 meses',  min: 181,  max: 365  },
      { faixa: '1 a 2 anos',    min: 366,  max: 730  },
      { faixa: '2 a 4 anos',    min: 731,  max: 1460 },
      { faixa: 'Mais de 4 anos',min: 1461, max: 99999},
    ].map(f => ({
      faixa: f.faixa,
      count: comDuracao.filter(r => r.duracao_dias! >= f.min && r.duracao_dias! <= f.max).length,
    }));

    // ── Top colaboradores com mais reajustes de mérito ─────────────────────
    const meritoCt: Record<string, { count: number; area: string; unidade: string }> = {};
    reajustes.filter(r => r.tipo_evento === 'reajuste_merito').forEach(r => {
      if (!meritoCt[r.nome]) meritoCt[r.nome] = { count: 0, area: r.area, unidade: r.unidade };
      meritoCt[r.nome].count++;
    });
    const topMerito = Object.entries(meritoCt)
      .map(([nome, d]) => ({ nome, totalReajustes: d.count, area: d.area, unidade: d.unidade }))
      .sort((a, b) => b.totalReajustes - a.totalReajustes)
      .slice(0, 10);

    // ── Histórico individual (busca por nome) ─────────────────────────────────
    const nomeBusca = searchParams.get('nome');
    let historicoColaborador: Historico[] = [];
    if (nomeBusca) {
      const q = nomeBusca.toUpperCase();
      historicoColaborador = all.filter(r => r.nome.includes(q)).sort((a, b) => (a.data_inicio || '').localeCompare(b.data_inicio || ''));
    }

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json({
      periodo: meses,
      atualizadoEm: hoje.toISOString(),
      kpis: {
        totalPromocoes:            promPeriodo.length,
        totalReajustes:            reajPeriodo.length,
        tempoMedioPromocaoDias,
        tempoMedioNaFuncaoDias,
        colaboradoresComPromocao:  nomesComPromocao.size,
        taxaPromocao:              totalColabs ? +((nomesComPromocao.size / totalColabs) * 100).toFixed(1) : 0,
        totalColaboradores:        totalColabs,
      },
      promocoesPorArea,
      promocoesPorUnidade,
      tendenciaPromocoes,
      topPromovidos,
      ultimasPromocoes:            ultimasPromocoes.slice(0, 20),
      reajustesPorTipo,
      reajustesPorArea,
      tempoNaFuncaoFaixas:         faixasTempo,
      topMerito,
      historicoColaborador,
    });

  } catch (err) {
    console.error('[Carreira] Erro:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
