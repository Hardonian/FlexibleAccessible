import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@aros/db', '@aros/core-services', '@aros/config', '@aros/shared'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
