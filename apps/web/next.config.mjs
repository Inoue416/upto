import path from "node:path";

/** @type {import("next").NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  reactStrictMode: true,
  transpilePackages: ["@upto/db", "@upto/domain"],
};

export default nextConfig;
