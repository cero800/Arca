import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@arca/core", "@arca/db"],
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
