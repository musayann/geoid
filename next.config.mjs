/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Let the service worker control the whole scope.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ];
  },
};

export default nextConfig;
