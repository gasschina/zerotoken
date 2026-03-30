/**
 * CDP helpers for zerotoken.
 * Provides getHeadersWithAuth, isWebSocketUrl, normalizeCdpWsUrl,
 * appendCdpPath, and other utilities needed by browser client providers.
 */

/**
 * Returns true when the URL uses a WebSocket protocol (ws: or wss:).
 */
export function isWebSocketUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "ws:" || parsed.protocol === "wss:";
  } catch {
    return false;
  }
}

/**
 * Returns true when the hostname is a loopback address.
 */
export function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/**
 * Generate headers with authentication for CDP connections.
 * Supports Basic auth from URL userinfo and Authorization header pass-through.
 */
export function getHeadersWithAuth(
  url: string,
  headers: Record<string, string> = {},
): Record<string, string> {
  try {
    const parsed = new URL(url);
    const hasAuthHeader = Object.keys(headers).some(
      (key) => key.toLowerCase() === "authorization",
    );
    if (hasAuthHeader) {
      return headers;
    }
    if (parsed.username || parsed.password) {
      const auth = Buffer.from(`${parsed.username}:${parsed.password}`).toString("base64");
      return { ...headers, Authorization: `Basic ${auth}` };
    }
  } catch {
    // ignore
  }
  return headers;
}

/**
 * Append a path segment to a CDP URL.
 */
export function appendCdpPath(cdpUrl: string, path: string): string {
  const url = new URL(cdpUrl);
  const basePath = url.pathname.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  url.pathname = `${basePath}${suffix}`;
  return url.toString();
}

/**
 * Normalize a CDP URL for HTTP JSON endpoints (convert ws to http).
 */
export function normalizeCdpHttpBaseForJsonEndpoints(cdpUrl: string): string {
  try {
    const url = new URL(cdpUrl);
    if (url.protocol === "ws:") {
      url.protocol = "http:";
    } else if (url.protocol === "wss:") {
      url.protocol = "https:";
    }
    url.pathname = url.pathname.replace(/\/devtools\/browser\/.*$/, "");
    url.pathname = url.pathname.replace(/\/cdp$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return cdpUrl
      .replace(/^ws:/, "http:")
      .replace(/^wss:/, "https:")
      .replace(/\/devtools\/browser\/.*$/, "")
      .replace(/\/cdp$/, "")
      .replace(/\/$/, "");
  }
}

/**
 * Normalize a CDP WebSocket URL, ensuring it uses the ws(s) protocol.
 * If the wsUrl is relative or doesn't have a protocol, construct it from the cdpUrl.
 */
export function normalizeCdpWsUrl(wsUrl: string, cdpUrl?: string): string {
  // If wsUrl is already a valid ws(s) URL, return it
  try {
    const parsed = new URL(wsUrl);
    if (parsed.protocol === "ws:" || parsed.protocol === "wss:") {
      return wsUrl;
    }
  } catch {
    // Not a full URL
  }

  // If wsUrl looks like a relative path or just a path, construct from cdpUrl
  if (cdpUrl && wsUrl.startsWith("/")) {
    try {
      const base = new URL(cdpUrl);
      const protocol = base.protocol === "https:" ? "wss:" : "ws:";
      const host = base.hostname;
      const port = base.port || (base.protocol === "https:" ? "443" : "80");
      return `${protocol}//${host}:${port}${wsUrl}`;
    } catch {
      // ignore
    }
  }

  // Return as-is as a fallback
  return wsUrl;
}
