import type { NextConfig } from "next";

export function r2ImageRemotePatterns(publicUrl: string | undefined) {
  if (!publicUrl) return [];

  try {
    const url = new URL(publicUrl);
    if (url.protocol !== "https:" || url.hostname.endsWith(".r2.dev")) return [];
    return [{ protocol: "https" as const, hostname: url.hostname, port: url.port, pathname: "/**" }];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,
  productionBrowserSourceMaps: false,
  enablePrerenderSourceMaps: false,
  experimental: {
    cpus: 1,
    serverSourceMaps: false,
    preloadEntriesOnStart: false,
    webpackMemoryOptimizations: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: r2ImageRemotePatterns(process.env.NEXT_PUBLIC_R2_PUBLIC_URL),
  },
};

export default nextConfig;
