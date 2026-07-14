'use client';
import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';

type Usuario = {
  id: number;
  nome: string;
  email: string | null;
  login: string;
  role: 'admin' | 'viewer';
  ativo: number;
  tem_senha: number;
  created_at: number;
};

const C = { purple: '#422c76', pink: '#ff2f69', gray: '#6b7280' };

function StatusBadge({ u }: { u: Usuario }) {
  if (!u.ativo) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase"
        style={{ background: '#fef2f2', color: '#dc2626' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
        Desativado
      </span>
    );
  }
  if (!u.tem_senha) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase"
        style={{ background: '#fffbeb', color: '#d97706' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
        Pendente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase"
      style={{ background: '#f0fdf4', color: '#16a34a' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
      Ativo
    </span>
  );
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [me, setMe]           = useState<{ id: number; nome: string; role: string } | null>(null);
  const [users, setUsers]     = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [nome, setNome]   = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole]   = useState<'admin' | 'viewer'>('viewer');
  const [saving, setSaving] = useState(false);
  const [erro, setErro]   = useState('');
  const [sucesso, setSucesso] = useState('');

  const reloadUsers = () =>
    fetch('/api/admin/usuarios').then(r => r.ok ? r.json() : []).then(setUsers);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || data.role !== 'admin') { router.replace('/dashboard'); return; }
        setMe(data);
        return fetch('/api/admin/usuarios');
      })
      .then(r => r ? (r.ok ? r.json() : []) : [])
      .then(data => { setUsers(data); setLoading(false); })
      .catch(() => { router.replace('/dashboard'); });
  }, [router]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setErro(''); setSucesso('');
    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, role }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.erro ?? 'Erro ao criar usuário'); return; }
      setSucesso(`Usuário criado! E-mail de convite enviado para ${email}.`);
      setNome(''); setEmail(''); setRole('viewer');
      setShowForm(false);
      await reloadUsers();
    } catch { setErro('Erro de conexão'); }
    finally { setSaving(false); }
  }

  async function handleDeactivate(id: number, nomeUser: string) {
    if (!confirm(`Desativar o usuário "${nomeUser}"?\n\nEle não conseguirá mais acessar o sistema, mas pode ser reativado depois.`)) return;
    setErro(''); setSucesso('');
    const res = await fetch(`/api/admin/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'desativar' }),
    });
    if (res.ok) {
      setSucesso(`Usuário "${nomeUser}" desativado.`);
      await reloadUsers();
    } else {
      const d = await res.json();
      setErro(d.erro ?? 'Erro ao desativar');
    }
  }

  async function handleHardDelete(id: number, nomeUser: string) {
    if (!confirm(`Excluir permanentemente "${nomeUser}"?\n\nEsta ação não pode ser desfeita. O usuário será removido do banco de dados.`)) return;
    setErro(''); setSucesso('');
    const res = await fetch(`/api/admin/usuarios/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSucesso(`Usuário "${nomeUser}" excluído permanentemente.`);
      await reloadUsers();
    } else {
      const d = await res.json();
      setErro(d.erro ?? 'Erro ao excluir');
    }
  }

  async function handleReactivate(id: number, nomeUser: string) {
    setErro(''); setSucesso('');
    const res = await fetch(`/api/admin/usuarios/${id}`, { method: 'PATCH' });
    if (res.ok) {
      const d = await res.json();
      setSucesso(
        d.convite_enviado
          ? `"${nomeUser}" reativado e novo convite enviado por e-mail.`
          : `"${nomeUser}" reativado com sucesso.`
      );
      await reloadUsers();
    } else {
      const d = await res.json();
      setErro(d.erro ?? 'Erro ao reativar');
    }
  }

  async function handleResendInvite(id: number, nomeUser: string) {
    setErro(''); setSucesso('');
    const res = await fetch(`/api/admin/usuarios/${id}`, { method: 'POST' });
    if (res.ok) setSucesso(`Novo convite enviado para "${nomeUser}".`);
    else { const d = await res.json(); setErro(d.erro ?? 'Erro ao reenviar'); }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#fff', border: '1.5px solid #e5e7eb',
    borderRadius: 8, padding: '9px 12px', color: '#1f2937', fontSize: 13, outline: 'none',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavHeader />
        <div className="flex items-center justify-center mt-32">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const ativos    = users.filter(u => u.ativo === 1);
  const inativos  = users.filter(u => u.ativo === 0);
  const pendentes = ativos.filter(u => !u.tem_senha).length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8f7f4' }}>
      <NavHeader />

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black" style={{ color: C.purple }}>Configurações</h1>
            <p className="text-sm mt-1" style={{ color: C.gray }}>Gerenciamento de usuários do sistema</p>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setErro(''); setSucesso(''); }}
            className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer"
            style={{ background: C.purple, color: '#fff', boxShadow: '0 4px 14px rgba(66,44,118,0.3)' }}
          >
            {showForm ? 'Cancelar' : '+ Novo Usuário'}
          </button>
        </div>

        {/* Mensagens globais */}
        {sucesso && (
          <div className="rounded-xl px-4 py-3 text-sm mb-6" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}>
            {sucesso}
          </div>
        )}
        {erro && (
          <div className="rounded-xl px-4 py-3 text-sm mb-6" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
            {erro}
          </div>
        )}

        {/* Formulário de criação */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
            <h2 className="font-bold text-sm mb-5" style={{ color: C.purple }}>Novo Usuário</h2>
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: C.gray }}>Nome completo</label>
                  <input value={nome} onChange={e => setNome(e.target.value)} required style={inputStyle} placeholder="João Silva"
                    onFocus={e => { e.currentTarget.style.borderColor = C.purple; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(66,44,118,0.1)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: C.gray }}>E-mail</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} placeholder="joao@vendemmia.com.br"
                    onFocus={e => { e.currentTarget.style.borderColor = C.purple; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(66,44,118,0.1)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: C.gray }}>Perfil</label>
                  <select value={role} onChange={e => setRole(e.target.value as 'admin' | 'viewer')}
                    style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="viewer">Visualizador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <p className="text-xs mb-4" style={{ color: C.gray }}>
                Um e-mail de convite será enviado com o link para o usuário criar sua senha.
              </p>
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all"
                style={{ background: saving ? 'rgba(66,44,118,0.5)' : C.purple, color: '#fff' }}>
                {saving ? 'Criando...' : 'Criar e enviar convite'}
              </button>
            </form>
          </div>
        )}

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Ativos', value: ativos.filter(u => u.tem_senha).length, color: '#16a34a', bg: '#f0fdf4' },
            { label: 'Pendentes', value: pendentes, color: '#d97706', bg: '#fffbeb' },
            { label: 'Desativados', value: inativos.length, color: '#dc2626', bg: '#fef2f2' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm" style={{ borderLeft: `3px solid ${card.color}` }}>
              <div className="text-2xl font-black" style={{ color: card.color }}>{card.value}</div>
              <div className="text-xs font-semibold mt-0.5" style={{ color: C.gray }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* Lista de usuários ativos */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-sm" style={{ color: C.purple }}>
              Usuários ({ativos.length})
            </h2>
          </div>
          {ativos.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm" style={{ color: C.gray }}>Nenhum usuário ativo</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Nome', 'E-mail', 'Perfil', 'Status', 'Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: C.gray }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ativos.map(u => (
                  <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm text-gray-800">{u.nome}</div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: C.gray }}>{u.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        style={{
                          background: u.role === 'admin' ? 'rgba(66,44,118,0.1)' : '#f3f4f6',
                          color: u.role === 'admin' ? C.purple : C.gray,
                        }}>
                        {u.role === 'admin' ? 'Admin' : 'Visualizador'}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge u={u} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {u.email && !u.tem_senha && (
                          <button
                            onClick={() => handleResendInvite(u.id, u.nome)}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer hover:bg-amber-50"
                            style={{ color: '#d97706', borderColor: '#fde68a' }}
                          >
                            Reenviar convite
                          </button>
                        )}
                        {u.id !== me?.id && (
                          <>
                            <button
                              onClick={() => handleDeactivate(u.id, u.nome)}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer hover:bg-orange-50"
                              style={{ color: '#ea580c', borderColor: '#fed7aa' }}
                            >
                              Desativar
                            </button>
                            <button
                              onClick={() => handleHardDelete(u.id, u.nome)}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer hover:bg-red-50"
                              style={{ color: '#dc2626', borderColor: '#fecaca' }}
                            >
                              Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Usuários desativados */}
        {inativos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-sm" style={{ color: '#dc2626' }}>
                Desativados ({inativos.length})
              </h2>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#fef2f2' }}>
                  {['Nome', 'E-mail', 'Perfil', 'Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: '#dc2626', opacity: 0.6 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inativos.map(u => (
                  <tr key={u.id} className="border-t border-red-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm" style={{ color: '#9ca3af' }}>{u.nome}</div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#d1d5db' }}>{u.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        style={{ background: '#f3f4f6', color: '#9ca3af' }}>
                        {u.role === 'admin' ? 'Admin' : 'Visualizador'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReactivate(u.id, u.nome)}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer hover:bg-green-50"
                          style={{ color: '#16a34a', borderColor: '#bbf7d0' }}
                        >
                          {u.tem_senha ? 'Reativar' : 'Reativar e convidar'}
                        </button>
                        <button
                          onClick={() => handleHardDelete(u.id, u.nome)}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer hover:bg-red-50"
                          style={{ color: '#dc2626', borderColor: '#fecaca' }}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
