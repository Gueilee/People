import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

type Colaborador = {
  id_colaborador: string;
  nome: string;
  email: string;
  unidade: string;
  departamento: string;
  cargo: string;
  gestor: string;
  data_admissao: string;
  data_desligamento: string | null;
  tipo_desligamento: string | null;
  status: string;
};

async function getDb() {
  const dbPath = path.resolve(process.cwd(), '../database/vendemmia_people.db');
  return open({ filename: dbPath, driver: sqlite3.Database });
}

function subMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

function isInLast12Months(dateStr: string | null, ref: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= subMonths(ref, 12) && d <= ref;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const meses = parseInt(searchParams.get('meses') || '12', 10);

    const db = await getDb();
    const todos: Colaborador[] = await db.all('SELECT * FROM colaboradores');
    await db.close();

    const hoje = new Date();
    const periodoInicio = subMonths(hoje, meses);

    // Ativos: sem data de desligamento
    const ativos = todos.filter(c => !c.data_desligamento);

    // Desligados no período selecionado
    const desligadosPeriodo = todos.filter(c => {
      if (!c.data_desligamento) return false;
      const d = new Date(c.data_desligamento);
      return d >= periodoInicio && d <= hoje;
    });

    // Admitidos no período
    const admitidosPeriodo = todos.filter(c => {
      const d = new Date(c.data_admissao);
      return d >= periodoInicio && d <= hoje;
    });

    // Taxa de turnover: ((deslig + admit) / 2) / headcount médio × 100
    const headcountMedio = Math.max((ativos.length + desligadosPeriodo.length) / 2, 1);
    const turnoverRate = (((desligadosPeriodo.length + admitidosPeriodo.length) / 2) / headcountMedio) * 100;

    // ─── Turnover por Unidade ───────────────────────────────────────
    const unidades = [...new Set(todos.map(c => c.unidade))].filter(Boolean);
    const turnoverPorUnidade = unidades.map(unidade => {
      const membros = todos.filter(c => c.unidade === unidade);
      const desligUnidade = desligadosPeriodo.filter(c => c.unidade === unidade).length;
      const ativosUnidade = ativos.filter(c => c.unidade === unidade).length;
      const hMedia = Math.max((ativosUnidade + desligUnidade) / 2, 1);
      const taxa = (desligUnidade / hMedia) * 100;
      return { unidade, total: membros.length, ativos: ativosUnidade, desligados: desligUnidade, taxa: parseFloat(taxa.toFixed(1)) };
    }).sort((a, b) => b.taxa - a.taxa);

    // ─── Turnover por Área ──────────────────────────────────────────
    const departamentos = [...new Set(todos.map(c => c.departamento))].filter(Boolean);
    const turnoverPorArea = departamentos.map(dep => {
      const desligDep = desligadosPeriodo.filter(c => c.departamento === dep).length;
      const ativosDep = ativos.filter(c => c.departamento === dep).length;
      const hMedia = Math.max((ativosDep + desligDep) / 2, 1);
      const taxa = (desligDep / hMedia) * 100;
      return { departamento: dep, ativos: ativosDep, desligados: desligDep, taxa: parseFloat(taxa.toFixed(1)) };
    }).sort((a, b) => b.taxa - a.taxa);

    // ─── Ranking de Gestores ────────────────────────────────────────
    const gestoresList = [...new Set(
      todos.filter(c => c.gestor && c.gestor !== 'Não informado').map(c => c.gestor)
    )];
    const rankingGestores = gestoresList.map(gestor => {
      const equipe = todos.filter(c => c.gestor === gestor);
      const desligGestor = desligadosPeriodo.filter(c => c.gestor === gestor).length;
      const ativosGestor = ativos.filter(c => c.gestor === gestor).length;
      const hMedia = Math.max((ativosGestor + desligGestor) / 2, 1);
      const taxa = (desligGestor / hMedia) * 100;
      return {
        gestor,
        totalEquipe: equipe.length,
        ativos: ativosGestor,
        desligados: desligGestor,
        unidade: equipe[0]?.unidade || '',
        departamento: equipe[0]?.departamento || '',
        taxa: parseFloat(taxa.toFixed(1)),
      };
    })
      .filter(g => g.desligados > 0)
      .sort((a, b) => b.desligados - a.desligados)
      .slice(0, 10);

    // ─── Tipos de Desligamento ──────────────────────────────────────
    const tiposCounts: Record<string, number> = {};
    desligadosPeriodo.forEach(c => {
      const tipo = c.tipo_desligamento || 'Não informado';
      tiposCounts[tipo] = (tiposCounts[tipo] || 0) + 1;
    });
    const tiposDesligamento = Object.entries(tiposCounts)
      .map(([tipo, count]) => ({ tipo, count, pct: parseFloat(((count / Math.max(desligadosPeriodo.length, 1)) * 100).toFixed(1)) }))
      .sort((a, b) => b.count - a.count);

    // ─── Tendência Mensal (últimos 12 meses fixo) ───────────────────
    const tendenciaMensal = Array.from({ length: 12 }, (_, i) => {
      const mesInicio = new Date(hoje.getFullYear(), hoje.getMonth() - (11 - i), 1);
      const mesFim    = new Date(hoje.getFullYear(), hoje.getMonth() - (11 - i) + 1, 0);
      const label = mesInicio.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const admissoes = todos.filter(c => {
        const d = new Date(c.data_admissao);
        return d >= mesInicio && d <= mesFim;
      }).length;
      const desligamentos = todos.filter(c => {
        if (!c.data_desligamento) return false;
        const d = new Date(c.data_desligamento);
        return d >= mesInicio && d <= mesFim;
      }).length;
      return { mes: label, admissoes, desligamentos };
    });

    // ─── Headcount por Unidade ──────────────────────────────────────
    const headcountPorUnidade = unidades.map(unidade => ({
      unidade,
      ativos: ativos.filter(c => c.unidade === unidade).length,
      desligados: todos.filter(c => c.unidade === unidade && c.data_desligamento).length,
    })).sort((a, b) => b.ativos - a.ativos);

    // ─── Últimos Desligamentos ──────────────────────────────────────
    const ultimosDesligamentos = todos
      .filter(c => c.data_desligamento)
      .sort((a, b) => new Date(b.data_desligamento!).getTime() - new Date(a.data_desligamento!).getTime())
      .slice(0, 15)
      .map(c => ({
        nome: c.nome,
        cargo: c.cargo,
        departamento: c.departamento,
        unidade: c.unidade,
        gestor: c.gestor,
        data_desligamento: c.data_desligamento,
        tipo_desligamento: c.tipo_desligamento || 'Não informado',
      }));

    // ─── Tempo médio de casa (ativos) ───────────────────────────────
    const tempoMedioMeses = ativos.length > 0
      ? ativos.reduce((acc, c) => {
          const adm = new Date(c.data_admissao);
          const mesesCasa = (hoje.getTime() - adm.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
          return acc + mesesCasa;
        }, 0) / ativos.length
      : 0;

    return NextResponse.json({
      periodo: meses,
      atualizadoEm: hoje.toISOString(),
      kpis: {
        headcountTotal: todos.length,
        headcountAtivo: ativos.length,
        desligamentosPeriodo: desligadosPeriodo.length,
        admissoesPeriodo: admitidosPeriodo.length,
        turnoverRate: parseFloat(turnoverRate.toFixed(1)),
        tempoMedioMeses: parseFloat(tempoMedioMeses.toFixed(0)),
      },
      turnoverPorUnidade,
      turnoverPorArea,
      rankingGestores,
      tiposDesligamento,
      tendenciaMensal,
      headcountPorUnidade,
      ultimosDesligamentos,
    });

  } catch (error) {
    console.error('[Dashboard API] Erro:', error);
    return NextResponse.json({ error: 'Erro interno ao calcular indicadores' }, { status: 500 });
  }
}
