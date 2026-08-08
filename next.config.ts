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
  images: {
    remotePatterns: r2ImageRemotePatterns(process.env.NEXT_PUBLIC_R2_PUBLIC_URL),
  },
};

export default nextConfig;
