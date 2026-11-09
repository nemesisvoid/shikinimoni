import type { NextConfig } from "next";

// Property photos uploaded to Cloudflare R2 (lib/storage/r2.ts). Only the
// properties/ folder of the bucket's public URL is allowed through next/image.
const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  images: {
    remotePatterns: [
      // Placeholder listing photos (seed data). `search` is an exact match: only
      // the sizing params used in lib/data/dummy-properties.ts.
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/photo-*",
        search: "?auto=format&fit=crop&w=1600&q=75",
      },
      ...(r2PublicUrl ? [new URL(`${r2PublicUrl}/properties/**`)] : []),
    ],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
