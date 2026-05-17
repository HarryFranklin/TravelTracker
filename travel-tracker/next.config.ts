import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Only enforce static export when compiling the production build
  output: isProd ? 'export' : undefined,
  
  // Disabling trailing slashes locally helps prevent local 404 routing loops
  trailingSlash: false,
};

export default nextConfig;