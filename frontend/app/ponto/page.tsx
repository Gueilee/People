'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { NavHeader, MultiFilterSelect, FilterTag, SyncBadge } from '@/components/NavHeader';

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
  totalNoturno: number;
  custoHe: number;
  custoAusencias: number;
  custoNoturno: number;
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
  adicional_noturno: number;
  hora_noturna_reduzida: number;
  dsr: number;
  custo_he: number;
  custo_ausencias: number;
  custo_noturno: number;
};

type TopFalta  = { nome: string; cargo: string; filial: string; departamento: string; falta_injustificada: number; atestado: number; total_ausencia: number };
type TopExtra  = { nome: string; cargo: string; filial: string; departamento: string; extra_50: number; extra_60: number; extra_100: number; total_he: number };
type TopAtraso  = { nome: string; cargo: string; filial: string; atraso: number };

type AbsGestor = { gestor: string; funcionarios: number; total_ausencia: number; media_ausencia: number };
type AbsCargo  = { cargo: string; funcionarios: number; total_ausencia: number; media_ausencia: number; total_he: number };

type Tendencia = {
  mes: string;
  funcionarios: number;
  he_total: number;
  ausencias: number;
  atrasos: number;
};

type MotoHora = {
  nome: string;
  competencia: string;
  hora_normal_min: number;
  hora_normal_not_min: number;
  hora_extra_50_min: number;
  hora_extra_50_not_min: number;
  hora_extra_100_min: number;
  hora_extra_100_not_min: number;
  uploaded_at: string;
  uploaded_by: string;
};

type PontoData = {
  filtroMeses: string[];
  filtroUnidades: string[];
  mesesDisponiveis: string[];
  opcoesFiltro: { unidades: string[]; areas: string[]; gestores: string[]; colaboradores: string[] };
  kpis: KPIs;
  porFilial: PorFilial[];
  topFaltas: TopFalta[];
  topExtras: TopExtra[];
  topAtrasos: TopAtraso[];
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

function fmtMin(min: number | null | undefined): string {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
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

function BarH({ label, value, max, color, suffix = 'h', subLabel, labelWidth = 110, wrap = false, total }: {
  label: string; value: number; max: number; color: string;
  suffix?: string; subLabel?: string; labelWidth?: number; wrap?: boolean; total?: number;
}) {
  const pct = max > 0 ? Math.max((Math.abs(value) / Math.abs(max)) * 100, 2) : 2;
  const displayValue = total != null && total > 0
    ? `${((value / total) * 100).toFixed(1)}%`
    : `${fmtH(value)}${suffix === '%' ? '%' : ''}`;
  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="text-right shrink-0" style={{ width: labelWidth }}>
        {wrap ? (
          <span className="text-xs font-semibold text-gray-700 leading-tight block"
                style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}
                title={label}>{label}</span>
        ) : (
          <span className="text-xs font-semibold text-gray-700 leading-tight block overflow-hidden text-ellipsis whitespace-nowrap"
                title={label}>{label}</span>
        )}
        {subLabel && <div className="text-[10px] text-gray-400 leading-tight">{subLabel}</div>}
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
             style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold shrink-0 tabular-nums" style={{ color, width: 52 }}>
        {displayValue}
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
type VisKeys = { he: boolean; abs: boolean; atr: boolean };

function TendenciaChart({ data }: { data: Tendencia[] }) {
  const [vis, setVis] = useState<VisKeys>({ he: true, abs: true, atr: true });

  function toggleLine(k: keyof VisKeys) {
    setVis(prev => {
      const next = { ...prev, [k]: !prev[k] };
      // garante que pelo menos uma linha fique visível
      if (!next.he && !next.abs && !next.atr) return prev;
      return next;
    });
  }

  // W grande → proporção ~6.5:1 → em tela 1200px a altura fica ~185px (proporcional)
  const W = 1000, H = 155, padL = 32, padR = 20, padT = 30, padB = 36;
  const n = data.length;
  if (n === 0) return <div className="text-xs text-gray-400 text-center py-8">Sem dados históricos</div>;

  const ALL_SERIES = [
    { key: 'he',  vals: data.map(d => d.he_total),  color: C.amber, name: 'HE total' },
    { key: 'abs', vals: data.map(d => d.ausencias), color: C.pink,  name: 'Ausências' },
    { key: 'atr', vals: data.map(d => d.atrasos),   color: C.blue,  name: 'Atrasos' },
  ] as const;

  const SERIES = ALL_SERIES.filter(s => vis[s.key as keyof VisKeys]);

  const maxAll = Math.max(
    ...SERIES.flatMap(s => s.vals), 1
  );
  const getX   = (i: number) => padL + (i / Math.max(n - 1, 1)) * (W - padL - padR);
  const getY   = (v: number) => padT + (1 - v / maxAll) * (H - padT - padB);
  const axisY  = H - padB;

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
    return `${s} L ${getX(vals.length - 1)},${axisY} L ${getX(0)},${axisY} Z`;
  }

  // Rótulos sem sobreposição por posição X
  function labelsAt(i: number) {
    const pts = SERIES.map(s => ({ y: getY(s.vals[i]), val: s.vals[i], color: s.color }))
      .sort((a, b) => a.y - b.y);
    const GAP = 12;
    return pts.map((p, rank) => {
      if (p.val === 0) return null;
      let above: boolean;
      if (rank === 0)                    above = true;
      else if (rank === pts.length - 1)  above = false;
      else {
        const gapUp   = p.y - pts[rank - 1].y;
        const gapDown = pts[rank + 1].y - p.y;
        if (gapUp < GAP && gapDown < GAP) return null;
        above = gapDown >= gapUp;
      }
      return { ...p, above };
    });
  }

  // Formato compacto: omite minutos se zero, usa separador pt-BR
  function lbl(v: number): string {
    const hh = Math.floor(v);
    const mm = Math.round((v - hh) * 60);
    return mm > 0
      ? `${hh.toLocaleString('pt-BR')}h${mm.toString().padStart(2, '0')}`
      : `${hh.toLocaleString('pt-BR')}h`;
  }

  // Mês abreviado sem rotação: "Set/25"
  function mesShort(mes: string): string {
    const [y, m] = mes.split('-');
    const n = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${n[parseInt(m, 10) - 1]}/${y.slice(2)}`;
  }

  return (
    <div>
      {/* Toggles de linha */}
      <div className="flex items-center gap-2 mb-3">
        {ALL_SERIES.map(s => {
          const active = vis[s.key as keyof VisKeys];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleLine(s.key as keyof VisKeys)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer"
              style={{
                backgroundColor: active ? `${s.color}18` : 'transparent',
                borderColor:     active ? s.color : '#E5E7EB',
                color:           active ? s.color : '#9CA3AF',
              }}
            >
              <span className="inline-block w-3 h-[2px] rounded-full"
                    style={{ backgroundColor: active ? s.color : '#D1D5DB' }} />
              {s.name}
            </button>
          );
        })}
      </div>

      {/* overflow:hidden — todos os elementos estão dentro do viewBox */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'hidden', display: 'block' }}>
        <defs>
          {SERIES.map(s => (
            <linearGradient key={s.key} id={`tg-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity="0.12" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0"    />
            </linearGradient>
          ))}
        </defs>

        {/* Grade horizontal */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f}
            x1={padL} y1={padT + (1 - f) * (H - padT - padB)}
            x2={W - padR} y2={padT + (1 - f) * (H - padT - padB)}
            stroke="#f3f4f6" strokeWidth="0.6" />
        ))}

        {/* Grade vertical pontilhada */}
        {data.map((_, i) => (
          <line key={i} x1={getX(i)} y1={padT} x2={getX(i)} y2={axisY}
                stroke="#f5f5f5" strokeWidth="0.6" strokeDasharray="2 3" />
        ))}

        {/* Eixo X */}
        <line x1={padL} y1={axisY} x2={W - padR} y2={axisY} stroke="#e9eaec" strokeWidth="0.6" />

        {/* Áreas */}
        {SERIES.map(s => (
          <path key={s.key} d={area(s.vals)} fill={`url(#tg-${s.key})`} />
        ))}

        {/* Linhas */}
        {SERIES.map(s => (
          <path key={s.key} d={smooth(s.vals)} fill="none" stroke={s.color}
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Pontos + rótulos + labels do eixo */}
        {data.map((d, i) => {
          const labels = labelsAt(i);
          return (
            <g key={i}>
              {/* Dots */}
              {SERIES.map(s => (
                <circle key={s.key}
                  cx={getX(i)} cy={getY(s.vals[i])} r="2"
                  fill="white" stroke={s.color} strokeWidth="1.4" />
              ))}

              {/* Rótulos de dados (anti-sobreposição) */}
              {labels.map((lb, li) => {
                if (!lb) return null;
                const cx = getX(i);
                const txt = lbl(lb.val);
                const tw = txt.length * 3.9 + 6;
                const th = 8;
                const ly = lb.above ? lb.y - th - 3 : lb.y + 3;
                return (
                  <g key={li}>
                    <rect x={cx - tw / 2} y={ly} width={tw} height={th} rx={2}
                          fill={lb.color} opacity={0.9} />
                    <text x={cx} y={ly + th - 1.5} textAnchor="middle"
                          fontSize="5" fontWeight="700" fill="white">
                      {txt}
                    </text>
                  </g>
                );
              })}

              {/* Label do mês — horizontal, sem rotação */}
              <line x1={getX(i)} y1={axisY} x2={getX(i)} y2={axisY + 3}
                    stroke="#d1d5db" strokeWidth="0.6" />
              <text x={getX(i)} y={axisY + 13}
                    textAnchor="middle" fontSize="6.5" fontWeight="600" fill="#9CA3AF">
                {mesShort(d.mes)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PontoPage() {
  const [data,      setData]      = useState<PontoData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [erro,      setErro]      = useState('');
  const [periodo,      setPeriodo]      = useState(12);
  const [filtrosMes,   setFiltrosMes]   = useState<string[]>([]);
  const [unidades,     setUnidades]     = useState<string[]>([]);
  const [areas,        setAreas]        = useState<string[]>([]);
  const [gestores,     setGestores]     = useState<string[]>([]);
  const [colaboradores, setColaboradores] = useState<string[]>([]);

  const carregar = useCallback((per: number, mes: string[], uni: string[], ar: string[], gest: string[], colab: string[]) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (mes.length)   params.set('mes',          mes.join(','));
    else              params.set('meses',         String(per));
    if (uni.length)   params.set('unidade',       uni.join(','));
    if (ar.length)    params.set('area',          ar.join(','));
    if (gest.length)  params.set('gestor',        gest.join(','));
    if (colab.length) params.set('colaborador',   colab.join(','));
    fetch(`/api/ponto?${params}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        if (d.erro) { setErro(d.erro); setData(null); }
        else { setData(d); setErro(''); }
      })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { carregar(periodo, filtrosMes, unidades, areas, gestores, colaboradores); }, [periodo, filtrosMes, unidades, areas, gestores, colaboradores, carregar]);

  const kpis = data?.kpis;
  const syncedAt  = kpis?.syncedAt
    ? new Date(kpis.syncedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  const maxFilialHE   = Math.max(...(data?.porFilial ?? []).map(f => f.extra_total), 1);
  const maxFilialAbs  = Math.max(...(data?.porFilial ?? []).map(f => f.ausencias), 1);
  const maxGestor     = Math.max(...(data?.absByGestor ?? []).map(g => g.total_ausencia), 1);
  const maxCargo      = Math.max(...(data?.absByCargo ?? []).map(c => c.total_ausencia), 1);
  const totalAbsCargo = (data?.absByCargo ?? []).reduce((s, c) => s + c.total_ausencia, 0);

  // ── Motoristas ──────────────────────────────────────────────────────────────
  const [abaMoto,        setAbaMoto]        = useState<'jornada' | 'motoristas' | 'bh'>('jornada');
  const [motoCompetencia, setMotoCompetencia] = useState('');
  const [motoCompetencias, setMotoCompetencias] = useState<string[]>([]);
  const [motoRows,       setMotoRows]       = useState<MotoHora[]>([]);
  const [motoLoading,    setMotoLoading]    = useState(false);
  const [motoUploading,  setMotoUploading]  = useState(false);
  const [motoErro,       setMotoErro]       = useState('');
  const [motoOk,         setMotoOk]         = useState('');
  const [motoMes,        setMotoMes]        = useState('');
  const [userRole,       setUserRole]       = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const carregarMoto = useCallback((comp: string) => {
    setMotoLoading(true);
    fetch(`/api/motoristas-horas?competencia=${comp}`)
      .then(r => r.json())
      .then(d => { setMotoRows(d.rows || []); setMotoCompetencias(d.competencias || []); })
      .finally(() => setMotoLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUserRole(d.role || ''));
  }, []);

  useEffect(() => {
    if (abaMoto !== 'motoristas') return;
    fetch('/api/motoristas-horas')
      .then(r => r.json())
      .then(d => {
        const comps: string[] = d.competencias || [];
        setMotoCompetencias(comps);
        if (!motoCompetencia && comps.length > 0) setMotoCompetencia(comps[0]);
      });
  }, [abaMoto]);

  useEffect(() => {
    if (motoCompetencia) carregarMoto(motoCompetencia);
  }, [motoCompetencia, carregarMoto]);

  async function handleMotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!motoMes) { setMotoErro('Selecione a competência (mês/ano) antes de carregar o arquivo.'); return; }
    setMotoUploading(true); setMotoErro(''); setMotoOk('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('competencia', `${motoMes}-01`);
      const r = await fetch('/api/motoristas-horas', { method: 'POST', body: fd });
      const d = await r.json();
      if (d.erro) { setMotoErro(d.erro); }
      else {
        setMotoOk(`${d.processados} motorista${d.processados !== 1 ? 's' : ''} importado${d.processados !== 1 ? 's' : ''} com sucesso!`);
        const comp = `${motoMes}-01`;
        if (!motoCompetencias.includes(comp)) setMotoCompetencias(prev => [comp, ...prev]);
        setMotoCompetencia(comp);
      }
    } catch (err: unknown) {
      setMotoErro(err instanceof Error ? err.message : 'Erro ao enviar arquivo');
    } finally {
      setMotoUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const isRHouAdmin = userRole === 'rh' || userRole === 'admin';

  // ── Banco de Horas ──────────────────────────────────────────────────────────
  type BhRow = { nome: string; saldo_minutos: number; unidade: string; cargo: string; departamento: string; competencia: string; uploaded_at: string; };
  const [bhCompetencia,   setBhCompetencia]   = useState('');
  const [bhCompetencias,  setBhCompetencias]  = useState<string[]>([]);
  const [bhRows,          setBhRows]          = useState<BhRow[]>([]);
  const [bhLoading,       setBhLoading]       = useState(false);
  const [bhUploading,     setBhUploading]     = useState(false);
  const [bhErro,          setBhErro]          = useState('');
  const [bhOk,            setBhOk]            = useState('');
  const [bhMes,           setBhMes]           = useState('');
  const bhFileRef = useRef<HTMLInputElement>(null);

  const carregarBH = useCallback((comp: string) => {
    setBhLoading(true);
    fetch(`/api/banco-horas?competencia=${comp}`)
      .then(r => r.json())
      .then(d => { setBhRows(d.rows || []); setBhCompetencias(d.competencias || []); })
      .finally(() => setBhLoading(false));
  }, []);

  useEffect(() => {
    if (abaMoto !== 'bh') return;
    fetch('/api/banco-horas')
      .then(r => r.json())
      .then(d => {
        const comps: string[] = d.competencias || [];
        setBhCompetencias(comps);
        if (!bhCompetencia && comps.length > 0) setBhCompetencia(comps[0]);
      });
  }, [abaMoto]);

  useEffect(() => {
    if (bhCompetencia) carregarBH(bhCompetencia);
  }, [bhCompetencia, carregarBH]);

  async function handleBHUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!bhMes) { setBhErro('Selecione a competência (mês/ano) antes de carregar o arquivo.'); return; }
    setBhUploading(true); setBhErro(''); setBhOk('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('competencia', `${bhMes}-01`);
      const r = await fetch('/api/banco-horas', { method: 'POST', body: fd });
      const d = await r.json();
      if (d.erro) { setBhErro(d.erro); }
      else {
        setBhOk(`${d.processados} colaborador${d.processados !== 1 ? 'es' : ''} importado${d.processados !== 1 ? 's' : ''} com sucesso!`);
        const comp = `${bhMes}-01`;
        if (!bhCompetencias.includes(comp)) setBhCompetencias(prev => [comp, ...prev]);
        setBhCompetencia(comp);
      }
    } catch (err: unknown) {
      setBhErro(err instanceof Error ? err.message : 'Erro ao enviar arquivo');
    } finally {
      setBhUploading(false);
      if (bhFileRef.current) bhFileRef.current.value = '';
    }
  }

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: C.white }}>

      <NavHeader>
        <MultiFilterSelect values={filtrosMes} onChange={setFiltrosMes} label="Período"
          options={data?.mesesDisponiveis ?? []} color={C.amber} labelFn={fmtMes} />
        <span className="w-px h-4 bg-gray-300 mx-1" />
        <MultiFilterSelect values={unidades} onChange={setUnidades} label="Unidade"
          options={data?.opcoesFiltro.unidades ?? []} color={C.amber} />
        <MultiFilterSelect values={areas} onChange={setAreas} label="Área"
          options={data?.opcoesFiltro.areas ?? []} color={C.amber} />
        <MultiFilterSelect values={gestores} onChange={setGestores} label="Gestor"
          options={data?.opcoesFiltro.gestores ?? []} color={C.amber} />
        <MultiFilterSelect values={colaboradores} onChange={setColaboradores} label="Colaborador"
          options={data?.opcoesFiltro.colaboradores ?? []} color={C.amber} searchable />
        {(filtrosMes.length > 0 || unidades.length > 0 || areas.length > 0 || gestores.length > 0 || colaboradores.length > 0) && (
          <FilterTag label="limpar filtros" onClear={() => { setFiltrosMes([]); setUnidades([]); setAreas([]); setGestores([]); setColaboradores([]); }} />
        )}
        <span className="flex-1" />
        {syncedAt && <SyncBadge label={`Sync: ${syncedAt}`} />}
      </NavHeader>

      {/* ── Conteúdo ── */}
      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-8">

        {/* Título */}
        <div>
          <h1 className="text-2xl font-black" style={{ color: C.purple }}>
            Jornada & Ponto
            {filtrosMes.length > 0 && (
              <span className="text-base font-bold text-gray-400 ml-3">
                {filtrosMes.length === 1 ? fmtMes(filtrosMes[0]) : `${filtrosMes.length} meses selecionados`}
              </span>
            )}
            {unidades.length > 0 && (
              <span className="text-base font-bold ml-2" style={{ color: C.amber }}>
                {' · '}{unidades.length === 1 ? unidades[0] : `${unidades.length} unidades`}
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            {abaMoto === 'motoristas'
              ? 'Horas extras dos motoristas · Upload manual mensal da planilha do cartão ponto'
              : abaMoto === 'bh'
                ? 'Banco de horas dos colaboradores · Upload manual mensal · Histórico completo'
                : filtrosMes.length === 0
                  ? 'Acumulado histórico (2025–2026) · Horas extras, absenteísmo e pontualidade · Fonte: TiqueTaque'
                  : 'Horas extras, absenteísmo e pontualidade · Fonte: TiqueTaque'}
          </p>
        </div>

        {/* ── Abas: Jornada Geral / Motoristas / Banco de Horas ── */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 w-fit">
          {(['jornada', 'motoristas', 'bh'] as const).map(aba => (
            <button
              key={aba}
              onClick={() => setAbaMoto(aba)}
              className="text-[12px] font-bold px-4 py-1.5 rounded-full transition-all cursor-pointer"
              style={{
                backgroundColor: abaMoto === aba ? C.amber : 'transparent',
                color: abaMoto === aba ? 'white' : '#6B7280',
              }}
            >
              {aba === 'jornada' ? '📊 Jornada Geral' : aba === 'motoristas' ? '🚛 Motoristas' : '🏦 Banco de Horas'}
            </button>
          ))}
        </div>

        {abaMoto === 'jornada' && (<>

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
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : kpis && (
          <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard label="Funcionários"    value={kpis.totalFuncionarios}        sub="no período"            color={C.purple} icon="👥" />
            <KpiCard label="HE Total"        value={fmtH(kpis.totalHE)}           sub={`50%:${fmtH(kpis.he50)} 60%:${fmtH(kpis.he60)} 100%:${fmtH(kpis.he100)}`} color={C.amber}  icon="⏱" />
            <KpiCard label="Absenteísmo"     value={`${kpis.taxaAbsenteismo}%`}   sub={`${fmtH(kpis.totalAusencias)} ausentes`} color={absBadgeColor(kpis.taxaAbsenteismo)} icon="📉" />
            <KpiCard label="Faltas"          value={fmtH(kpis.totalFaltas)}       sub="injustificadas"        color={C.pink}   icon="🚫" />
            <KpiCard label="Atestados"       value={fmtH(kpis.totalAtestados)}    sub="médicos/ausências just." color={C.blue}  icon="🏥" />
            <KpiCard label="Atrasos"         value={fmtH(kpis.totalAtraso)}       sub="soma do período"       color={C.orange} icon="🕐" />
          </div>

          {/* ── Faixa financeira ── */}
          {(() => {
            const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const custoTotal = kpis.custoHe + kpis.custoAusencias + kpis.custoNoturno;
            return (
              <div className="mt-3 rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">💸</span>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">Impacto Financeiro do Período</span>
                  <span className="ml-auto text-xs text-white/40">valor/hora individual do TiqueTaque</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-xl p-3 text-center" style={{ backgroundColor: `${C.amber}25` }}>
                    <div className="text-[9px] font-bold uppercase text-amber-300/80 mb-1">Custo Horas Extras</div>
                    <div className="text-lg font-black text-amber-300">{fmtBRL(kpis.custoHe)}</div>
                    <div className="text-[9px] text-white/40 mt-0.5">{fmtH(kpis.totalHE)} trabalhadas</div>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ backgroundColor: `${C.pink}25` }}>
                    <div className="text-[9px] font-bold uppercase text-pink-300/80 mb-1">Custo Ausências</div>
                    <div className="text-lg font-black text-pink-300">{fmtBRL(kpis.custoAusencias)}</div>
                    <div className="text-[9px] text-white/40 mt-0.5">{fmtH(kpis.totalAusencias)} horas</div>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#7c3aed25' }}>
                    <div className="text-[9px] font-bold uppercase mb-1" style={{ color: '#a78bfa' }}>Adicional Noturno</div>
                    <div className="text-lg font-black" style={{ color: '#a78bfa' }}>{fmtBRL(kpis.custoNoturno)}</div>
                    <div className="text-[9px] text-white/40 mt-0.5">{fmtH(kpis.totalNoturno)} horas</div>
                  </div>
                  <div className="rounded-xl p-3 text-center lg:col-span-1 col-span-2" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                    <div className="text-[9px] font-bold uppercase text-white/60 mb-1">Total Impacto Estimado</div>
                    <div className="text-lg font-black text-white">{fmtBRL(custoTotal)}</div>
                    <div className="text-[9px] text-white/40 mt-0.5">no período selecionado</div>
                  </div>
                </div>
              </div>
            );
          })()}
          </>
        )}

        {/* ── Por Filial ── */}
        {!loading && data && data.porFilial.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            <Card>
              <SectionTitle icon="🏢">HE por Filial</SectionTitle>
              {data.porFilial.map((f, i) => (
                <BarH key={f.filial} label={f.filial} value={f.extra_total} max={maxFilialHE}
                      color={PALETTE[i % PALETTE.length]}
                      subLabel={`${f.funcionarios} func · 50%:${fmtH(f.extra_50)} 60%:${fmtH(f.extra_60)} 100%:${fmtH(f.extra_100)} · ${(+f.custo_he).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`} />
              ))}
            </Card>

            <Card>
              <SectionTitle icon="📉">Ausências por Filial</SectionTitle>
              {data.porFilial.map((f, i) => (
                <BarH key={f.filial} label={f.filial} value={f.ausencias} max={maxFilialAbs}
                      color={PALETTE[i % PALETTE.length]}
                      subLabel={`Faltas: ${fmtH(f.faltas)} · Atestados: ${fmtH(f.atestados)} · ${(+f.custo_ausencias).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`} />
              ))}
            </Card>
          </div>
        )}

        {/* ── Painel Financeiro por Filial ── */}
        {!loading && data && data.porFilial.length > 0 && (() => {
          const fmtBRL = (v: number) => (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const filiais = data.porFilial.map(f => ({
            ...f,
            total: (+f.custo_he) + (+f.custo_ausencias) + (+f.custo_noturno),
          }));
          const maxTotal = Math.max(...filiais.map(f => f.total), 1);
          return (
            <Card>
              <SectionTitle icon="📊">Painel Financeiro por Filial</SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b text-right">
                      <th className="text-left pb-2 font-semibold w-36">Filial</th>
                      <th className="pb-2 font-semibold" style={{ color: C.amber }}>Custo HE</th>
                      <th className="pb-2 font-semibold" style={{ color: C.pink }}>Custo Ausências</th>
                      <th className="pb-2 font-semibold" style={{ color: '#a78bfa' }}>Adic. Noturno</th>
                      <th className="pb-2 font-semibold text-gray-600">Total Estimado</th>
                      <th className="pb-2 w-32"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filiais.map((f, i) => (
                      <tr key={f.filial} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="py-2.5 font-semibold text-gray-700">{f.filial}</td>
                        <td className="py-2.5 text-right font-mono" style={{ color: C.amber }}>{fmtBRL(f.custo_he)}</td>
                        <td className="py-2.5 text-right font-mono" style={{ color: C.pink }}>{fmtBRL(f.custo_ausencias)}</td>
                        <td className="py-2.5 text-right font-mono" style={{ color: '#a78bfa' }}>{fmtBRL(f.custo_noturno)}</td>
                        <td className="py-2.5 text-right font-mono font-bold text-gray-700">{fmtBRL(f.total)}</td>
                        <td className="py-2.5 pl-3">
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(f.total / maxTotal) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-200 font-bold">
                      <td className="pt-3 text-gray-700">Total</td>
                      <td className="pt-3 text-right font-mono" style={{ color: C.amber }}>{fmtBRL(filiais.reduce((s,f)=>s+(+f.custo_he),0))}</td>
                      <td className="pt-3 text-right font-mono" style={{ color: C.pink }}>{fmtBRL(filiais.reduce((s,f)=>s+(+f.custo_ausencias),0))}</td>
                      <td className="pt-3 text-right font-mono" style={{ color: '#a78bfa' }}>{fmtBRL(filiais.reduce((s,f)=>s+(+f.custo_noturno),0))}</td>
                      <td className="pt-3 text-right font-mono text-gray-700">{fmtBRL(filiais.reduce((s,f)=>s+f.total,0))}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })()}

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

        {/* ── Cruzamento RH (por gestor + por cargo) ── */}
        {!loading && data && (data.absByGestor.length > 0 || data.absByCargo.length > 0) && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {data.absByGestor.length > 0 && (
              <Card>
                <SectionTitle icon="👔">Absenteísmo por Gestor</SectionTitle>
                {data.absByGestor.map((g, i) => (
                  <BarH key={g.gestor} label={g.gestor} value={g.total_ausencia} max={maxGestor}
                        color={PALETTE[i % PALETTE.length]} labelWidth={165} wrap
                        subLabel={`${g.funcionarios} func · média ${fmtH(g.media_ausencia)}/pessoa`} />
                ))}
              </Card>
            )}

            {data.absByCargo.length > 0 && (
              <Card>
                <SectionTitle icon="🏷">Ausências por Cargo</SectionTitle>
                {data.absByCargo.slice(0, 12).map((c, i) => (
                  <BarH key={c.cargo} label={c.cargo} value={c.total_ausencia} max={maxCargo}
                        color={PALETTE[i % PALETTE.length]} labelWidth={165} wrap
                        total={totalAbsCargo}
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

        </>)}

        {/* ── Motoristas ── */}
        {abaMoto === 'motoristas' && (
          <div className="space-y-6">

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black" style={{ color: C.amber }}>Horas Extras — Motoristas</h2>
                <p className="text-xs text-gray-400 mt-0.5">Histórico mensal por motorista · Upload da planilha do cartão ponto</p>
              </div>
              {isRHouAdmin && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase">Competência</label>
                    <input
                      type="month"
                      value={motoMes}
                      onChange={e => setMotoMes(e.target.value)}
                      className="text-xs border-2 rounded-lg px-3 py-1.5 outline-none"
                      style={{ borderColor: motoMes ? C.amber : '#E5E7EB', color: motoMes ? C.amber : '#6B7280' }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!motoMes) { setMotoErro('Selecione a competência (mês/ano) antes de carregar o arquivo.'); return; }
                      setMotoErro(''); setMotoOk('');
                      fileRef.current?.click();
                    }}
                    disabled={motoUploading}
                    className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full transition-all cursor-pointer mt-4"
                    style={{ backgroundColor: C.amber, color: 'white', opacity: motoUploading ? 0.6 : 1 }}
                  >
                    {motoUploading ? '⏳ Enviando...' : '📁 Carregar planilha'}
                  </button>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleMotoUpload} />
                </div>
              )}
            </div>

            {motoErro && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{motoErro}</div>}
            {motoOk  && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">{motoOk}</div>}

            {/* Seletor de competência disponível */}
            {motoCompetencias.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 font-semibold">Histórico:</span>
                {motoCompetencias.map(c => (
                  <button
                    key={c}
                    onClick={() => setMotoCompetencia(c)}
                    className="text-[11px] font-bold px-3 py-1 rounded-full transition-all cursor-pointer border-2"
                    style={{
                      backgroundColor: motoCompetencia === c ? C.amber : 'white',
                      color: motoCompetencia === c ? 'white' : C.amber,
                      borderColor: C.amber,
                    }}
                  >
                    {fmtMes(c.substring(0, 7))}
                  </button>
                ))}
              </div>
            )}

            {/* Tabela */}
            {motoLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : motoRows.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">🚛</div>
                <p className="font-semibold">Nenhum dado de motoristas encontrado.</p>
                <p className="text-sm mt-1">
                  {isRHouAdmin
                    ? 'Selecione a competência e carregue a planilha para começar.'
                    : 'Aguarde o RH carregar a planilha do mês.'}
                </p>
              </div>
            ) : (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <SectionTitle icon="🚛">
                    Motoristas — {fmtMes(motoCompetencia.substring(0, 7))}
                  </SectionTitle>
                  <span className="text-[11px] text-gray-400">{motoRows.length} motorista{motoRows.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ minWidth: 720 }}>
                    <thead>
                      <tr className="text-gray-400 border-b">
                        <th className="text-left pb-3 font-semibold pr-4">Motorista</th>
                        <th className="text-right pb-3 font-semibold">H. Normal</th>
                        <th className="text-right pb-3 font-semibold">HN Noturna</th>
                        <th className="text-right pb-3 font-semibold" style={{ color: C.amber }}>HE 50%</th>
                        <th className="text-right pb-3 font-semibold" style={{ color: `${C.amber}99` }}>HE 50% Not.</th>
                        <th className="text-right pb-3 font-semibold" style={{ color: C.pink }}>HE 100%</th>
                        <th className="text-right pb-3 font-semibold" style={{ color: `${C.pink}99` }}>HE 100% Not.</th>
                        <th className="text-right pb-3 font-semibold" style={{ color: C.purple }}>Total HE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {motoRows.map((r, i) => {
                        const totalHE = r.hora_extra_50_min + r.hora_extra_50_not_min + r.hora_extra_100_min + r.hora_extra_100_not_min;
                        return (
                          <tr key={i} className="border-b border-gray-50 hover:bg-amber-50/30 transition-colors">
                            <td className="py-2.5 pr-4 font-semibold text-gray-800">{r.nome}</td>
                            <td className="py-2.5 text-right tabular-nums text-gray-600">{fmtMin(r.hora_normal_min)}</td>
                            <td className="py-2.5 text-right tabular-nums text-gray-500">{fmtMin(r.hora_normal_not_min)}</td>
                            <td className="py-2.5 text-right tabular-nums font-medium" style={{ color: C.amber }}>{fmtMin(r.hora_extra_50_min)}</td>
                            <td className="py-2.5 text-right tabular-nums" style={{ color: `${C.amber}99` }}>{fmtMin(r.hora_extra_50_not_min)}</td>
                            <td className="py-2.5 text-right tabular-nums font-medium" style={{ color: C.pink }}>{fmtMin(r.hora_extra_100_min)}</td>
                            <td className="py-2.5 text-right tabular-nums" style={{ color: `${C.pink}99` }}>{fmtMin(r.hora_extra_100_not_min)}</td>
                            <td className="py-2.5 text-right tabular-nums font-black" style={{ color: totalHE > 0 ? C.purple : '#9CA3AF' }}>{fmtMin(totalHE)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200">
                        <td className="py-2.5 pr-4 font-black text-gray-700">Total</td>
                        <td className="py-2.5 text-right tabular-nums font-bold text-gray-600">{fmtMin(motoRows.reduce((s, r) => s + r.hora_normal_min, 0))}</td>
                        <td className="py-2.5 text-right tabular-nums font-bold text-gray-500">{fmtMin(motoRows.reduce((s, r) => s + r.hora_normal_not_min, 0))}</td>
                        <td className="py-2.5 text-right tabular-nums font-bold" style={{ color: C.amber }}>{fmtMin(motoRows.reduce((s, r) => s + r.hora_extra_50_min, 0))}</td>
                        <td className="py-2.5 text-right tabular-nums font-bold" style={{ color: `${C.amber}99` }}>{fmtMin(motoRows.reduce((s, r) => s + r.hora_extra_50_not_min, 0))}</td>
                        <td className="py-2.5 text-right tabular-nums font-bold" style={{ color: C.pink }}>{fmtMin(motoRows.reduce((s, r) => s + r.hora_extra_100_min, 0))}</td>
                        <td className="py-2.5 text-right tabular-nums font-bold" style={{ color: `${C.pink}99` }}>{fmtMin(motoRows.reduce((s, r) => s + r.hora_extra_100_not_min, 0))}</td>
                        <td className="py-2.5 text-right tabular-nums font-black" style={{ color: C.purple }}>
                          {fmtMin(motoRows.reduce((s, r) => s + r.hora_extra_50_min + r.hora_extra_50_not_min + r.hora_extra_100_min + r.hora_extra_100_not_min, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {motoRows[0]?.uploaded_at && (
                  <p className="text-[10px] text-gray-400 mt-3">
                    Última atualização: {motoRows[0].uploaded_at}
                    {motoRows[0].uploaded_by ? ` · por ${motoRows[0].uploaded_by}` : ''}
                  </p>
                )}
              </Card>
            )}

          </div>
        )}

        {/* ── Banco de Horas (nova funcionalidade) ── */}
        {abaMoto === 'bh' && (
          <div className="space-y-6">

            {/* Upload + seleção de competência */}
            <Card>
              <SectionTitle icon="🏦">Banco de Horas — Upload Mensal</SectionTitle>
              <p className="text-xs text-gray-400 mb-4">
                Envie uma planilha com duas colunas: <strong>Colaborador</strong> e <strong>Saldo BH</strong> (formato HH:MM:SS ou HH:MM).
                Os dados são vinculados ao cadastro de colaboradores para exibir Unidade, Cargo e Departamento.
              </p>

              {isRHouAdmin && (
                <div className="flex flex-wrap items-end gap-3 mb-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Competência</label>
                    <input
                      type="month"
                      value={bhMes}
                      onChange={e => setBhMes(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': C.teal } as React.CSSProperties}
                    />
                  </div>
                  <button
                    onClick={() => bhFileRef.current?.click()}
                    disabled={bhUploading || !bhMes}
                    className="text-xs font-bold px-4 py-2 rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: C.teal }}
                  >
                    {bhUploading ? 'Enviando…' : '⬆ Carregar Excel'}
                  </button>
                  <input ref={bhFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBHUpload} />
                </div>
              )}

              {bhErro && <p className="text-xs text-red-500 mb-3">{bhErro}</p>}
              {bhOk  && <p className="text-xs mb-3 font-semibold" style={{ color: C.teal }}>{bhOk}</p>}

              {/* Botões de competências históricas */}
              {bhCompetencias.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {bhCompetencias.map(c => {
                    const [y, m] = c.split('-');
                    const label = new Date(+y, +m - 1, 1).toLocaleString('pt-BR', { month: 'short', year: '2-digit' }).replace('. ', '/');
                    return (
                      <button
                        key={c}
                        onClick={() => setBhCompetencia(c)}
                        className="text-[11px] font-bold px-3 py-1 rounded-full border transition-all"
                        style={{
                          backgroundColor: bhCompetencia === c ? C.teal : 'transparent',
                          color: bhCompetencia === c ? 'white' : C.teal,
                          borderColor: C.teal,
                        }}
                      >
                        {label.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Tabela de saldos */}
            {bhCompetencia && (
              <Card>
                {bhLoading
                  ? <Skeleton className="h-48" />
                  : bhRows.length === 0
                    ? <p className="text-xs text-gray-400">Nenhum dado para esta competência.</p>
                    : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 border-b text-left">
                              <th className="pb-2 font-semibold">Colaborador</th>
                              <th className="pb-2 font-semibold">Unidade</th>
                              <th className="pb-2 font-semibold">Cargo</th>
                              <th className="pb-2 font-semibold">Departamento</th>
                              <th className="pb-2 font-semibold text-right">Saldo BH</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bhRows.map((r, i) => {
                              const pos = r.saldo_minutos >= 0;
                              const h = Math.floor(Math.abs(r.saldo_minutos) / 60);
                              const m = Math.abs(r.saldo_minutos) % 60;
                              const label = `${pos ? '+' : '-'}${h}h${m.toString().padStart(2, '0')}`;
                              return (
                                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60">
                                  <td className="py-2 font-semibold text-gray-800">{r.nome}</td>
                                  <td className="py-2 text-gray-500">{r.unidade || '—'}</td>
                                  <td className="py-2 text-gray-500">{r.cargo || '—'}</td>
                                  <td className="py-2 text-gray-500">{r.departamento || '—'}</td>
                                  <td className="py-2 text-right font-bold font-mono" style={{ color: pos ? C.teal : C.pink }}>{label}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-gray-200 font-bold">
                              <td colSpan={4} className="pt-3 text-gray-700">Total ({bhRows.length} colaboradores)</td>
                              <td className="pt-3 text-right font-mono" style={{ color: bhRows.reduce((s,r)=>s+r.saldo_minutos,0)>=0?C.teal:C.pink }}>
                                {(() => {
                                  const tot = bhRows.reduce((s,r)=>s+r.saldo_minutos,0);
                                  const h = Math.floor(Math.abs(tot)/60);
                                  const m = Math.abs(tot)%60;
                                  return `${tot>=0?'+':'-'}${h}h${m.toString().padStart(2,'0')}`;
                                })()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                        {bhRows[0]?.uploaded_at && (
                          <p className="text-[10px] text-gray-400 mt-3">
                            Última atualização: {bhRows[0].uploaded_at}
                          </p>
                        )}
                      </div>
                    )}
              </Card>
            )}

          </div>
        )}

        {/* ── Footer ── */}
        <footer className="text-center text-[10px] text-gray-400 pb-6">
          VENDEMMIA PEOPLE — Sistema de Gestão de Pessoas ·{abaMoto === 'motoristas' ? ' Upload manual · Cartão Ponto Motoristas' : abaMoto === 'bh' ? ' Upload manual · Banco de Horas' : ' Dados via API TiqueTaque'} · {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  );
}
