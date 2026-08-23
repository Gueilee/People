'use client';
import { useState, useEffect, useRef } from 'react';
import { NavHeader } from '@/components/NavHeader';

const C = { pink: '#ff2f69', purple: '#422c76', dark: '#414042', white: '#faf9f5' };

const OPCOES_MOTIVO   = ['Aumento de quadro', 'Substituição'];
const OPCOES_TIPO_SUB = ['Desligamento', 'Pedido de demissão', 'Transferência', 'Afastamento'];
const OPCOES_FILIAIS  = ['Garuva', 'Itapevi', 'Navegantes – CD 1', 'Navegantes – CD 2', 'Vila Olímpia'];
const OPCOES_MODELO   = ['CLT', 'PJ', 'Estágio', 'Temporário'];
const OPCOES_CC = [
  'OPERAÇÃO VCI', 'OPERAÇÃO ARMAZEM - NVG', 'OPERAÇÃO ARMAZEM - ITV', 'OPERAÇÃO ARMAZEM - GRV',
  'OPERAÇÃO TRANSPORTE', 'COMERCIAL', 'INFRAESTRUTURA', 'PROJETOS/QUALIDADE', 'COMPRAS',
  'MARKETING', 'TI', 'FINANCEIRO - ADM', 'RH', 'JURIDICO', 'DIRETORIA',
  'EXECUTIVO ARMAZEM', 'EXECUTIVO COMERCIO', 'TI - ANALYTICS',
];

const RECRUTADORES_RH = [
  { nome: 'Camile Fernandes',  email: 'cfernandes@vendemmia.com.br' },
  { nome: 'Denise Oliveira',   email: 'doliveira@vendemmia.com.br'  },
  { nome: 'Gabriela Santos',   email: 'glima@vendemmia.com.br'      },
  { nome: 'Hellen Gomes',      email: 'hfernandes@vendemmia.com.br' },
  { nome: 'Julia Barbosa',     email: 'jbarbosa@vendemmia.com.br'   },
  { nome: 'Rafaela Marques',   email: 'rmarques@vendemmia.com.br'   },
  { nome: 'José Netto',        email: 'jnetto@vendemmia.com.br'     },
];

const hoje = () => new Date().toISOString().split('T')[0];

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="w-7 h-7 rounded-full text-sm font-black flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: C.purple }}>{n}</span>
      <span className="text-sm font-black uppercase tracking-widest" style={{ color: C.purple }}>{title}</span>
    </div>
  );
}

type ColabSugestao = { nome: string; email: string | null; cargo: string | null; unidade: string | null };

function GestorAutocomplete({
  value, emailValue, onChange,
}: {
  value: string;
  emailValue: string;
  onChange: (nome: string, email: string) => void;
}) {
  const [query, setQuery]           = useState(value);
  const [sugestoes, setSugestoes]   = useState<ColabSugestao[]>([]);
  const [aberto, setAberto]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const wrapRef                     = useRef<HTMLDivElement>(null);
  const timerRef                    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Busca com debounce 300ms
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.length < 2) { setSugestoes([]); setAberto(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res  = await fetch(`/api/colaboradores/busca?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSugestoes(data);
        setAberto(data.length > 0);
      } catch { setSugestoes([]); }
      finally  { setLoading(false); }
    }, 300);
  }, [query]);

  function selecionar(s: ColabSugestao) {
    setQuery(s.nome);
    setSugestoes([]);
    setAberto(false);
    onChange(s.nome, s.email || '');
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 bg-white';

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          className={inputCls}
          style={{ '--tw-ring-color': C.pink } as React.CSSProperties}
          placeholder="Digite o nome do gestor..."
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value, ''); }}
          onFocus={() => sugestoes.length > 0 && setAberto(true)}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-pink-400 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* E-mail confirmado */}
      {emailValue && (
        <p className="mt-1 text-[11px] text-green-600 font-semibold flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {emailValue}
        </p>
      )}

      {/* Dropdown de sugestões */}
      {aberto && sugestoes.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {sugestoes.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => selecionar(s)}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{s.nome}</p>
              <p className="text-[11px] text-gray-400 truncate">
                {[s.cargo, s.unidade].filter(Boolean).join(' · ')}
                {s.email ? <span className="ml-1 text-green-600"> · {s.email}</span> : ''}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtSalario(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return 'R$ ' + parseInt(digits, 10).toLocaleString('pt-BR');
}

function SalarioRange({ onChange }: { onChange: (v: string) => void }) {
  const [de, setDe]   = useState('');
  const [ate, setAte] = useState('');

  function handle(raw: string, setter: (v: string) => void, other: string, isMin: boolean) {
    const fmt = fmtSalario(raw);
    setter(fmt);
    const a = isMin ? fmt : other;
    const b = isMin ? other : fmt;
    if (a && b) onChange(`${a} – ${b}`);
    else if (a) onChange(a);
    else if (b) onChange(b);
    else onChange('');
  }

  const inputCls = 'flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 bg-white';
  return (
    <div className="flex items-center gap-2">
      <input
        className={inputCls}
        style={{ '--tw-ring-color': C.pink } as React.CSSProperties}
        placeholder="R$ 2.000"
        value={de}
        onChange={e => handle(e.target.value, setDe, ate, true)}
        inputMode="numeric"
      />
      <span className="text-gray-400 font-bold text-sm shrink-0">–</span>
      <input
        className={inputCls}
        style={{ '--tw-ring-color': C.pink } as React.CSSProperties}
        placeholder="R$ 3.500"
        value={ate}
        onChange={e => handle(e.target.value, setAte, de, false)}
        inputMode="numeric"
      />
    </div>
  );
}

function Pills({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className="px-4 py-2 text-sm font-semibold rounded-xl border-2 transition-all"
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

const EMPTY = {
  cargo: '', centro_custo: '', gestor: '', gestor_email: '', unidade: '',
  quantidade_vagas: '1', data_abertura: hoje(),
  motivo: '', colaborador_substituido: '', tipo_substituicao: '',
  faixa_salarial: '', modelo_contratacao: '',
  confidencial: false, recrutador_nome: '', recrutador_email: '',
};

export default function SolicitarVagaPage() {
  const [form, setForm]       = useState({ ...EMPTY });
  const [saving, setSaving]   = useState(false);
  const [erro, setErro]       = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [meRole, setMeRole]   = useState<string | null>(null);

  // Se for requisitante, pré-preenche o gestor com os dados da sessão
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setMeRole(data.role);
        if (data.role === 'requisitante') {
          setForm(p => ({ ...p, gestor: data.nome || '', gestor_email: data.email || '' }));
        }
      })
      .catch(() => {});
  }, []);

  const set  = (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));
  const pick = (k: keyof typeof EMPTY) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit() {
    if (!form.cargo.trim())                               { setErro('Cargo é obrigatório.'); return; }
    if (!form.gestor.trim())                              { setErro('Gestor responsável é obrigatório.'); return; }
    if (!form.unidade)                                    { setErro('Selecione a unidade.'); return; }
    if (!form.motivo)                                     { setErro('Informe o motivo de abertura.'); return; }
    if (!form.modelo_contratacao)                         { setErro('Selecione o modelo de contratação.'); return; }
    if (form.confidencial && !form.recrutador_email)      { setErro('Selecione o recrutador responsável para vaga confidencial.'); return; }

    setSaving(true); setErro('');
    try {
      const res = await fetch('/api/recrutamento', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...form,
          status: 'Aberta',
          recrutador: form.recrutador_nome,
          recrutador_email: form.recrutador_email,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSucesso(true);
    } catch (e) { setErro(String(e)); }
    finally     { setSaving(false); }
  }

  const isSub    = form.motivo === 'Substituição';
  const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 bg-white';
  const labelCls = 'block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2';

  if (sucesso) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: C.white }}>
      {meRole === 'requisitante' && <NavHeader />}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
               style={{ backgroundColor: '#F0FDF4' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-xl font-black mb-2" style={{ color: C.dark }}>Solicitação enviada!</h2>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            Sua solicitação foi registrada com sucesso.<br />
            O time de RH dará continuidade ao processo e entrará em contato em breve.
          </p>
          <button onClick={() => { setForm(p => ({ ...EMPTY, gestor: p.gestor, gestor_email: p.gestor_email })); setSucesso(false); }}
            className="text-sm font-bold px-6 py-3 rounded-xl text-white transition-all hover:opacity-90 shadow-sm"
            style={{ backgroundColor: C.pink }}>
            Nova solicitação
          </button>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: C.white }}>

      {/* Topo */}
      {meRole === 'requisitante' ? (
        <NavHeader />
      ) : (
        <div className="bg-white border-b border-gray-100 shadow-sm px-6 py-3 flex items-center">
          <img src="/logo.png" alt="Vendemmia People" className="h-10 w-auto" />
        </div>
      )}

      {/* Conteúdo */}
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black mb-1" style={{ color: C.pink }}>
            Solicitação de Abertura de Vaga
          </h1>
          <p className="text-sm text-gray-500">
            Preencha os dados abaixo para solicitar ao time de RH a abertura de um processo seletivo.
          </p>
        </div>

        <div className="space-y-5">

          {/* ── Seção 1: Dados da Vaga ───────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <SectionHeader n={1} title="Dados da Vaga" />
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Gestor Responsável *</label>
                  {meRole === 'requisitante' ? (
                    <div className={`${inputCls} bg-gray-50 text-gray-700`} style={{ '--tw-ring-color': C.pink } as React.CSSProperties}>
                      {form.gestor || '...'}
                      {form.gestor_email && (
                        <p className="mt-0.5 text-[11px] text-green-600 font-semibold flex items-center gap-1">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                            <path d="M5 13l4 4L19 7" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          {form.gestor_email}
                        </p>
                      )}
                    </div>
                  ) : (
                    <GestorAutocomplete
                      value={form.gestor}
                      emailValue={form.gestor_email}
                      onChange={(nome, email) => setForm(p => ({ ...p, gestor: nome, gestor_email: email }))}
                    />
                  )}
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
                <input type="date" className={`${inputCls} w-auto`}
                  value={form.data_abertura} onChange={set('data_abertura')} />
              </div>
            </div>
          </div>

          {/* ── Seção 2: Motivo da Contratação ──────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <SectionHeader n={2} title="Motivo da Contratação" />
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Tipo *</label>
                <Pills options={OPCOES_MOTIVO} value={form.motivo} onChange={pick('motivo')} />
              </div>
              {isSub && (
                <div className="p-4 rounded-xl border border-pink-100 space-y-4"
                     style={{ backgroundColor: '#FFF5F7' }}>
                  <div>
                    <label className={labelCls}>Colaborador Substituído</label>
                    <input className={inputCls} placeholder="Nome do colaborador"
                      value={form.colaborador_substituido} onChange={set('colaborador_substituido')} />
                  </div>
                  <div>
                    <label className={labelCls}>Motivo da Substituição</label>
                    <Pills options={OPCOES_TIPO_SUB} value={form.tipo_substituicao}
                           onChange={pick('tipo_substituicao')} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Seção 3: Condições da Contratação ───────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <SectionHeader n={3} title="Condições da Contratação" />
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Faixa Salarial Aprovada</label>
                <SalarioRange onChange={v => setForm(p => ({ ...p, faixa_salarial: v }))} />
                {form.faixa_salarial && (
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    Será registrado como: <span className="font-semibold text-gray-600">{form.faixa_salarial}</span>
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Modelo de Contratação *</label>
                <Pills options={OPCOES_MODELO} value={form.modelo_contratacao}
                       onChange={pick('modelo_contratacao')} />
              </div>
            </div>
          </div>

          {/* ── Seção 4: Confidencialidade ───────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <SectionHeader n={4} title="Confidencialidade" />
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Esta vaga é confidencial?</label>
                <Pills
                  options={['Não', 'Sim']}
                  value={form.confidencial ? 'Sim' : 'Não'}
                  onChange={v => setForm(p => ({
                    ...p,
                    confidencial: v === 'Sim',
                    recrutador_nome: '',
                    recrutador_email: '',
                  }))}
                />
                <p className="mt-2 text-[11px] text-gray-400">
                  Vagas confidenciais são notificadas apenas para o recrutador selecionado e ficam ocultas para os demais.
                </p>
              </div>
              {form.confidencial && (
                <div>
                  <label className={labelCls}>Recrutador Responsável *</label>
                  <select
                    className={inputCls}
                    value={form.recrutador_email}
                    onChange={e => {
                      const email = e.target.value;
                      const gestorOpt = form.gestor_email && !RECRUTADORES_RH.some(r => r.email === form.gestor_email)
                        ? { nome: form.gestor, email: form.gestor_email }
                        : null;
                      const todos = gestorOpt ? [...RECRUTADORES_RH, gestorOpt] : RECRUTADORES_RH;
                      const rec = todos.find(r => r.email === email);
                      setForm(p => ({ ...p, recrutador_email: email, recrutador_nome: rec?.nome || '' }));
                    }}
                  >
                    <option value="">Selecione o recrutador...</option>
                    {[
                      ...RECRUTADORES_RH,
                      ...(form.gestor_email && !RECRUTADORES_RH.some(r => r.email === form.gestor_email)
                        ? [{ nome: form.gestor || 'Gestor da área', email: form.gestor_email }]
                        : []),
                    ].map(r => (
                      <option key={r.email} value={r.email}>{r.nome}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {erro && <p className="text-sm text-red-500 font-semibold px-1">{erro}</p>}

          <button onClick={handleSubmit} disabled={saving}
            className="w-full py-4 text-base font-black text-white rounded-2xl transition-all hover:opacity-90 disabled:opacity-50 shadow-lg"
            style={{ backgroundColor: C.pink }}>
            {saving ? 'Enviando...' : 'Enviar Solicitação'}
          </button>

        </div>
      </div>
    </div>
  );
}
