import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    typedRoutes: true,
    outputFileTracingRoot: path.join(process.cwd(), "../../"),
  },
};

export default nextConfig;
