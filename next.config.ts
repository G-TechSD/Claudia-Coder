import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",

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
    "bill-dev-linux-1",
    "preview.claudiacoder.com",
    "preview.claudiacode.com",
  ],
};

export default nextConfig;
