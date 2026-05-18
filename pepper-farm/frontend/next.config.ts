import type { NextConfig } from "next";

// API_PROXY_TARGET is server-side only (no NEXT_PUBLIC_ prefix) so it is never
// embedded in the client bundle.  Fall back to NEXT_PUBLIC_API_BASE_URL for
// legacy configs that haven't yet added the new variable, then to localhost.
const apiProxyTarget =
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
