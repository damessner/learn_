import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://teams.microsoft.com https://*.teams.microsoft.com https://*.microsoft.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
