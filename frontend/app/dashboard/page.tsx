'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';

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

type TenureFaixa = { faixa: string; count: number };
type TenureTipo  = { tipo: string; mediaDias: number; count: number };
type MortUnid    = { unidade: string; ate3m: number; total: number };
type CargoCt     = { cargo: string; count: number };
type SpanBkts    = { ate3: number; de4a7: number; de8a15: number; acima15: number };
type GenUnid     = { unidade: string; M: number; F: number };
type EtniaItem   = { etnia: string; count: number; pct: number };
type IdadeFaixa  = { faixa: string; M: number; F: number; total: number };
type Geracao     = { geracao: string; count: number };
type VinculoItem = { vinculo: string; count: number; pct: number };

type RiscoColab = {
  nome: string; cargo: string; unidade: string; departamento: string;
  gestor: string; diasEmpresa: number; score: number; nivel: 'alto' | 'medio' | 'baixo';
  fatores: string[];
};

type DashData = {
  periodo: number;
  atualizadoEm: string;
  filtros: { unidade: string; area: string };
  opcoesFiltro: { unidades: string[]; areas: string[] };
  kpis: KPIs;
  turnoverPorUnidade: TurnoverUnidade[];
  turnoverPorArea: TurnoverArea[];
  rankingGestores: Gestor[];
  tiposDesligamento: TipoDesl[];
  tendenciaMensal: Tendencia[];
  headcountPorUnidade: HcUnidade[];
  ultimosDesligamentos: UltDesl[];
  riscoTurnover: { alto: number; medio: number; baixo: number; top20: RiscoColab[] };
  tenure: { mediaDias: number; mediaMeses: number; faixas: TenureFaixa[]; porTipo: TenureTipo[] };
  mortalidadeInfantil: {
    ate3m: number; de3a6m: number; ate6m: number; total: number;
    pctAte3m: number; pctAte6m: number; porUnidade: MortUnid[];
  };
  estrutura: { totalGestores: number; spanMedio: number; spanBuckets: SpanBkts; headcountPorCargo: CargoCt[] };
  diversidade: {
    genero: { geral: { M: number; F: number; ND: number; total: number }; pctF: number; porUnidade: GenUnid[] };
    etnia: { distribuicao: EtniaItem[]; pctNaoBranca: number; totalComInfo: number };
    idade: { media: number; faixas: IdadeFaixa[]; geracoes: Geracao[]; totalComInfo: number };
    vinculo: VinculoItem[];
  };
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
  'Nao informado':             C.gray,
};

const PALETTE = [C.pink, C.amber, C.blue, C.purple, '#8B5CF6', '#DC2626', '#0D9488', '#01E18E', '#F97316'];

function tipoColor(tipo: string, idx: number): string {
  return TIPO_CORES[tipo] ?? PALETTE[idx % PALETTE.length];
}

function taxaColor(taxa: number): string {
  if (taxa < 5)  return C.green;
  if (taxa < 15) return C.amber;
  return C.pink;
}

// ─── Componentes de gráfico ────────────────────────────────────────────────────

function BarHorizontal({ label, value, max, color, suffix = '%', subLabel, labelWidth = 100 }: {
  label: string; value: number; max: number; color: string; suffix?: string; subLabel?: string; labelWidth?: number;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="text-right shrink-0 overflow-hidden" style={{ width: labelWidth }}>
        <span className="text-xs font-semibold text-gray-700 leading-tight"
              style={{ whiteSpace: 'nowrap', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
              title={label}>{label}</span>
        {subLabel && <div className="text-[10px] text-gray-400 leading-tight">{subLabel}</div>}
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

function smoothPath(pts: [number, number][]): string {
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

function DataLabel({ x, y, val, color, above }: { x:number; y:number; val:number; color:string; above:boolean }) {
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

function LineChart({ data }: { data: Tendencia[] }) {
  const W = 560, H = 165, padL = 18, padR = 18, padT = 30, padB = 28;
  const n = data.length;
  const maxVal = Math.max(...data.flatMap(d => [d.admissoes, d.desligamentos]), 1);

  const getX = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const getY = (v: number) => padT + (1 - v / maxVal) * (H - padT - padB);

  const ptsAdm:  [number, number][] = data.map((d, i) => [getX(i), getY(d.admissoes)]);
  const ptsDesl: [number, number][] = data.map((d, i) => [getX(i), getY(d.desligamentos)]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'visible' }}>
      <path d={smoothPath(ptsAdm)}  fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" />
      <path d={smoothPath(ptsDesl)} fill="none" stroke={C.pink}  strokeWidth="2.5" strokeLinecap="round" />
      {data.map((d, i) => {
        const [ax, ay] = ptsAdm[i];
        const [dx, dy] = ptsDesl[i];
        // ponto com menor Y (mais alto na tela) recebe rótulo acima; o outro, abaixo
        const admAbove = ay <= dy;
        return (
          <g key={i}>
            <DataLabel x={ax} y={ay} val={d.admissoes}    color={C.green} above={admAbove} />
            <DataLabel x={dx} y={dy} val={d.desligamentos} color={C.pink}  above={!admAbove} />
            <circle cx={ax} cy={ay} r="4" fill="white" stroke={C.green} strokeWidth="2" />
            <circle cx={dx} cy={dy} r="4" fill="white" stroke={C.pink}  strokeWidth="2" />
            {i % 2 === 0 && (
              <text x={getX(i)} y={H - 6} textAnchor="middle" fontSize="8" fill={C.gray}>{d.mes}</text>
            )}
          </g>
        );
      })}
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
          const color = tipoColor(d.tipo, i);
          const dash  = (d.count / Math.max(total, 1)) * circum;
          const gap   = circum - dash;
          const seg   = (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={color}
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
        {data.map((d, i) => (
          <li key={d.tipo} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tipoColor(d.tipo, i) }} />
            <span className="text-xs text-gray-600 leading-tight">{d.tipo}</span>
            <span className="ml-auto text-xs font-bold" style={{ color: tipoColor(d.tipo, i) }}>{d.count}</span>
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

function GenderBar({ M, F }: { M: number; F: number }) {
  const total = M + F;
  const pM = total > 0 ? (M / total) * 100 : 50;
  const pF = total > 0 ? (F / total) * 100 : 50;
  return (
    <div className="flex rounded-full overflow-hidden h-7 text-xs font-bold text-white">
      {pM > 0 && (
        <div className="flex items-center justify-center gap-1" style={{ width: `${pM}%`, backgroundColor: C.purple }}>
          {pM > 8 && <><span>M</span><span>{pM.toFixed(0)}%</span></>}
        </div>
      )}
      {pF > 0 && (
        <div className="flex items-center justify-center gap-1" style={{ width: `${pF}%`, backgroundColor: C.pink }}>
          {pF > 8 && <><span>F</span><span>{pF.toFixed(0)}%</span></>}
        </div>
      )}
    </div>
  );
}

function PiramideRow({ faixa, M, F, maxVal }: { faixa: string; M: number; F: number; maxVal: number }) {
  const pM = maxVal > 0 ? (M / maxVal) * 100 : 0;
  const pF = maxVal > 0 ? (F / maxVal) * 100 : 0;
  return (
    <div className="flex items-center gap-2 mb-2">
      {/* Lado masculino — barra cresce do centro para a esquerda */}
      <div className="flex-1 flex items-center justify-end gap-2">
        <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: C.purple, minWidth: 20, textAlign: 'right' }}>{M}</span>
        <div className="flex-1 flex justify-end">
          <div className="h-7 rounded-l-full"
               style={{ width: `${pM}%`, backgroundColor: C.purple, minWidth: M > 0 ? 4 : 0 }} />
        </div>
      </div>
      {/* Rótulo central */}
      <div className="text-[10px] font-medium text-gray-500 text-center shrink-0" style={{ width: 72 }}>{faixa}</div>
      {/* Lado feminino — barra cresce do centro para a direita */}
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1">
          <div className="h-7 rounded-r-full"
               style={{ width: `${pF}%`, backgroundColor: C.pink, minWidth: F > 0 ? 4 : 0 }} />
        </div>
        <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: C.pink, minWidth: 20 }}>{F}</span>
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
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [filtroArea,    setFiltroArea]    = useState('');

  // Alertas
  const [alertaOpen,      setAlertaOpen]      = useState(false);
  const [alertaEmail,     setAlertaEmail]      = useState('');
  const [alertaThreshold, setAlertaThreshold]  = useState(10);
  const [alertaStatus,    setAlertaStatus]     = useState<{ tipo: 'ok' | 'erro' | 'loading' | null; msg: string }>({ tipo: null, msg: '' });
  const [alertaInfo,      setAlertaInfo]       = useState<{ taxaGeral: number; emAlerta: boolean; smtpConfigurado: boolean; unidadesEmAlerta: {unidade:string;taxa:number}[] } | null>(null);
  const alertaRef = useRef<HTMLDivElement>(null);

  const verificarAlerta = useCallback(() => {
    setAlertaStatus({ tipo: 'loading', msg: 'Verificando...' });
    fetch(`/api/alertas?threshold=${alertaThreshold}&meses=${periodo}`)
      .then(r => r.json())
      .then(d => { setAlertaInfo(d); setAlertaStatus({ tipo: null, msg: '' }); })
      .catch(() => setAlertaStatus({ tipo: 'erro', msg: 'Erro ao verificar' }));
  }, [alertaThreshold, periodo]);

  const enviarAlerta = useCallback(() => {
    if (!alertaEmail) { setAlertaStatus({ tipo: 'erro', msg: 'Informe o email de destino' }); return; }
    setAlertaStatus({ tipo: 'loading', msg: 'Enviando...' });
    fetch('/api/alertas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinatario: alertaEmail, threshold: alertaThreshold, meses: periodo }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) setAlertaStatus({ tipo: 'erro', msg: d.error });
        else         setAlertaStatus({ tipo: 'ok', msg: d.mensagem || 'Email enviado!' });
      })
      .catch(() => setAlertaStatus({ tipo: 'erro', msg: 'Erro ao enviar email' }));
  }, [alertaEmail, alertaThreshold, periodo]);

  const carregar = useCallback((meses: number, unidade: string, area: string) => {
    setLoading(true);
    const params = new URLSearchParams({ meses: String(meses) });
    if (unidade) params.set('unidade', unidade);
    if (area)    params.set('area',    area);
    fetch(`/api/dashboard?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(d => { setData(d); setErro(''); })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { carregar(periodo, filtroUnidade, filtroArea); }, [periodo, filtroUnidade, filtroArea, carregar]);

  const kpis = data?.kpis;
  const atualizado = data?.atualizadoEm
    ? new Date(data.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: C.white }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b-4" style={{ borderColor: C.purple }}>
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center">
            <img src="/logo.png" alt="Vendemmia People" className="h-20 w-auto" />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/carreira"
              className="text-xs font-bold px-3 py-1 rounded-full border-2 transition-all cursor-pointer"
              style={{ borderColor: '#0D9488', color: '#0D9488' }}>
              Carreira & Dev →
            </Link>
            <Link href="/colaborador"
              className="text-xs font-bold px-3 py-1 rounded-full border-2 transition-all cursor-pointer"
              style={{ borderColor: C.purple, color: C.purple }}>
              Consulta Colaborador →
            </Link>

            {/* Filtro por unidade */}
            <select
              value={filtroUnidade}
              onChange={e => setFiltroUnidade(e.target.value)}
              className="text-xs border-2 rounded-full px-3 py-1 outline-none transition-all cursor-pointer"
              style={{ borderColor: filtroUnidade ? C.purple : '#D1D5DB', color: filtroUnidade ? C.purple : C.gray, fontWeight: filtroUnidade ? 700 : 400 }}
            >
              <option value="">Todas as unidades</option>
              {(data?.opcoesFiltro.unidades ?? []).map(u => <option key={u} value={u}>{u}</option>)}
            </select>

            {/* Filtro por área */}
            <select
              value={filtroArea}
              onChange={e => setFiltroArea(e.target.value)}
              className="text-xs border-2 rounded-full px-3 py-1 outline-none transition-all cursor-pointer"
              style={{ borderColor: filtroArea ? C.purple : '#D1D5DB', color: filtroArea ? C.purple : C.gray, fontWeight: filtroArea ? 700 : 400 }}
            >
              <option value="">Todas as áreas</option>
              {(data?.opcoesFiltro.areas ?? []).map(a => <option key={a} value={a}>{a}</option>)}
            </select>

            {(filtroUnidade || filtroArea) && (
              <button onClick={() => { setFiltroUnidade(''); setFiltroArea(''); }}
                className="text-xs font-bold px-2 py-1 rounded-full border-2 transition-all cursor-pointer"
                style={{ borderColor: C.pink, color: C.pink }}>
                ✕ limpar
              </button>
            )}

            <span className="text-xs text-gray-500">Período:</span>
            {[3, 6, 12].map(m => (
              <button
                key={m}
                onClick={() => setPeriodo(m)}
                className="text-xs font-bold px-3 py-1 rounded-full border-2 transition-all cursor-pointer"
                style={{
                  borderColor: periodo === m ? C.purple : '#D1D5DB',
                  backgroundColor: periodo === m ? C.purple : 'transparent',
                  color: periodo === m ? 'white' : C.gray,
                }}
              >
                {m}m
              </button>
            ))}
            {atualizado && (
              <span className="text-[10px] text-gray-400">Atualizado: {atualizado}</span>
            )}

            {/* Botão de alertas */}
            <button
              onClick={() => { setAlertaOpen(o => !o); if (!alertaInfo) verificarAlerta(); }}
              className="relative text-xs font-bold px-3 py-1 rounded-full border-2 transition-all cursor-pointer"
              style={{ borderColor: C.amber, color: C.amber }}
              title="Configurar alertas por email"
            >
              🔔 Alertas
              {alertaInfo?.emAlerta && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border border-white" />
              )}
            </button>

            {/* Logout */}
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/login';
              }}
              className="text-xs font-bold px-3 py-1 rounded-full border-2 transition-all cursor-pointer"
              style={{ borderColor: '#9CA3AF', color: '#6B7280' }}
              title="Sair do sistema"
            >
              Sair
            </button>
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
                      labelWidth={150}
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
                      labelWidth={150}
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
              Ranking de Gestores — Desligamentos ({periodo}m) — TOP 20
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

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  RADAR DE RISCO DE TURNOVER                                   */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <h2 className="font-black text-base uppercase tracking-wide border-l-4 pl-3" style={{ color: '#DC2626', borderColor: '#DC2626' }}>
            Radar de Risco — Turnover por Colaborador
          </h2>

          {/* KPI mini cards de risco */}
          {!loading && data?.riscoTurnover && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Alto Risco',  value: data.riscoTurnover.alto,  color: '#DC2626', bg: '#FEF2F2' },
                { label: 'Médio Risco', value: data.riscoTurnover.medio, color: C.amber,  bg: '#FFFBEB' },
                { label: 'Baixo Risco', value: data.riscoTurnover.baixo, color: C.green,  bg: '#F0FDF4' },
              ].map(item => (
                <div key={item.label} className="rounded-2xl p-4 text-center border" style={{ borderColor: `${item.color}30`, backgroundColor: item.bg }}>
                  <div className="text-4xl font-black" style={{ color: item.color }}>{item.value}</div>
                  <div className="text-xs font-bold text-gray-500 mt-1">{item.label}</div>
                  <div className="text-[10px] text-gray-400">colaboradores ativos</div>
                </div>
              ))}
            </div>
          )}

          {/* Tabela top 20 em risco */}
          <div className="bg-white rounded-2xl shadow-sm p-5 overflow-auto">
            <h3 className="font-black text-sm uppercase mb-1" style={{ color: C.dark }}>Top 20 — Colaboradores em Maior Risco</h3>
            <p className="text-[10px] text-gray-400 mb-4">Score calculado com base em: tempo na empresa, turnover da unidade, taxa do gestor e tipo de vínculo</p>
            {loading
              ? <Skeleton className="h-48 w-full" />
              : !data?.riscoTurnover.top20.length
                ? <p className="text-xs text-gray-400 text-center py-8">Sem dados de risco disponíveis</p>
                : (
                  <table className="w-full text-xs min-w-[680px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase text-gray-400 border-b">
                        {['Colaborador','Cargo','Área / Unidade','Tempo','Score','Nível','Fatores'].map(h => (
                          <th key={h} className="pb-2 font-bold pr-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.riscoTurnover.top20.map((r, i) => {
                        const nivelColor = r.nivel === 'alto' ? '#DC2626' : r.nivel === 'medio' ? C.amber : C.green;
                        const nivelLabel = r.nivel === 'alto' ? 'ALTO' : r.nivel === 'medio' ? 'MÉDIO' : 'BAIXO';
                        const diasLabel  = r.diasEmpresa < 31 ? `${r.diasEmpresa}d`
                          : r.diasEmpresa < 365 ? `${Math.round(r.diasEmpresa / 30)}m`
                          : `${(r.diasEmpresa / 365).toFixed(1)}a`;
                        return (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 pr-3 font-semibold max-w-[140px] truncate">{r.nome}</td>
                            <td className="py-2 pr-3 text-gray-500 max-w-[110px] truncate">{r.cargo}</td>
                            <td className="py-2 pr-3 text-gray-500 text-[10px]">
                              {r.departamento}<br/><span className="text-gray-400">{r.unidade}</span>
                            </td>
                            <td className="py-2 pr-3 font-mono text-gray-600">{diasLabel}</td>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 bg-gray-100 rounded-full h-2 w-16 overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${r.score}%`, backgroundColor: nivelColor }} />
                                </div>
                                <span className="text-[10px] font-bold tabular-nums" style={{ color: nivelColor }}>{r.score}</span>
                              </div>
                            </td>
                            <td className="py-2 pr-3">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: nivelColor }}>{nivelLabel}</span>
                            </td>
                            <td className="py-2">
                              <div className="flex flex-wrap gap-1">
                                {r.fatores.map(f => (
                                  <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{f}</span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
            }
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  ROTATIVIDADE — TEMPO DE PERMANÊNCIA                         */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <h2 className="font-black text-base uppercase tracking-wide border-l-4 pl-3" style={{ color: C.purple, borderColor: C.purple }}>
            Rotatividade — Tempo de Permanência
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Distribuição de tenure */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-black text-sm uppercase mb-1" style={{ color: C.dark }}>
                Distribuição de Permanência dos Desligados
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Tempo médio:{' '}
                <strong style={{ color: C.purple }}>
                  {data?.tenure ? fmtMeses(Math.round(data.tenure.mediaMeses)) : '—'}
                </strong>
                {data?.tenure && ` (${data.tenure.mediaDias} dias)`}
              </p>
              {loading
                ? <Skeleton className="h-44 w-full" />
                : (() => {
                    const faixas = data?.tenure.faixas ?? [];
                    const maxF = Math.max(...faixas.map(f => f.count), 1);
                    return faixas.map(f => (
                      <BarHorizontal key={f.faixa} label={f.faixa} value={f.count} max={maxF}
                        color={C.blue} suffix=" col." labelWidth={110} />
                    ));
                  })()
              }
            </div>

            {/* Mortalidade infantil */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>
                Mortalidade Infantil ({periodo}m)
              </h3>
              {loading
                ? <Skeleton className="h-44 w-full" />
                : (() => {
                    const mi = data?.mortalidadeInfantil;
                    if (!mi) return <p className="text-xs text-gray-400 text-center pt-8">Sem dados</p>;
                    return (
                      <div className="space-y-5">
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: 'Saíram < 3m', value: mi.ate3m,    pct: mi.pctAte3m,                            color: C.pink },
                            { label: 'Saíram 3–6m', value: mi.de3a6m,   pct: +(mi.pctAte6m - mi.pctAte3m).toFixed(1), color: C.amber },
                            { label: 'Total < 6m',  value: mi.ate6m,    pct: mi.pctAte6m,                            color: '#DC2626' },
                          ].map(item => (
                            <div key={item.label} className="rounded-xl p-3 text-center border"
                                 style={{ borderColor: `${item.color}40`, backgroundColor: `${item.color}0d` }}>
                              <div className="text-2xl font-black" style={{ color: item.color }}>{item.pct}%</div>
                              <div className="text-[10px] font-bold text-gray-500 mt-1 leading-tight">{item.label}</div>
                              <div className="text-[10px] text-gray-400">{item.value} pessoas</div>
                            </div>
                          ))}
                        </div>
                        {mi.porUnidade.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">Saídas &lt; 3 meses por unidade</p>
                            {mi.porUnidade.slice(0, 5).map(u => (
                              <BarHorizontal key={u.unidade} label={u.unidade} value={u.ate3m}
                                max={Math.max(...mi.porUnidade.map(x => x.ate3m), 1)}
                                color={C.pink} suffix=" col." subLabel={`de ${u.total} desligados`}
                                labelWidth={155} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()
              }
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  GESTÃO DE EFETIVO                                            */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <h2 className="font-black text-base uppercase tracking-wide border-l-4 pl-3" style={{ color: C.purple, borderColor: C.purple }}>
            Gestão de Efetivo
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Span of Control */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-black text-sm uppercase mb-1" style={{ color: C.dark }}>
                Amplitude de Controle (Span of Control)
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                {data?.estrutura
                  ? `${data.estrutura.totalGestores} gestores ativos · média de ${data.estrutura.spanMedio} diretos`
                  : loading ? '...' : '—'}
              </p>
              {loading
                ? <Skeleton className="h-32 w-full" />
                : (() => {
                    const sb = data?.estrutura.spanBuckets;
                    if (!sb) return null;
                    const buckets = [
                      { label: 'Até 3 diretos',   value: sb.ate3,    color: C.blue,   desc: 'Subutilizado' },
                      { label: '4 a 7 diretos',   value: sb.de4a7,   color: C.green,  desc: 'Ideal' },
                      { label: '8 a 15 diretos',  value: sb.de8a15,  color: C.amber,  desc: 'Amplo' },
                      { label: 'Acima de 15',     value: sb.acima15, color: C.pink,   desc: 'Sobrecarregado' },
                    ];
                    const maxB = Math.max(...buckets.map(b => b.value), 1);
                    return buckets.map(b => (
                      <BarHorizontal key={b.label} label={b.label} value={b.value} max={maxB}
                        color={b.color} suffix=" gestores" subLabel={b.desc} labelWidth={110} />
                    ));
                  })()
              }
            </div>

            {/* Headcount por Cargo Top 6 */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>
                Headcount por Cargo (Top 6)
              </h3>
              {loading
                ? <Skeleton className="h-48 w-full" />
                : (() => {
                    const cargos = (data?.estrutura.headcountPorCargo ?? []).slice(0, 6);
                    const maxC = Math.max(...cargos.map(c => c.count), 1);
                    return cargos.map(c => (
                      <BarHorizontal key={c.cargo} label={c.cargo} value={c.count} max={maxC}
                        color={C.purple} suffix=" col." labelWidth={170} />
                    ));
                  })()
              }
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  DIVERSIDADE & INCLUSÃO                                       */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <h2 className="font-black text-base uppercase tracking-wide border-l-4 pl-3" style={{ color: C.purple, borderColor: C.purple }}>
            Diversidade & Inclusão
          </h2>

          {/* Gênero */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>Distribuição de Gênero</h3>
              {loading
                ? <Skeleton className="h-52 w-full" />
                : (() => {
                    const gen = data?.diversidade.genero;
                    if (!gen) return null;
                    const { M, F, ND, total } = gen.geral;
                    return (
                      <div className="space-y-5">
                        <GenderBar M={M} F={F} />
                        <div className="grid grid-cols-3 gap-3 text-center">
                          {[
                            { label: 'Masculino',     value: M,  color: C.purple },
                            { label: 'Feminino',      value: F,  color: C.pink   },
                            { label: 'Não informado', value: ND, color: C.gray   },
                          ].map(item => (
                            <div key={item.label}>
                              <div className="text-2xl font-black" style={{ color: item.color }}>{item.value}</div>
                              <div className="text-[10px] text-gray-500">{item.label}</div>
                              <div className="text-xs font-bold" style={{ color: item.color }}>
                                {total > 0 ? `${((item.value / total) * 100).toFixed(0)}%` : '—'}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">Por unidade</p>
                          {gen.porUnidade.map(u => (
                            <div key={u.unidade} className="mb-2.5">
                              <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                                <span className="font-semibold">{u.unidade}</span>
                                <span>{u.M}M / {u.F}F</span>
                              </div>
                              <GenderBar M={u.M} F={u.F} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()
              }
            </div>

            {/* Etnia + Vínculo */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="font-black text-sm uppercase mb-1" style={{ color: C.dark }}>Diversidade Étnico-Racial</h3>
                <p className="text-xs text-gray-400 mb-4">
                  {data?.diversidade.etnia
                    ? `${data.diversidade.etnia.pctNaoBranca}% não-branca · ${data.diversidade.etnia.totalComInfo} registros`
                    : loading ? '...' : '—'}
                </p>
                {loading
                  ? <Skeleton className="h-28 w-full" />
                  : (() => {
                      const dist = data?.diversidade.etnia.distribuicao ?? [];
                      const maxE = Math.max(...dist.map(e => e.count), 1);
                      return dist.map(e => (
                        <BarHorizontal key={e.etnia} label={e.etnia} value={e.count} max={maxE}
                          color={C.dark} suffix=" col." subLabel={`${e.pct}%`} labelWidth={80} />
                      ));
                    })()
                }
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>Vínculo Empregatício</h3>
                {loading
                  ? <Skeleton className="h-20 w-full" />
                  : (() => {
                      const vinc = data?.diversidade.vinculo ?? [];
                      const maxV = Math.max(...vinc.map(v => v.count), 1);
                      return vinc.map(v => (
                        <BarHorizontal key={v.vinculo} label={v.vinculo} value={v.count} max={maxV}
                          color={C.blue} suffix=" col." subLabel={`${v.pct}%`} labelWidth={80} />
                      ));
                    })()
                }
              </div>
            </div>
          </div>

          {/* Pirâmide etária + Gerações */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-black text-sm uppercase mb-1" style={{ color: C.dark }}>Pirâmide Etária</h3>
              <p className="text-xs text-gray-400 mb-4">
                {data?.diversidade.idade
                  ? `Idade média: ${data.diversidade.idade.media} anos · ${data.diversidade.idade.totalComInfo} com data cadastrada`
                  : loading ? '...' : '—'}
              </p>
              {loading
                ? <Skeleton className="h-44 w-full" />
                : (() => {
                    const faixas = data?.diversidade.idade.faixas ?? [];
                    const maxV = Math.max(...faixas.flatMap(f => [f.M, f.F]), 1);
                    return (
                      <div>
                        <div className="flex justify-center gap-12 text-[10px] font-bold mb-3">
                          <span style={{ color: C.purple }}>◀ Masculino</span>
                          <span style={{ color: C.pink }}>Feminino ▶</span>
                        </div>
                        {[...faixas].reverse().map(f => (
                          <PiramideRow key={f.faixa} faixa={f.faixa} M={f.M} F={f.F} maxVal={maxV} />
                        ))}
                      </div>
                    );
                  })()
              }
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h3 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>Gerações</h3>
              {loading
                ? <Skeleton className="h-44 w-full" />
                : (() => {
                    const ger = data?.diversidade.idade.geracoes ?? [];
                    const totalCom = data?.diversidade.idade.totalComInfo ?? 1;
                    const CORES = [C.purple, C.blue, C.green, C.amber];
                    const maxG = Math.max(...ger.map(g => g.count), 1);
                    return ger.map((g, i) => (
                      <BarHorizontal
                        key={g.geracao}
                        label={g.geracao.split(' (')[0]}
                        value={g.count}
                        max={maxG}
                        color={CORES[i % CORES.length]}
                        suffix=" col."
                        subLabel={`${totalCom > 0 ? ((g.count / totalCom) * 100).toFixed(0) : 0}% · ${g.geracao.match(/\(([^)]+)\)/)?.[1] ?? ''}`}
                        labelWidth={90}
                      />
                    ));
                  })()
              }
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="text-center text-[10px] text-gray-400 pb-6">
          VENDEMMIA PEOPLE — Sistema de Gestão de Pessoas · Dados via API Convenia · {new Date().getFullYear()}
        </footer>

      </main>

      {/* ── Painel de Alertas (slide-in) ── */}
      {alertaOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={e => { if (e.target === e.currentTarget) setAlertaOpen(false); }}>
          <div ref={alertaRef} className="bg-white shadow-2xl w-full max-w-sm h-full overflow-y-auto border-l-4 p-6 flex flex-col gap-5" style={{ borderColor: C.amber }}>

            <div className="flex items-center justify-between">
              <h2 className="font-black text-base" style={{ color: C.dark }}>🔔 Alertas de Turnover</h2>
              <button onClick={() => setAlertaOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            {/* Status atual */}
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">Status atual</p>
              {!alertaInfo
                ? <p className="text-xs text-gray-400">Clique em &quot;Verificar&quot; para checar</p>
                : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl border" style={{
                      borderColor: alertaInfo.emAlerta ? '#DC262640' : '#16A34A40',
                      backgroundColor: alertaInfo.emAlerta ? '#FEF2F2' : '#F0FDF4',
                    }}>
                      <span className="text-2xl font-black" style={{ color: alertaInfo.emAlerta ? '#DC2626' : '#16A34A' }}>
                        {alertaInfo.taxaGeral}%
                      </span>
                      <div>
                        <div className="text-xs font-bold" style={{ color: alertaInfo.emAlerta ? '#DC2626' : '#16A34A' }}>
                          {alertaInfo.emAlerta ? '⚠️ Acima do limite' : '✅ Dentro do limite'}
                        </div>
                        <div className="text-[10px] text-gray-400">Taxa geral de turnover · limite {alertaThreshold}%</div>
                      </div>
                    </div>
                    {alertaInfo.unidadesEmAlerta?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1 font-bold">Unidades em alerta:</p>
                        {alertaInfo.unidadesEmAlerta.map(u => (
                          <div key={u.unidade} className="flex justify-between text-xs py-1 border-b border-gray-50">
                            <span className="text-gray-700">{u.unidade}</span>
                            <span className="font-black" style={{ color: '#DC2626' }}>{u.taxa}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
            </div>

            {/* Configurações */}
            <div className="space-y-3">
              <p className="text-[10px] uppercase font-bold text-gray-400">Configurações</p>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Limite de turnover (%)</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={3} max={30} step={1} value={alertaThreshold}
                    onChange={e => setAlertaThreshold(+e.target.value)}
                    className="flex-1" />
                  <span className="text-sm font-black w-8 text-right" style={{ color: C.amber }}>{alertaThreshold}%</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Email de destino</label>
                <input
                  type="email"
                  placeholder="rh@vendemmia.com.br"
                  value={alertaEmail}
                  onChange={e => setAlertaEmail(e.target.value)}
                  className="w-full text-xs border-2 rounded-lg px-3 py-2 outline-none"
                  style={{ borderColor: '#D1D5DB' }}
                />
              </div>
              {!alertaInfo?.smtpConfigurado && (
                <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg p-2">
                  ⚙️ SMTP não configurado. Copie <strong>.env.local.example</strong> para <strong>.env.local</strong> e preencha as credenciais de email.
                </p>
              )}
            </div>

            {/* Feedback de status */}
            {alertaStatus.tipo && alertaStatus.tipo !== 'loading' && (
              <div className={`text-xs rounded-lg px-3 py-2 font-medium ${alertaStatus.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {alertaStatus.tipo === 'ok' ? '✅ ' : '❌ '}{alertaStatus.msg}
              </div>
            )}

            {/* Botões */}
            <div className="flex flex-col gap-2 mt-auto">
              <button onClick={verificarAlerta} disabled={alertaStatus.tipo === 'loading'}
                className="text-xs font-bold py-2 px-4 rounded-xl border-2 transition-all"
                style={{ borderColor: C.blue, color: C.blue }}>
                {alertaStatus.tipo === 'loading' ? 'Verificando...' : '🔍 Verificar agora'}
              </button>
              <button onClick={enviarAlerta} disabled={alertaStatus.tipo === 'loading' || !alertaInfo?.smtpConfigurado}
                className="text-xs font-bold py-2 px-4 rounded-xl text-white transition-all disabled:opacity-40"
                style={{ backgroundColor: C.amber }}>
                {alertaStatus.tipo === 'loading' ? 'Enviando...' : '📧 Enviar relatório por email'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
