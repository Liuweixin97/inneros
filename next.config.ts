import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  devIndicators: false,
  turbopack: {},
  allowedDevOrigins: ["192.168.31.40", "localhost"],
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/.data/**"],
      };
    }

    return config;
  },
};

export default nextConfig;
