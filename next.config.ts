import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/ws/:path*",
        destination: "https://a737-171-252-154-24.ngrok-free.app/ws/:path*",
      },
    ];
  },
};

export default nextConfig;