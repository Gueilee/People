'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const C = {
  purple: '#422c76', dark: '#2d1f52', light: '#ede9f6',
  green: '#16a34a', red: '#dc2626', amber: '#d97706',
  blue: '#2563eb', teal: '#0d9488', gray: '#6b7280',
  border: '#e5e7eb', bg: '#f8f7fc',
};

const GRAD = `linear-gradient(135deg, ${C.purple}, ${C.teal})`;

type Sugestao = {
  id_colaborador: string; nome: string; cargo: string;
  unidade: string; departamento: string; status: string;
};

type Colab = {
  id_colaborador: string; nome: string; email: string;
  unidade: string; departamento: string; cargo: string;
  gestor: string; data_admissao: string; data_desligamento: string | null;
  tipo_desligamento: string | null; status: string;
  vinculo?: string | null; birth_date?: string | null;
  gender?: string | null; etnia?: string | null;
  gravatar_hash?: string;
};

type Evento = {
  id: number; nome: string; cpf: string; vinculo: string;
  cargo: string; departamento: string; area: string;
  unidade: string; centro_custo: string; motivo: string;
  tipo_evento: string; data_inicio: string | null;
  data_fim: string | null; is_current: number; duracao_dias: number | null;
};

type OrgPessoa = {
  id_colaborador?: string; nome: string; cargo: string;
  unidade?: string; departamento?: string; status?: string; gestor?: string;
  gravatar_hash?: string; email?: string;
};

type Organograma = {
  diretos: OrgPessoa[];
  totalDiretos: number;
  gestorInfo: OrgPessoa | null;
  gestorDoGestor: OrgPessoa | null;
  irmaos: OrgPessoa[];
};

/* ── Helpers ── */
function iniciais(nome: string) {
  const p = nome.trim().split(' ');
  return (p[0][0] + (p[p.length - 1][0] || '')).toUpperCase();
}
function fmtData(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function calcTenure(adm: string, desl: string | null) {
  const ini = new Date(adm), fim = desl ? new Date(desl) : new Date();
  const meses = (fim.getFullYear() - ini.getFullYear()) * 12 + (fim.getMonth() - ini.getMonth());
  const anos = Math.floor(meses / 12), m = meses % 12;
  if (anos === 0) return `${m} ${m === 1 ? 'mês' : 'meses'}`;
  if (m === 0) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
  return `${anos} ${anos === 1 ? 'ano' : 'anos'} e ${m} ${m === 1 ? 'mês' : 'meses'}`;
}
function tipoConfig(tipo: string) {
  const t = (tipo || '').toLowerCase();
  if (t.includes('admiss'))   return { cor: C.green,  bg: '#f0fdf4', icone: IconAdmissao,  label: 'Admissão' };
  if (t.includes('promoç'))   return { cor: C.purple, bg: C.light,   icone: IconPromocao,  label: 'Promoção' };
  if (t.includes('reajuste') || t.includes('salár') || t.includes('salar'))
                               return { cor: C.amber,  bg: '#fffbeb', icone: IconReajuste,  label: 'Reajuste' };
  if (t.includes('transfer')) return { cor: C.blue,   bg: '#eff6ff', icone: IconTransfer,  label: 'Transferência' };
  if (t.includes('desloca'))  return { cor: C.teal,   bg: '#f0fdfa', icone: IconTransfer,  label: 'Deslocamento' };
  if (t.includes('deslig') || t.includes('rescis'))
                               return { cor: C.red,    bg: '#fef2f2', icone: IconDesligado, label: 'Desligamento' };
  return { cor: C.gray, bg: '#f9fafb', icone: IconEvento, label: tipo || 'Evento' };
}

/* ── Ícones ── */
function IconAdmissao({ c }: { c: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>;
}
function IconPromocao({ c }: { c: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
}
function IconReajuste({ c }: { c: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}
function IconTransfer({ c }: { c: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
}
function IconDesligado({ c }: { c: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64A9 9 0 1 1 5.64 19.36"/><line x1="12" y1="2" x2="12" y2="12"/></svg>;
}
function IconEvento({ c }: { c: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}
function IconSearch() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.gray }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: '#1f2937' }}>{value || '—'}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ORGANOGRAMA
══════════════════════════════════════════════════════ */

type CardRole = 'ancestor' | 'manager' | 'self' | 'report' | 'peer';

type AvatarStage = 'ms365' | 'uiavatar' | 'initials';

function OrgAvatar({ nome, email, role, size }: {
  nome: string; email?: string; role: CardRole; size: number;
}) {
  const [stage, setStage] = useState<AvatarStage>(email ? 'ms365' : 'uiavatar');

  const borderColor = role === 'self' ? 'rgba(255,255,255,0.5)' : role === 'ancestor' ? '#e5e7eb' : '#fff';
  const shadow      = role === 'self' ? '0 4px 16px rgba(0,0,0,0.25)' : '0 1px 6px rgba(0,0,0,0.1)';
  const baseImg     = {
    width: size, height: size, borderRadius: '50%', objectFit: 'cover' as const,
    flexShrink: 0 as const, border: `2px solid ${borderColor}`, boxShadow: shadow,
  };

  function nextStage() {
    setStage(s => s === 'ms365' ? 'uiavatar' : 'initials');
  }

  if (stage === 'initials') {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: role === 'self' ? 'rgba(255,255,255,0.2)' : GRAD,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 900,
        color: role === 'self' ? C.purple : '#fff',
        border: `2px solid ${borderColor}`, boxShadow: shadow,
      }}>
        {iniciais(nome)}
      </div>
    );
  }

  const bg  = role === 'ancestor' ? 'adb5bd' : role === 'self' ? 'ffffff' : '422c76';
  const fg  = role === 'self' ? '422c76' : 'ffffff';
  const src = stage === 'ms365'
    ? `/api/foto?email=${encodeURIComponent(email ?? '')}`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(nome)}&background=${bg}&color=${fg}&bold=true&size=${size * 2}&format=png&rounded=true`;

  return (
    <img
      key={stage}
      src={src} width={size} height={size} alt={nome}
      style={baseImg}
      onError={nextStage}
    />
  );
}

function OrgCard({ pessoa, role = 'report' }: { pessoa: OrgPessoa; role?: CardRole }) {
  const isSelf     = role === 'self';
  const isAncestor = role === 'ancestor';
  const avatarSz   = isSelf ? 56 : 44;

  return (
    <div style={{
      width: 176, borderRadius: 20, flexShrink: 0, position: 'relative',
      padding: isSelf ? '24px 14px 18px' : '16px 14px',
      background: isSelf ? GRAD : '#fff',
      border: isSelf ? 'none' : `1.5px solid ${isAncestor ? '#ebebeb' : C.border}`,
      boxShadow: isSelf
        ? `0 20px 60px ${C.purple}40, 0 6px 20px ${C.purple}25`
        : isAncestor ? 'none' : '0 2px 12px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      opacity: isAncestor ? 0.6 : 1,
    }}>
      {isSelf && (
        <div style={{
          position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
          background: '#fff', borderRadius: 99, padding: '3px 14px',
          border: `1.5px solid ${C.purple}40`,
          boxShadow: `0 2px 10px ${C.purple}20`,
          fontSize: 9, fontWeight: 900, color: C.purple, letterSpacing: '0.12em',
          whiteSpace: 'nowrap',
        }}>★ SELECIONADO</div>
      )}
      <OrgAvatar nome={pessoa.nome} email={pessoa.email} role={role} size={avatarSz} />
      <div style={{ textAlign: 'center', width: '100%' }}>
        <p style={{
          fontSize: isSelf ? 13 : 11, fontWeight: 700, lineHeight: 1.3, margin: 0,
          color: isSelf ? '#fff' : isAncestor ? '#9ca3af' : '#1f2937',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', wordBreak: 'break-word',
        }}>{pessoa.nome}</p>
        {pessoa.cargo && (
          <p style={{
            fontSize: 10, margin: '4px 0 0', lineHeight: 1.2,
            color: isSelf ? 'rgba(255,255,255,0.82)' : '#6b7280',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>{pessoa.cargo}</p>
        )}
        {!isAncestor && pessoa.unidade && (
          <p style={{
            fontSize: 9, margin: '2px 0 0',
            color: isSelf ? 'rgba(255,255,255,0.55)' : '#9ca3af',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>{pessoa.unidade}</p>
        )}
        {pessoa.status === 'Desligado' && !isSelf && (
          <span style={{
            display: 'inline-block', marginTop: 6, fontSize: 8, fontWeight: 700,
            color: C.red, background: '#fef2f2', borderRadius: 99, padding: '2px 8px',
          }}>Desligado</span>
        )}
      </div>
    </div>
  );
}

function LineV({ h = 24, dashed = false }: { h?: number; dashed?: boolean }) {
  return (
    <div style={{
      width: 2, height: h, flexShrink: 0,
      background: dashed ? 'none' : GRAD,
      borderLeft: dashed ? `2px dashed ${C.purple}60` : 'none',
    }} />
  );
}

function OrgChartSection({ colab, org }: { colab: Colab; org: Organograma }) {
  const { diretos, totalDiretos, gestorInfo, gestorDoGestor, irmaos } = org;
  const isMgr  = totalDiretos > 0;
  const extras = totalDiretos > 8 ? totalDiretos - diretos.length : 0;
  const n      = diretos.length + (extras > 0 ? 1 : 0);

  const hLineLeft  = n > 1 ? `${(0.5 / n) * 100}%` : '50%';
  const hLineRight = n > 1 ? `${(0.5 / n) * 100}%` : '50%';

  const colabPessoa: OrgPessoa = {
    id_colaborador: colab.id_colaborador,
    nome: colab.nome, cargo: colab.cargo,
    unidade: colab.unidade, status: colab.status,
    email: colab.email,
  };

  return (
    <div style={{
      background: '#fff', borderRadius: 24,
      border: `1px solid ${C.border}`,
      boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
      padding: '28px 28px 24px',
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.purple }}>
            Organograma
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.gray }}>
            {isMgr
              ? `Gestão de ${totalDiretos} colaborador${totalDiretos > 1 ? 'es' : ''}`
              : gestorInfo ? `Equipe de ${gestorInfo.nome.split(' ')[0]}` : 'Posição hierárquica'}
          </p>
        </div>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {gestorDoGestor && (
            <span style={{
              fontSize: 10, color: '#9ca3af', background: '#f9fafb',
              padding: '4px 10px', borderRadius: 99, border: '1px solid #f0f0f0',
            }}>{gestorDoGestor.nome.split(' ')[0]}</span>
          )}
          {gestorDoGestor && gestorInfo && <span style={{ fontSize: 10, color: '#d1d5db' }}>›</span>}
          {gestorInfo && (
            <span style={{
              fontSize: 10, color: C.gray, background: '#f3f4f6',
              padding: '4px 10px', borderRadius: 99, border: `1px solid ${C.border}`,
            }}>{gestorInfo.nome.split(' ')[0]}</span>
          )}
          {gestorInfo && <span style={{ fontSize: 10, color: '#d1d5db' }}>›</span>}
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#fff', background: C.purple,
            padding: '4px 12px', borderRadius: 99,
          }}>★ {colab.nome.split(' ')[0]}</span>
          {isMgr && <span style={{ fontSize: 10, color: '#d1d5db' }}>›</span>}
          {isMgr && (
            <span style={{
              fontSize: 10, color: C.teal, background: '#f0fdfa',
              padding: '4px 10px', borderRadius: 99, border: `1px solid ${C.teal}30`,
            }}>{totalDiretos} direto{totalDiretos > 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Árvore hierárquica */}
      <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 200 }}>

          {/* Nível 0: Gestor do Gestor */}
          {gestorDoGestor && (
            <>
              <OrgCard pessoa={gestorDoGestor as OrgPessoa} role="ancestor" />
              <LineV h={24} />
            </>
          )}

          {/* Nível 1: Gestor */}
          {gestorInfo && (
            <>
              <OrgCard pessoa={gestorInfo as OrgPessoa} role="manager" />
              <LineV h={24} />
            </>
          )}

          {/* Nível 2: Colaborador selecionado */}
          <OrgCard pessoa={colabPessoa} role="self" />

          {/* Nível 3: Subordinados diretos */}
          {isMgr && (
            <>
              <LineV h={24} />
              <div style={{ position: 'relative', width: '100%' }}>
                <div style={{
                  position: 'absolute', top: 0,
                  left: hLineLeft, right: hLineRight, height: 2,
                  background: `linear-gradient(to right, ${C.purple}60, ${C.teal}60)`,
                }} />
                <div style={{
                  display: 'flex', justifyContent: 'space-around',
                  alignItems: 'flex-start', gap: 10,
                  flexWrap: diretos.length > 5 ? 'wrap' : 'nowrap',
                }}>
                  {diretos.map((d) => (
                    <div key={d.nome} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <LineV h={24} />
                      <OrgCard pessoa={d} role="report" />
                    </div>
                  ))}
                  {extras > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <LineV h={24} />
                      <div style={{
                        width: 176, borderRadius: 20, border: `1.5px dashed ${C.purple}40`,
                        background: C.light, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 4,
                        padding: '20px 14px',
                      }}>
                        <span style={{ fontSize: 24, fontWeight: 900, color: C.purple, lineHeight: 1 }}>+{extras}</span>
                        <span style={{ fontSize: 9, color: C.gray, marginTop: 2 }}>colaboradores</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Não-gestor: equipe com mesmo gestor */}
          {!isMgr && irmaos.length > 0 && (
            <div style={{ marginTop: 32, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${C.border})` }} />
                <span style={{
                  fontSize: 10, fontWeight: 700, color: C.gray, letterSpacing: '0.1em',
                  textTransform: 'uppercase', whiteSpace: 'nowrap',
                  padding: '5px 14px', background: '#f9fafb',
                  border: `1px solid ${C.border}`, borderRadius: 99,
                }}>
                  Equipe com {gestorInfo?.nome.split(' ')[0] || 'o gestor'} · {irmaos.length + 1} pessoas
                </span>
                <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${C.border})` }} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                {irmaos.map(s => <OrgCard key={s.nome} pessoa={s} role="peer" />)}
              </div>
            </div>
          )}

          {!isMgr && !gestorInfo && irmaos.length === 0 && (
            <p style={{ marginTop: 20, fontSize: 12, color: C.gray, textAlign: 'center' }}>
              Sem vínculos hierárquicos registrados.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
══════════════════════════════════════════════════════ */
export default function ColaboradorPage() {
  const router = useRouter();
  const [query, setQuery]           = useState('');
  const [sugestoes, setSugestoes]   = useState<Sugestao[]>([]);
  const [showDrop, setShowDrop]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [loadingProf, setLoadingProf] = useState(false);
  const [colab, setColab]           = useState<Colab | null>(null);
  const [historico, setHistorico]   = useState<Evento[]>([]);
  const [organograma, setOrganograma] = useState<Organograma | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscar = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setSugestoes([]); setShowDrop(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/colaborador?busca=${encodeURIComponent(q)}`);
        const d = await r.json();
        setSugestoes(Array.isArray(d) ? d : []);
        setShowDrop(true);
      } finally { setLoading(false); }
    }, 280);
  }, []);

  async function selecionar(s: Sugestao) {
    setShowDrop(false);
    setQuery(s.nome);
    setLoadingProf(true);
    try {
      const r = await fetch(`/api/colaborador?id=${encodeURIComponent(s.id_colaborador)}`);
      const d = await r.json();
      setColab(d.colaborador);
      setHistorico(d.historico || []);
      setOrganograma(d.organograma || null);
    } finally { setLoadingProf(false); }
  }

  function limpar() {
    setColab(null); setHistorico([]); setOrganograma(null);
    setQuery(''); setSugestoes([]); setShowDrop(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!(e.target as Element).closest('#search-wrap')) setShowDrop(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const ativo = colab?.status === 'Ativo';

  // Só cria evento sintético de admissão se o histórico não tiver um real
  const historicoTemAdmissao = historico.some(h =>
    (h.tipo_evento || '').toLowerCase().includes('admiss')
  );

  const eventosTimeline: (Evento & { _tipo: string })[] = [
    ...(colab && !historicoTemAdmissao ? [{
      id: -1, nome: colab.nome, cpf: '', vinculo: colab.vinculo || '',
      cargo: colab.cargo, departamento: colab.departamento, area: '',
      unidade: colab.unidade, centro_custo: '', motivo: 'Entrada na empresa',
      tipo_evento: 'Admissão', data_inicio: colab.data_admissao,
      data_fim: null, is_current: 0, duracao_dias: null, _tipo: 'Admissão',
    }] : []),
    ...historico.map(h => ({ ...h, _tipo: h.tipo_evento })),
    ...(colab?.data_desligamento ? [{
      id: -2, nome: colab.nome, cpf: '', vinculo: '',
      cargo: colab.cargo, departamento: colab.departamento, area: '',
      unidade: colab.unidade, centro_custo: '', motivo: colab.tipo_desligamento || 'Desligamento',
      tipo_evento: 'Desligamento', data_inicio: colab.data_desligamento,
      data_fim: null, is_current: 0, duracao_dias: null, _tipo: 'Desligamento',
    }] : []),
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bg }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b-4" style={{ borderColor: C.purple }}>
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center">
            <img src="/logo.png" alt="Vendemmia People" className="h-20 w-auto" />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/dashboard"
              className="text-xs font-semibold px-4 py-2 rounded-full border-2 cursor-pointer transition-all hover:opacity-80"
              style={{ borderColor: C.purple, color: C.purple }}>
              Dashboard →
            </Link>
            <Link href="/carreira"
              className="text-xs font-semibold px-4 py-2 rounded-full border-2 cursor-pointer transition-all hover:opacity-80"
              style={{ borderColor: C.purple, color: C.purple }}>
              Carreira & Dev →
            </Link>
            <button onClick={handleLogout}
              className="text-xs font-semibold px-4 py-2 rounded-full border-2 cursor-pointer transition-all hover:opacity-80"
              style={{ borderColor: C.border, color: C.gray }}>
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-8">

        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: C.dark }}>Consulta de Colaborador</h1>
          <p className="text-sm mt-1" style={{ color: C.gray }}>Busque pelo nome para ver o perfil completo, organograma e linha do tempo</p>
        </div>

        {/* ── Busca ── */}
        <div id="search-wrap" className="relative mb-8 max-w-xl">
          <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-md border"
            style={{ borderColor: showDrop ? C.purple : C.border }}>
            <IconSearch />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); buscar(e.target.value); }}
              onFocus={() => sugestoes.length > 0 && setShowDrop(true)}
              placeholder="Digite o nome do colaborador..."
              className="flex-1 text-sm outline-none bg-transparent"
              style={{ color: '#1f2937' }}
              autoComplete="off"
            />
            {loading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" style={{ color: C.purple }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            )}
            {colab && (
              <button onClick={limpar} className="text-xs cursor-pointer px-2 py-0.5 rounded-full"
                style={{ background: '#f3f4f6', color: C.gray }}>✕ limpar</button>
            )}
          </div>

          {showDrop && sugestoes.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border z-50 overflow-hidden"
              style={{ borderColor: C.border }}>
              {sugestoes.map(s => (
                <button key={s.id_colaborador} onClick={() => selecionar(s)}
                  className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors cursor-pointer border-b last:border-0"
                  style={{ borderColor: C.border }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: GRAD }}>
                      {iniciais(s.nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1f2937' }}>{s.nome}</p>
                      <p className="text-xs truncate" style={{ color: C.gray }}>{s.cargo} · {s.unidade}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: s.status === 'Ativo' ? '#f0fdf4' : '#fef2f2', color: s.status === 'Ativo' ? C.green : C.red }}>
                      {s.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showDrop && sugestoes.length === 0 && !loading && query.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border z-50 px-4 py-4 text-sm text-center"
              style={{ borderColor: C.border, color: C.gray }}>
              Nenhum colaborador encontrado para &quot;{query}&quot;
            </div>
          )}
        </div>

        {/* Loading */}
        {loadingProf && (
          <div className="flex items-center gap-3 justify-center py-16">
            <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none" style={{ color: C.purple }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="text-sm" style={{ color: C.gray }}>Carregando perfil...</span>
          </div>
        )}

        {/* ── Perfil completo ── */}
        {colab && !loadingProf && (
          <div className="flex flex-col gap-6">

            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: C.border }}>
              <div className="h-24 relative" style={{ background: GRAD }}>
                <div className="absolute -bottom-10 left-8">
                  <div className="w-20 h-20 rounded-2xl border-4 border-white flex items-center justify-center text-2xl font-black text-white shadow-lg"
                    style={{ background: GRAD }}>
                    {iniciais(colab.nome)}
                  </div>
                </div>
              </div>
              <div className="pt-14 pb-6 px-8">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-2xl font-black" style={{ color: C.dark }}>{colab.nome}</h2>
                    <p className="text-sm mt-1 font-medium" style={{ color: C.gray }}>{colab.cargo}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs font-bold px-3 py-1 rounded-full"
                        style={{ background: ativo ? '#f0fdf4' : '#fef2f2', color: ativo ? C.green : C.red }}>
                        ● {colab.status}
                      </span>
                      <span className="text-xs px-3 py-1 rounded-full font-medium"
                        style={{ background: C.light, color: C.purple }}>
                        {colab.unidade}
                      </span>
                      <span className="text-xs px-3 py-1 rounded-full font-medium"
                        style={{ background: '#f3f4f6', color: C.gray }}>
                        ⏱ {calcTenure(colab.data_admissao, colab.data_desligamento)} de casa
                      </span>
                      {organograma && organograma.totalDiretos > 0 && (
                        <span className="text-xs px-3 py-1 rounded-full font-bold"
                          style={{ background: C.light, color: C.purple }}>
                          👥 {organograma.totalDiretos} liderado{organograma.totalDiretos > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  {!ativo && colab.tipo_desligamento && (
                    <div className="px-4 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: '#fef2f2', color: C.red, border: '1px solid #fecaca' }}>
                      Desligamento: {colab.tipo_desligamento}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Organograma ── */}
            {organograma && (
              <OrgChartSection colab={colab} org={organograma} />
            )}

            {/* ── Grid: Dados + Timeline ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">

              {/* Dados */}
              <div className="flex flex-col gap-4">
                <div className="bg-white rounded-2xl shadow-sm border p-6" style={{ borderColor: C.border }}>
                  <h3 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: C.purple }}>Dados Profissionais</h3>
                  <div className="flex flex-col gap-4">
                    <InfoRow label="Cargo Atual" value={colab.cargo} />
                    <InfoRow label="Departamento" value={colab.departamento} />
                    <InfoRow label="Unidade" value={colab.unidade} />
                    <InfoRow label="Gestor" value={colab.gestor} />
                    {colab.vinculo && <InfoRow label="Vínculo" value={colab.vinculo} />}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border p-6" style={{ borderColor: C.border }}>
                  <h3 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: C.purple }}>Dados Pessoais</h3>
                  <div className="flex flex-col gap-4">
                    <InfoRow label="E-mail" value={colab.email} />
                    {colab.birth_date && <InfoRow label="Data de Nascimento" value={fmtData(colab.birth_date)} />}
                    {colab.gender && <InfoRow label="Gênero" value={colab.gender} />}
                    {colab.etnia && <InfoRow label="Etnia" value={colab.etnia} />}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border p-6" style={{ borderColor: C.border }}>
                  <h3 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: C.purple }}>Datas</h3>
                  <div className="flex flex-col gap-4">
                    <InfoRow label="Data de Admissão" value={fmtData(colab.data_admissao)} />
                    <InfoRow label="Tempo de Casa" value={calcTenure(colab.data_admissao, colab.data_desligamento)} />
                    {colab.data_desligamento && (
                      <InfoRow label="Data de Desligamento" value={fmtData(colab.data_desligamento)} />
                    )}
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white rounded-2xl shadow-sm border p-6" style={{ borderColor: C.border }}>
                <h3 className="text-xs font-black uppercase tracking-widest mb-6" style={{ color: C.purple }}>
                  Linha do Tempo — {eventosTimeline.length} {eventosTimeline.length === 1 ? 'evento' : 'eventos'}
                </h3>

                {eventosTimeline.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: C.gray }}>Nenhum evento registrado.</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-5 top-0 bottom-0 w-0.5"
                      style={{ background: `linear-gradient(to bottom, ${C.purple}, ${C.teal})` }} />

                    <div className="flex flex-col gap-0">
                      {eventosTimeline.map((ev, i) => {
                        const cfg = tipoConfig(ev._tipo);
                        const Icone = cfg.icone;
                        const isLast = i === eventosTimeline.length - 1;

                        return (
                          <div key={ev.id} className="relative flex gap-5 pb-6">
                            <div className="relative z-10 flex-shrink-0">
                              <div className="w-10 h-10 rounded-full border-2 border-white shadow flex items-center justify-center"
                                style={{ background: cfg.bg }}>
                                <Icone c={cfg.cor} />
                              </div>
                              {i === 0 && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
                                  style={{ background: C.green }} />
                              )}
                              {isLast && !colab.data_desligamento && (
                                <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white animate-pulse"
                                  style={{ background: C.purple }} />
                              )}
                            </div>

                            <div className="flex-1 rounded-xl border p-4"
                              style={{ background: cfg.bg, borderColor: `${cfg.cor}30` }}>
                              <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                    style={{ background: cfg.cor, color: '#fff' }}>
                                    {cfg.label}
                                  </span>
                                  {ev.is_current === 1 && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                                      style={{ background: C.purple, color: '#fff' }}>
                                      Atual
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs font-semibold" style={{ color: C.gray }}>
                                  {fmtData(ev.data_inicio)}{ev.data_fim ? ` → ${fmtData(ev.data_fim)}` : ''}
                                </span>
                              </div>
                              {ev.cargo && (
                                <p className="text-sm font-bold mb-1" style={{ color: '#1f2937' }}>{ev.cargo}</p>
                              )}
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                                {ev.departamento && <span className="text-xs" style={{ color: C.gray }}><span className="font-semibold">Dept:</span> {ev.departamento}</span>}
                                {ev.area && ev.area !== ev.departamento && <span className="text-xs" style={{ color: C.gray }}><span className="font-semibold">Área:</span> {ev.area}</span>}
                                {ev.unidade && <span className="text-xs" style={{ color: C.gray }}><span className="font-semibold">Unidade:</span> {ev.unidade}</span>}
                                {ev.vinculo && <span className="text-xs" style={{ color: C.gray }}><span className="font-semibold">Vínculo:</span> {ev.vinculo}</span>}
                                {ev.centro_custo && <span className="text-xs" style={{ color: C.gray }}><span className="font-semibold">CC:</span> {ev.centro_custo}</span>}
                              </div>
                              {ev.motivo && ev.motivo !== 'Entrada na empresa' && (
                                <p className="text-xs mt-2 italic" style={{ color: C.gray }}>Motivo: {ev.motivo}</p>
                              )}
                              {ev.duracao_dias && ev.duracao_dias > 0 && (
                                <p className="text-[10px] mt-2 font-semibold" style={{ color: cfg.cor }}>
                                  ⏱ {Math.round(ev.duracao_dias / 30)} meses nesta posição
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {ativo && (
                        <div className="relative flex gap-5">
                          <div className="relative z-10 flex-shrink-0">
                            <div className="w-10 h-10 rounded-full border-2 border-white shadow flex items-center justify-center animate-pulse"
                              style={{ background: C.light }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            </div>
                          </div>
                          <div className="flex-1 rounded-xl border-2 border-dashed p-4 flex items-center gap-3"
                            style={{ borderColor: C.purple, background: C.light }}>
                            <span className="text-sm font-bold" style={{ color: C.purple }}>Hoje</span>
                            <span className="text-xs" style={{ color: C.gray }}>— colaborador ativo há {calcTenure(colab.data_admissao, null)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Estado vazio */}
        {!colab && !loadingProf && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: C.light }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <p className="text-base font-semibold" style={{ color: C.dark }}>Busque um colaborador para ver o perfil</p>
            <p className="text-sm" style={{ color: C.gray }}>Digite pelo menos 2 letras do nome</p>
          </div>
        )}
      </main>
    </div>
  );
}
