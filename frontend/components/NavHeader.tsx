'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react';

const NAV = [
  { href: '/dashboard',   label: 'People Analytics',     color: '#422c76' },
  { href: '/ponto',       label: 'Jornada & Ponto',      color: '#F59E0B' },
  { href: '/carreira',    label: 'Carreira',             color: '#0D9488' },
  { href: '/colaborador', label: 'Consulta Colaborador', color: '#6366F1' },
];

// ─── Seleção única (usado em /ponto e outros) ────────────────────────────────

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

// ─── Seleção múltipla (usado no /dashboard) ───────────────────────────────────

export function MultiFilterSelect({
  values,
  onChange,
  label,
  options,
  color = '#422c76',
  labelFn,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  label: string;
  options: string[];
  color?: string;
  labelFn?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggle(opt: string) {
    onChange(values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt]);
  }

  const active = values.length > 0;
  const fmt = (v: string) => (labelFn ? labelFn(v) : v);
  const displayLabel = !active
    ? label
    : values.length === 1
    ? fmt(values[0])
    : `${values.length} selecionados`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[11px] border-2 rounded-full px-3 py-1 outline-none cursor-pointer transition-all bg-white whitespace-nowrap"
        style={{
          borderColor: active ? color : '#E5E7EB',
          color: active ? color : '#6B7280',
          fontWeight: active ? 700 : 500,
        }}
      >
        {displayLabel}
        <svg
          width="8" height="5" viewBox="0 0 8 5" fill="none"
          style={{ opacity: 0.6, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full mt-1.5 left-0 bg-white rounded-xl shadow-2xl border z-[200] overflow-hidden"
          style={{ minWidth: 220, maxHeight: 264, display: 'flex', flexDirection: 'column', borderColor: '#E5E7EB' }}
        >
          {active && (
            <button
              onClick={() => onChange([])}
              className="shrink-0 w-full text-left px-3 py-2 text-[11px] font-bold hover:bg-red-50 border-b border-gray-100 transition-colors"
              style={{ color: '#EF4444' }}
            >
              ✕ Limpar seleção ({values.length})
            </button>
          )}
          <div style={{ overflowY: 'auto' }}>
            {options.map(opt => {
              const sel = values.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggle(opt)}
                  className="w-full text-left px-3 py-2 text-[11px] flex items-center gap-2.5 hover:bg-gray-50 transition-colors"
                  style={{ color: sel ? color : '#374151', fontWeight: sel ? 700 : 400 }}
                >
                  <span
                    className="shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                    style={{
                      borderColor: sel ? color : '#D1D5DB',
                      backgroundColor: sel ? color : 'transparent',
                    }}
                  >
                    {sel && (
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <span className="truncate" title={fmt(opt)}>{fmt(opt)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Botões de período ────────────────────────────────────────────────────────

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

// ─── Tags de filtro ativo ─────────────────────────────────────────────────────

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
