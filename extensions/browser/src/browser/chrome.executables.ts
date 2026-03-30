/**
 * Minimal chrome.executables stub for zerotoken.
 * Provides BrowserExecutable type needed by chrome.ts.
 * The full implementation from openclaw is not needed since zerotoken uses attachOnly mode.
 */

import type { ResolvedBrowserConfig } from "./config.js";

export type BrowserExecutable = {
  kind: "brave" | "canary" | "chromium" | "chrome" | "custom" | "edge";
  path: string;
};

/**
 * Stub - not implemented in zerotoken.
 */
export function resolveBrowserExecutableForPlatform(
  _resolved: ResolvedBrowserConfig,
  _platform: NodeJS.Platform,
): BrowserExecutable | null {
  return null;
}

/**
 * Stub - not implemented in zerotoken.
 */
export function findChromeExecutableMac(): BrowserExecutable | null {
  return null;
}

/**
 * Stub - not implemented in zerotoken.
 */
export function findChromeExecutableLinux(): BrowserExecutable | null {
  return null;
}

/**
 * Stub - not implemented in zerotoken.
 */
export function findChromeExecutableWindows(): BrowserExecutable | null {
  return null;
}
