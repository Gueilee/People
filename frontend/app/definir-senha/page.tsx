'use client';
import { useState, FormEvent, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function DefinirSenhaForm() {
  const params     = useSearchParams();
  const router     = useRouter();
  const token      = params.get('token') ?? '';
  const [senha, setSenha]         = useState('');
  const [confirma, setConfirma]   = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [mensagem, setMensagem]   = useState('');
  const [erro, setErro]           = useState('');

  useEffect(() => {
    if (!token) setErro('Link inválido. Verifique o e-mail recebido.');
  }, [token]);

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#ffffff', border: '1.5px solid #e5e7eb',
    borderRadius: 10, padding: '11px 16px', color: '#1f2937', fontSize: 14, outline: 'none',
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (senha !== confirma) { setErro('As senhas não conferem'); return; }
    if (senha.length < 6) { setErro('A senha deve ter ao menos 6 caracteres'); return; }
    setLoading(true); setErro('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, senha }),
      });
      const data = await res.json();
      if (res.ok) {
        setMensagem('Senha definida com sucesso! Redirecionando...');
        setTimeout(() => router.push('/login'), 2500);
      } else {
        setErro(data.erro ?? 'Erro ao definir senha');
      }
    } catch {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 w-full max-w-[320px] px-2">
      <div className="flex justify-center mb-10">
        <img src="/logo-vendemmia.png" alt="Vendemmia" style={{ height: 44, width: 'auto' }} />
      </div>

      <h2 style={{ color: '#422c76' }} className="text-center text-xl font-bold mb-1">
        Criar nova senha
      </h2>
      <p className="text-center text-sm mb-8" style={{ color: '#9ca3af' }}>
        Escolha uma senha segura para sua conta
      </p>

      {mensagem ? (
        <div className="rounded-xl px-4 py-4 text-sm text-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}>
          {mensagem}
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6b7280' }}>Nova Senha</label>
            <div className="relative">
              <input
                type={showSenha ? 'text' : 'password'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                autoFocus
                style={{ ...inputStyle, paddingRight: 44 }}
                placeholder="Mínimo 6 caracteres"
                onFocus={e => { e.currentTarget.style.borderColor = '#422c76'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(66,44,118,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <button type="button" onClick={() => setShowSenha(v => !v)} tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base" style={{ color: '#9ca3af' }}>
                {showSenha ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6b7280' }}>Confirmar Senha</label>
            <input
              type={showSenha ? 'text' : 'password'}
              value={confirma}
              onChange={e => setConfirma(e.target.value)}
              required
              style={inputStyle}
              placeholder="Repita a senha"
              onFocus={e => { e.currentTarget.style.borderColor = '#422c76'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(66,44,118,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {erro && (
            <div className="rounded-xl px-4 py-3 text-sm mb-4" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
              {erro}
            </div>
          )}

          <button
            type="submit" disabled={loading || !token}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all"
            style={{ background: (loading || !token) ? 'rgba(66,44,118,0.5)' : '#422c76', color: '#fff', cursor: (loading || !token) ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 16px rgba(66,44,118,0.3)' }}
          >
            {loading ? 'Salvando...' : 'Salvar senha'}
          </button>
        </form>
      )}

      <div className="mt-6 text-center">
        <Link href="/login" className="text-xs font-medium hover:underline" style={{ color: '#6b7280' }}>
          ← Voltar para o login
        </Link>
      </div>

      <div className="mt-8 pt-6 text-center" style={{ borderTop: '1px solid #e5e7eb' }}>
        <p className="text-[10px] tracking-widest uppercase" style={{ color: '#d1d5db' }}>
          Vendemmia People · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

export default function DefinirSenhaPage() {
  return (
    <div className="min-h-screen flex overflow-hidden">
      <div className="flex-1 relative hidden md:block">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/login_v1.jpeg)' }} />
      </div>
      <div className="w-full md:w-[440px] flex flex-col items-center justify-center relative" style={{ backgroundColor: '#faf9f5' }}>
        <div className="absolute inset-0 bg-cover bg-center md:hidden" style={{ backgroundImage: 'url(/login_v1.jpeg)', opacity: 0.08 }} />
        <Suspense fallback={<div className="text-sm text-gray-400">Carregando...</div>}>
          <DefinirSenhaForm />
        </Suspense>
      </div>
    </div>
  );
}
