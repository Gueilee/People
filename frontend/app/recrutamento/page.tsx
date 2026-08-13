'use client';
import { useEffect, useState, useCallback } from 'react';
import { NavHeader, MultiFilterSelect, FilterTag, PeriodButtons, FilterSelect } from '@/components/NavHeader';

// ─── Types ────────────────────────────────────────────────────────────────────
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
  quantidade_vagas: number | null;
  faixa_salarial: string | null;
  modelo_contratacao: string | null;
  num_convocados: number | null;
  num_compareceu: number | null;
  sla_meta_dias: number | null;
  salario_real: string | null;
};

type KPIs = {
  total: number; totalPeriodo: number; abertas: number;
  congeladas: number; fechadasPeriodo: number; canceladas: number;
  slaMedia: number; taxaFechamento: number;
};
type PorStatus  = { status: string; count: number };
type PorUnidade = { unidade: string; total: number; abertas: number; fechadas: number };
type PorFonte   = { fonte: string; count: number };
type PorMotivo  = { motivo: string; count: number };
type SlaMes     = { mes: string; slaMedia: number | null; count: number };
type Opcoes     = { responsaveis: string[]; unidades: string[]; centrosCusto: string[]; gestores: string[]; fontes: string[] };

type SlaPerf = { eficienciaSLA: number | null; abertasAtrasadas: number; totalFechadas: number; dentroPrazo: number };
type RecrutData = {
  vagas: Vaga[];
  kpis: KPIs;
  porStatus: PorStatus[];
  porUnidade: PorUnidade[];
  porFonte: PorFonte[];
  porMotivo: PorMotivo[];
  slaPorMes: SlaMes[];
  opcoes: Opcoes;
  slaPerf: SlaPerf;
};

// ─── Constantes ───────────────────────────────────────────────────────────────
const C = {
  pink:   '#ff2f69',
  purple: '#422c76',
  green:  '#01E18E',
  amber:  '#F59E0B',
  teal:   '#0D9488',
  blue:   '#3B82F6',
  gray:   '#6B7280',
  dark:   '#414042',
  white:  '#faf9f5',
};

const STATUS_CFG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  Aberta:    { color: C.blue,   bg: '#EFF6FF', border: '#BFDBFE', label: 'Aberta'    },
  Fechada:   { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', label: 'Fechada'  },
  Congelada: { color: C.amber,  bg: '#FFFBEB', border: '#FDE68A', label: 'Congelada' },
  Cancelada: { color: C.gray,   bg: '#F9FAFB', border: '#E5E7EB', label: 'Cancelada' },
};

const FONTES_CORES: Record<string, string> = {
  WhatsApp: '#25D366', Indicação: C.purple, LinkedIn: '#0A66C2',
  Gupy: C.pink, SINE: C.amber, Interno: C.teal,
};

const MOTIVO_CORES: Record<string, string> = {
  'Substituição': C.pink, 'Aumento de Quadro': C.blue, 'Vaga Nova': C.teal,
};

const OPCOES_MOTIVO    = ['Aumento de quadro', 'Substituição'];
const OPCOES_TIPO_SUB  = ['Desligamento', 'Pedido de demissão', 'Transferência', 'Afastamento'];
const OPCOES_FILIAIS   = ['Garuva', 'Itapevi', 'Navegantes CD 01', 'Navegantes CD 02', 'Vila Olímpia'];
const OPCOES_MODELO    = ['CLT', 'PJ', 'Estágio', 'Temporário'];
const OPCOES_STATUS    = ['Aberta', 'Fechada', 'Congelada', 'Cancelada'];
const RESPONSAVEIS_RH  = ['Camile', 'Denise Oliveira', 'Gabriela Santos', 'Hellen', 'José Netto', 'Julia Barbosa', 'Rafaela Marques'];
const UNIDADES_SC      = ['Garuva', 'Navegantes CD 01', 'Navegantes CD 02'];
const OPCOES_CC = [
  'OPERAÇÃO VCI', 'OPERAÇÃO ARMAZEM - NVG', 'OPERAÇÃO ARMAZEM - ITV', 'OPERAÇÃO ARMAZEM - GRV',
  'OPERAÇÃO TRANSPORTE', 'COMERCIAL', 'INFRAESTRUTURA', 'PROJETOS/QUALIDADE', 'COMPRAS',
  'MARKETING', 'TI', 'FINANCEIRO - ADM', 'RH', 'JURIDICO', 'DIRETORIA',
  'EXECUTIVO ARMAZEM', 'EXECUTIVO COMERCIO', 'TI - ANALYTICS',
];
const OPCOES_FONTE = [
  'Gupy', 'Indicação', 'LinkedIn', 'Processo Seletivo Interno', 'SINE', 'Terceirizada', 'WhatsApp',
];

const OPCOES_CARGO = [
  'ANALISTA ADM JR', 'ANALISTA ADM/FATURAMENTO', 'ANALISTA ADMINISTRATIVO',
  'ANALISTA ADMINISTRATIVO PLENO', 'ANALISTA ADMINISTRATIVO SENIOR II', 'ANALISTA COMERCIAL',
  'ANALISTA COMERCIAL PLENO', 'ANALISTA COMERCIAL SÊNIOR III', 'ANALISTA CONTABIL FISCAL SÊNIOR',
  'ANALISTA CONTABIL JUNIOR', 'ANALISTA CONTABIL PLENO', 'ANALISTA DE COMPRAS',
  'ANALISTA DE COMPRAS SENIOR I', 'ANALISTA DE DP', 'ANALISTA DE ESTOQUE JR I',
  'ANALISTA DE FATURAMENTO JUNIOR', 'ANALISTA DE GROWTH SENIOR', 'ANALISTA DE IMPORT. JUNIOR',
  'ANALISTA DE IMPORTAÇÃO PLENO', 'ANALISTA DE IMPORTAÇÃO SENIOR', 'ANALISTA DE PROJETO SENIOR II',
  'ANALISTA DE PROJETOS JÚNIOR', 'ANALISTA DE PROJETOS SENIOR', 'ANALISTA DE QUALIDADE SR',
  'ANALISTA DE RH', 'ANALISTA DE RH SENIOR', 'ANALISTA DE SISTEMA SÊNIOR III',
  'ANALISTA DE SISTEMAS JUNIOR', 'ANALISTA DE SUPORTE JUNIOR', 'ANALISTA DE TESOURARIA JUNIOR',
  'ANALISTA DE TESOURARIA PLENO', 'ANALISTA DE TESOURARIA SR', 'ANALISTA DE TI',
  'ANALISTA DE TRANSPORTE JR', 'ANALISTA DE TRANSPORTE JUNIOR II', 'ANALISTA DE TRANSPORTE PLENO',
  'ANALISTA DE TRANSPORTE SÊNIOR', 'ANALISTA FISCAL JR', 'ANALISTA FISCAL PLENO',
  'ANALISTA FISCAL SÊNIOR', 'ANALISTA PROGRAMADOR', 'APRENDIZ', 'ASSISTENTE ADMINISTRATIVO',
  'ASSISTENTE ADMINISTRATIVO II', 'ASSISTENTE ADMINISTRATIVO III', 'ASSISTENTE DE FATURAMENTO',
  'ASSISTENTE DE IMPORTAÇÃO PLENO', 'ASSISTENTE DE IMPORTAÇÃO SÊNIOR', 'ASSISTENTE DE LOGISTICA',
  'ASSISTENTE DE RH JÚNIOR', 'ASSISTENTE DE TRANSPORTE', 'AUXILIAR ADMINISTRATIVO',
  'AUXILIAR DE COMPRAS', 'AUXILIAR DE LIMPEZA', 'AUXILIAR DE LOGISTICA', 'AUXILIAR DE RH',
  'AUXILIAR SERVIÇOS GERAIS', 'CONFERENTE', 'CONFERENTE IV', 'CONFERENTE SÊNIOR',
  'CONTROLLER CONTABIL', 'COORDENADOR (A) JURÍDICO (A)', 'COORDENADOR CONTABIL',
  'COORDENADOR DE EXPERIENCIA DO CLIENTE', 'COORDENADOR DE IMPORTACAO PLENO',
  'COORDENADOR DE IMPORTACAO SENIOR', 'COORDENADOR DE TECNOLOGIA', 'COORDENADOR DE TRANSPORTE',
  'COORDENADOR OPERACIONAL', 'COORDENADOR OPERACIONAL III', 'COORDENADOR(A) DE IMPORTAÇÃO PLENO',
  'COORDENADOR(A) DE RH', 'DESENVOLVEDOR', 'DESIGNER', 'DIRETOR DE RH', 'DIRETOR DE TRANSPORTES',
  'DIRETOR DE UNIDADE DE NEGÓCIOS', 'DIRETOR EXECUTIVO', 'DIRETOR FINANCEIRO',
  'ENGENHEIRO DE DADOS SENIOR', 'ESPECIALISTA DE IMPORTAÇÃO', 'ESPECIALISTA DE RH',
  'ESPECIALISTA EM ADMINISTRAÇÃO DE PESSOAS', 'ESPECIALISTA EM TESOURARIA', 'ESPECIALISTA FISCAL',
  'ESTAGIÁRIO DE MARKETING', 'ESTAGIÁRIO DE TI',
  'ESTÁGIO LOGÍSTICA INTEGRADA (COMÉRCIO EXTERIOR)',
  'EXECUTIVA COMERCIAL', 'EXECUTIVO DE VENDAS', 'GERENTE ADMINISTRATIVO', 'GERENTE DE LOGÍSTICA',
  'GERENTE DE OPERAÇÕES', 'GERENTE DE PROJETOS', 'GERENTE DE TESOURARIA', 'GERENTE EXECUTIVO',
  'HEAD DE COMUNICAÇÃO E MARKETING', 'LIDER DE LOGISTICA', 'LIDER DE LOGISTICA II',
  'LIDER DE LOGISTICA III', 'MOTORISTA', 'OPERADOR DE EMPILHADEIRA', 'OPERADOR DE EMPILHADEIRA II',
  'OPERADOR DE EMPILHADEIRA III', 'OPERADOR DE EMPILHADEIRA IV', 'PROGRAMADOR FULL STACK PLENO',
  'PROGRAMADOR FULL STACK SENIOR', 'SUPERVISOR (A) COMERCIAL', 'SUPERVISOR OPERACIONAL',
  'SUPERVISOR(A) ADMINISTRATIVO OPERACIONAL', 'SÓCIO', 'TECNICO SEGURANCA DO TRABALHO',
  'TRADER', 'ZELADOR',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtData = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const hoje = () => new Date().toISOString().split('T')[0];

// ─── Componentes visuais ──────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function StatusBadge({ status }: { status: string | null }) {
  const cfg = STATUS_CFG[status || ''] || { color: C.gray, bg: '#F9FAFB', border: '#E5E7EB', label: status || '—' };
  return (
    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border"
          style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}>
      {cfg.label}
    </span>
  );
}

function KpiCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 leading-tight">{label}</span>
      </div>
      <div className="text-2xl font-black leading-none" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 leading-tight">{sub}</div>}
    </div>
  );
}

function DonutFonte({ data }: { data: PorFonte[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  // r=62, stroke=18 → borda externa = 62+9 = 71 < 90 (cx/cy), sem corte
  const S = 180, cx = 90, cy = 90, r = 62, stroke = 18;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const cores = data.map((d, i) => FONTES_CORES[d.fonte] || [C.purple, C.teal, C.blue, C.amber][i % 4]);
  return (
    <div className="flex items-center gap-5">
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="shrink-0">
        {/* trilha de fundo */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
        {data.map((d, i) => {
          const dash = (d.count / Math.max(total, 1)) * circ;
          const seg = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={cores[i]} strokeWidth={stroke}
              strokeLinecap="butt"
              strokeDasharray={`${dash.toFixed(2)} ${(circ - dash).toFixed(2)}`}
              strokeDashoffset={(circ / 4 - offset).toFixed(2)} />
          );
          offset += dash;
          return seg;
        })}
        {/* número central */}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="26" fontWeight="700"
              fill={C.dark} fontFamily="system-ui, sans-serif">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8.5" fill="#9CA3AF"
              fontFamily="system-ui, sans-serif" letterSpacing="0.5">contratações</text>
      </svg>

      {/* legenda */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {data.map((d, i) => (
          <div key={d.fonte} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cores[i] }} />
            <span className="text-[11px] text-gray-500 flex-1 truncate">{d.fonte}</span>
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: cores[i] }}>{d.count}</span>
            <span className="text-[10px] text-gray-300 w-7 text-right tabular-nums">
              {total > 0 ? Math.round((d.count / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarUnidade({ data }: { data: PorUnidade[] }) {
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.unidade} className="flex items-center gap-3">
          <div className="text-xs font-semibold text-gray-700 shrink-0 w-24 text-right truncate" title={d.unidade}>{d.unidade}</div>
          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden relative">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(d.total / max) * 100}%`, backgroundColor: C.pink }} />
          </div>
          <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: C.pink, minWidth: 32 }}>{d.total}</span>
          <span className="text-[10px] text-gray-400 shrink-0 w-20">
            {d.abertas > 0 && <span style={{ color: C.blue }}>{d.abertas} ab. </span>}
            {d.fechadas > 0 && <span style={{ color: '#16A34A' }}>{d.fechadas} fech.</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function SlaChart({ data: rawData }: { data: SlaMes[] }) {
  // Exclui meses sem dados — ficam só os meses com fechamentos reais no eixo X
  const data = rawData.filter(d => d.slaMedia !== null);
  if (data.length < 2) return <p className="text-xs text-gray-400 text-center pt-8">Dados insuficientes</p>;

  const W = 560, H = 130, padL = 12, padR = 12, padT = 28, padB = 24;
  const n = data.length;
  const maxVal = Math.max(...data.map(d => d.slaMedia as number), 1);
  const getX = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const getY = (v: number) => padT + (1 - v / maxVal) * (H - padT - padB);

  const pts = data.map((d, i) => [getX(i), getY(d.slaMedia as number)] as [number, number]);

  // curva suave
  const linePath = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`;
    const prev = pts[i - 1];
    const mx = (prev[0] + pt[0]) / 2;
    return `${acc} C ${mx.toFixed(1)} ${prev[1].toFixed(1)} ${mx.toFixed(1)} ${pt[1].toFixed(1)} ${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`;
  }, '');

  // área preenchida
  const baseline = H - padB;
  const areaPath = `${linePath} L ${pts[n-1][0].toFixed(1)} ${baseline} L ${pts[0][0].toFixed(1)} ${baseline} Z`;

  // pico local: valor maior que os vizinhos adjacentes
  const isPeak = (i: number) => {
    const val = data[i].slaMedia as number;
    const prev = i > 0 ? data[i - 1].slaMedia as number : -Infinity;
    const next = i < n - 1 ? data[i + 1].slaMedia as number : -Infinity;
    return val > prev && val > next;
  };
  // todos os meses com dados mostram label nos picos; nos demais, alterna se houver muitos
  const showLabel = (i: number) => n <= 8 || i === 0 || i === n - 1 || isPeak(i) || i % 2 === 0;
  // todos os meses com dados aparecem no eixo X
  const showAxis  = (_i: number) => true;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="slaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={C.pink} stopOpacity="0.12" />
          <stop offset="100%" stopColor={C.pink} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* linhas de grade horizontais */}
      {[0.25, 0.5, 0.75, 1].map(t => {
        const y = padT + (1 - t) * (H - padT - padB);
        return <line key={t} x1={padL} y1={y} x2={W - padR} y2={y} stroke="#F3F4F6" strokeWidth="1" />;
      })}

      {/* área gradiente */}
      <path d={areaPath} fill="url(#slaGrad)" />

      {/* linha principal */}
      <path d={linePath} fill="none" stroke={C.pink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* pontos e labels */}
      {data.map((d, i) => {
        const pt = pts[i];
        return (
          <g key={i}>
            <text
              x={getX(i)} y={H - padB + 14}
              textAnchor="middle" fontSize="7.5" fill="#9CA3AF"
              fontFamily="system-ui, sans-serif"
            >
              {d.mes}
            </text>
            <circle cx={pt[0]} cy={pt[1]} r="2.5" fill={C.pink} />
            {showLabel(i) && (
              <text
                x={pt[0]} y={pt[1] - 7}
                textAnchor="middle" fontSize="8.5" fill={C.pink}
                fontWeight="600" fontFamily="system-ui, sans-serif"
              >
                {d.slaMedia}d
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── SLA Cell ─────────────────────────────────────────────────────────────────
const HOJE_MS = () => Date.now();

function calcSLAMetaClient(cargo: string | null): number {
  const c = (cargo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\bgerente\b|\btrader\b/.test(c))                                                return 90;
  if (/\bespecialista\b|\bcoordenador\b/.test(c))                                      return 60;
  if (/\banalista\b|\bengenheiro\b|\bdesenvolvedor\b|\bdeveloper\b|\bsdr\b/.test(c))   return 30;
  if (/empilhadeira/.test(c))                                                          return 25;
  if (/\bmotorista\b|\bauxiliar\b|\bconferente\b/.test(c))                             return 20;
  if (/estagiario|jovem\s*aprendiz|\bassistente\b/.test(c))                            return 15;
  return 30;
}

function SlaCell({ v }: { v: Vaga }) {
  const meta = v.sla_meta_dias ?? calcSLAMetaClient(v.cargo);
  if (!meta || !v.data_abertura) return <span className="text-gray-300 text-xs">—</span>;

  const abertura      = new Date(v.data_abertura).getTime();
  const diasDecorridos = Math.round((HOJE_MS() - abertura) / 86400000);
  const restantes      = meta - diasDecorridos;
  const progress       = Math.min(Math.max(diasDecorridos / meta, 0), 1);

  if (v.status === 'Fechada' && v.sla_dias != null) {
    const dentro  = v.sla_dias <= meta;
    const diff    = Math.abs(v.sla_dias - meta);
    const barPct  = Math.min(v.sla_dias / meta, 1.5);
    return (
      <div className="space-y-1" style={{ minWidth: 80 }}>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className="h-1.5 rounded-full"
               style={{ width: `${barPct * 100}%`, backgroundColor: dentro ? '#16A34A' : '#DC2626' }} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-black" style={{ color: dentro ? '#16A34A' : '#DC2626' }}>
            {dentro ? '✓' : '✗'}
          </span>
          <span className="text-[10px] font-bold tabular-nums" style={{ color: dentro ? '#16A34A' : '#DC2626' }}>
            {v.sla_dias}d
          </span>
          <span className="text-[9px] text-gray-400">/{meta}d</span>
        </div>
        <div className="text-[9px] leading-none" style={{ color: dentro ? '#16A34A' : '#DC2626' }}>
          {dentro ? `${diff}d adiantado` : `${diff}d de atraso`}
        </div>
      </div>
    );
  }

  if (v.status === 'Aberta') {
    const cor = restantes > meta * 0.25 ? '#16A34A' : restantes >= 0 ? '#F59E0B' : '#DC2626';
    return (
      <div className="space-y-1" style={{ minWidth: 80 }}>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className="h-1.5 rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: cor }} />
        </div>
        <div className="text-[10px] font-bold leading-none" style={{ color: cor }}>
          {restantes >= 0 ? `${restantes}d restantes` : `${Math.abs(restantes)}d em atraso`}
        </div>
        <div className="text-[9px] text-gray-400 leading-none">meta: {meta}d</div>
      </div>
    );
  }

  return <span className="text-[10px] text-gray-400">Meta: {meta}d</span>;
}

// ─── Helpers de formulário ────────────────────────────────────────────────────
function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: C.purple }}>{n}</span>
      <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: C.purple }}>{title}</span>
    </div>
  );
}

function Pills({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition-all"
          style={{
            backgroundColor: value === opt ? C.pink : 'white',
            borderColor:     value === opt ? C.pink : '#E5E7EB',
            color:           value === opt ? 'white' : '#4B5563',
          }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Helpers de salário ───────────────────────────────────────────────────────
function fmtSal(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return 'R$ ' + parseInt(digits, 10).toLocaleString('pt-BR');
}

function parseSalRange(v: string): [string, string] {
  if (!v) return ['', ''];
  const parts = v.split('–').map(p => p.trim());
  return [parts[0] || '', parts[1] || ''];
}

function SalarioRangeField({ initialValue, onChange }: {
  initialValue: string;
  onChange: (v: string) => void;
}) {
  const [parsed] = useState<[string, string]>(() => parseSalRange(initialValue));
  const [de,  setDe]  = useState(parsed[0]);
  const [ate, setAte] = useState(parsed[1]);

  function handle(raw: string, setter: (v: string) => void, other: string, isMin: boolean) {
    const fmt = fmtSal(raw);
    setter(fmt);
    const a = isMin ? fmt : other;
    const b = isMin ? other : fmt;
    if (a && b) onChange(`${a} – ${b}`);
    else if (a) onChange(a);
    else if (b) onChange(b);
    else onChange('');
  }

  const cls = 'flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <input className={cls} style={{ '--tw-ring-color': C.pink } as React.CSSProperties}
          placeholder="R$ 2.000" value={de} inputMode="numeric"
          onChange={e => handle(e.target.value, setDe, ate, true)} />
        <span className="text-gray-400 font-bold text-sm shrink-0">–</span>
        <input className={cls} style={{ '--tw-ring-color': C.pink } as React.CSSProperties}
          placeholder="R$ 3.500" value={ate} inputMode="numeric"
          onChange={e => handle(e.target.value, setAte, de, false)} />
      </div>
    </div>
  );
}

function SalarioSingleField({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const cls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white';
  return (
    <input className={cls} style={{ '--tw-ring-color': '#16A34A' } as React.CSSProperties}
      placeholder={placeholder ?? 'R$ 2.800'}
      value={value} inputMode="numeric"
      onChange={e => onChange(fmtSal(e.target.value))} />
  );
}

// ─── Modal Nova/Editar Vaga ───────────────────────────────────────────────────
const EMPTY_FORM = {
  cargo: '', centro_custo: '', gestor: '', unidade: '',
  quantidade_vagas: '1', data_abertura: hoje(),
  motivo: '', colaborador_substituido: '', tipo_substituicao: '',
  faixa_salarial: '', modelo_contratacao: '',
  responsavel: '', status: 'Aberta', fonte: '',
  data_fechamento: '', novo_colaborador: '', data_inicio: '', observacoes: '',
  num_convocados: '', num_compareceu: '', salario_real: '',
};

type FormState = typeof EMPTY_FORM;

function VagaModal({ vaga, opcoes, onClose, onSaved }: {
  vaga: Vaga | null; opcoes: Opcoes; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!vaga;
  const [form, setForm] = useState<FormState>(() =>
    vaga ? {
      cargo:                  vaga.cargo || '',
      centro_custo:           vaga.centro_custo || '',
      gestor:                 vaga.gestor || '',
      unidade:                vaga.unidade || '',
      quantidade_vagas:       String(vaga.quantidade_vagas ?? 1),
      data_abertura:          vaga.data_abertura?.split('T')[0] || hoje(),
      motivo:                 vaga.motivo || '',
      colaborador_substituido: vaga.colaborador_substituido || '',
      tipo_substituicao:      vaga.tipo_substituicao || '',
      faixa_salarial:         vaga.faixa_salarial || '',
      modelo_contratacao:     vaga.modelo_contratacao || '',
      responsavel:            vaga.responsavel || '',
      status:                 vaga.status || 'Aberta',
      fonte:                  vaga.fonte || '',
      data_fechamento:        vaga.data_fechamento?.split('T')[0] || '',
      novo_colaborador:       vaga.novo_colaborador || '',
      data_inicio:            vaga.data_inicio?.split('T')[0] || '',
      observacoes:            vaga.observacoes || '',
      num_convocados:         String(vaga.num_convocados ?? ''),
      num_compareceu:         String(vaga.num_compareceu ?? ''),
      salario_real:           vaga.salario_real || '',
    } : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [erro, setErro]     = useState('');

  const set  = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));
  const pick = (k: keyof FormState) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!form.cargo.trim())       { setErro('Cargo é obrigatório.'); return; }
    if (!form.gestor.trim())      { setErro('Gestor responsável é obrigatório.'); return; }
    if (!form.unidade)            { setErro('Selecione a unidade.'); return; }
    if (!form.motivo)             { setErro('Informe o motivo de abertura.'); return; }
    if (!form.modelo_contratacao) { setErro('Selecione o modelo de contratação.'); return; }
    setSaving(true); setErro('');
    try {
      const res = await fetch('/api/recrutamento', {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(isEdit ? { id: vaga!.id, ...form } : form),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } catch (e) { setErro(String(e)); }
    finally     { setSaving(false); }
  }

  const isSub     = form.motivo === 'Substituição';
  const isFechada = form.status === 'Fechada';
  const inputCls  = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white';
  const labelCls  = 'block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
         style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-black" style={{ color: C.pink }}>
              {isEdit ? `Editar Vaga — ${vaga!.cargo || 'sem título'}` : 'Abertura de Vaga'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEdit ? 'Atualize os dados da vaga' : 'Preencha o formulário de solicitação de seleção'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-6 max-h-[75vh] overflow-y-auto">

          {/* ── Seção 1: Dados da Vaga ─────────────────────────────────────── */}
          <div>
            <SectionHeader n={1} title="Dados da Vaga" />
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Cargo *</label>
                  {(() => {
                    const isKnown = OPCOES_CARGO.includes(form.cargo);
                    const selVal  = form.cargo === '' ? '' : isKnown ? form.cargo : 'Outro';
                    return (
                      <>
                        <select
                          className={inputCls}
                          value={selVal}
                          onChange={e => {
                            const v = e.target.value;
                            setForm(p => ({ ...p, cargo: v === 'Outro' ? '' : v }));
                          }}
                        >
                          <option value="">Selecione o cargo...</option>
                          {OPCOES_CARGO.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="Outro">Outro (digitar)</option>
                        </select>
                        {selVal === 'Outro' && (
                          <input
                            className={inputCls}
                            style={{ '--tw-ring-color': C.pink, marginTop: 6 } as React.CSSProperties}
                            placeholder="Digite o nome do cargo..."
                            value={form.cargo}
                            onChange={set('cargo')}
                            autoFocus
                          />
                        )}
                      </>
                    );
                  })()}
                </div>
                <div>
                  <label className={labelCls}>Centro de Custo</label>
                  <select className={inputCls} value={form.centro_custo} onChange={set('centro_custo')}>
                    <option value="">Selecione...</option>
                    {OPCOES_CC.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Gestor Responsável *</label>
                  <input className={inputCls} placeholder="Nome do gestor" value={form.gestor} onChange={set('gestor')} />
                </div>
                <div>
                  <label className={labelCls}>Quantidade de Vagas</label>
                  <input type="number" min="1" className={inputCls}
                    value={form.quantidade_vagas} onChange={set('quantidade_vagas')} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Filial / Unidade *</label>
                <Pills options={OPCOES_FILIAIS} value={form.unidade} onChange={pick('unidade')} />
              </div>
              <div>
                <label className={labelCls}>Data de Abertura</label>
                <input type="date" className={`${inputCls} w-auto`} value={form.data_abertura} onChange={set('data_abertura')} />
              </div>
            </div>
          </div>

          {/* ── Seção 2: Motivo da Contratação ─────────────────────────────── */}
          <div>
            <SectionHeader n={2} title="Motivo da Contratação" />
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Tipo *</label>
                <Pills options={OPCOES_MOTIVO} value={form.motivo} onChange={pick('motivo')} />
              </div>
              {isSub && (
                <div className="p-3 rounded-xl border border-pink-100 space-y-3" style={{ backgroundColor: '#FFF5F7' }}>
                  <div>
                    <label className={labelCls}>Colaborador Substituído</label>
                    <input className={inputCls} placeholder="Nome do colaborador"
                      value={form.colaborador_substituido} onChange={set('colaborador_substituido')} />
                  </div>
                  <div>
                    <label className={labelCls}>Motivo da Substituição</label>
                    <Pills options={OPCOES_TIPO_SUB} value={form.tipo_substituicao} onChange={pick('tipo_substituicao')} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Seção 3: Condições da Contratação ──────────────────────────── */}
          <div>
            <SectionHeader n={3} title="Condições da Contratação" />
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Faixa Salarial Aprovada — De / Até</label>
                <SalarioRangeField
                  initialValue={form.faixa_salarial}
                  onChange={v => setForm(p => ({ ...p, faixa_salarial: v }))}
                />
                {form.faixa_salarial && (
                  <p className="mt-1 text-[11px] text-gray-400">
                    Registrado como: <span className="font-semibold text-gray-600">{form.faixa_salarial}</span>
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Modelo de Contratação *</label>
                <Pills options={OPCOES_MODELO} value={form.modelo_contratacao} onChange={pick('modelo_contratacao')} />
              </div>
            </div>
          </div>

          {/* ── Seção 4: Acompanhamento RH (somente edição) ────────────────── */}
          {isEdit && (
            <div className="p-4 rounded-xl border border-dashed border-purple-200" style={{ backgroundColor: '#FAF8FF' }}>
              <SectionHeader n={4} title="Acompanhamento RH" />
              <div className="space-y-4">

                <div>
                  <label className={labelCls}>Responsável pelo Processo</label>
                  <Pills options={RESPONSAVEIS_RH} value={form.responsavel} onChange={pick('responsavel')} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Status</label>
                    <select className={inputCls} value={form.status} onChange={set('status')}>
                      {OPCOES_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Data de Fechamento</label>
                    <input type="date" className={inputCls} value={form.data_fechamento} onChange={set('data_fechamento')} />
                  </div>
                </div>

                {isFechada && (
                  <div className="p-3 rounded-xl border border-green-100 space-y-3" style={{ backgroundColor: '#F0FDF4' }}>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#16A34A' }}>
                      Dados do Fechamento
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls} style={{ color: '#16A34A' }}>Colaborador Contratado</label>
                        <input className={inputCls} placeholder="Nome de quem foi contratado"
                          value={form.novo_colaborador} onChange={set('novo_colaborador')} />
                      </div>
                      <div>
                        <label className={labelCls}>Início Previsto</label>
                        <input type="date" className={inputCls} value={form.data_inicio} onChange={set('data_inicio')} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: '#16A34A' }}>Salário Real Fechado</label>
                      <SalarioSingleField
                        value={form.salario_real}
                        onChange={v => setForm(p => ({ ...p, salario_real: v }))}
                        placeholder="R$ 2.800"
                      />
                      {form.faixa_salarial && form.salario_real && (
                        <p className="mt-1 text-[11px] text-gray-500">
                          Previsto: <span className="font-semibold">{form.faixa_salarial}</span>
                          <span className="mx-1.5 text-gray-300">→</span>
                          Real: <span className="font-semibold text-green-700">{form.salario_real}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className={labelCls}>Fonte de Contratação</label>
                  <select className={inputCls} value={form.fonte} onChange={set('fonte')}>
                    <option value="">Selecione...</option>
                    {OPCOES_FONTE.map(f2 => <option key={f2} value={f2}>{f2}</option>)}
                  </select>
                </div>

                {/* Campos exclusivos para contratações em SC */}
                {UNIDADES_SC.includes(form.unidade) && (
                  <div className="p-3 rounded-xl border border-purple-100" style={{ backgroundColor: '#F5F3FF' }}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: C.purple }}>
                      Contratação SC — Dados de Processo Seletivo
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Nº de Convocados</label>
                        <input type="number" min="0" className={inputCls}
                          placeholder="0" value={form.num_convocados} onChange={set('num_convocados')} />
                      </div>
                      <div>
                        <label className={labelCls}>Nº de Compareceram</label>
                        <input type="number" min="0" className={inputCls}
                          placeholder="0" value={form.num_compareceu} onChange={set('num_compareceu')} />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className={labelCls}>Observações</label>
                  <textarea className={`${inputCls} resize-none`} rows={3}
                    placeholder="Notas adicionais sobre a vaga..."
                    value={form.observacoes} onChange={set('observacoes')} />
                </div>

              </div>
            </div>
          )}

          {erro && <p className="text-xs text-red-500 font-semibold">{erro}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm font-bold text-white rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: C.pink }}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Abrir Vaga'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function RecrutamentoPage() {
  const [data, setData]           = useState<RecrutData | null>(null);
  const [loading, setLoading]     = useState(true);
  // Filtros globais → afetam API (KPIs + gráficos + dados carregados)
  const [filtroMeses, setFiltroMeses]             = useState(12);
  const [filtroUnidades, setFiltroUnidades]       = useState<string[]>([]);
  const [filtroResponsaveis, setFiltroResponsaveis] = useState<string[]>([]);
  const [filtroFontes, setFiltroFontes]           = useState<string[]>([]);
  // Filtros locais da tabela → client-side, sem API call
  const [busca,        setBusca]        = useState('');
  const [localStatus,  setLocalStatus]  = useState('');
  const [localUnidade, setLocalUnidade] = useState('');
  const [localResp,    setLocalResp]    = useState('');
  const [localCargo,   setLocalCargo]   = useState('');
  const [localGestor,  setLocalGestor]  = useState('');
  const [localFonte,   setLocalFonte]   = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [editVaga, setEditVaga]     = useState<Vaga | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('meses', String(filtroMeses));
    if (filtroUnidades.length > 0)     params.set('unidade',     filtroUnidades.join(','));
    if (filtroResponsaveis.length > 0) params.set('responsavel', filtroResponsaveis.join(','));
    if (filtroFontes.length > 0)       params.set('fonte',       filtroFontes.join(','));
    try {
      const res = await fetch(`/api/recrutamento?${params}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [filtroMeses, filtroUnidades, filtroResponsaveis, filtroFontes]);

  useEffect(() => { load(); }, [load]);

  const kpis    = data?.kpis;
  const opcoes  = data?.opcoes ?? { responsaveis: [], unidades: [], centrosCusto: [], gestores: [], fontes: [] };
  const vagas   = data?.vagas ?? [];
  const slaPerf = data?.slaPerf;

  // Opções derivadas dos dados carregados (para os selects locais)
  const vagasOpts = {
    status:   OPCOES_STATUS,
    unidades: [...new Set(vagas.map(v => v.unidade).filter(Boolean) as string[])].sort(),
    resps:    [...new Set(vagas.map(v => v.responsavel).filter(Boolean) as string[])].sort(),
    cargos:   [...new Set(vagas.map(v => v.cargo).filter(Boolean) as string[])].sort(),
    gestores: [...new Set(vagas.map(v => v.gestor).filter(Boolean) as string[])].sort(),
    fontes:   [...new Set(vagas.map(v => v.fonte).filter(Boolean) as string[])].sort(),
  };

  // Filtro local client-side aplicado sobre o array já carregado
  const vagasFiltradas = vagas.filter(v => {
    if (busca) {
      const q = busca.toLowerCase();
      const hit = [v.cargo, v.novo_colaborador, v.gestor, v.colaborador_substituido]
        .some(f => (f || '').toLowerCase().includes(q));
      if (!hit) return false;
    }
    if (localStatus  && v.status      !== localStatus)  return false;
    if (localUnidade && v.unidade     !== localUnidade)  return false;
    if (localResp    && v.responsavel !== localResp)     return false;
    if (localCargo   && v.cargo       !== localCargo)    return false;
    if (localGestor  && v.gestor      !== localGestor)   return false;
    if (localFonte   && v.fonte       !== localFonte)    return false;
    return true;
  });
  const anyLocal = !!(busca || localStatus || localUnidade || localResp || localCargo || localGestor || localFonte);
  function limparFiltrosLocais() {
    setBusca(''); setLocalStatus(''); setLocalUnidade('');
    setLocalResp(''); setLocalCargo(''); setLocalGestor(''); setLocalFonte('');
  }

  function openEdit(v: Vaga) { setEditVaga(v); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditVaga(null); }
  function onSaved() { closeModal(); load(); }

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: C.white }}>
      <NavHeader>
        <PeriodButtons value={filtroMeses} onChange={setFiltroMeses} color={C.pink} />
        <span className="w-px h-4 bg-gray-200 mx-1 shrink-0" />
        <MultiFilterSelect
          values={filtroUnidades} onChange={setFiltroUnidades}
          label="Unidade" options={opcoes.unidades} color={C.pink} />
        <MultiFilterSelect
          values={filtroResponsaveis} onChange={setFiltroResponsaveis}
          label="Responsável" options={opcoes.responsaveis} color={C.pink} />
        <MultiFilterSelect
          values={filtroFontes} onChange={setFiltroFontes}
          label="Fonte" options={opcoes.fontes} color={C.pink} />
        {(filtroUnidades.length > 0 || filtroResponsaveis.length > 0 || filtroFontes.length > 0) && (
          <FilterTag
            label="limpar filtros"
            onClear={() => { setFiltroUnidades([]); setFiltroResponsaveis([]); setFiltroFontes([]); }}
          />
        )}
      </NavHeader>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div>
            <h1 className="text-xl font-black" style={{ color: C.pink }}>Recrutamento & Seleção</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gestão de vagas e pipeline de contratação</p>
          </div>
        </div>

        {/* ── KPI cards ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
            : <>
                <KpiCard label="Vagas Abertas"      value={kpis?.abertas ?? 0}       icon="📂" color={C.blue}    sub={`${kpis?.congeladas ?? 0} congeladas`} />
                <KpiCard label="SLA Médio"           value={kpis?.slaMedia ? `${kpis.slaMedia}d` : '—'} icon="⏱" color={C.pink} sub="dias para fechar" />
                <KpiCard label="Fechadas (período)"  value={kpis?.fechadasPeriodo ?? 0} icon="✅" color="#16A34A" sub={`de ${kpis?.totalPeriodo ?? 0} no período`} />
                <KpiCard label="Taxa de Fechamento"  value={`${kpis?.taxaFechamento ?? 0}%`} icon="📊" color={C.purple} sub="vagas concluídas" />
              </>
          }
        </div>

        {/* ── Status overview ────────────────────────────────────────────────── */}
        {!loading && data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(STATUS_CFG).map(([key, cfg]) => {
              const count = data.porStatus.find(s => s.status === key)?.count ?? 0;
              const total = data.kpis.total;
              const ativo = localStatus === key;
              return (
                <button
                  key={key}
                  onClick={() => setLocalStatus(prev => prev === key ? '' : key)}
                  className="rounded-xl p-3 text-left border-2 transition-all hover:shadow-md"
                  style={{
                    backgroundColor: cfg.bg,
                    borderColor: ativo ? cfg.color : cfg.border,
                    boxShadow: ativo ? `0 0 0 2px ${cfg.color}40` : undefined,
                  }}>
                  <div className="text-2xl font-black" style={{ color: cfg.color }}>{count}</div>
                  <div className="text-xs font-bold mt-0.5" style={{ color: cfg.color }}>{cfg.label}</div>
                  <div className="text-[10px] text-gray-400">{total > 0 ? ((count / total) * 100).toFixed(0) : 0}% do total</div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Analytics ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Fonte de contratação */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>Fonte de Contratação</h3>
            {loading
              ? <Skeleton className="h-32 w-full" />
              : !data?.porFonte.length
                ? <p className="text-xs text-gray-400 text-center py-8">Sem dados</p>
                : <DonutFonte data={data.porFonte.slice(0, 6)} />
            }
          </div>

          {/* Vagas por unidade */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>Vagas por Unidade</h3>
            {loading
              ? <Skeleton className="h-32 w-full" />
              : !data?.porUnidade.length
                ? <p className="text-xs text-gray-400 text-center py-8">Sem dados</p>
                : <BarUnidade data={data.porUnidade} />
            }
          </div>

          {/* Motivo de abertura */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-black text-sm uppercase mb-4" style={{ color: C.dark }}>Motivo de Abertura</h3>
            {loading
              ? <Skeleton className="h-32 w-full" />
              : (() => {
                  const items = data?.porMotivo ?? [];
                  const total = items.reduce((s, m) => s + m.count, 0);
                  const max   = Math.max(...items.map(m => m.count), 1);
                  return items.length
                    ? items.map(m => {
                        const cor = MOTIVO_CORES[m.motivo] || C.gray;
                        return (
                          <div key={m.motivo} className="flex items-center gap-3 mb-2">
                            <span className="text-xs font-semibold text-gray-700 shrink-0 w-28 text-right leading-tight">{m.motivo}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${(m.count / max) * 100}%`, backgroundColor: cor }} />
                            </div>
                            <span className="text-xs font-bold tabular-nums" style={{ color: cor, minWidth: 24 }}>{m.count}</span>
                            <span className="text-[10px] text-gray-400 w-8 text-right">{total > 0 ? ((m.count / total) * 100).toFixed(0) : 0}%</span>
                          </div>
                        );
                      })
                    : <p className="text-xs text-gray-400 text-center py-8">Sem dados</p>;
                })()
            }
          </div>
        </div>

        {/* SLA trend */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold tracking-wide uppercase text-gray-400">SLA médio por mês</h3>
            {kpis && <span className="text-xs text-gray-400">Média geral: <span className="font-semibold" style={{ color: C.pink }}>{kpis.slaMedia}d</span></span>}
          </div>
          {loading
            ? <Skeleton className="h-32 w-full" />
            : <SlaChart data={data?.slaPorMes ?? []} />
          }
        </div>

        {/* ── Desempenho de SLA ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-black text-sm uppercase" style={{ color: C.dark }}>Desempenho de SLA</h3>
              <p className="text-xs text-gray-400 mt-0.5">Prazo alvo por nível de cargo e eficiência do processo</p>
            </div>
            {slaPerf && (
              <div className="flex gap-4">
                <div className="text-right">
                  <div className="text-2xl font-black tabular-nums"
                       style={{ color: (slaPerf.eficienciaSLA ?? 0) >= 80 ? '#16A34A' : (slaPerf.eficienciaSLA ?? 0) >= 60 ? C.amber : C.pink }}>
                    {slaPerf.eficienciaSLA != null ? `${slaPerf.eficienciaSLA}%` : '—'}
                  </div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">eficiência SLA</div>
                  <div className="text-[10px] text-gray-500">{slaPerf.dentroPrazo}/{slaPerf.totalFechadas} vagas</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black tabular-nums"
                       style={{ color: slaPerf.abertasAtrasadas > 0 ? '#DC2626' : '#16A34A' }}>
                    {slaPerf.abertasAtrasadas}
                  </div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">em atraso</div>
                  <div className="text-[10px] text-gray-500">vagas abertas</div>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase text-gray-400 border-b border-gray-100">
                  <th className="pb-2 text-left font-bold">Nível / Cargo</th>
                  <th className="pb-2 text-center font-bold w-20">Meta (dias)</th>
                  <th className="pb-2 text-left font-bold pl-4">Referência</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { nivel: 'Operacional',              dias: 15, ref: 'Estagiário, Jovem Aprendiz, Assistente',              cor: '#8B5CF6' },
                  { nivel: 'Motoristas',               dias: 20, ref: 'Motoristas',                                          cor: '#3B82F6' },
                  { nivel: 'Aux. Logística / Conferentes', dias: 20, ref: 'Auxiliares de Logística, Conferentes',            cor: '#0D9488' },
                  { nivel: 'Operadores de Empilhadeira', dias: 25, ref: 'Operadores de Empilhadeira',                        cor: '#F59E0B' },
                  { nivel: 'Analistas / Técnicos',     dias: 30, ref: 'Analistas (Jr, Pl, Sr), Engenheiros, Desenvolvedores, SDR', cor: '#ff2f69' },
                  { nivel: 'Especialistas / Coordenadores', dias: 60, ref: 'Especialistas, Coordenadores',                  cor: '#DC2626' },
                  { nivel: 'Gerentes / Traders',       dias: 90, ref: 'Gerentes, Traders',                                   cor: '#422c76' },
                ].map((row) => (
                  <tr key={row.nivel} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.cor }} />
                        <span className="font-semibold text-gray-800">{row.nivel}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-lg text-[11px] font-black text-white"
                            style={{ backgroundColor: row.cor }}>
                        {row.dias}d
                      </span>
                    </td>
                    <td className="py-2.5 pl-4 text-gray-500 text-[11px]">{row.ref}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Tabela de vagas ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-5">

          {/* Barra de filtros locais */}
          <div className="space-y-2.5 mb-4">
            {/* Linha 1: busca + contador + limpar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 min-w-48">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text" placeholder="Buscar cargo, colaborador, gestor..."
                  value={busca} onChange={e => setBusca(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': C.pink } as React.CSSProperties} />
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {vagasFiltradas.length !== vagas.length
                  ? <><span className="font-semibold" style={{ color: C.pink }}>{vagasFiltradas.length}</span> de {vagas.length} vagas</>
                  : <>{vagas.length} vagas</>}
              </span>
              {anyLocal && (
                <button onClick={limparFiltrosLocais}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 whitespace-nowrap transition-colors">
                  ✕ Limpar
                </button>
              )}
            </div>

            {/* Linha 2: selects de filtro */}
            <div className="flex flex-wrap gap-2">
              <FilterSelect value={localStatus}  onChange={setLocalStatus}  label="Status"     options={vagasOpts.status}   color={localStatus ? (STATUS_CFG[localStatus]?.color || C.pink) : C.pink} />
              <FilterSelect value={localResp}    onChange={setLocalResp}    label="Resp. RH"   options={vagasOpts.resps}    color={C.pink} />
              <FilterSelect value={localUnidade} onChange={setLocalUnidade} label="Unidade"    options={vagasOpts.unidades} color={C.pink} />
              <FilterSelect value={localCargo}   onChange={setLocalCargo}   label="Cargo"      options={vagasOpts.cargos}   color={C.pink} />
              <FilterSelect value={localGestor}  onChange={setLocalGestor}  label="Gestor"     options={vagasOpts.gestores} color={C.pink} />
              <FilterSelect value={localFonte}   onChange={setLocalFonte}   label="Fonte"      options={vagasOpts.fontes}   color={C.pink} />
            </div>
          </div>

          {loading
            ? <Skeleton className="h-48 w-full" />
            : vagasFiltradas.length === 0
              ? <p className="text-sm text-gray-400 text-center py-10">
                  {anyLocal ? 'Nenhuma vaga com esses filtros.' : 'Nenhuma vaga encontrada.'}
                </p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[800px]">
                    <thead>
                      <tr className="text-[10px] uppercase text-gray-400 border-b border-gray-100">
                        {['Status', 'Cargo', 'Resp. RH', 'Unidade', 'Gestor', 'Abertura', 'SLA / Prazo', 'Fonte', 'Contratado', 'Acomp. RH'].map(h => (
                          <th key={h} className="pb-2 pr-3 text-left font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vagasFiltradas.map(v => (
                        <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-2 pr-3"><StatusBadge status={v.status} /></td>
                          <td className="py-2 pr-3 font-semibold text-gray-800 max-w-[160px] truncate" title={v.cargo || ''}>{v.cargo || '—'}</td>
                          <td className="py-2 pr-3 text-gray-600">{v.responsavel || '—'}</td>
                          <td className="py-2 pr-3 text-gray-600">{v.unidade || '—'}</td>
                          <td className="py-2 pr-3 text-gray-500 max-w-[120px] truncate">{v.gestor || '—'}</td>
                          <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{fmtData(v.data_abertura)}</td>
                          <td className="py-2 pr-3"><SlaCell v={v} /></td>
                          <td className="py-2 pr-3 text-gray-500">{v.fonte || '—'}</td>
                          <td className="py-2 pr-3 text-gray-600 max-w-[140px] truncate" title={v.novo_colaborador || ''}>{v.novo_colaborador || '—'}</td>
                          <td className="py-2">
                            <button
                              onClick={() => openEdit(v)}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors hover:bg-purple-50 whitespace-nowrap"
                              style={{ color: C.purple, borderColor: '#C4B5FD' }}>
                              Preencher RH
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          }
        </div>

        <footer className="text-center text-[10px] text-gray-400 pb-6">
          VENDEMMIA PEOPLE — Recrutamento & Seleção · {new Date().getFullYear()}
        </footer>
      </main>

      {showModal && (
        <VagaModal
          vaga={editVaga}
          opcoes={opcoes}
          onClose={closeModal}
          onSaved={onSaved} />
      )}
    </div>
  );
}
