/**
 * Chrome browser automation for zerotoken.
 * Provides functional launchOpenClawChrome, stopOpenClawChrome,
 * getChromeWebSocketUrl, and isChromeReachable.
 */

import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { ResolvedBrowserConfig, ResolvedBrowserProfile } from "./config.js";
import {
  resolveBrowserExecutableForPlatform,
  findChromeExecutableMac,
  findChromeExecutableLinux,
  findChromeExecutableWindows,
  type BrowserExecutable,
} from "./chrome.executables.js";

export type RunningChrome = {
  pid: number;
  exe: BrowserExecutable;
  userDataDir: string;
  cdpPort: number;
  startedAt: number;
  proc: ChildProcess;
};

type ChromeVersion = {
  webSocketDebuggerUrl?: string;
  Browser?: string;
  "User-Agent"?: string;
};

/**
 * Fetch Chrome version info from CDP HTTP endpoint.
 */
async function fetchChromeVersion(
  cdpUrl: string,
  timeoutMs = 2000,
): Promise<ChromeVersion | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const versionUrl = `${cdpUrl.replace(/\/$/, "")}/json/version`;
    const res = await fetch(versionUrl, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as ChromeVersion;
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Check if Chrome is reachable at the given CDP URL.
 */
export async function isChromeReachable(
  cdpUrl: string,
  timeoutMs = 2000,
): Promise<boolean> {
  const version = await fetchChromeVersion(cdpUrl, timeoutMs);
  return Boolean(version);
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
  return wsUrl || null;
}

/**
 * Check if Chrome CDP is fully ready (HTTP + WebSocket).
 */
export async function isChromeCdpReady(
  cdpUrl: string,
  timeoutMs = 500,
  _handshakeTimeoutMs = 800,
): Promise<boolean> {
  const wsUrl = await getChromeWebSocketUrl(cdpUrl, timeoutMs);
  return Boolean(wsUrl);
}

/**
 * Get the default user data directory for zerotoken's Chrome instance.
 */
function getDefaultUserDataDir(profileName?: string): string {
  const base = path.join(os.homedir(), ".zerotoken", "browser");
  return profileName ? path.join(base, profileName) : base;
}

/**
 * Find a free port starting from a base port.
 */
async function findFreePort(startPort: number, maxAttempts = 50): Promise<number> {
  const net = await import("node:net");
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    const available = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.listen(port, "127.0.0.1", () => {
        server.close(() => resolve(true));
      });
      server.on("error", () => resolve(false));
    });
    if (available) return port;
  }
  return startPort; // fallback
}

/**
 * Launch a new Chrome instance with remote debugging enabled.
 */
export async function launchOpenClawChrome(
  resolved: ResolvedBrowserConfig,
  profile: ResolvedBrowserProfile,
): Promise<RunningChrome> {
  // Find browser executable
  const exe = resolveBrowserExecutableForPlatform(resolved, process.platform);
  if (!exe) {
    throw new Error(
      "No Chrome/Chromium/Edge/Brave browser found on this system. " +
        "Please install one of these browsers, or set executablePath in your config.",
    );
  }

  // Determine user data directory
  let userDataDir = (resolved as Record<string, unknown>).userDataDir as string | undefined;
  if (!userDataDir || typeof userDataDir !== "string") {
    userDataDir = getDefaultUserDataDir(profile.name);
  }
  fs.mkdirSync(userDataDir, { recursive: true });

  // Determine port
  const cdpPort = profile.cdpPort || await findFreePort(resolved.cdpPortRangeStart || 9222);

  // Build arguments
  const args: string[] = [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-blink-features=AutomationControlled",
    "--disable-features=TranslateUI",
    "--disable-component-extensions-with-background-pages",
  ];

  // Add headless mode
  if (resolved.headless) {
    args.push("--headless=new");
  }

  // Add no-sandbox
  if (resolved.noSandbox) {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  // Add extra args from config
  if (resolved.extraArgs && resolved.extraArgs.length > 0) {
    args.push(...resolved.extraArgs.filter((a) => typeof a === "string"));
  }

  // Launch the browser
  const proc = spawn(exe.path, args, {
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  proc.on("error", (err) => {
    console.error(`[zerotoken] Chrome process error: ${err.message}`);
  });

  // Log stderr for debugging (silently)
  proc.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) {
      console.error(`[chrome] ${msg}`);
    }
  });

  const running: RunningChrome = {
    pid: proc.pid ?? 0,
    exe,
    userDataDir,
    cdpPort,
    startedAt: Date.now(),
    proc,
  };

  // Wait for Chrome to be ready
  const cdpUrl = profile.cdpUrl || `http://127.0.0.1:${cdpPort}`;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const reachable = await isChromeReachable(cdpUrl, 1000);
    if (reachable) {
      return running;
    }
  }

  // Timeout waiting for Chrome
  try {
    proc.kill("SIGTERM");
  } catch {
    // ignore
  }
  throw new Error(
    `Chrome did not become reachable at ${cdpUrl} within 15 seconds. ` +
      `Check if port ${cdpPort} is available and ${exe.path} is a valid browser.`,
  );
}

/**
 * Stop a running Chrome instance launched by launchOpenClawChrome.
 */
export async function stopOpenClawChrome(
  running: RunningChrome,
  timeoutMs = 5000,
): Promise<void> {
  const proc = running.proc;
  if (proc.killed || proc.exitCode != null) {
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
    await new Promise((r) => setTimeout(r, 200));
  }

  try {
    proc.kill("SIGKILL");
  } catch {
    // ignore
  }
}
