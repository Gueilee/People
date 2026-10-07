'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavHeader } from '@/components/NavHeader';

type Iniciativa = {
  id: number;
  titulo: string;
  tipo: string;
  descricao: string | null;
  criado_em: string;
};

type Atividade = {
  id: number;
  iniciativa_id: number;
  titulo: string;
  descricao: string | null;
  responsavel: string | null;
  prazo: string | null;
  status: string;
  criado_em: string;
  atualizado_em: string;
};

const TIPOS_INICIATIVA = [
  'Pesquisa de Clima',
  'Treinamento',
  'Avaliação de Desempenho',
  'Onboarding',
  'Engajamento',
  'Outro',
];

const COLUNAS = [
  { key: 'planejamento', label: 'Em Planejamento', cor: '#6366f1', bg: '#eef2ff' },
  { key: 'andamento',    label: 'Em Andamento',    cor: '#d97706', bg: '#fef3c7' },
  { key: 'concluido',    label: 'Concluído',        cor: '#059669', bg: '#d1fae5' },
  { key: 'pausado',      label: 'Pausado',           cor: '#6b7280', bg: '#f3f4f6' },
] as const;

type ColKey = typeof COLUNAS[number]['key'];

const STATUS_MAP: Record<string, { label: string; cor: string; bg: string }> = {
  planejamento: { label: 'Em Planejamento', cor: '#6366f1', bg: '#eef2ff' },
  andamento:    { label: 'Em Andamento',    cor: '#d97706', bg: '#fef3c7' },
  concluido:    { label: 'Concluído',        cor: '#059669', bg: '#d1fae5' },
  pausado:      { label: 'Pausado',           cor: '#6b7280', bg: '#f3f4f6' },
};

const EMPTY_INI = { titulo: '', tipo_iniciativa: '', descricao: '' };
const EMPTY_ATIV = { iniciativa_id: 0, titulo: '', descricao: '', responsavel: '', prazo: '', status: 'planejamento' };

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function isVencido(prazo: string | null, status: string) {
  return !!prazo && status !== 'concluido' && new Date(prazo) < new Date();
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DHOPage() {
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [iniciativas, setIniciativas] = useState<Iniciativa[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  // filtros lista
  const [filtroIni, setFiltroIni] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroResp, setFiltroResp] = useState('');

  // modal iniciativa
  const [showModalIni, setShowModalIni] = useState(false);
  const [editIni, setEditIni] = useState<Iniciativa | null>(null);
  const [formIni, setFormIni] = useState(EMPTY_INI);

  // modal atividade
  const [showModalAtiv, setShowModalAtiv] = useState(false);
  const [editAtiv, setEditAtiv] = useState<Atividade | null>(null);
  const [formAtiv, setFormAtiv] = useState(EMPTY_ATIV);

  // kanban drag
  const dragId = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<ColKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/dho');
      const d = await r.json();
      setIniciativas(d.iniciativas ?? []);
      setAtividades(d.atividades ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Iniciativa ────────────────────────────────────────────────────────────

  function abrirNovaIni() {
    setEditIni(null); setFormIni(EMPTY_INI); setErro(''); setShowModalIni(true);
  }
  function abrirEditarIni(ini: Iniciativa) {
    setEditIni(ini); setFormIni({ titulo: ini.titulo, tipo_iniciativa: ini.tipo, descricao: ini.descricao ?? '' });
    setErro(''); setShowModalIni(true);
  }
  async function salvarIni() {
    if (!formIni.titulo.trim() || !formIni.tipo_iniciativa) { setErro('Título e tipo são obrigatórios'); return; }
    setSaving(true);
    try {
      if (editIni) {
        await fetch(`/api/dho/${editIni.id}?entidade=iniciativa`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo: formIni.titulo, tipo_iniciativa: formIni.tipo_iniciativa, descricao: formIni.descricao }),
        });
      } else {
        await fetch('/api/dho', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo: 'iniciativa', titulo: formIni.titulo, tipo_iniciativa: formIni.tipo_iniciativa, descricao: formIni.descricao }),
        });
      }
      setShowModalIni(false); await load();
    } finally { setSaving(false); }
  }
  async function deletarIni(ini: Iniciativa) {
    if (!confirm(`Excluir "${ini.titulo}"? Todas as atividades vinculadas serão removidas.`)) return;
    await fetch(`/api/dho/${ini.id}?entidade=iniciativa`, { method: 'DELETE' });
    await load();
  }

  // ── Atividade ─────────────────────────────────────────────────────────────

  function abrirNovaAtiv(iniciativaId?: number) {
    setEditAtiv(null);
    setFormAtiv({ ...EMPTY_ATIV, iniciativa_id: iniciativaId ?? (iniciativas[0]?.id ?? 0) });
    setErro(''); setShowModalAtiv(true);
  }
  function abrirEditarAtiv(a: Atividade) {
    setEditAtiv(a);
    setFormAtiv({
      iniciativa_id: a.iniciativa_id, titulo: a.titulo,
      descricao: a.descricao ?? '', responsavel: a.responsavel ?? '',
      prazo: a.prazo ? a.prazo.substring(0, 10) : '', status: a.status,
    });
    setErro(''); setShowModalAtiv(true);
  }
  async function salvarAtiv() {
    if (!formAtiv.titulo.trim() || !formAtiv.iniciativa_id) { setErro('Título e iniciativa são obrigatórios'); return; }
    setSaving(true);
    try {
      if (editAtiv) {
        await fetch(`/api/dho/${editAtiv.id}?entidade=atividade`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formAtiv),
        });
      } else {
        await fetch('/api/dho', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo: 'atividade', ...formAtiv }),
        });
      }
      setShowModalAtiv(false); await load();
    } finally { setSaving(false); }
  }
  async function deletarAtiv(a: Atividade) {
    if (!confirm(`Excluir atividade "${a.titulo}"?`)) return;
    await fetch(`/api/dho/${a.id}?entidade=atividade`, { method: 'DELETE' });
    setAtividades(prev => prev.filter(x => x.id !== a.id));
  }

  // ── Kanban drag ───────────────────────────────────────────────────────────

  async function handleDrop(status: ColKey) {
    setDragOver(null);
    const id = dragId.current;
    if (id === null) return;
    dragId.current = null;
    const current = atividades.find(a => a.id === id);
    if (!current || current.status === status) return;
    setAtividades(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    await fetch(`/api/dho/${id}?entidade=atividade`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const atividadesFiltradas = atividades.filter(a => {
    if (filtroIni && String(a.iniciativa_id) !== filtroIni) return false;
    if (filtroStatus && a.status !== filtroStatus) return false;
    if (filtroResp && a.responsavel !== filtroResp) return false;
    return true;
  });

  const responsaveisUnicos = [...new Set(atividades.map(a => a.responsavel).filter(Boolean))] as string[];

  function nomeIni(id: number) { return iniciativas.find(i => i.id === id)?.titulo ?? '—'; }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8f7fb' }}>
      <NavHeader />

      <main className="max-w-screen-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1e1b4b' }}>DHO</h1>
            <p className="text-sm text-gray-400 mt-0.5">Planos de ação · pesquisas e iniciativas de desenvolvimento humano</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-white border border-gray-200 rounded-xl p-0.5">
              {(['kanban', 'lista'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg transition-all"
                  style={{ backgroundColor: view === v ? '#6366f1' : 'transparent', color: view === v ? 'white' : '#6b7280' }}>
                  {v === 'kanban' ? '⬜ Kanban' : '☰ Lista'}
                </button>
              ))}
            </div>
            <button onClick={abrirNovaIni}
              className="text-xs font-bold px-4 py-2 rounded-xl transition-all border"
              style={{ color: '#6366f1', borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.06)' }}>
              + Nova iniciativa
            </button>
            <button onClick={() => abrirNovaAtiv()}
              className="text-xs font-bold px-4 py-2 rounded-xl text-white"
              style={{ backgroundColor: '#6366f1' }}>
              + Nova atividade
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : iniciativas.length === 0 ? (
          <EmptyState onNovaIni={abrirNovaIni} />
        ) : view === 'kanban' ? (
          <KanbanView
            atividades={atividades} iniciativas={iniciativas}
            dragId={dragId} dragOver={dragOver} setDragOver={setDragOver}
            onDrop={handleDrop} onEdit={abrirEditarAtiv} onDelete={deletarAtiv}
            onNovaAtiv={abrirNovaAtiv} nomeIni={nomeIni}
          />
        ) : (
          <ListaView
            atividades={atividadesFiltradas} todasAtividades={atividades} iniciativas={iniciativas}
            filtroIni={filtroIni} setFiltroIni={setFiltroIni}
            filtroStatus={filtroStatus} setFiltroStatus={setFiltroStatus}
            filtroResp={filtroResp} setFiltroResp={setFiltroResp}
            responsaveisUnicos={responsaveisUnicos}
            onEdit={abrirEditarAtiv} onDelete={deletarAtiv} onNovaAtiv={abrirNovaAtiv}
            onEditIni={abrirEditarIni} onDeleteIni={deletarIni} nomeIni={nomeIni}
          />
        )}
      </main>

      {/* Modal: Iniciativa */}
      {showModalIni && (
        <Modal titulo={editIni ? 'Editar iniciativa' : 'Nova iniciativa'}
          onClose={() => setShowModalIni(false)} onSave={salvarIni} saving={saving} erro={erro}>
          <FormField label="Título">
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={formIni.titulo} placeholder="Nome da iniciativa"
              onChange={e => setFormIni(p => ({ ...p, titulo: e.target.value }))} />
          </FormField>
          <FormField label="Tipo">
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={formIni.tipo_iniciativa}
              onChange={e => setFormIni(p => ({ ...p, tipo_iniciativa: e.target.value }))}>
              <option value="">Selecione o tipo</option>
              {TIPOS_INICIATIVA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormField>
          <FormField label="Descrição / Contexto">
            <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none"
              rows={3} value={formIni.descricao} placeholder="Objetivo, contexto, público-alvo..."
              onChange={e => setFormIni(p => ({ ...p, descricao: e.target.value }))} />
          </FormField>
          {editIni && (
            <div className="pt-2 border-t border-gray-100">
              <button onClick={() => { setShowModalIni(false); deletarIni(editIni); }}
                className="text-xs text-red-500 hover:text-red-700 font-medium">
                Excluir esta iniciativa
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* Modal: Atividade */}
      {showModalAtiv && (
        <Modal titulo={editAtiv ? 'Editar atividade' : 'Nova atividade'}
          onClose={() => setShowModalAtiv(false)} onSave={salvarAtiv} saving={saving} erro={erro}>
          <FormField label="Iniciativa">
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={formAtiv.iniciativa_id}
              onChange={e => setFormAtiv(p => ({ ...p, iniciativa_id: parseInt(e.target.value) }))}>
              <option value={0}>Selecione</option>
              {iniciativas.map(i => <option key={i.id} value={i.id}>{i.titulo}</option>)}
            </select>
          </FormField>
          <FormField label="Atividade / Plano de ação">
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={formAtiv.titulo} placeholder="Descreva a atividade ou plano de ação"
              onChange={e => setFormAtiv(p => ({ ...p, titulo: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Responsável">
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
                value={formAtiv.responsavel} placeholder="Nome"
                onChange={e => setFormAtiv(p => ({ ...p, responsavel: e.target.value }))} />
            </FormField>
            <FormField label="Prazo">
              <input type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
                value={formAtiv.prazo}
                onChange={e => setFormAtiv(p => ({ ...p, prazo: e.target.value }))} />
            </FormField>
          </div>
          {editAtiv && (
            <FormField label="Status">
              <div className="flex gap-2 flex-wrap">
                {COLUNAS.map(c => (
                  <button key={c.key} onClick={() => setFormAtiv(p => ({ ...p, status: c.key }))}
                    className="px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all"
                    style={{
                      borderColor: formAtiv.status === c.key ? c.cor : '#e5e7eb',
                      backgroundColor: formAtiv.status === c.key ? c.bg : 'white',
                      color: formAtiv.status === c.key ? c.cor : '#9ca3af',
                    }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </FormField>
          )}
          <FormField label="Observações">
            <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none"
              rows={3} value={formAtiv.descricao} placeholder="Detalhes, resultado esperado, critério de conclusão..."
              onChange={e => setFormAtiv(p => ({ ...p, descricao: e.target.value }))} />
          </FormField>
          {editAtiv && (
            <div className="pt-2 border-t border-gray-100">
              <button onClick={() => { setShowModalAtiv(false); deletarAtiv(editAtiv); }}
                className="text-xs text-red-500 hover:text-red-700 font-medium">
                Excluir esta atividade
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function EmptyState({ onNovaIni }: { onNovaIni: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ backgroundColor: '#eef2ff' }}>
        📋
      </div>
      <p className="text-gray-500 text-sm text-center max-w-xs">
        Nenhuma iniciativa cadastrada. Crie a primeira para começar a organizar os planos de ação do DHO.
      </p>
      <button onClick={onNovaIni}
        className="text-sm font-bold px-5 py-2.5 rounded-xl text-white"
        style={{ backgroundColor: '#6366f1' }}>
        + Criar primeira iniciativa
      </button>
    </div>
  );
}

// ── Kanban ────────────────────────────────────────────────────────────────────

function KanbanView({
  atividades, iniciativas, dragId, dragOver, setDragOver, onDrop, onEdit, onDelete, onNovaAtiv, nomeIni,
}: {
  atividades: Atividade[];
  iniciativas: Iniciativa[];
  dragId: React.MutableRefObject<number | null>;
  dragOver: ColKey | null;
  setDragOver: (v: ColKey | null) => void;
  onDrop: (s: ColKey) => void;
  onEdit: (a: Atividade) => void;
  onDelete: (a: Atividade) => void;
  onNovaAtiv: (iniId?: number) => void;
  nomeIni: (id: number) => string;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))', minWidth: 900 }}>
        {COLUNAS.map(col => {
          const cards = atividades.filter(a => a.status === col.key);
          const isOver = dragOver === col.key;
          return (
            <div key={col.key}
              onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
              onDrop={() => onDrop(col.key)}
              className="rounded-2xl flex flex-col"
              style={{
                backgroundColor: isOver ? col.bg : '#f1f0f9',
                border: `2px solid ${isOver ? col.cor : 'transparent'}`,
                minHeight: 400, transition: 'all 0.15s',
              }}>
              {/* Column header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.cor }} />
                  <span className="text-xs font-bold" style={{ color: col.cor }}>{col.label}</span>
                  <span className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: col.bg, color: col.cor }}>
                    {cards.length}
                  </span>
                </div>
                <button onClick={() => onNovaAtiv()}
                  className="text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center hover:opacity-70 transition-opacity"
                  style={{ backgroundColor: col.bg, color: col.cor }} title="Nova atividade">
                  +
                </button>
              </div>
              {/* Cards */}
              <div className="flex flex-col gap-2 px-3 pb-3 flex-1">
                {cards.map(a => (
                  <KanbanCard key={a.id} atividade={a} nomeIniciativa={nomeIni(a.iniciativa_id)}
                    cor={col.cor}
                    onDragStart={() => { dragId.current = a.id; }}
                    onEdit={() => onEdit(a)} onDelete={() => onDelete(a)} />
                ))}
                {cards.length === 0 && (
                  <div className="flex-1 rounded-xl border-2 border-dashed flex items-center justify-center"
                    style={{ borderColor: `${col.cor}40`, minHeight: 80 }}>
                    <span className="text-xs" style={{ color: `${col.cor}60` }}>Arraste para cá</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({
  atividade, nomeIniciativa, cor, onDragStart, onEdit, onDelete,
}: {
  atividade: Atividade;
  nomeIniciativa: string;
  cor: string;
  onDragStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const vencido = isVencido(atividade.prazo, atividade.status);
  return (
    <div draggable
      onDragStart={e => { onDragStart(); e.dataTransfer.effectAllowed = 'move'; }}
      className="bg-white rounded-xl p-3 shadow-sm cursor-grab active:cursor-grabbing group"
      style={{ border: '1.5px solid #e5e7eb' }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-gray-800 leading-snug flex-1">{atividade.titulo}</p>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={e => { e.stopPropagation(); onEdit(); }}
            className="w-5 h-5 rounded flex items-center justify-center hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Editar">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M7 1L9 3L3 9H1V7L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-50 text-gray-400 hover:text-red-500" title="Excluir">
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M1 1L8 8M8 1L1 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-block mb-2 max-w-full truncate"
        style={{ backgroundColor: `${cor}18`, color: cor }} title={nomeIniciativa}>
        {nomeIniciativa}
      </div>
      {atividade.descricao && (
        <p className="text-[10px] text-gray-400 mb-2 leading-snug line-clamp-2">{atividade.descricao}</p>
      )}
      <div className="flex items-center justify-between gap-2 mt-1">
        {atividade.responsavel && (
          <span className="text-[10px] text-gray-400 truncate">{atividade.responsavel}</span>
        )}
        {atividade.prazo && (
          <span className="text-[10px] font-medium ml-auto shrink-0"
            style={{ color: vencido ? '#ef4444' : '#9ca3af' }}>
            {vencido ? '⚠ ' : ''}{fmtDate(atividade.prazo)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Lista ─────────────────────────────────────────────────────────────────────

function ListaView({
  atividades, todasAtividades, iniciativas,
  filtroIni, setFiltroIni, filtroStatus, setFiltroStatus, filtroResp, setFiltroResp,
  responsaveisUnicos, onEdit, onDelete, onNovaAtiv, onEditIni, onDeleteIni, nomeIni,
}: {
  atividades: Atividade[];
  todasAtividades: Atividade[];
  iniciativas: Iniciativa[];
  filtroIni: string; setFiltroIni: (v: string) => void;
  filtroStatus: string; setFiltroStatus: (v: string) => void;
  filtroResp: string; setFiltroResp: (v: string) => void;
  responsaveisUnicos: string[];
  onEdit: (a: Atividade) => void;
  onDelete: (a: Atividade) => void;
  onNovaAtiv: () => void;
  onEditIni: (i: Iniciativa) => void;
  onDeleteIni: (i: Iniciativa) => void;
  nomeIni: (id: number) => string;
}) {
  const hasFilter = !!(filtroIni || filtroStatus || filtroResp);
  return (
    <div className="space-y-5">
      {/* Iniciativas */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Iniciativas</span>
          <span className="text-xs text-gray-400">{iniciativas.length}</span>
        </div>
        <div className="divide-y divide-gray-50">
          {iniciativas.map(ini => (
            <div key={ini.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{ini.titulo}</p>
                <p className="text-xs text-gray-400">{ini.tipo}</p>
              </div>
              {ini.descricao && (
                <p className="text-xs text-gray-400 hidden md:block max-w-xs truncate">{ini.descricao}</p>
              )}
              <span className="text-xs text-gray-300 shrink-0">
                {todasAtividades.filter(a => a.iniciativa_id === ini.id).length} atividade{todasAtividades.filter(a => a.iniciativa_id === ini.id).length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => onEditIni(ini)}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-medium px-2 py-1">Editar</button>
                <button onClick={() => onDeleteIni(ini)}
                  className="text-xs text-red-400 hover:text-red-600 font-medium px-2 py-1">Excluir</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Filtrar:</span>
        <select className="text-xs border border-gray-200 rounded-full px-3 py-1.5 outline-none bg-white"
          value={filtroIni} onChange={e => setFiltroIni(e.target.value)}>
          <option value="">Todas as iniciativas</option>
          {iniciativas.map(i => <option key={i.id} value={String(i.id)}>{i.titulo}</option>)}
        </select>
        <select className="text-xs border border-gray-200 rounded-full px-3 py-1.5 outline-none bg-white"
          value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {COLUNAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        {responsaveisUnicos.length > 0 && (
          <select className="text-xs border border-gray-200 rounded-full px-3 py-1.5 outline-none bg-white"
            value={filtroResp} onChange={e => setFiltroResp(e.target.value)}>
            <option value="">Todos os responsáveis</option>
            {responsaveisUnicos.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {hasFilter && (
          <button onClick={() => { setFiltroIni(''); setFiltroStatus(''); setFiltroResp(''); }}
            className="text-xs text-red-400 hover:text-red-600 font-medium">
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela de atividades */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Atividades</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {atividades.length} resultado{atividades.length !== 1 ? 's' : ''}
            </span>
            <button onClick={onNovaAtiv}
              className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
              style={{ backgroundColor: '#6366f1' }}>
              + Nova
            </button>
          </div>
        </div>
        {atividades.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">
            {hasFilter ? 'Nenhuma atividade corresponde aos filtros' : 'Nenhuma atividade cadastrada ainda'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-400 font-bold uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Iniciativa</th>
                  <th className="text-left px-3 py-3">Atividade</th>
                  <th className="text-left px-3 py-3">Responsável</th>
                  <th className="text-left px-3 py-3">Prazo</th>
                  <th className="text-left px-3 py-3">Status</th>
                  <th className="px-3 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {atividades.map(a => {
                  const s = STATUS_MAP[a.status] ?? STATUS_MAP.planejamento;
                  const vencido = isVencido(a.prazo, a.status);
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 group">
                      <td className="px-5 py-3 text-gray-500 max-w-[160px]">
                        <span className="truncate block">{nomeIni(a.iniciativa_id)}</span>
                      </td>
                      <td className="px-3 py-3 max-w-[260px]">
                        <p className="font-semibold text-gray-800 truncate">{a.titulo}</p>
                        {a.descricao && (
                          <p className="text-gray-400 truncate mt-0.5">{a.descricao}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{a.responsavel || '—'}</td>
                      <td className="px-3 py-3 whitespace-nowrap" style={{ color: vencido ? '#ef4444' : '#9ca3af' }}>
                        {vencido && '⚠ '}{fmtDate(a.prazo)}
                      </td>
                      <td className="px-3 py-3">
                        <span className="px-2.5 py-1 rounded-full font-bold whitespace-nowrap"
                          style={{ backgroundColor: s.bg, color: s.cor }}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onEdit(a)}
                            className="font-bold" style={{ color: '#6366f1' }}>Editar</button>
                          <button onClick={() => onDelete(a)}
                            className="font-bold text-red-400 hover:text-red-600">Excluir</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Modal({
  titulo, onClose, onSave, saving, erro, children,
}: {
  titulo: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  erro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">{titulo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{erro}</div>
          )}
          {children}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 font-medium">Cancelar</button>
          <button onClick={onSave} disabled={saving}
            className="text-sm font-bold px-5 py-2 rounded-xl text-white transition-all"
            style={{ backgroundColor: saving ? '#a5b4fc' : '#6366f1' }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-600">{label}</label>
      {children}
    </div>
  );
}
