import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",

  // Turbopack configuration (Next.js 16+ uses Turbopack by default)
  // Note: Turbopack doesn't support watchOptions ignore patterns yet
  // Use webpack flag (next dev --webpack) if you need this feature
  turbopack: {},

  // Webpack configuration for when running with --webpack flag
  // Ignores claudia-projects folder from hot reload during development
  // This prevents page refreshes when builds modify files in project directories
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/claudia-projects/**',
          '/home/**/claudia-projects/**',
          '**/.git/**',
          '**/~/**',
          '**/~/claudia-projects/**',
          '**/.local-storage/**',
          '**/auth.db',
          '**/auth.db-journal',
        ],
      };
    }
    return config;
  },

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: "Claudia Coder",
  },

  // Disable strict mode in production for better performance
  reactStrictMode: process.env.NODE_ENV === "development",

  // Hide the dev tools indicator for a cleaner UI
  // Errors will still be displayed when they occur
  devIndicators: false,

  // Allow requests from these dev origins
  allowedDevOrigins: [
    // Internal dev hostname only in development
    ...(process.env.NODE_ENV === "development" ? ["bill-dev-linux-1"] : []),
    "preview.claudiacoder.com",
    "preview.claudiacode.com",
  ],
};

export default nextConfig;
