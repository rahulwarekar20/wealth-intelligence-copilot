/**
 * Next.js configuration.
 *
 * Backend proxy: requests to /backend/* are forwarded to the FastAPI server
 * (BACKEND_URL, default http://localhost:8000). Setting
 * NEXT_PUBLIC_API_URL=/backend in .env.local makes the browser talk only to
 * this Next.js server — useful for demos on a phone or through a tunnel, since
 * only one port has to be reachable and the backend stays private.
 *
 * ALLOWED_DEV_ORIGINS: comma-separated hosts (e.g. your PC's Wi-Fi address,
 * 10.0.0.159) allowed to load the dev server from other devices.
 */
import type { NextConfig } from "next";

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  async rewrites() {
    return [{ source: "/backend/:path*", destination: `${BACKEND_URL}/:path*` }];
  },

  experimental: {
    // AI answers and PDF imports can take longer than the default 30 s proxy timeout
    proxyTimeout: 120_000,
  },
};

export default nextConfig;
