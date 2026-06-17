import fs from "node:fs";
import path from "node:path";

loadRootEnv(path.join(import.meta.dirname, "../../"));

/** @type {import("next").NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  reactStrictMode: true,
  transpilePackages: ["@upto/db", "@upto/domain"],
};

export default nextConfig;

function loadRootEnv(rootDir) {
  const loadedKeys = new Set();
  loadRootEnvFile(path.join(rootDir, ".env"), loadedKeys, false);
  loadRootEnvFile(path.join(rootDir, ".env.local"), loadedKeys, true);
}

function loadRootEnvFile(envPath, loadedKeys, overrideLoadedKeys) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const [rawKey, ...rawValueParts] = trimmedLine.replace(/^export\s+/, "").split("=");
    const key = rawKey?.trim();
    if (!key || (process.env[key] !== undefined && !(overrideLoadedKeys && loadedKeys.has(key)))) {
      continue;
    }

    process.env[key] = parseEnvValue(rawValueParts.join("="));
    loadedKeys.add(key);
  }
}

function parseEnvValue(rawValue) {
  const value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value.replace(/\s+#.*$/, "");
}
