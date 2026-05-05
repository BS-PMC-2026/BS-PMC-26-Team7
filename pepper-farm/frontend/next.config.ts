import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },
  serverExternalPackages: [
    "lightningcss",
    "lightningcss-darwin-arm64",
    "lightningcss-darwin-x64",
    "lightningcss-linux-x64-gnu",
    "lightningcss-linux-arm64-gnu",
    "lightningcss-linux-x64-musl",
    "lightningcss-linux-arm64-musl",
    "lightningcss-win32-x64-msvc",
    "lightningcss-win32-arm64-msvc",
  ],
};

export default nextConfig;
