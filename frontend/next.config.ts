import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/api/dashboard':     ['./database/**', './lib/sql-wasm.wasm'],
    '/api/carreira':      ['./database/**', './lib/sql-wasm.wasm'],
    '/api/alertas':       ['./database/**', './lib/sql-wasm.wasm'],
    '/api/colaboradores': ['./database/**', './lib/sql-wasm.wasm'],
    '/api/ponto':         ['./database/**', './lib/sql-wasm.wasm'],
    '/api/recrutamento':  ['./database/**', './lib/sql-wasm.wasm'],
  },
};

export default nextConfig;
