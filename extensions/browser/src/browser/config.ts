/**
 * Minimal browser config resolution for zerotoken.
 * Provides resolveBrowserConfig and resolveProfile for provider compatibility.
 * Replaces the openclaw browser/config.ts which has deep openclaw dependencies.
 */

// Minimal type definitions matching what providers need.
// Re-export types that the original openclaw config.ts defined.

export type BrowserConfig = {
  enabled?: boolean;
  attachOnly?: boolean;
  defaultProfile?: string;
  cdpUrl?: string;
  profiles?: Record<string, BrowserProfileConfig>;
  headless?: boolean;
  noSandbox?: boolean;
  executablePath?: string;
  extraArgs?: string[];
  cdpPortRangeStart?: number;
  remoteCdpTimeoutMs?: number;
  remoteCdpHandshakeTimeoutMs?: number;
  color?: string;
  ssrfPolicy?: Record<string, unknown>;
  relayBindHost?: string;
  evaluateEnabled?: boolean;
  controlPort?: number;
};

export type BrowserProfileConfig = {
  cdpUrl?: string;
  cdpPort?: number;
  userDataDir?: string;
  headless?: boolean;
  color?: string;
  driver?: "openclaw" | "extension";
  attachOnly?: boolean;
};

export type OpenClawConfig = {
  models?: Record<string, unknown>;
  browser?: BrowserConfig;
  gateway?: {
    port?: number;
    auth?: {
      token?: string;
    };
  };
  [key: string]: unknown;
};

/**
 * Resolved browser configuration returned by resolveBrowserConfig().
 * This is the type that providers actually use.
 */
export type ResolvedBrowserConfig = {
  enabled: boolean;
  attachOnly: boolean;
  controlPort: number;
  defaultProfile: string;
  headless: boolean;
  noSandbox: boolean;
  executablePath?: string;
  extraArgs: string[];
  cdpPortRangeStart: number;
  cdpPortRangeEnd: number;
  cdpProtocol: "http" | "https";
  cdpHost: string;
  cdpIsLoopback: boolean;
  remoteCdpTimeoutMs: number;
  remoteCdpHandshakeTimeoutMs: number;
  color: string;
  profiles: Record<string, BrowserProfileConfig>;
  ssrfPolicy?: unknown;
  evaluateEnabled: boolean;
  relayBindHost?: string;
};

/**
 * Resolved browser profile returned by resolveProfile().
 */
export type ResolvedBrowserProfile = {
  name: string;
  cdpPort: number;
  cdpUrl: string;
  cdpHost: string;
  cdpIsLoopback: boolean;
  color?: string;
  driver: "openclaw" | "extension";
  attachOnly: boolean;
};

const DEFAULT_CDP_PORT = 9222;
const DEFAULT_CONTROL_PORT = 18780;

/**
 * Resolve browser configuration from the main config.
 * Returns a ResolvedBrowserConfig that providers can use.
 */
export function resolveBrowserConfig(
  cfg: BrowserConfig | undefined,
  _rootConfig?: OpenClawConfig,
): ResolvedBrowserConfig {
  const cdpUrl = (cfg?.cdpUrl || "").trim() || `http://127.0.0.1:${DEFAULT_CDP_PORT}`;
  let parsedHost = "127.0.0.1";
  let parsedPort = DEFAULT_CDP_PORT;
  try {
    const parsed = new URL(cdpUrl);
    parsedHost = parsed.hostname;
    parsedPort = parseInt(parsed.port, 10) || (parsed.protocol === "https:" ? 443 : 80);
  } catch {
    // keep defaults
  }

  const controlPort = cfg?.controlPort || DEFAULT_CONTROL_PORT;
  const profiles = cfg?.profiles || {};

  // Ensure a "default" profile exists
  if (!profiles["default"] && !profiles["openclaw"]) {
    profiles["default"] = {
      cdpUrl,
      cdpPort: parsedPort,
    };
  }

  return {
    enabled: cfg?.enabled !== false,
    attachOnly: cfg?.attachOnly !== false,
    controlPort,
    defaultProfile: cfg?.defaultProfile || "default",
    headless: cfg?.headless === true,
    noSandbox: cfg?.noSandbox === true,
    executablePath: cfg?.executablePath?.trim() || undefined,
    extraArgs: Array.isArray(cfg?.extraArgs) ? cfg.extraArgs.filter((a) => typeof a === "string") : [],
    cdpPortRangeStart: cfg?.cdpPortRangeStart || controlPort + 2,
    cdpPortRangeEnd: (cfg?.cdpPortRangeStart || controlPort + 2) + 10,
    cdpProtocol: cdpUrl.startsWith("https") ? "https" : "http",
    cdpHost: parsedHost,
    cdpIsLoopback: parsedHost === "localhost" || parsedHost === "127.0.0.1" || parsedHost === "::1",
    remoteCdpTimeoutMs: cfg?.remoteCdpTimeoutMs || 1500,
    remoteCdpHandshakeTimeoutMs: cfg?.remoteCdpHandshakeTimeoutMs || 3000,
    color: cfg?.color || "#FF6600",
    profiles,
    evaluateEnabled: cfg?.evaluateEnabled !== false,
  };
}

/**
 * Resolve a specific browser profile by name from the resolved config.
 * Returns null if the profile doesn't exist.
 */
export function resolveProfile(
  resolved: ResolvedBrowserConfig,
  profileName: string | undefined,
): ResolvedBrowserProfile | null {
  const name = profileName || resolved.defaultProfile;
  const profile = resolved.profiles[name];
  if (!profile) {
    return null;
  }

  const rawCdpUrl = profile.cdpUrl?.trim() || "";
  let cdpHost = resolved.cdpHost;
  let cdpPort = profile.cdpPort || 0;
  let cdpUrl = "";

  if (rawCdpUrl) {
    try {
      const parsed = new URL(rawCdpUrl);
      cdpHost = parsed.hostname;
      cdpPort = parseInt(parsed.port, 10) || (parsed.protocol === "https:" ? 443 : 80);
      cdpUrl = rawCdpUrl.replace(/\/$/, "");
    } catch {
      cdpUrl = rawCdpUrl;
    }
  } else if (cdpPort) {
    cdpUrl = `${resolved.cdpProtocol}://${resolved.cdpHost}:${cdpPort}`;
  } else {
    // Fallback to the default CDP URL from the resolved config
    cdpUrl = `${resolved.cdpProtocol}://${resolved.cdpHost}:${DEFAULT_CDP_PORT}`;
    cdpPort = DEFAULT_CDP_PORT;
  }

  return {
    name,
    cdpPort,
    cdpUrl,
    cdpHost,
    cdpIsLoopback: cdpHost === "localhost" || cdpHost === "127.0.0.1" || cdpHost === "::1",
    color: profile.color,
    driver: profile.driver === "extension" ? "extension" : "openclaw",
    attachOnly: profile.attachOnly ?? resolved.attachOnly,
  };
}

/**
 * Parse and validate an HTTP URL.
 */
export function parseHttpUrl(raw: string, label: string) {
  const trimmed = raw.trim();
  const parsed = new URL(trimmed);
  const allowed = ["http:", "https:", "ws:", "wss:"];
  if (!allowed.includes(parsed.protocol)) {
    throw new Error(`${label} must be http(s) or ws(s), got: ${parsed.protocol.replace(":", "")}`);
  }
  const isSecure = parsed.protocol === "https:" || parsed.protocol === "wss:";
  const port =
    parsed.port && parseInt(parsed.port, 10) > 0
      ? parseInt(parsed.port, 10)
      : isSecure
        ? 443
        : 80;
  return {
    parsed,
    port,
    normalized: parsed.toString().replace(/\/$/, ""),
  };
}

/**
 * Always returns true in zerotoken context (no local browser management).
 */
export function shouldStartLocalBrowserServer(_resolved: ResolvedBrowserConfig): boolean {
  return false;
}
