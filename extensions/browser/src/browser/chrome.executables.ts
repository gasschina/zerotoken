/**
 * Chrome/Chromium/Edge/Brave executable finder for zerotoken.
 * Finds browser executables on macOS, Linux, and Windows.
 */

import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export type BrowserExecutable = {
  kind: "brave" | "canary" | "chromium" | "chrome" | "custom" | "edge";
  path: string;
};

/**
 * Check if a path exists and is executable.
 */
async function isExecutable(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

/**
 * Find Chrome executable on macOS.
 */
export function findChromeExecutableMac(): BrowserExecutable | null {
  const candidates: Array<{ path: string; kind: BrowserExecutable["kind"] }> = [
    // Brave
    { path: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", kind: "brave" },
    // Chrome
    { path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", kind: "chrome" },
    // Chrome Canary
    { path: "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary", kind: "canary" },
    // Chromium
    { path: "/Applications/Chromium.app/Contents/MacOS/Chromium", kind: "chromium" },
    // Edge
    { path: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", kind: "edge" },
  ];

  for (const { path: p, kind } of candidates) {
    if (existsSync(p)) {
      return { kind, path: p };
    }
  }

  // Also check home directory
  const home = os.homedir();
  const homeCandidates: Array<{ path: string; kind: BrowserExecutable["kind"] }> = [
    { path: path.join(home, "Applications/Brave Browser.app/Contents/MacOS/Brave Browser"), kind: "brave" },
    { path: path.join(home, "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"), kind: "chrome" },
    { path: path.join(home, "Applications/Chromium.app/Contents/MacOS/Chromium"), kind: "chromium" },
  ];

  for (const { path: p, kind } of homeCandidates) {
    if (existsSync(p)) {
      return { kind, path: p };
    }
  }

  return null;
}

/**
 * Find Chrome executable on Linux.
 */
export function findChromeExecutableLinux(): BrowserExecutable | null {
  const candidates: Array<{ cmd: string; kind: BrowserExecutable["kind"] }> = [
    { cmd: "google-chrome-stable", kind: "chrome" },
    { cmd: "google-chrome", kind: "chrome" },
    { cmd: "chromium-browser", kind: "chromium" },
    { cmd: "chromium", kind: "chromium" },
    { cmd: "brave-browser", kind: "brave" },
    { cmd: "brave", kind: "brave" },
    { cmd: "microsoft-edge-stable", kind: "edge" },
    { cmd: "microsoft-edge", kind: "edge" },
    { cmd: "google-chrome-beta", kind: "chrome" },
    { cmd: "google-chrome-unstable", kind: "canary" },
  ];

  // We use synchronous execSync-like approach: check common paths
  const commonPaths: Array<{ path: string; kind: BrowserExecutable["kind"] }> = [
    { path: "/usr/bin/google-chrome", kind: "chrome" },
    { path: "/usr/bin/google-chrome-stable", kind: "chrome" },
    { path: "/usr/bin/chromium-browser", kind: "chromium" },
    { path: "/usr/bin/chromium", kind: "chromium" },
    { path: "/usr/bin/brave-browser", kind: "brave" },
    { path: "/usr/bin/brave", kind: "brave" },
    { path: "/usr/bin/microsoft-edge", kind: "edge" },
    { path: "/usr/bin/microsoft-edge-stable", kind: "edge" },
    { path: "/snap/bin/chromium", kind: "chromium" },
    { path: "/snap/bin/chromium-browser", kind: "chromium" },
    { path: "/usr/lib/chromium-browser/chromium-browser", kind: "chromium" },
    { path: "/usr/lib/chromium/chromium", kind: "chromium" },
    // Flatpak
    { path: "/var/lib/flatpak/exports/bin/com.google.Chrome", kind: "chrome" },
    { path: "/var/lib/flatpak/exports/bin/com.brave.Browser", kind: "brave" },
    { path: "/var/lib/flatpak/exports/bin/org.chromium.Chromium", kind: "chromium" },
    { path: "/var/lib/flatpak/exports/bin/com.microsoft.Edge", kind: "edge" },
  ];

  for (const { path: p, kind } of commonPaths) {
    if (existsSync(p)) {
      return { kind, path: p };
    }
  }

  return null;
}

/**
 * Find Chrome executable on Windows.
 */
export function findChromeExecutableWindows(): BrowserExecutable | null {
  const programFiles = process.env["ProgramFiles"] || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const localAppData = process.env["LOCALAPPDATA"] || path.join(os.homedir(), "AppData", "Local");

  const candidates: Array<{ path: string; kind: BrowserExecutable["kind"] }> = [
    // Chrome
    { path: path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"), kind: "chrome" },
    { path: path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"), kind: "chrome" },
    { path: path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"), kind: "chrome" },
    // Edge
    { path: path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"), kind: "edge" },
    { path: path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"), kind: "edge" },
    // Brave
    { path: path.join(programFiles, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"), kind: "brave" },
    { path: path.join(localAppData, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"), kind: "brave" },
    // Chromium
    { path: path.join(programFiles, "Chromium", "Application", "chrome.exe"), kind: "chromium" },
    { path: path.join(localAppData, "Chromium", "Application", "chrome.exe"), kind: "chromium" },
    // Chrome Canary
    { path: path.join(localAppData, "Google", "Chrome SxS", "Application", "chrome.exe"), kind: "canary" },
  ];

  for (const { path: p, kind } of candidates) {
    if (existsSync(p)) {
      return { kind, path: p };
    }
  }

  return null;
}

/**
 * Resolve browser executable for the current platform.
 */
export function resolveBrowserExecutableForPlatform(
  _resolved: import("./config.js").ResolvedBrowserConfig,
  platform: NodeJS.Platform,
): BrowserExecutable | null {
  // If user explicitly set an executable path, use that
  if (_resolved.executablePath && existsSync(_resolved.executablePath)) {
    return { kind: "custom", path: _resolved.executablePath };
  }

  switch (platform) {
    case "darwin":
      return findChromeExecutableMac();
    case "linux":
      return findChromeExecutableLinux();
    case "win32":
      return findChromeExecutableWindows();
    default:
      return null;
  }
}
