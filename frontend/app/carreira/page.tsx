'use client';
import { useEffect, useState, useCallback } from 'react';
import { NavHeader, MultiFilterSelect, PeriodButtons, FilterTag, SyncBadge } from '@/components/NavHeader';

// ─── Types ────────────────────────────────────────────────────────────────────
type KPIs = {
  totalPromocoes: number;
  totalReajustes: number;
  tempoMedioPromocaoDias: number;
  tempoMedioNaFuncaoDias: number;
  colaboradoresComPromocao: number;
  taxaPromocao: number;
  totalColaboradores: number;
};

type PromArea     = { area: string; count: number };
type PromUnidade  = { unidade: string; count: number };
type Tendencia    = { mes: string; promocoes: number; reajustes: number };
type TopPromovido = { nome: string; totalPromocoes: number; cargo: string; area: string; unidade: string; ultimaPromocao: string };
type UltimaPromo  = { nome: string; cargo_anterior: string; cargo_novo: string; area: string; unidade: string; data: string; motivo: string };
type ReajTipo     = { tipo: string; label: string; count: number; pct: number };
type ReajArea     = { area: string; coletivo: number; merito: number; salarial: number; total: number };
type FaixaTempo   = { faixa: string; count: number };
type TopMerito    = { nome: string; totalReajustes: number; area: string; unidade: string };

type CarreiraData = {
  periodo: number;
  atualizadoEm: string;
  opcoesFiltro: { unidades: string[]; areas: string[]; gestores: string[] };
  mesesDisponiveis: string[];
  kpis: KPIs;
  promocoesPorArea: PromArea[];
  promocoesPorUnidade: PromUnidade[];
  tendenciaPromocoes: Tendencia[];
  topPromovidos: TopPromovido[];
  ultimasPromocoes: UltimaPromo[];
  reajustesPorTipo: ReajTipo[];
  distribuicaoPorTipo: ReajTipo[];
  totalAlteracoes: number;
  reajustesPorArea: ReajArea[];
  tempoNaFuncaoFaixas: FaixaTempo[];
  topMerito: TopMerito[];
};

// ─── Cores ────────────────────────────────────────────────────────────────────
const C = {
  purple: '#422c76',
  pink:   '#ff2f69',
  green:  '#01E18E',
  dark:   '#414042',
  white:  '#faf9f5',
  amber:  '#F59E0B',
  blue:   '#3B82F6',
  gray:   '#6B7280',
  teal:   '#0D9488',
};

const REAJ_CORES: Record<string, string> = {
  reajuste_coletivo: C.blue,
  reajuste_salarial: C.purple,
  reajuste_merito:   C.green,
  promocao:          C.teal,
};

// ─── Componentes ─────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function BarH({ label, value, max, color, suffix = '', subLabel, labelWidth = 120, valueLabel }: {
  label: string; value: number; max: number; color: string;
  suffix?: string; subLabel?: string; labelWidth?: number; valueLabel?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="text-right shrink-0" style={{ width: labelWidth }}>
        <span className="text-xs font-semibold text-gray-700 leading-tight">{label}</span>
        {subLabel && <div className="text-[10px] text-gray-400">{subLabel}</div>}
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
             style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold shrink-0" style={{ color, width: 50 }}>
        {valueLabel ?? `${value}${suffix}`}
      </span>
    </div>
  );
}

function smoothPathC(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cpx = (x0 + x1) / 2;
    d += ` C ${cpx},${y0} ${cpx},${y1} ${x1},${y1}`;
  }
  return d;
}

function DataLabelC({ x, y, val, color, above }: { x:number; y:number; val:number; color:string; above:boolean }) {
  if (val === 0) return null;
  const txt = String(val);
  const lw  = txt.length * 5.8 + 12;
  const lh  = 14;
  const ly  = above ? y - 14 : y + 18;
  return (
    <g>
      <rect x={x - lw / 2} y={ly - lh + 3} width={lw} height={lh} rx={4}
            fill="white" stroke={color} strokeWidth={1} opacity={0.95} />
      <text x={x} y={ly - 1} textAnchor="middle" fontSize={8.5} fontWeight="bold" fill={color}>{val}</text>
    </g>
  );
}

function TrendChart({ data }: { data: Tendencia[] }) {
  const W = 560, H = 175, padL = 28, padR = 28, padT = 30, padB = 34;
  const n = data.length;
  if (n < 2) return <p className="text-xs text-gray-400 text-center pt-8">Dados insuficientes</p>;
  const maxVal = Math.max(...data.flatMap(d => [d.promocoes, d.reajustes]), 1);
  const getX = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const getY = (v: number) => padT + (1 - v / maxVal) * (H - padT - padB);

  const ptsProm: [number, number][] = data.map((d, i) => [getX(i), getY(d.promocoes)]);
  const ptsReaj: [number, number][] = data.map((d, i) => [getX(i), getY(d.reajustes)]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'visible' }}>
      {/* Eixo X */}
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#E5E7EB" strokeWidth="1" />
      {/* Curvas suaves */}
      <path d={smoothPathC(ptsReaj)} fill="none" stroke={C.blue}   strokeWidth="2.5" strokeLinecap="round" />
      <path d={smoothPathC(ptsProm)} fill="none" stroke={C.purple} strokeWidth="2.5" strokeLinecap="round" />
      {data.map((d, i) => {
        const [px, py] = ptsProm[i];
        const [rx, ry] = ptsReaj[i];
        // ponto mais alto (menor Y) recebe rótulo acima; o outro, abaixo
        const promAbove = py <= ry;
        return (
          <g key={i}>
            <DataLabelC x={px} y={py} val={d.promocoes} color={C.purple} above={promAbove} />
            <DataLabelC x={rx} y={ry} val={d.reajustes}  color={C.blue}   above={!promAbove} />
            <circle cx={px} cy={py} r="4" fill="white" stroke={C.purple} strokeWidth="2" />
            <circle cx={rx} cy={ry} r="4" fill="white" stroke={C.blue}   strokeWidth="2" />
            {/* Tick */}
            <line x1={getX(i)} y1={H - padB} x2={getX(i)} y2={H - padB + 4} stroke="#D1D5DB" strokeWidth="1" />
            {(n <= 12 || i % 2 === 0) && (
              <text x={getX(i)} y={H - padB + 15} textAnchor="middle" fontSize="8.5" fill={C.gray}>{d.mes}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function ReajDonut({ data, total }: { data: ReajTipo[]; total: number }) {
  const r = 80, cx = 100, cy = 100, stroke = 30;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-5">
      {/* Rosca maior e centralizada */}
      <svg width={200} height={200} viewBox="0 0 200 200">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
        {data.map((d, i) => {
          const dash = (d.count / Math.max(total, 1)) * circ;
          const seg = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={REAJ_CORES[d.tipo] || C.amber}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset + circ / 4}
            />
          );
          offset += dash;
          return seg;
        })}
        <text x={cx} y={cy - 8}  textAnchor="middle" fontSize="28" fontWeight="900" fill={C.dark}>{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" fill={C.gray}>alterações</text>
      </svg>
      {/* Legenda abaixo em grid */}
      <div className="w-full grid grid-cols-1 gap-2">
        {data.map(d => {
          const cor = REAJ_CORES[d.tipo] || C.amber;
          return (
            <div key={d.tipo} className="flex items-center gap-3 px-2 py-1.5 rounded-lg" style={{ backgroundColor: `${cor}12` }}>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cor }} />
              <span className="text-xs text-gray-700 flex-1 leading-tight">{d.label}</span>
              <span className="text-xs font-bold tabular-nums" style={{ color: cor }}>{d.count}</span>
              <span className="text-[11px] font-semibold text-gray-400 w-10 text-right">{d.pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Formatações ──────────────────────────────────────────────────────────────
function fmtData(str: string | null) {
  if (!str) return '—';
  const [y, m, d] = str.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function fmtDias(dias: number) {
  if (dias < 31)   return `${dias} dias`;
  if (dias < 365)  return `${Math.round(dias / 30)} meses`;
  const anos  = Math.floor(dias / 365);
  const meses = Math.round((dias % 365) / 30);
  return meses > 0 ? `${anos}a ${meses}m` : `${anos} ano${anos > 1 ? 's' : ''}`;
}

function setaPromo(anterior: string, novo: string) {
  if (!anterior || anterior === '—' || anterior === novo) return null;
  return (
    <span className="text-[10px] text-gray-400 mx-1">→</span>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function CarreiraPage() {
  const [data,       setData]       = useState<CarreiraData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [erro,       setErro]       = useState('');
  const [periodo,    setPeriodo]    = useState(12);
  const [filtrosMes, setFiltrosMes] = useState<string[]>([]);
  const [unidades,   setUnidades]   = useState<string[]>([]);
  const [areas,      setAreas]      = useState<string[]>([]);
  const [gestores,   setGestores]   = useState<string[]>([]);

  const carregar = useCallback((per: number, mes: string[], uni: string[], ar: string[], gest: string[]) => {
    setLoading(true);
    const params = new URLSearchParams({ meses: String(per) });
    if (mes.length)  params.set('mes',     mes.join(','));
    if (uni.length)  params.set('unidade', uni.join(','));
    if (ar.length)   params.set('area',    ar.join(','));
    if (gest.length) params.set('gestor',  gest.join(','));
    fetch(`/api/carreira?${params}`)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(d => { setData(d); setErro(''); })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { carregar(periodo, filtrosMes, unidades, areas, gestores); }, [periodo, filtrosMes, unidades, areas, gestores, carregar]);

  const kpis = data?.kpis;
  const atualizado = data?.atualizadoEm
    ? new Date(data.atualizadoEm).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : '';

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: C.white }}>

      <NavHeader>
        <MultiFilterSelect
          values={filtrosMes}
          onChange={setFiltrosMes}
          label="Todos os meses"
          options={data?.mesesDisponiveis ?? []}
          color={C.teal}
        />
        <PeriodButtons value={periodo} onChange={setPeriodo} color={C.teal} />
        <MultiFilterSelect
          values={unidades}
          onChange={setUnidades}
          label="Todas as unidades"
          options={data?.opcoesFiltro.unidades ?? []}
          color={C.teal}
        />
        <MultiFilterSelect
          values={areas}
          onChange={setAreas}
          label="Todas as áreas"
          options={data?.opcoesFiltro.areas ?? []}
          color={C.teal}
        />
        <MultiFilterSelect
          values={gestores}
          onChange={setGestores}
          label="Todos os gestores"
          options={data?.opcoesFiltro.gestores ?? []}
          color={C.teal}
        />
        {(filtrosMes.length > 0 || unidades.length > 0 || areas.length > 0 || gestores.length > 0) && (
          <FilterTag label="limpar filtros" onClear={() => { setFiltrosMes([]); setUnidades([]); setAreas([]); setGestores([]); }} />
        )}
        {atualizado && <SyncBadge label={`Atualizado: ${atualizado}`} />}
      </NavHeader>

      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {erro.includes('404') ? 'Tabela de histórico não encontrada. Execute: cd backend && python etl_historico.py' : `Erro: ${erro}`}
          </div>
        )}

        {/* ── KPI Cards ── */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: `Promoções (${periodo}m)`,     value: kpis?.totalPromocoes,            color: C.purple, icon: '🚀', suffix: '' },
            { label: `Reajustes (${periodo}m)`,      value: kpis?.totalReajustes,             color: C.blue,   icon: '💰', suffix: '' },
            { label: 'Tempo p/ Promoção',            value: kpis ? fmtDias(kpis.tempoMedioPromocaoDias) : null, color: C.teal,   icon: '⏱️', raw: true },
            { label: 'Tempo na Função',              value: kpis ? fmtDias(kpis.tempoMedioNaFuncaoDias) : null, color: C.amber,  icon: '📅', raw: true },
            { label: 'Colaboradores Promovidos',     value: kpis?.colaboradoresComPromocao,   color: C.green,  icon: '⭐', suffix: '' },
            { label: 'Taxa de Promoção',             value: kpis?.taxaPromocao,               color: C.pink,   icon: '📊', suffix: '%' },
          ].map(({ label, value, color, icon, suffix = '', raw }) => (
            <div key={label} className="bg-white rounded-2xl shadow-sm p-4 border-t-4 flex flex-col" style={{ borderColor: color }}>
              <div className="text-xl mb-1">{icon}</div>
              <div className="text-[10px] font-bold uppercase text-gray-400 mb-1 leading-tight">{label}</div>
              {loading
                ? <Skeleton className="h-9 w-16 mt-1" />
                : <div className="text-3xl font-black mt-auto" style={{ color }}>
                    {raw ? (value ?? '—') : `${value ?? '—'}${suffix}`}
                  </div>
              }
            </div>
          ))}
        </section>

        {/* ══════════════════════════════════════════════════════════ */}
        {/*  PROMOÇÕES                                                 */}
        {/* ══════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <h2 className="font-black text-base uppercase tracking-wide border-l-4 pl-3"
              style={{ color: C.purple, borderColor: C.purple }}>
            Promoções & Progressão de Carreira
          </h2>

          {/* Tendência + Promoções por área/unidade */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Tendência mensal */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-sm uppercase" style={{ color: C.dark }}>
                  Tendência — Promoções & Reajustes ({periodo}m) <span className="text-[9px] font-normal text-gray-400 normal-case">(excl. dissídio)</span>
                </h3>
                <div className="flex gap-3 text-[10px]">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-1 rounded inline-block" style={{ backgroundColor: C.purple }} /> Promoções
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-1 rounded inline-block" style={{ backgroundColor: C.blue }} /> Reajustes
                  </span>
                </div>
              </div>
              {loading
                ? <Skeleton className="h-36 w-full" />
                : <TrendChart data={data?.tendenciaPromocoes ?? []} />
              }
            </div>

            {/* Promoções por área */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>
                Promoções por Área ({periodo}m) — TOP 6
              </h3>
              {loading
                ? <Skeleton className="h-36 w-full" />
                : (() => {
                    const items = (data?.promocoesPorArea ?? []).slice(0, 6);
                    const totalP = items.reduce((s, i) => s + i.count, 0);
                    const maxV = Math.max(...items.map(i => i.count), 1);
                    return items.length
                      ? items.map(i => <BarH key={i.area} label={i.area} value={i.count} max={maxV} color={C.purple} labelWidth={130}
                          valueLabel={totalP > 0 ? `${((i.count / totalP) * 100).toFixed(0)}%` : '0%'}
                          subLabel={`${i.count} prom.`} />)
                      : <p className="text-xs text-gray-400 text-center pt-8">Nenhuma promoção no período</p>;
                  })()
              }
            </div>
          </div>

          {/* Top promovidos + Últimas promoções */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Top promovidos */}
            <div className="bg-white rounded-2xl shadow-sm p-5 overflow-auto">
              <h3 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>
                Mais Promovidos (histórico completo)
              </h3>
              {loading
                ? <Skeleton className="h-48 w-full" />
                : !data?.topPromovidos.length
                  ? <p className="text-xs text-gray-400 text-center pt-8">Sem dados</p>
                  : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase text-gray-400 border-b">
                          <th className="pb-2 font-bold">#</th>
                          <th className="pb-2 font-bold">Colaborador</th>
                          <th className="pb-2 font-bold">Cargo Atual</th>
                          <th className="pb-2 font-bold">Área</th>
                          <th className="pb-2 font-bold text-right">Prom.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topPromovidos.map((p, i) => (
                          <tr key={p.nome} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 font-black" style={{ color: i < 3 ? C.purple : C.gray }}>{i + 1}</td>
                            <td className="py-2 font-semibold max-w-[140px] truncate">{p.nome}</td>
                            <td className="py-2 text-gray-500 max-w-[120px] truncate">{p.cargo}</td>
                            <td className="py-2 text-gray-400 text-[10px]">{p.area}</td>
                            <td className="py-2 text-right">
                              <span className="font-black px-2 py-0.5 rounded-full text-white text-[10px]"
                                    style={{ backgroundColor: i < 3 ? C.purple : C.gray }}>
                                {p.totalPromocoes}x
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
              }
            </div>

            {/* Últimas promoções */}
            <div className="bg-white rounded-2xl shadow-sm p-5 overflow-auto">
              <h3 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>
                Últimas Promoções ({periodo}m)
              </h3>
              {loading
                ? <Skeleton className="h-48 w-full" />
                : !data?.ultimasPromocoes.length
                  ? <p className="text-xs text-gray-400 text-center pt-8">Nenhuma promoção no período</p>
                  : (
                    <table className="w-full text-xs min-w-[480px]">
                      <thead>
                        <tr className="text-left text-[10px] uppercase text-gray-400 border-b">
                          <th className="pb-2 font-bold">Colaborador</th>
                          <th className="pb-2 font-bold">Progressão</th>
                          <th className="pb-2 font-bold">Unidade</th>
                          <th className="pb-2 font-bold">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ultimasPromocoes.map((p, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 font-semibold max-w-[130px] truncate">{p.nome}</td>
                            <td className="py-2">
                              <div className="flex items-center gap-1" style={{ minWidth: 0 }}>
                                {/* Cargo anterior — largura fixa, sempre ocupa espaço */}
                                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0"
                                      style={{ width: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
                                      title={p.cargo_anterior && p.cargo_anterior !== '—' ? p.cargo_anterior : ''}>
                                  {p.cargo_anterior && p.cargo_anterior !== '—' ? p.cargo_anterior : ''}
                                </span>
                                {/* Seta — sempre no mesmo lugar */}
                                <span className="text-gray-300 text-[10px] shrink-0 px-0.5">→</span>
                                {/* Cargo novo — largura fixa, sempre alinhado */}
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white shrink-0"
                                      style={{ backgroundColor: C.purple, width: 110, overflow: 'hidden',
                                               textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
                                      title={p.cargo_novo}>
                                  {p.cargo_novo}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 text-gray-400 text-[10px]">{p.unidade}</td>
                            <td className="py-2 font-mono text-gray-600 text-[10px] whitespace-nowrap">{fmtData(p.data)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
              }
            </div>
          </div>

          {/* Promoções por unidade */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>
              Promoções por Unidade ({periodo}m)
            </h3>
            {loading
              ? <Skeleton className="h-24 w-full" />
              : (() => {
                  const items = data?.promocoesPorUnidade ?? [];
                  const totalP = items.reduce((s, i) => s + i.count, 0);
                  const maxV = Math.max(...items.map(i => i.count), 1);
                  return items.length
                    ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                        {items.map(i => <BarH key={i.unidade} label={i.unidade} value={i.count} max={maxV} color={C.teal}
                          valueLabel={totalP > 0 ? `${((i.count / totalP) * 100).toFixed(0)}%` : '0%'}
                          subLabel={`${i.count} prom.`} />)}
                      </div>
                    )
                    : <p className="text-xs text-gray-400 text-center py-4">Nenhuma promoção no período</p>;
                })()
            }
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════ */}
        {/*  REAJUSTES SALARIAIS                                       */}
        {/* ══════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <h2 className="font-black text-base uppercase tracking-wide border-l-4 pl-3"
              style={{ color: C.blue, borderColor: C.blue }}>
            Reajustes Salariais
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Donut tipos */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>
                Distribuição por Tipo ({periodo}m)
              </h3>
              {loading
                ? <Skeleton className="h-36 w-full" />
                : !data?.distribuicaoPorTipo.length
                  ? <p className="text-xs text-gray-400 text-center pt-8">Nenhuma alteração no período</p>
                  : <ReajDonut data={data.distribuicaoPorTipo} total={data.totalAlteracoes} />
              }
            </div>

            {/* Reajustes por área */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>
                Reajustes por Área ({periodo}m)
              </h3>
              {loading
                ? <Skeleton className="h-36 w-full" />
                : (() => {
                    const items = data?.reajustesPorArea ?? [];
                    const totalR = items.reduce((s, i) => s + i.total, 0);
                    const maxV = Math.max(...items.map(i => i.total), 1);
                    return items.length
                      ? items.map(i => (
                          <BarH key={i.area} label={i.area} value={i.total} max={maxV}
                            color={C.blue} labelWidth={130}
                            valueLabel={totalR > 0 ? `${((i.total / totalR) * 100).toFixed(0)}%` : '0%'}
                            subLabel={`${i.total} reaj. · Col. ${i.coletivo} · Mér. ${i.merito} · Enq. ${i.salarial}`} />
                        ))
                      : <p className="text-xs text-gray-400 text-center pt-8">Nenhum reajuste no período</p>;
                  })()
              }
            </div>
          </div>

          {/* Top mérito */}
          <div className="bg-white rounded-2xl shadow-sm p-5 overflow-auto">
            <h3 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>
              Mais Reajustes por Mérito (histórico completo)
            </h3>
            {loading
              ? <Skeleton className="h-32 w-full" />
              : !data?.topMerito.length
                ? <p className="text-xs text-gray-400 text-center py-4">Sem dados de mérito</p>
                : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    {data.topMerito.map(m => (
                      <div key={m.nome} className="flex items-center gap-3 py-2 border-b border-gray-50">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">{m.nome}</div>
                          <div className="text-[10px] text-gray-400">{m.area} · {m.unidade}</div>
                        </div>
                        <span className="font-black text-sm px-2 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: C.green }}>
                          {m.totalReajustes}x
                        </span>
                      </div>
                    ))}
                  </div>
                )
            }
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════ */}
        {/*  TEMPO NA FUNÇÃO                                           */}
        {/* ══════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <h2 className="font-black text-base uppercase tracking-wide border-l-4 pl-3"
              style={{ color: C.amber, borderColor: C.amber }}>
            Permanência por Função
          </h2>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-black text-sm uppercase" style={{ color: C.dark }}>
                Distribuição de Tempo por Período de Função
              </h3>
              <span className="text-xs text-gray-500 shrink-0 ml-4">
                Tempo médio: <strong style={{ color: C.amber }}>
                  {kpis ? fmtDias(kpis.tempoMedioNaFuncaoDias) : '—'}
                </strong> por período
              </span>
            </div>
            {/* Explicação do indicador */}
            <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF9EE', border: '1px solid #FDE68A' }}>
              <span className="text-sm shrink-0 mt-0.5">💡</span>
              <p className="text-xs text-amber-800 leading-relaxed">
                Cada <strong>período</strong> representa um trecho contínuo em que um colaborador permaneceu no mesmo cargo antes de ser promovido ou ter o cargo alterado.
                Por exemplo, <strong>&quot;Até 3 meses — 329 períodos&quot;</strong> significa que houve 329 passagens por um cargo com duração inferior a 3 meses no histórico analisado.
                Um mesmo colaborador pode ter gerado mais de um período ao longo da carreira.
              </p>
            </div>
            {loading
              ? <Skeleton className="h-40 w-full" />
              : (() => {
                  const faixas = data?.tempoNaFuncaoFaixas ?? [];
                  const maxV = Math.max(...faixas.map(f => f.count), 1);
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                      {faixas.map(f => <BarH key={f.faixa} label={f.faixa} value={f.count} max={maxV} color={C.amber} suffix=" períodos" labelWidth={110} />)}
                    </div>
                  );
                })()
            }
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-[10px] text-gray-400 pb-6">
          VENDEMMIA PEOPLE — Carreira & Desenvolvimento · Dados: Histórico Convenia · {new Date().getFullYear()}
        </footer>

      </main>
    </div>
  );
}
