import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/dashboard':     ['./database/**', './node_modules/sql.js/dist/**'],
    '/api/carreira':      ['./database/**', './node_modules/sql.js/dist/**'],
    '/api/alertas':       ['./database/**', './node_modules/sql.js/dist/**'],
    '/api/colaboradores': ['./database/**', './node_modules/sql.js/dist/**'],
  },
};

export default nextConfig;
