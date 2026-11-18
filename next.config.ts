import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SheetJS is a pure-JS package but must be required at runtime rather than
  // bundled, otherwise serverless (Vercel) builds can fail on its dynamic
  // requires. Report exports therefore work in production.
  serverExternalPackages: ["xlsx"],
};

export default nextConfig;
