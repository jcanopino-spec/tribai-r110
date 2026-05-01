import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Balance de Prueba uploads can be a few MB.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
