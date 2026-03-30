/**
 * Chrome browser automation stubs for zerotoken.
 * Provides launchOpenClawChrome, stopOpenClawChrome, getChromeWebSocketUrl.
 * These are stubs that allow the providers to compile. The actual browser
 * connection is handled by each provider using playwright-core directly.
 */

import { chromium } from "playwright-core";
import type { BrowserContext } from "playwright-core";

export type RunningChrome = {
  cdpPort: number;
  process: import("node:child_process").ChildProcess;
};

/**
 * Get the WebSocket URL from a running Chrome debug port.
 */
export async function getChromeWebSocketUrl(
  cdpUrl: string,
  timeoutMs: number = 2000,
): Promise<string | null> {
  try {
    const response = await fetch(`${cdpUrl}/json/version`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { webSocketDebuggerUrl?: string };
    return data.webSocketDebuggerUrl || null;
  } catch {
    return null;
  }
}

/**
 * Launch a new Chrome instance with remote debugging enabled.
 */
export async function launchOpenClawChrome(
  _browserConfig: unknown,
  _profile: unknown,
): Promise<RunningChrome> {
  throw new Error(
    "launchOpenClawChrome is not supported in zerotoken. " +
    "Please use attachOnly mode or connect to an existing Chrome instance. " +
    "Set ZEROTOKEN_CDP_URL to your Chrome debug address (default: http://127.0.0.1:9222).",
  );
}

/**
 * Stop a running Chrome instance launched by launchOpenClawChrome.
 */
export async function stopOpenClawChrome(running: RunningChrome): Promise<void> {
  if (running.process && !running.process.killed) {
    running.process.kill("SIGTERM");
  }
}
