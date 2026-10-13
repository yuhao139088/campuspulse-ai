import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: { cpus: 2 },
  outputFileTracingExcludes: { "/*": ["./.env", "./.env.*", "./.deployment-private/**", "./.git/**", "./test-results/**", "./test-results-production/**", "./playwright-report/**", "./tests/**"] },
};

export default nextConfig;


