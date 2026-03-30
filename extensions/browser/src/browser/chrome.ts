/**
 * Minimal Chrome browser automation stubs for zerotoken.
 * Provides getChromeWebSocketUrl, launchOpenClawChrome, stopOpenClawChrome,
 * isChromeReachable, and RunningChrome type needed by browser client providers.
 * Replaces the openclaw browser/chrome.ts which has deep openclaw dependencies.
 */

import type { ResolvedBrowserConfig, ResolvedBrowserProfile } from "./config.js";

export type BrowserExecutable = {
  kind: "brave" | "canary" | "chromium" | "chrome" | "custom" | "edge";
  path: string;
};

export type RunningChrome = {
  pid: number;
  exe: BrowserExecutable;
  userDataDir: string;
  cdpPort: number;
  startedAt: number;
  proc: import("node:child_process").ChildProcess;
};

type ChromeVersion = {
  webSocketDebuggerUrl?: string;
  Browser?: string;
  "User-Agent"?: string;
};

/**
 * Check if Chrome is reachable at the given CDP URL.
 */
export async function isChromeReachable(
  cdpUrl: string,
  timeoutMs = 500,
): Promise<boolean> {
  const version = await fetchChromeVersion(cdpUrl, timeoutMs);
  return Boolean(version);
}

/**
 * Get the Chrome version info from CDP.
 */
async function fetchChromeVersion(
  cdpUrl: string,
  timeoutMs = 500,
): Promise<ChromeVersion | null> {
  const ctrl = new AbortController();
  const t = setTimeout(ctrl.abort.bind(ctrl), timeoutMs);
  try {
    const versionUrl = `${cdpUrl.replace(/\/$/, "")}/json/version`;
    const res = await fetch(versionUrl, { signal: ctrl.signal });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as ChromeVersion;
    if (!data || typeof data !== "object") {
      return null;
    }
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Get the Chrome WebSocket debugger URL from a CDP HTTP endpoint.
 */
export async function getChromeWebSocketUrl(
  cdpUrl: string,
  timeoutMs = 2000,
): Promise<string | null> {
  const version = await fetchChromeVersion(cdpUrl, timeoutMs);
  const wsUrl = String(version?.webSocketDebuggerUrl ?? "").trim();
  if (!wsUrl) {
    return null;
  }
  return wsUrl;
}

/**
 * Check if Chrome CDP is fully ready (HTTP + WebSocket).
 */
export async function isChromeCdpReady(
  cdpUrl: string,
  timeoutMs = 500,
  handshakeTimeoutMs = 800,
): Promise<boolean> {
  const wsUrl = await getChromeWebSocketUrl(cdpUrl, timeoutMs);
  return Boolean(wsUrl);
}

/**
 * Launch a new Chrome instance with remote debugging enabled.
 * In zerotoken, this is a stub - users should use attachOnly mode
 * and connect to an already-running Chrome instance.
 */
export async function launchOpenClawChrome(
  _resolved: ResolvedBrowserConfig,
  _profile: ResolvedBrowserProfile,
): Promise<RunningChrome> {
  throw new Error(
    "launchOpenClawChrome is not supported in zerotoken. " +
    "Please use attachOnly mode (the default) and connect to an already-running Chrome instance. " +
    "Set ZEROTOKEN_CDP_URL to your Chrome debug address (default: http://127.0.0.1:9222). " +
    "Start Chrome with: chrome --remote-debugging-port=9222",
  );
}

/**
 * Stop a running Chrome instance launched by launchOpenClawChrome.
 */
export async function stopOpenClawChrome(
  running: RunningChrome,
  timeoutMs = 2500,
): Promise<void> {
  const proc = running.proc;
  if (proc.killed) {
    return;
  }
  try {
    proc.kill("SIGTERM");
  } catch {
    // ignore
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (proc.exitCode != null || proc.killed) {
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  try {
    proc.kill("SIGKILL");
  } catch {
    // ignore
  }
}

// Re-export commonly used browser executable functions as stubs

export function findChromeExecutableMac(): BrowserExecutable | null {
  return null;
}

export function findChromeExecutableLinux(): BrowserExecutable | null {
  return null;
}

export function findChromeExecutableWindows(): BrowserExecutable | null {
  return null;
}

export function resolveBrowserExecutableForPlatform(
  _resolved: ResolvedBrowserConfig,
  _platform: NodeJS.Platform,
): BrowserExecutable | null {
  return null;
}
