'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

const NAV = [
  { href: '/dashboard',   label: 'People Analytics',     color: '#422c76' },
  { href: '/ponto',       label: 'Jornada & Ponto',      color: '#F59E0B' },
  { href: '/carreira',    label: 'Carreira',             color: '#0D9488' },
  { href: '/colaborador', label: 'Consulta Colaborador', color: '#6366F1' },
];

// ─── Controles de filtro reutilizáveis ────────────────────────────────────────

export function FilterSelect({
  value, onChange, label, options, color = '#422c76', labelFn,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: string[];
  color?: string;
  labelFn?: (v: string) => string;
}) {
  const active = !!value;
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-[11px] border-2 rounded-full px-3 py-1 outline-none cursor-pointer transition-all bg-white"
      style={{
        borderColor: active ? color : '#E5E7EB',
        color: active ? color : '#6B7280',
        fontWeight: active ? 700 : 500,
      }}
    >
      <option value="">{label}</option>
      {options.map(o => <option key={o} value={o}>{labelFn ? labelFn(o) : o}</option>)}
    </select>
  );
}

export function PeriodButtons({
  value, onChange, options = [3, 6, 12], color = '#422c76',
}: {
  value: number;
  onChange: (v: number) => void;
  options?: number[];
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
      {options.map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className="text-[11px] font-bold px-3 py-1 rounded-full transition-all cursor-pointer"
          style={{
            backgroundColor: value === m ? color : 'transparent',
            color: value === m ? 'white' : '#6B7280',
          }}
        >
          {m}m
        </button>
      ))}
    </div>
  );
}

export function FilterTag({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-pink-50 text-pink-500 border border-pink-200">
      {label}
      <button onClick={onClear} className="hover:text-pink-700 ml-0.5 cursor-pointer">✕</button>
    </span>
  );
}

export function SyncBadge({ label }: { label: string }) {
  return (
    <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
      {label}
    </span>
  );
}

// ─── NavHeader principal ──────────────────────────────────────────────────────

export function NavHeader({ children }: { children?: React.ReactNode }) {
  const path = usePathname();
  const active = NAV.find(n => path.startsWith(n.href));
  const borderColor = active?.color ?? '#422c76';

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <header
      className="sticky top-0 z-50 bg-white"
      style={{ boxShadow: '0 2px 16px 0 rgba(66,44,118,0.10)', borderBottom: `3px solid ${borderColor}` }}
    >
      <div className="max-w-screen-2xl mx-auto px-6 flex items-stretch justify-between gap-2" style={{ minHeight: 68 }}>

        {/* Logo */}
        <div className="flex items-center shrink-0 pr-4" style={{ borderRight: '1.5px solid #F3F4F6' }}>
          <img src="/logo.png" alt="Vendemmia People" className="h-14 w-auto" />
        </div>

        {/* Nav tabs */}
        <nav className="flex items-stretch gap-0 flex-1">
          {NAV.map(item => {
            const isActive = path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex items-center px-5 text-[12.5px] font-bold transition-colors duration-150 border-b-[3px] -mb-[3px] whitespace-nowrap"
                style={{
                  color: isActive ? item.color : '#B0B7C3',
                  borderBottomColor: isActive ? item.color : 'transparent',
                  background: isActive ? `${item.color}08` : 'transparent',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Filtros + ações da página */}
        <div className="flex items-center gap-2 flex-wrap py-2 pl-4" style={{ borderLeft: '1.5px solid #F3F4F6' }}>
          {children}
          <button
            onClick={logout}
            className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-400 px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap"
          >
            Sair
          </button>
        </div>

      </div>
    </header>
  );
}
