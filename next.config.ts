import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

// CAM-187 MEAS-1c — bundle size analysis.
// Enable with: ANALYZE=1 npm run build
// Output: .next/analyze/client.html + server.html
// The analyzer is NEVER enabled in Vercel production builds (ANALYZE env var not set).
const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "1",
  openAnalyzer: false,
});

const nextConfig: NextConfig = {
  images: {
    formats: ["image/webp"],
    qualities: [75],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 80, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 31, // 31 days in seconds (CAM-194 PERF-4)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
    dangerouslyAllowSVG: false,
  },
};

export default withAnalyzer(nextConfig);
