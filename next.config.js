/** @type {import('next').NextConfig} */
const nextConfig = {
  // Isso garante que o Next.js procure as rotas dentro de src/app
  experimental: {
    appDir: true,
  },
};

module.exports = nextConfig;