import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@claws/sdk"],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
