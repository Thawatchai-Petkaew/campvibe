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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default withAnalyzer(nextConfig);
