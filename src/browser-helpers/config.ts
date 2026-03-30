/**
 * Browser config resolution stubs for zerotoken.
 * Provides resolveBrowserConfig and resolveProfile for provider compatibility.
 */

import type { BrowserConfig, BrowserProfileConfig, OpenClawConfig } from "../config/config.js";

const DEFAULT_PROFILE: BrowserProfileConfig = {
  cdpUrl: process.env.ZEROTOKEN_CDP_URL || "http://127.0.0.1:9222",
};

const DEFAULT_BROWSER_CONFIG: BrowserConfig = {
  attachOnly: process.env.ZEROTOKEN_ATTACH_ONLY !== "false",
  defaultProfile: "default",
  profiles: {
    default: DEFAULT_PROFILE,
  },
};

/**
 * Resolve browser configuration from the main config.
 */
export function resolveBrowserConfig(
  browserConfig: BrowserConfig | undefined,
  _rootConfig: OpenClawConfig,
): BrowserConfig {
  if (!browserConfig) {
    return DEFAULT_BROWSER_CONFIG;
  }
  return {
    ...DEFAULT_BROWSER_CONFIG,
    ...browserConfig,
    profiles: {
      ...DEFAULT_BROWSER_CONFIG.profiles,
      ...browserConfig.profiles,
    },
  };
}

/**
 * Resolve a specific browser profile by name.
 */
export function resolveProfile(
  browserConfig: BrowserConfig,
  profileName: string | undefined,
): BrowserProfileConfig | undefined {
  const name = profileName || browserConfig.defaultProfile || "default";
  return browserConfig.profiles?.[name] || DEFAULT_PROFILE;
}
