'use client';
import { useEffect, useState, useCallback } from 'react';
import { NavHeader, FilterSelect, FilterTag, SyncBadge } from '@/components/NavHeader';

// ─── Types ────────────────────────────────────────────────────────────────────
type KPIs = {
  totalFuncionarios: number;
  horasNormais: number;
  totalHE: number;
  he50: number; he60: number; he100: number;
  totalFaltas: number;
  totalAtestados: number;
  totalAusencias: number;
  taxaAbsenteismo: number;
  totalAtraso: number;
  saldoBanco: number;
  bancoNegativo: number;
  totalNoturno: number;
  totalAbono: number;
  totalFerias: number;
  totalAfastamento: number;
  syncedAt: string;
};

type PorFilial = {
  filial: string;
  funcionarios: number;
  horas_normais: number;
  extra_total: number;
  extra_50: number; extra_60: number; extra_100: number;
  faltas: number;
  atestados: number;
  ausencias: number;
  atrasos: number;
  banco_horas: number;
  banco_negativo: number;
};

type TopFalta  = { nome: string; cargo: string; filial: string; departamento: string; falta_injustificada: number; atestado: number; total_ausencia: number };
type TopExtra  = { nome: string; cargo: string; filial: string; departamento: string; extra_50: number; extra_60: number; extra_100: number; total_he: number };
type TopBanco  = { nome: string; cargo: string; filial: string; banco_horas: number };
type TopAtraso = { nome: string; cargo: string; filial: string; atraso: number };

type DistBanco = { critico: number; negativo: number; equilibrado: number; positivo: number; excesso: number };

type AbsGestor = { gestor: string; funcionarios: number; total_ausencia: number; media_ausencia: number };
type AbsCargo  = { cargo: string; funcionarios: number; total_ausencia: number; media_ausencia: number; total_he: number };

type Tendencia = {
  mes: string;
  funcionarios: number;
  he_total: number;
  ausencias: number;
  atrasos: number;
  saldo_banco: number;
};

type PontoData = {
  mes: string;
  mesesDisponiveis: string[];
  kpis: KPIs;
  porFilial: PorFilial[];
  topFaltas: TopFalta[];
  topExtras: TopExtra[];
  topBancoNeg: TopBanco[];
  topBancoPos: TopBanco[];
  topAtrasos: TopAtraso[];
  distBanco: DistBanco;
  absByGestor: AbsGestor[];
  absByCargo: AbsCargo[];
  tendencia: Tendencia[];
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
  indigo: '#6366F1',
  orange: '#F97316',
};

const PALETTE = [C.purple, C.pink, C.amber, C.blue, C.teal, C.orange, C.indigo, C.green];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtH(h: number): string {
  if (h === 0) return '0h';
  const neg  = h < 0;
  const abs  = Math.abs(h);
  const hh   = Math.floor(abs);
  const mm   = Math.round((abs - hh) * 60);
  const hhStr = hh.toLocaleString('pt-BR'); // adiciona separador de milhares
  const base = mm > 0 ? `${hhStr}h${mm.toString().padStart(2, '0')}` : `${hhStr}h`;
  return neg ? `-${base}` : base;
}

function fmtMes(mes: string): string {
  if (!mes) return '';
  const [y, m] = mes.split('-');
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${meses[parseInt(m, 10) - 1]}/${y}`;
}

function absBadgeColor(taxa: number): string {
  if (taxa < 3)  return C.green;
  if (taxa < 6)  return C.amber;
  return C.pink;
}

// ─── Componentes visuais ──────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide leading-tight">{label}</span>
      </div>
      <div className="text-2xl font-black leading-none" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400 leading-tight">{sub}</div>}
    </div>
  );
}

function BarH({ label, value, max, color, suffix = 'h', subLabel, labelWidth = 110 }: {
  label: string; value: number; max: number; color: string;
  suffix?: string; subLabel?: string; labelWidth?: number;
}) {
  const pct = max > 0 ? Math.max((Math.abs(value) / Math.abs(max)) * 100, 2) : 2;
  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="text-right shrink-0 overflow-hidden" style={{ width: labelWidth }}>
        <span className="text-xs font-semibold text-gray-700 leading-tight block overflow-hidden text-ellipsis whitespace-nowrap"
              title={label}>{label}</span>
        {subLabel && <div className="text-[10px] text-gray-400 leading-tight">{subLabel}</div>}
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
             style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold shrink-0 tabular-nums" style={{ color, width: 52 }}>
        {fmtH(value)}{suffix === '%' ? '%' : ''}
      </span>
    </div>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: string }) {
  return (
    <h2 className="text-base font-black uppercase tracking-wide mb-4 flex items-center gap-2" style={{ color: C.dark }}>
      {icon && <span>{icon}</span>}
      {children}
    </h2>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 ${className}`}>
      {children}
    </div>
  );
}

// ─── Gráfico de linha histórico ───────────────────────────────────────────────
function TendenciaChart({ data }: { data: Tendencia[] }) {
  const W = 560, H = 148, padL = 24, padR = 20, padT = 20, padB = 44;
  const n = data.length;
  if (n === 0) return <div className="text-xs text-gray-400 text-center py-8">Sem dados históricos</div>;

  const maxAll = Math.max(...data.flatMap(d => [d.he_total, d.ausencias, d.atrasos]), 1);
  const getX   = (i: number) => padL + (i / Math.max(n - 1, 1)) * (W - padL - padR);
  const getY   = (v: number) => padT + (1 - v / maxAll) * (H - padT - padB);
  const axisY  = H - padB;

  const SERIES = [
    { key: 'he',  vals: data.map(d => d.he_total),  color: C.amber, name: 'HE total' },
    { key: 'abs', vals: data.map(d => d.ausencias), color: C.pink,  name: 'Ausências' },
    { key: 'atr', vals: data.map(d => d.atrasos),   color: C.blue,  name: 'Atrasos' },
  ];

  function smooth(vals: number[]): string {
    const pts: [number, number][] = vals.map((v, i) => [getX(i), getY(v)]);
    if (pts.length < 2) return '';
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const cpx = (x0 + x1) / 2;
      d += ` C ${cpx},${y0} ${cpx},${y1} ${x1},${y1}`;
    }
    return d;
  }

  function area(vals: number[]): string {
    const s = smooth(vals);
    if (!s) return '';
    const last = getX(vals.length - 1);
    const first = getX(0);
    return `${s} L ${last},${axisY} L ${first},${axisY} Z`;
  }

  // Rótulos sem sobreposição: posiciona cada série relativa às outras no mesmo x
  function labelsAt(i: number) {
    const pts = SERIES.map(s => ({ y: getY(s.vals[i]), val: s.vals[i], color: s.color }))
      .sort((a, b) => a.y - b.y); // topo (menor y) → base (maior y)
    // topo → label acima; base → label abaixo; meio → acima se gap ok, senão omite
    const GAP = 13;
    return pts.map((p, rank) => {
      if (p.val === 0) return null;
      let above: boolean;
      if (rank === 0)                              above = true;   // topo: acima
      else if (rank === pts.length - 1)            above = false;  // base: abaixo
      else {
        const gapUp   = p.y - pts[rank - 1].y;
        const gapDown = pts[rank + 1].y - p.y;
        if (gapUp < GAP && gapDown < GAP) return null; // sem espaço: omite
        above = gapDown >= gapUp;
      }
      return { ...p, above };
    });
  }

  // Formato compacto para rótulo no gráfico
  function lbl(v: number): string {
    const hh = Math.floor(v);
    const mm = Math.round((v - hh) * 60);
    return mm > 0 ? `${hh.toLocaleString('pt-BR')}h${mm.toString().padStart(2,'0')}` : `${hh.toLocaleString('pt-BR')}h`;
  }

  return (
    <div>
      {/* Legenda */}
      <div className="flex items-center gap-5 mb-3">
        {SERIES.map(s => (
          <span key={s.key} className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
            <span className="inline-block w-5 h-[2px] rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'visible' }}>
        <defs>
          {SERIES.map(s => (
            <linearGradient key={s.key} id={`tg-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity="0.10" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0"    />
            </linearGradient>
          ))}
        </defs>

        {/* Grade horizontal suave */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f}
            x1={padL} y1={padT + (1 - f) * (H - padT - padB)}
            x2={W - padR} y2={padT + (1 - f) * (H - padT - padB)}
            stroke="#f3f4f6" strokeWidth="0.75" />
        ))}

        {/* Grade vertical pontilhada */}
        {data.map((_, i) => (
          <line key={i} x1={getX(i)} y1={padT} x2={getX(i)} y2={axisY}
                stroke="#f5f5f5" strokeWidth="0.75" strokeDasharray="2 3" />
        ))}

        {/* Eixo X */}
        <line x1={padL} y1={axisY} x2={W - padR} y2={axisY} stroke="#e9eaec" strokeWidth="0.75" />

        {/* Áreas com gradiente */}
        {SERIES.map(s => (
          <path key={s.key} d={area(s.vals)} fill={`url(#tg-${s.key})`} />
        ))}

        {/* Linhas */}
        {SERIES.map(s => (
          <path key={s.key} d={smooth(s.vals)} fill="none" stroke={s.color}
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Pontos + rótulos */}
        {data.map((_, i) => {
          const labels = labelsAt(i);
          return (
            <g key={i}>
              {/* Dots */}
              {SERIES.map(s => (
                <circle key={s.key}
                  cx={getX(i)} cy={getY(s.vals[i])} r="2.2"
                  fill="white" stroke={s.color} strokeWidth="1.5" />
              ))}

              {/* Rótulos de dados (anti-sobreposição) */}
              {labels.map((lb, li) => {
                if (!lb) return null;
                const cx = getX(i);
                const txt = lbl(lb.val);
                const tw = txt.length * 4.2 + 7;
                const th = 9;
                const ly = lb.above ? lb.y - th - 3 : lb.y + 3;
                return (
                  <g key={li}>
                    <rect x={cx - tw / 2} y={ly} width={tw} height={th} rx={2.5}
                          fill={lb.color} opacity={0.88} />
                    <text x={cx} y={ly + th - 2} textAnchor="middle"
                          fontSize="5.5" fontWeight="700" fill="white">
                      {txt}
                    </text>
                  </g>
                );
              })}

              {/* Tick + label do mês */}
              <line x1={getX(i)} y1={axisY} x2={getX(i)} y2={axisY + 3}
                    stroke="#d1d5db" strokeWidth="0.75" />
              <g transform={`translate(${getX(i)}, ${axisY + 5})`}>
                <text textAnchor="end" fontSize="6.5" fontWeight="600" fill="#9CA3AF" transform="rotate(-38)">
                  {fmtMes(_.mes)}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Distribuição banco de horas ──────────────────────────────────────────────
function DistBancoBar({ dist }: { dist: DistBanco }) {
  const total = dist.critico + dist.negativo + dist.equilibrado + dist.positivo + dist.excesso;
  if (total === 0) return null;
  const segs = [
    { label: 'Crítico (<-40h)',    val: dist.critico,    color: '#DC2626' },
    { label: 'Negativo (-40…0h)',  val: dist.negativo,   color: C.pink },
    { label: 'Equilibrado (0‑20h)',val: dist.equilibrado, color: C.green },
    { label: 'Positivo (20‑40h)', val: dist.positivo,   color: C.teal },
    { label: 'Excesso (>40h)',     val: dist.excesso,    color: C.amber },
  ];
  return (
    <div>
      <div className="flex rounded-xl overflow-hidden h-8 mb-3">
        {segs.map(s => s.val > 0 && (
          <div key={s.label}
               className="flex items-center justify-center text-white text-[10px] font-bold transition-all"
               style={{ width: `${(s.val / total) * 100}%`, backgroundColor: s.color }}
               title={`${s.label}: ${s.val}`}>
            {s.val > 0 && s.val / total > 0.08 ? s.val : ''}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segs.map(s => (
          <div key={s.label} className="flex items-center gap-1 text-xs">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-gray-500">{s.label}</span>
            <span className="font-bold" style={{ color: s.color }}>{s.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PontoPage() {
  const [data,    setData]    = useState<PontoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro,    setErro]    = useState('');
  const [mes,     setMes]     = useState('');
  const [filial,  setFilial]  = useState('');

  const carregar = useCallback((m: string, f: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (m) params.set('mes', m);
    if (f) params.set('filial', f);
    fetch(`/api/ponto?${params}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        if (d.erro) { setErro(d.erro); setData(null); }
        else { setData(d); setErro(''); if (!m) setMes(d.mes); }
      })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { carregar(mes, filial); }, [mes, filial, carregar]);

  const kpis      = data?.kpis;
  const filiais   = [...new Set((data?.porFilial ?? []).map(f => f.filial))];
  const syncedAt  = kpis?.syncedAt
    ? new Date(kpis.syncedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  const maxFilialHE   = Math.max(...(data?.porFilial ?? []).map(f => f.extra_total), 1);
  const maxFilialAbs  = Math.max(...(data?.porFilial ?? []).map(f => f.ausencias), 1);
  const maxGestor     = Math.max(...(data?.absByGestor ?? []).map(g => g.total_ausencia), 1);
  const maxCargo      = Math.max(...(data?.absByCargo ?? []).map(c => c.total_ausencia), 1);

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: C.white }}>

      <NavHeader>
        <FilterSelect
          value={mes}
          onChange={setMes}
          label="Selecione o mês"
          options={data?.mesesDisponiveis ?? (mes ? [mes] : [])}
          color={C.amber}
          labelFn={fmtMes}
        />
        <FilterSelect
          value={filial}
          onChange={setFilial}
          label="Todas as filiais"
          options={filiais}
          color={C.amber}
        />
        {filial && <FilterTag label={filial} onClear={() => setFilial('')} />}
        {syncedAt && <SyncBadge label={`Sync: ${syncedAt}`} />}
      </NavHeader>

      {/* ── Conteúdo ── */}
      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-8">

        {/* Título */}
        <div>
          <h1 className="text-2xl font-black" style={{ color: C.purple }}>
            Jornada & Ponto
            {mes && <span className="text-base font-bold text-gray-400 ml-3">{fmtMes(mes)}</span>}
            {filial && <span className="text-base font-bold ml-2" style={{ color: C.amber }}> · {filial}</span>}
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Horas extras, absenteísmo, banco de horas e pontualidade · Fonte: TiqueTaque
          </p>
        </div>

        {/* Erro */}
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {erro === 'HTTP 404'
              ? 'Nenhum dado sincronizado ainda. Execute o script de sync primeiro: py scripts/sync_ponto.py --mes 2026-04'
              : erro}
          </div>
        )}

        {/* ── KPIs ── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <KpiCard label="Funcionários"    value={kpis.totalFuncionarios}        sub="no período"            color={C.purple} icon="👥" />
            <KpiCard label="HE Total"        value={fmtH(kpis.totalHE)}           sub={`50%:${fmtH(kpis.he50)} 60%:${fmtH(kpis.he60)} 100%:${fmtH(kpis.he100)}`} color={C.amber}  icon="⏱" />
            <KpiCard label="Absenteísmo"     value={`${kpis.taxaAbsenteismo}%`}   sub={`${fmtH(kpis.totalAusencias)} ausentes`} color={absBadgeColor(kpis.taxaAbsenteismo)} icon="📉" />
            <KpiCard label="Faltas"          value={fmtH(kpis.totalFaltas)}       sub="injustificadas"        color={C.pink}   icon="🚫" />
            <KpiCard label="Atestados"       value={fmtH(kpis.totalAtestados)}    sub="médicos/ausências just." color={C.blue}  icon="🏥" />
            <KpiCard label="Atrasos"         value={fmtH(kpis.totalAtraso)}       sub="soma do período"       color={C.orange} icon="🕐" />
            <KpiCard label="Banco de Horas"  value={fmtH(kpis.saldoBanco)}        sub={`${kpis.bancoNegativo} com saldo neg.`} color={kpis.saldoBanco >= 0 ? C.teal : C.pink} icon="🏦" />
            <KpiCard label="Adic. Noturno"   value={fmtH(kpis.totalNoturno)}      sub="horas noturnas"        color={C.indigo} icon="🌙" />
          </div>
        )}

        {/* ── Por Filial ── */}
        {!loading && data && data.porFilial.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            <Card>
              <SectionTitle icon="🏢">HE por Filial</SectionTitle>
              {data.porFilial.map((f, i) => (
                <BarH key={f.filial} label={f.filial} value={f.extra_total} max={maxFilialHE}
                      color={PALETTE[i % PALETTE.length]}
                      subLabel={`${f.funcionarios} func · 50%:${fmtH(f.extra_50)} 60%:${fmtH(f.extra_60)} 100%:${fmtH(f.extra_100)}`} />
              ))}
            </Card>

            <Card>
              <SectionTitle icon="📉">Ausências por Filial</SectionTitle>
              {data.porFilial.map((f, i) => (
                <BarH key={f.filial} label={f.filial} value={f.ausencias} max={maxFilialAbs}
                      color={PALETTE[i % PALETTE.length]}
                      subLabel={`Faltas: ${fmtH(f.faltas)} · Atestados: ${fmtH(f.atestados)}`} />
              ))}
            </Card>
          </div>
        )}

        {/* ── Top Faltas + Top Extras ── */}
        {!loading && data && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            <Card>
              <SectionTitle icon="🚫">Top Ausências</SectionTitle>
              {data.topFaltas.length === 0
                ? <p className="text-xs text-gray-400">Nenhuma ausência no período.</p>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b">
                          <th className="text-left pb-2 font-semibold">Colaborador</th>
                          <th className="text-right pb-2 font-semibold w-16">Faltas</th>
                          <th className="text-right pb-2 font-semibold w-16">Atestado</th>
                          <th className="text-right pb-2 font-semibold w-16">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topFaltas.map((r, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="py-1.5 leading-tight">
                              <div className="font-semibold text-gray-800">{r.nome}</div>
                              <div className="text-gray-400">{r.cargo} · {r.filial}</div>
                            </td>
                            <td className="py-1.5 text-right font-mono" style={{ color: C.pink }}>{fmtH(r.falta_injustificada)}</td>
                            <td className="py-1.5 text-right font-mono" style={{ color: C.blue }}>{fmtH(r.atestado)}</td>
                            <td className="py-1.5 text-right font-bold font-mono" style={{ color: C.dark }}>{fmtH(r.total_ausencia)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </Card>

            <Card>
              <SectionTitle icon="⏱">Top Horas Extras</SectionTitle>
              {data.topExtras.length === 0
                ? <p className="text-xs text-gray-400">Nenhuma hora extra no período.</p>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b">
                          <th className="text-left pb-2 font-semibold">Colaborador</th>
                          <th className="text-right pb-2 font-semibold w-14">50%</th>
                          <th className="text-right pb-2 font-semibold w-14">60%</th>
                          <th className="text-right pb-2 font-semibold w-14">100%</th>
                          <th className="text-right pb-2 font-semibold w-16">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topExtras.map((r, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="py-1.5 leading-tight">
                              <div className="font-semibold text-gray-800">{r.nome}</div>
                              <div className="text-gray-400">{r.cargo} · {r.filial}</div>
                            </td>
                            <td className="py-1.5 text-right font-mono text-gray-500">{fmtH(r.extra_50)}</td>
                            <td className="py-1.5 text-right font-mono text-gray-500">{fmtH(r.extra_60)}</td>
                            <td className="py-1.5 text-right font-mono text-gray-500">{fmtH(r.extra_100)}</td>
                            <td className="py-1.5 text-right font-bold font-mono" style={{ color: C.amber }}>{fmtH(r.total_he)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </Card>
          </div>
        )}

        {/* ── Banco de Horas ── */}
        {!loading && data && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            <Card>
              <SectionTitle icon="🏦">Distribuição Banco de Horas</SectionTitle>
              <DistBancoBar dist={data.distBanco} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                {/* Saldo Negativo */}
                <div>
                  <SectionTitle icon="⚠️">Maior Saldo Negativo</SectionTitle>
                  {data.topBancoNeg.length === 0
                    ? <p className="text-xs text-gray-400">Nenhum saldo negativo.</p>
                    : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 border-b">
                            <th className="text-left pb-2 font-semibold">Colaborador</th>
                            <th className="text-right pb-2 font-semibold w-20">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.topBancoNeg.map((r, i) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                              <td className="py-1.5 leading-tight">
                                <div className="font-semibold text-gray-800 text-[11px]">{r.nome}</div>
                                <div className="text-gray-400 text-[10px]">{r.cargo} · {r.filial}</div>
                              </td>
                              <td className="py-1.5 text-right font-bold font-mono" style={{ color: C.pink }}>{fmtH(r.banco_horas)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                </div>

                {/* Saldo Positivo */}
                <div>
                  <SectionTitle icon="✅">Maior Saldo Positivo</SectionTitle>
                  {data.topBancoPos.length === 0
                    ? <p className="text-xs text-gray-400">Nenhum saldo positivo.</p>
                    : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 border-b">
                            <th className="text-left pb-2 font-semibold">Colaborador</th>
                            <th className="text-right pb-2 font-semibold w-20">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.topBancoPos.map((r, i) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                              <td className="py-1.5 leading-tight">
                                <div className="font-semibold text-gray-800 text-[11px]">{r.nome}</div>
                                <div className="text-gray-400 text-[10px]">{r.cargo} · {r.filial}</div>
                              </td>
                              <td className="py-1.5 text-right font-bold font-mono" style={{ color: C.teal }}>+{fmtH(r.banco_horas)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                </div>
              </div>
            </Card>

            <Card>
              <SectionTitle icon="🕐">Top Atrasos</SectionTitle>
              {data.topAtrasos.length === 0
                ? <p className="text-xs text-gray-400">Nenhum atraso no período.</p>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b">
                          <th className="text-left pb-2 font-semibold">Colaborador</th>
                          <th className="text-right pb-2 font-semibold w-20">Atraso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topAtrasos.map((r, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="py-1.5 leading-tight">
                              <div className="font-semibold text-gray-800">{r.nome}</div>
                              <div className="text-gray-400">{r.cargo} · {r.filial}</div>
                            </td>
                            <td className="py-1.5 text-right font-bold font-mono" style={{ color: C.orange }}>{fmtH(r.atraso)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              {/* Atrasos por Filial */}
              {data.porFilial.some(f => f.atrasos > 0) && (
                <div className="mt-5">
                  <SectionTitle icon="📊">Atrasos por Filial</SectionTitle>
                  {data.porFilial
                    .filter(f => f.atrasos > 0)
                    .sort((a, b) => b.atrasos - a.atrasos)
                    .map((f, i) => (
                      <BarH key={f.filial} label={f.filial} value={f.atrasos}
                            max={Math.max(...data.porFilial.map(x => x.atrasos), 1)}
                            color={PALETTE[i % PALETTE.length]} />
                    ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── Cruzamento RH (por gestor + por cargo) ── */}
        {!loading && data && (data.absByGestor.length > 0 || data.absByCargo.length > 0) && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {data.absByGestor.length > 0 && (
              <Card>
                <SectionTitle icon="👔">Absenteísmo por Gestor</SectionTitle>
                {data.absByGestor.map((g, i) => (
                  <BarH key={g.gestor} label={g.gestor} value={g.total_ausencia} max={maxGestor}
                        color={PALETTE[i % PALETTE.length]}
                        subLabel={`${g.funcionarios} func · média ${fmtH(g.media_ausencia)}/pessoa`} />
                ))}
              </Card>
            )}

            {data.absByCargo.length > 0 && (
              <Card>
                <SectionTitle icon="🏷">Ausências por Cargo</SectionTitle>
                {data.absByCargo.slice(0, 12).map((c, i) => (
                  <BarH key={c.cargo} label={c.cargo} value={c.total_ausencia} max={maxCargo}
                        color={PALETTE[i % PALETTE.length]}
                        subLabel={`${c.funcionarios} func · HE: ${fmtH(c.total_he)}`} />
                ))}
              </Card>
            )}
          </div>
        )}

        {/* ── Tendência Histórica ── */}
        {!loading && data && data.tendencia.length > 1 && (
          <Card>
            <SectionTitle icon="📈">Tendência Histórica</SectionTitle>
            <TendenciaChart data={data.tendencia} />
          </Card>
        )}

        {/* Mensagem quando sem dados mas sem erro */}
        {!loading && !erro && !data && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-semibold">Nenhum dado de ponto sincronizado.</p>
            <p className="text-sm mt-1">Execute: <code className="bg-gray-100 px-2 py-0.5 rounded">py scripts/sync_ponto.py --mes 2026-04</code></p>
          </div>
        )}
      </main>
    </div>
  );
}
