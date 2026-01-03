import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: "Claudia Admin",
  },

  // Disable strict mode in production for better performance
  reactStrictMode: process.env.NODE_ENV === "development",
};

export default nextConfig;
