'use client';
import { useEffect, useState, useCallback } from 'react';
import { NavHeader } from '@/components/NavHeader';

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
const OPCOES_FILIAIS   = ['Garuva', 'Itapevi', 'Navegantes – CD 1', 'Navegantes – CD 2', 'Vila Olímpia'];
const OPCOES_MODELO    = ['CLT', 'PJ', 'Estágio', 'Temporário'];
const OPCOES_STATUS    = ['Aberta', 'Fechada', 'Congelada', 'Cancelada'];
const RESPONSAVEIS_RH  = ['Camile Fernandes', 'Denise Oliveira', 'Gabriela Santos', 'Hellen Gomes', 'Julia Barbosa', 'Rafaela Marques'];
const UNIDADES_SC      = ['Garuva', 'Navegantes – CD 1', 'Navegantes – CD 2'];
const OPCOES_CC = [
  'OPERAÇÃO VCI', 'OPERAÇÃO ARMAZEM - NVG', 'OPERAÇÃO ARMAZEM - ITV', 'OPERAÇÃO ARMAZEM - GRV',
  'OPERAÇÃO TRANSPORTE', 'COMERCIAL', 'INFRAESTRUTURA', 'PROJETOS/QUALIDADE', 'COMPRAS',
  'MARKETING', 'TI', 'FINANCEIRO - ADM', 'RH', 'JURIDICO', 'DIRETORIA',
  'EXECUTIVO ARMAZEM', 'EXECUTIVO COMERCIO', 'TI - ANALYTICS',
];
const OPCOES_FONTE = [
  'Gupy', 'Indicação', 'LinkedIn', 'Processo Seletivo Interno', 'SINE', 'Terceirizada', 'WhatsApp',
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
  const r = 70, cx = 80, cy = 80, stroke = 26;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const cores = data.map((d, i) => FONTES_CORES[d.fonte] || [C.purple, C.teal, C.blue, C.amber][i % 4]);
  return (
    <div className="flex items-center gap-6">
      <svg width={160} height={160} viewBox="0 0 160 160" className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
        {data.map((d, i) => {
          const dash = (d.count / Math.max(total, 1)) * circ;
          const seg = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={cores[i]} strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset + circ / 4} />
          );
          offset += dash;
          return seg;
        })}
        <text x={cx} y={cy - 6}  textAnchor="middle" fontSize="22" fontWeight="900" fill={C.dark}>{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9"  fill={C.gray}>contratações</text>
      </svg>
      <div className="flex flex-col gap-1.5 flex-1">
        {data.map((d, i) => (
          <div key={d.fonte} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cores[i] }} />
            <span className="text-xs text-gray-600 flex-1 truncate">{d.fonte}</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: cores[i] }}>{d.count}</span>
            <span className="text-[10px] text-gray-400 w-8 text-right">{total > 0 ? ((d.count / total) * 100).toFixed(0) : 0}%</span>
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

function SlaChart({ data }: { data: SlaMes[] }) {
  const validos = data.filter(d => d.slaMedia !== null);
  if (validos.length < 2) return <p className="text-xs text-gray-400 text-center pt-8">Dados insuficientes</p>;
  const W = 480, H = 140, padL = 32, padR = 16, padT = 20, padB = 28;
  const n = data.length;
  const maxVal = Math.max(...validos.map(d => d.slaMedia as number), 1);
  const getX = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const getY = (v: number) => padT + (1 - v / maxVal) * (H - padT - padB);
  const pts = data.map((d, i) => d.slaMedia !== null ? [getX(i), getY(d.slaMedia)] as [number, number] : null);
  const pathD = pts.reduce((acc, pt, i) => {
    if (!pt) return acc;
    const prev = pts.slice(0, i).reverse().find(p => p !== null);
    if (!prev) return `M ${pt[0]} ${pt[1]}`;
    const mx = (prev[0] + pt[0]) / 2;
    return `${acc} C ${mx} ${prev[1]} ${mx} ${pt[1]} ${pt[0]} ${pt[1]}`;
  }, '');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#E5E7EB" strokeWidth="1" />
      <path d={pathD} fill="none" stroke={C.pink} strokeWidth="2.5" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={i}>
          {(n <= 12 || i % 2 === 0) && (
            <text x={getX(i)} y={H - padB + 14} textAnchor="middle" fontSize="8" fill={C.gray}>{d.mes}</text>
          )}
          {d.slaMedia !== null && (
            <>
              <circle cx={getX(i)} cy={getY(d.slaMedia)} r="4" fill="white" stroke={C.pink} strokeWidth="2" />
              <text x={getX(i)} y={getY(d.slaMedia) - 8} textAnchor="middle" fontSize="9" fontWeight="700" fill={C.pink}>{d.slaMedia}d</text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

// ─── SLA Cell ─────────────────────────────────────────────────────────────────
const HOJE_MS = () => Date.now();

function SlaCell({ v }: { v: Vaga }) {
  const meta = v.sla_meta_dias;
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

// ─── Modal Nova/Editar Vaga ───────────────────────────────────────────────────
const EMPTY_FORM = {
  cargo: '', centro_custo: '', gestor: '', unidade: '',
  quantidade_vagas: '1', data_abertura: hoje(),
  motivo: '', colaborador_substituido: '', tipo_substituicao: '',
  faixa_salarial: '', modelo_contratacao: '',
  responsavel: '', status: 'Aberta', fonte: '',
  data_fechamento: '', novo_colaborador: '', data_inicio: '', observacoes: '',
  num_convocados: '', num_compareceu: '',
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
                  <input className={inputCls} style={{ '--tw-ring-color': C.pink } as React.CSSProperties}
                    placeholder="Ex: Auxiliar de Logística" value={form.cargo} onChange={set('cargo')} />
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
                <label className={labelCls}>Faixa Salarial Aprovada</label>
                <input className={inputCls}
                  placeholder="Ex: R$ 2.000 – R$ 2.500 (conforme Plano de Cargos e Salários)"
                  value={form.faixa_salarial} onChange={set('faixa_salarial')} />
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls} style={{ color: '#16A34A' }}>Nome do Colaborador Contratado</label>
                      <input className={inputCls} placeholder="Nome de quem foi contratado"
                        value={form.novo_colaborador} onChange={set('novo_colaborador')} />
                    </div>
                    <div>
                      <label className={labelCls}>Início Previsto</label>
                      <input type="date" className={inputCls} value={form.data_inicio} onChange={set('data_inicio')} />
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
  const [busca, setBusca]         = useState('');
  const [filtroStatus, setFiltroStatus]   = useState<string[]>([]);
  const [filtroStatusSel, setFiltroStatusSel] = useState('');
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [filtroResp, setFiltroResp]       = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [editVaga, setEditVaga]     = useState<Vaga | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  function copiarLink() {
    const url = 'https://people.vendemm.ia.br/solicitar-vaga';
    const fallback = () => {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus(); el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    };
    (navigator.clipboard?.writeText(url) ?? Promise.reject()).catch(fallback);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    const statusAtivo = filtroStatusSel || filtroStatus.join(',');
  if (statusAtivo) params.set('status', statusAtivo);
    if (filtroUnidade) params.set('unidade', filtroUnidade);
    if (filtroResp)    params.set('responsavel', filtroResp);
    if (busca)         params.set('busca', busca);
    try {
      const res = await fetch(`/api/recrutamento?${params}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [filtroStatus, filtroUnidade, filtroResp, busca]);

  useEffect(() => { load(); }, [load]);

  const kpis    = data?.kpis;
  const opcoes  = data?.opcoes ?? { responsaveis: [], unidades: [], centrosCusto: [], gestores: [], fontes: [] };
  const vagas   = data?.vagas ?? [];
  const slaPerf = data?.slaPerf;

  function openEdit(v: Vaga) { setEditVaga(v); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditVaga(null); }
  function onSaved() { closeModal(); load(); }

  const toggleStatus = (s: string) => setFiltroStatus(prev =>
    prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
  );

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: C.white }}>
      <NavHeader />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div>
            <h1 className="text-xl font-black" style={{ color: C.pink }}>Recrutamento & Seleção</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gestão de vagas e pipeline de contratação</p>
          </div>
          {/* Banner: link do formulário público para compartilhar com gestores */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
               style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
                    stroke="#422c76" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
                    stroke="#422c76" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide mb-0.5" style={{ color: C.purple }}>
                Link para abertura de vagas — compartilhe com os gestores
              </p>
              <p className="text-xs text-gray-500 truncate">people.vendemm.ia.br/solicitar-vaga</p>
            </div>
            <button
              onClick={copiarLink}
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all shrink-0"
              style={{
                color:           linkCopiado ? '#16A34A' : C.purple,
                borderColor:     linkCopiado ? '#86EFAC' : '#C4B5FD',
                backgroundColor: linkCopiado ? '#F0FDF4' : undefined,
              }}>
              {linkCopiado ? '✓ Copiado!' : 'Copiar link'}
            </button>
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
              const ativo = filtroStatus.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleStatus(key)}
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

        {/* ── Filtros + Tabela ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <input
              type="text" placeholder="Buscar cargo, colaborador, gestor..."
              value={busca} onChange={e => setBusca(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': C.pink } as React.CSSProperties} />
            <select
              value={filtroStatusSel}
              onChange={e => { setFiltroStatusSel(e.target.value); setFiltroStatus([]); }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              style={{ color: filtroStatusSel ? STATUS_CFG[filtroStatusSel]?.color : undefined }}>
              <option value="">Todos os status</option>
              {OPCOES_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
              <option value="">Todas as unidades</option>
              {OPCOES_FILIAIS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <select
              value={filtroResp} onChange={e => setFiltroResp(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
              <option value="">Todos os responsáveis</option>
              {RESPONSAVEIS_RH.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {(filtroStatus.length > 0 || filtroStatusSel || filtroUnidade || filtroResp || busca) && (
              <button
                onClick={() => { setFiltroStatus([]); setFiltroStatusSel(''); setFiltroUnidade(''); setFiltroResp(''); setBusca(''); }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                Limpar filtros
              </button>
            )}
            <span className="text-xs text-gray-400 ml-auto">{vagas.length} vagas</span>
          </div>

          {loading
            ? <Skeleton className="h-48 w-full" />
            : vagas.length === 0
              ? <p className="text-sm text-gray-400 text-center py-10">Nenhuma vaga encontrada.</p>
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
                      {vagas.map(v => (
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
            <h3 className="font-black text-sm uppercase" style={{ color: C.dark }}>SLA Médio por Mês (dias para fechar)</h3>
            {kpis && <span className="text-xs text-gray-500">Média geral: <strong style={{ color: C.pink }}>{kpis.slaMedia}d</strong></span>}
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
