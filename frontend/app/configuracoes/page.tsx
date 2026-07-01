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
  created_at: number;
};

const C = { purple: '#422c76', pink: '#ff2f69', gray: '#6b7280' };

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [me, setMe]           = useState<{ id: number; nome: string; role: string } | null>(null);
  const [users, setUsers]     = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [nome, setNome]   = useState('');
  const [email, setEmail] = useState('');
  const [login, setLogin] = useState('');
  const [role, setRole]   = useState<'admin' | 'viewer'>('viewer');
  const [saving, setSaving] = useState(false);
  const [erro, setErro]   = useState('');
  const [sucesso, setSucesso] = useState('');

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
        body: JSON.stringify({ nome, email, login, role }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.erro ?? 'Erro ao criar usuário'); return; }
      setSucesso(`Usuário criado! E-mail de convite enviado para ${email}.`);
      setNome(''); setEmail(''); setLogin(''); setRole('viewer');
      setShowForm(false);
      const r2 = await fetch('/api/admin/usuarios');
      setUsers(await r2.json());
    } catch { setErro('Erro de conexão'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number, nomeUser: string) {
    if (!confirm(`Remover o usuário "${nomeUser}"?`)) return;
    setErro(''); setSucesso('');
    const res = await fetch(`/api/admin/usuarios/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSucesso(`Usuário "${nomeUser}" removido.`);
      setUsers(u => u.filter(x => x.id !== id));
    } else {
      const d = await res.json();
      setErro(d.erro ?? 'Erro ao remover');
    }
  }

  async function handleResendInvite(id: number, nomeUser: string) {
    setErro(''); setSucesso('');
    const res = await fetch(`/api/admin/usuarios/${id}`, { method: 'POST' });
    if (res.ok) setSucesso(`Convite reenviado para "${nomeUser}".`);
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
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: C.gray }}>Login</label>
                  <input value={login} onChange={e => setLogin(e.target.value.toLowerCase().replace(/\s/g, ''))} required style={inputStyle} placeholder="joaosilva"
                    onFocus={e => { e.currentTarget.style.borderColor = C.purple; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(66,44,118,0.1)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }} />
                </div>
                <div>
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

        {/* Lista de usuários */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-sm" style={{ color: C.purple }}>
              Usuários ({users.length})
            </h2>
          </div>
          {users.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm" style={{ color: C.gray }}>Nenhum usuário cadastrado</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Nome', 'E-mail', 'Login', 'Perfil', 'Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: C.gray }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm text-gray-800">{u.nome}</div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: C.gray }}>{u.email || '—'}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{u.login}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        style={{
                          background: u.role === 'admin' ? 'rgba(66,44,118,0.1)' : '#f3f4f6',
                          color: u.role === 'admin' ? C.purple : C.gray,
                        }}>
                        {u.role === 'admin' ? 'Admin' : 'Visualizador'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {u.email && (
                          <button
                            onClick={() => handleResendInvite(u.id, u.nome)}
                            title="Reenviar convite"
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer hover:bg-purple-50"
                            style={{ color: C.purple, borderColor: 'rgba(66,44,118,0.2)' }}
                          >
                            Reenviar convite
                          </button>
                        )}
                        {u.id !== me?.id && (
                          <button
                            onClick={() => handleDelete(u.id, u.nome)}
                            title="Remover usuário"
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer hover:bg-red-50"
                            style={{ color: '#dc2626', borderColor: '#fecaca' }}
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
