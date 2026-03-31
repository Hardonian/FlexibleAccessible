/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Obscure the technology stack from basic automated scanners
  poweredByHeader: false,
  
  // Enforce baseline security headers on static assets that bypass the Middleware
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;