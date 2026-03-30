/**
 * Minimal config loader for zerotoken.
 * Provides loadConfig() compatible with openclaw-zero-token provider imports.
 */
import fs from "node:fs";
import path from "node:path";
import type { OpenClawConfig } from "./config.js";

let cachedConfig: OpenClawConfig | null = null;

/**
 * Load configuration from zerotoken.json in CWD, or return defaults.
 * Compatible with the openclaw loadConfig() interface.
 */
export function loadConfig(): OpenClawConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const configPath = path.join(process.cwd(), "zerotoken.json");
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      cachedConfig = JSON.parse(content) as OpenClawConfig;
      return cachedConfig;
    }
  } catch (err) {
    console.warn("[zerotoken] Failed to load config file:", err);
  }

  // Return defaults
  cachedConfig = {
    browser: {
      attachOnly: true,
      defaultProfile: "default",
      profiles: {
        default: {
          cdpUrl: process.env.ZEROTOKEN_CDP_URL || "http://127.0.0.1:9222",
        },
      },
    },
  };
  return cachedConfig;
}

/**
 * Clear the config cache (useful for testing or hot-reload).
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
