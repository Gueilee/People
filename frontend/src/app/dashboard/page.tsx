'use client';
import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type KPIs = {
  headcountTotal: number;
  headcountAtivo: number;
  desligamentosPeriodo: number;
  admissoesPeriodo: number;
  turnoverRate: number;
  tempoMedioMeses: number;
};

type TurnoverUnidade = { unidade: string; total: number; ativos: number; desligados: number; taxa: number };
type TurnoverArea    = { departamento: string; ativos: number; desligados: number; taxa: number };
type Gestor         = { gestor: string; totalEquipe: number; ativos: number; desligados: number; unidade: string; departamento: string; taxa: number };
type TipoDesl       = { tipo: string; count: number; pct: number };
type Tendencia      = { mes: string; admissoes: number; desligamentos: number };
type HcUnidade      = { unidade: string; ativos: number; desligados: number };
type UltDesl        = { nome: string; cargo: string; departamento: string; unidade: string; gestor: string; data_desligamento: string; tipo_desligamento: string };

type DashData = {
  periodo: number;
  atualizadoEm: string;
  kpis: KPIs;
  turnoverPorUnidade: TurnoverUnidade[];
  turnoverPorArea: TurnoverArea[];
  rankingGestores: Gestor[];
  tiposDesligamento: TipoDesl[];
  tendenciaMensal: Tendencia[];
  headcountPorUnidade: HcUnidade[];
  ultimosDesligamentos: UltDesl[];
};

// ─── Cores do sistema ─────────────────────────────────────────────────────────
const C = {
  purple: '#422c76',
  pink:   '#ff2f69',
  green:  '#01E18E',
  dark:   '#414042',
  white:  '#faf9f5',
  amber:  '#F59E0B',
  blue:   '#3B82F6',
  gray:   '#6B7280',
};

const TIPO_CORES: Record<string, string> = {
  'Pedido de demissão':        C.amber,
  'Demissão sem justa causa':  C.pink,
  'Acordo mútuo':              C.blue,
  'Demissão com justa causa':  '#DC2626',
  'Término de contrato':       '#8B5CF6',
};

function taxaColor(taxa: number): string {
  if (taxa < 5)  return C.green;
  if (taxa < 15) return C.amber;
  return C.pink;
}

// ─── Componentes de gráfico ────────────────────────────────────────────────────

function BarHorizontal({ label, value, max, color, suffix = '%', subLabel }: {
  label: string; value: number; max: number; color: string; suffix?: string; subLabel?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="text-right shrink-0" style={{ width: 100 }}>
        <span className="text-xs font-semibold text-gray-700 leading-tight">{label}</span>
        {subLabel && <div className="text-[10px] text-gray-400">{subLabel}</div>}
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-bold shrink-0" style={{ color, width: 42 }}>
        {value}{suffix}
      </span>
    </div>
  );
}

function LineChart({ data }: { data: Tendencia[] }) {
  const W = 560, H = 140, padL = 8, padR = 8, padT = 12, padB = 24;
  const n = data.length;
  const maxVal = Math.max(...data.flatMap(d => [d.admissoes, d.desligamentos]), 1);

  const getX = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const getY = (v: number) => padT + (1 - v / maxVal) * (H - padT - padB);

  const pointsAdm  = data.map((d, i) => `${getX(i)},${getY(d.admissoes)}`).join(' ');
  const pointsDesl = data.map((d, i) => `${getX(i)},${getY(d.desligamentos)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <polyline points={pointsAdm}  fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={pointsDesl} fill="none" stroke={C.pink}  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={getX(i)} cy={getY(d.admissoes)}  r="3.5" fill={C.green} />
          <circle cx={getX(i)} cy={getY(d.desligamentos)} r="3.5" fill={C.pink} />
          {i % 2 === 0 && (
            <text x={getX(i)} y={H - 4} textAnchor="middle" fontSize="8" fill={C.gray}>{d.mes}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

function DonutChart({ data, total }: { data: TipoDesl[]; total: number }) {
  const r = 52, cx = 70, cy = 70, stroke = 22;
  const circum = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={140} height={140} viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
        {data.map((d, i) => {
          const dash = (d.count / Math.max(total, 1)) * circum;
          const gap  = circum - dash;
          const seg  = (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={TIPO_CORES[d.tipo] || C.gray}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset + circum / 4}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return seg;
        })}
        <text x={cx} y={cy - 6}  textAnchor="middle" fontSize="20" fontWeight="900" fill={C.dark}>{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9"  fill={C.gray}>desligamentos</text>
      </svg>
      <ul className="space-y-2 flex-1">
        {data.map(d => (
          <li key={d.tipo} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: TIPO_CORES[d.tipo] || C.gray }} />
            <span className="text-xs text-gray-600 leading-tight">{d.tipo}</span>
            <span className="ml-auto text-xs font-bold" style={{ color: TIPO_CORES[d.tipo] || C.gray }}>{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Skeleton loading ─────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

// ─── Formatações ──────────────────────────────────────────────────────────────
function fmtData(str: string | null) {
  if (!str) return '—';
  const [y, m, d] = str.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function fmtMeses(m: number) {
  if (m < 12) return `${m} meses`;
  const anos = Math.floor(m / 12);
  const resto = m % 12;
  return resto > 0 ? `${anos}a ${resto}m` : `${anos} anos`;
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function DashboardRH() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [periodo, setPeriodo] = useState(12);

  const carregar = useCallback((meses: number) => {
    setLoading(true);
    fetch(`/api/dashboard?meses=${meses}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(d => { setData(d); setErro(''); })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { carregar(periodo); }, [periodo, carregar]);

  const kpis = data?.kpis;
  const atualizado = data?.atualizadoEm
    ? new Date(data.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: C.white }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b-4" style={{ borderColor: C.purple }}>
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black tracking-tight" style={{ color: C.purple }}>
              VENDEMMIA <span style={{ color: C.pink }}>PEOPLE</span>
            </h1>
            <span className="text-xs font-semibold px-3 py-1 rounded-full text-white" style={{ backgroundColor: C.dark }}>
              DASHBOARD RH
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-500">Período de análise:</span>
            {[3, 6, 12].map(m => (
              <button
                key={m}
                onClick={() => setPeriodo(m)}
                className="text-xs font-bold px-3 py-1 rounded-full border-2 transition-all"
                style={{
                  borderColor: periodo === m ? C.purple : '#D1D5DB',
                  backgroundColor: periodo === m ? C.purple : 'transparent',
                  color: periodo === m ? 'white' : C.gray,
                }}
              >
                {m} meses
              </button>
            ))}
            {atualizado && (
              <span className="text-[10px] text-gray-400">Atualizado: {atualizado}</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            Erro ao carregar dados: {erro}. Verifique se o servidor está rodando e o banco foi populado.
          </div>
        )}

        {/* ── KPI Cards ── */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Headcount Ativo',      value: kpis?.headcountAtivo,       color: C.purple, icon: '👥', suffix: '' },
            { label: 'Headcount Total',       value: kpis?.headcountTotal,       color: C.dark,   icon: '🏢', suffix: '' },
            { label: `Desligamentos (${periodo}m)`, value: kpis?.desligamentosPeriodo, color: C.pink,   icon: '📉', suffix: '' },
            { label: `Admissões (${periodo}m)`,     value: kpis?.admissoesPeriodo,     color: C.green,  icon: '📈', suffix: '' },
            { label: 'Taxa de Turnover',      value: kpis?.turnoverRate,         color: C.amber,  icon: '🔄', suffix: '%' },
            { label: 'Tempo Médio de Casa',   value: kpis ? fmtMeses(kpis.tempoMedioMeses) : null, color: C.blue, icon: '📅', suffix: '', raw: true },
          ].map(({ label, value, color, icon, suffix, raw }) => (
            <div key={label} className="bg-white rounded-2xl shadow-sm p-4 border-t-4 flex flex-col" style={{ borderColor: color }}>
              <div className="text-xl mb-1">{icon}</div>
              <div className="text-[10px] font-bold uppercase text-gray-400 mb-1 leading-tight">{label}</div>
              {loading
                ? <Skeleton className="h-9 w-16 mt-1" />
                : <div className="text-3xl font-black mt-auto" style={{ color }}>
                    {raw ? value : `${value ?? '—'}${suffix}`}
                  </div>
              }
            </div>
          ))}
        </section>

        {/* ── Tendência + Donut ── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Tendência Mensal */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-sm uppercase" style={{ color: C.dark }}>Tendência Mensal (12m)</h2>
              <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-1 rounded inline-block" style={{ backgroundColor: C.green }} /> Admissões</span>
                <span className="flex items-center gap-1"><span className="w-3 h-1 rounded inline-block" style={{ backgroundColor: C.pink }} /> Desligamentos</span>
              </div>
            </div>
            {loading
              ? <Skeleton className="h-36 w-full" />
              : data?.tendenciaMensal.length
                ? <LineChart data={data.tendenciaMensal} />
                : <p className="text-xs text-gray-400 text-center pt-8">Sem dados</p>
            }
          </div>

          {/* Tipos de Desligamento */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>Tipos de Desligamento ({periodo}m)</h2>
            {loading
              ? <Skeleton className="h-36 w-full" />
              : data?.tiposDesligamento.length
                ? <DonutChart data={data.tiposDesligamento} total={kpis?.desligamentosPeriodo ?? 0} />
                : <p className="text-xs text-gray-400 text-center pt-8">Sem desligamentos no período</p>
            }
          </div>
        </section>

        {/* ── Turnover por Unidade + Headcount ── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>Turnover por Unidade ({periodo}m)</h2>
            {loading
              ? <Skeleton className="h-48 w-full" />
              : (() => {
                  const maxT = Math.max(...(data?.turnoverPorUnidade.map(d => d.taxa) ?? [1]));
                  return data?.turnoverPorUnidade.map(d => (
                    <BarHorizontal
                      key={d.unidade}
                      label={d.unidade}
                      value={d.taxa}
                      max={maxT}
                      color={taxaColor(d.taxa)}
                      subLabel={`${d.ativos} ativ. | ${d.desligados} desl.`}
                    />
                  )) ?? null;
                })()
            }
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>Headcount por Unidade</h2>
            {loading
              ? <Skeleton className="h-48 w-full" />
              : (() => {
                  const maxA = Math.max(...(data?.headcountPorUnidade.map(d => d.ativos) ?? [1]));
                  return data?.headcountPorUnidade.map(d => (
                    <BarHorizontal
                      key={d.unidade}
                      label={d.unidade}
                      value={d.ativos}
                      max={maxA}
                      color={C.purple}
                      suffix=""
                      subLabel={`${d.desligados} desligados (histórico)`}
                    />
                  )) ?? null;
                })()
            }
          </div>
        </section>

        {/* ── Turnover por Área + Ranking Gestores ── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>Turnover por Área ({periodo}m)</h2>
            {loading
              ? <Skeleton className="h-48 w-full" />
              : (() => {
                  const maxT = Math.max(...(data?.turnoverPorArea.map(d => d.taxa) ?? [1]));
                  return data?.turnoverPorArea.map(d => (
                    <BarHorizontal
                      key={d.departamento}
                      label={d.departamento}
                      value={d.taxa}
                      max={maxT}
                      color={taxaColor(d.taxa)}
                      subLabel={`${d.ativos} ativ. | ${d.desligados} desl.`}
                    />
                  )) ?? null;
                })()
            }
          </div>

          {/* Ranking Gestores */}
          <div className="bg-white rounded-2xl shadow-sm p-5 overflow-auto">
            <h2 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>
              Ranking de Gestores — Desligamentos ({periodo}m)
            </h2>
            {loading
              ? <Skeleton className="h-48 w-full" />
              : !data?.rankingGestores.length
                ? <p className="text-xs text-gray-400 text-center pt-8">Nenhum desligamento no período</p>
                : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase text-gray-400 border-b">
                        <th className="pb-2 font-bold">#</th>
                        <th className="pb-2 font-bold">Gestor</th>
                        <th className="pb-2 font-bold">Depto / Unidade</th>
                        <th className="pb-2 font-bold text-right">Desl.</th>
                        <th className="pb-2 font-bold text-right">Taxa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rankingGestores.map((g, i) => (
                        <tr key={g.gestor} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 font-black" style={{ color: i < 3 ? C.pink : C.gray }}>
                            {i + 1}
                          </td>
                          <td className="py-2 font-semibold max-w-[120px] truncate">{g.gestor}</td>
                          <td className="py-2 text-gray-500">
                            {g.departamento}<br />
                            <span className="text-[10px]">{g.unidade}</span>
                          </td>
                          <td className="py-2 text-right font-black" style={{ color: C.pink }}>{g.desligados}</td>
                          <td className="py-2 text-right font-bold" style={{ color: taxaColor(g.taxa) }}>{g.taxa}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
            }
          </div>
        </section>

        {/* ── Últimos Desligamentos ── */}
        <section className="bg-white rounded-2xl shadow-sm p-5 overflow-auto">
          <h2 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>Últimos Desligamentos</h2>
          {loading
            ? <Skeleton className="h-32 w-full" />
            : !data?.ultimosDesligamentos.length
              ? <p className="text-xs text-gray-400 text-center py-8">Nenhum desligamento registrado</p>
              : (
                <table className="w-full text-xs min-w-[720px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-gray-400 border-b">
                      {['Colaborador', 'Cargo', 'Área', 'Unidade', 'Gestor', 'Data', 'Tipo'].map(h => (
                        <th key={h} className="pb-2 font-bold pr-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.ultimosDesligamentos.map((d, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-3 font-semibold">{d.nome}</td>
                        <td className="py-2 pr-3 text-gray-500 max-w-[120px] truncate">{d.cargo || '—'}</td>
                        <td className="py-2 pr-3 text-gray-500">{d.departamento}</td>
                        <td className="py-2 pr-3 text-gray-500">{d.unidade}</td>
                        <td className="py-2 pr-3 text-gray-500 max-w-[120px] truncate">{d.gestor}</td>
                        <td className="py-2 pr-3 font-mono text-gray-600">{fmtData(d.data_desligamento)}</td>
                        <td className="py-2 pr-3">
                          <span
                            className="px-2 py-0.5 rounded-full text-white text-[10px] font-bold whitespace-nowrap"
                            style={{ backgroundColor: TIPO_CORES[d.tipo_desligamento] || C.gray }}
                          >
                            {d.tipo_desligamento}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
          }
        </section>

        {/* ── Footer ── */}
        <footer className="text-center text-[10px] text-gray-400 pb-6">
          VENDEMMIA PEOPLE — Sistema de Gestão de Pessoas · Dados via API Convenia · {new Date().getFullYear()}
        </footer>

      </main>
    </div>
  );
}
