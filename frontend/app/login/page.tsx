'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin]     = useState('');
  const [senha, setSenha]     = useState('');
  const [erro, setErro]       = useState('');
  const [loading, setLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, senha }),
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const data = await res.json();
        setErro(data.erro ?? 'Usuário ou senha inválidos');
        setLoading(false);
      }
    } catch {
      setErro('Erro de conexão. Tente novamente.');
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#ffffff',
    border: '1.5px solid #e5e7eb',
    borderRadius: 10,
    padding: '11px 16px',
    color: '#1f2937',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  return (
    <div className="min-h-screen flex overflow-hidden">

      {/* ── Lado esquerdo: imagem de fundo ── */}
      <div className="flex-1 relative hidden md:block">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/login_v1.jpeg)' }}
        />
        <div className="absolute bottom-10 left-10">
          <p className="text-white/40 text-xs tracking-[0.25em] uppercase">
            Empowering Your People
          </p>
        </div>
      </div>

      {/* ── Lado direito: painel off-white ── */}
      <div
        className="w-full md:w-[440px] flex flex-col items-center justify-center relative"
        style={{ backgroundColor: '#faf9f5' }}
      >
        {/* Mobile: imagem de fundo faint */}
        <div
          className="absolute inset-0 bg-cover bg-center md:hidden"
          style={{ backgroundImage: 'url(/login_v1.jpeg)', opacity: 0.08 }}
        />

        <div className="relative z-10 w-full max-w-[320px] px-2">

          {/* Logo Vendemmia PNG transparente */}
          <div className="flex justify-center mb-10">
            <img
              src="/logo-vendemmia.png"
              alt="Vendemmia"
              style={{ height: 44, width: 'auto' }}
            />
          </div>

          {/* Título */}
          <h2 style={{ color: '#422c76' }} className="text-center text-xl font-bold mb-1">
            Bem-vindo de volta
          </h2>
          <p className="text-center text-sm mb-8" style={{ color: '#9ca3af' }}>
            Acesse o painel de gestão de pessoas
          </p>

          <form onSubmit={handleSubmit}>

            {/* Usuário */}
            <div className="mb-4">
              <label
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                style={{ color: '#6b7280' }}
              >
                Usuário
              </label>
              <input
                type="text"
                value={login}
                onChange={e => setLogin(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                style={inputStyle}
                placeholder="seu usuário"
                onFocus={e => {
                  e.currentTarget.style.borderColor = '#422c76';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(66,44,118,0.1)';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Senha */}
            <div className="mb-6">
              <label
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
                style={{ color: '#6b7280' }}
              >
                Senha
              </label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  placeholder="••••••••"
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#422c76';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(66,44,118,0.1)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base"
                  style={{ color: '#9ca3af', lineHeight: 1 }}
                >
                  {showSenha ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div
                className="rounded-xl px-4 py-3 text-sm mb-4"
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                }}
              >
                {erro}
              </div>
            )}

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all"
              style={{
                background: loading ? 'rgba(66,44,118,0.5)' : '#422c76',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(66,44,118,0.3)',
              }}
            >
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10"
                              stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Entrando...
                  </span>
                : 'Entrar'
              }
            </button>
          </form>

          {/* Rodapé */}
          <div
            className="mt-10 pt-6 text-center"
            style={{ borderTop: '1px solid #e5e7eb' }}
          >
            <p className="text-[10px] tracking-widest uppercase" style={{ color: '#d1d5db' }}>
              Vendemmia People · {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
