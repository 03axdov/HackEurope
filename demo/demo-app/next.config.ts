import { withBetterStack } from "@logtail/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // instrumentationHook: true,
  },
  productionBrowserSourceMaps: true,
};

export default withBetterStack(nextConfig);
