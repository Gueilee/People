import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Porta configurável via variável de ambiente (default 3001 neste ambiente)
  // Para produção: defina PORT=3001 antes de iniciar
};

export default nextConfig;
