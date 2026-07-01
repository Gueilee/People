'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function RecuperarSenhaPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro]       = useState('');

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#ffffff',
    border: '1.5px solid #e5e7eb',
    borderRadius: 10,
    padding: '11px 16px',
    color: '#1f2937',
    fontSize: 14,
    outline: 'none',
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setMensagem('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setMensagem(data.mensagem);
      } else {
        setErro(data.erro ?? 'Erro ao processar solicitação');
      }
    } catch {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex overflow-hidden">
      <div className="flex-1 relative hidden md:block">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/login_v1.jpeg)' }} />
      </div>

      <div className="w-full md:w-[440px] flex flex-col items-center justify-center relative" style={{ backgroundColor: '#faf9f5' }}>
        <div className="absolute inset-0 bg-cover bg-center md:hidden" style={{ backgroundImage: 'url(/login_v1.jpeg)', opacity: 0.08 }} />

        <div className="relative z-10 w-full max-w-[320px] px-2">
          <div className="flex justify-center mb-10">
            <img src="/logo-vendemmia.png" alt="Vendemmia" style={{ height: 44, width: 'auto' }} />
          </div>

          <h2 style={{ color: '#422c76' }} className="text-center text-xl font-bold mb-1">
            Recuperar senha
          </h2>
          <p className="text-center text-sm mb-8" style={{ color: '#9ca3af' }}>
            Informe seu e-mail para receber o link de redefinição
          </p>

          {mensagem ? (
            <div className="rounded-xl px-4 py-4 text-sm text-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }}>
              {mensagem}
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6b7280' }}>
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  style={inputStyle}
                  placeholder="seu@email.com"
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
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                style={{ background: loading ? 'rgba(66,44,118,0.5)' : '#422c76', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 16px rgba(66,44,118,0.3)' }}
              >
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
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
      </div>
    </div>
  );
}
