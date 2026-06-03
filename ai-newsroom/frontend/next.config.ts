import type { NextConfig } from "next";

const internalApiBase = (
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const assetRouteBase = (
  process.env.INTERNAL_ASSET_URL ||
  internalApiBase
).replace(/\/+$/, "");

const minioBucket = (
  process.env.MINIO_BUCKET ||
  process.env.NEXT_PUBLIC_MINIO_BUCKET ||
  "newsroom-images"
).replace(/^\/+|\/+$/g, "");

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    return [
      {
        source: `/${minioBucket}/:path*`,
        destination: `${assetRouteBase}/${minioBucket}/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${internalApiBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
