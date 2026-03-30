/**
 * Credential storage system for zerotoken.
 * Stores provider login credentials in ~/.zerotoken/auth-profiles.json.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ZEROTOKEN_DIR = path.join(os.homedir(), ".zerotoken");
const AUTH_PROFILES_PATH = path.join(ZEROTOKEN_DIR, "auth-profiles.json");

export type AuthProfileCredential = {
  type: "token";
  provider: string;
  token: string; // JSON string of credentials (cookie, sessionKey, etc.)
  capturedAt: number;
};

export type AuthProfileStore = {
  version: number;
  profiles: Record<string, AuthProfileCredential>;
};

/**
 * Ensure the ~/.zerotoken directory exists.
 */
export function ensureAuthDir(): string {
  fs.mkdirSync(ZEROTOKEN_DIR, { recursive: true, mode: 0o700 });
  return ZEROTOKEN_DIR;
}

/**
 * Load or create the auth profile store.
 */
export function ensureAuthProfileStore(): AuthProfileStore {
  ensureAuthDir();
  try {
    const raw = fs.readFileSync(AUTH_PROFILES_PATH, "utf-8");
    const parsed = JSON.parse(raw) as AuthProfileStore;
    if (parsed && typeof parsed === "object" && parsed.profiles) {
      return parsed;
    }
    return { version: 1, profiles: {} };
  } catch {
    return { version: 1, profiles: {} };
  }
}

/**
 * Save the auth profile store to disk.
 */
export function saveAuthProfileStore(store: AuthProfileStore): void {
  ensureAuthDir();
  fs.writeFileSync(
    AUTH_PROFILES_PATH,
    JSON.stringify(store, null, 2),
    { mode: 0o600 },
  );
}

/**
 * Save a credential for a provider.
 */
export function saveAuthProviderCredential(
  providerId: string,
  credentials: Record<string, unknown>,
): void {
  const store = ensureAuthProfileStore();
  const key = `${providerId}:default`;
  store.profiles[key] = {
    type: "token",
    provider: providerId,
    token: JSON.stringify(credentials),
    capturedAt: Date.now(),
  };
  saveAuthProfileStore(store);
}

/**
 * Get stored credential for a provider as a JSON string.
 * Returns null if not found.
 */
export function getAuthProviderCredential(providerId: string): string | null {
  const store = ensureAuthProfileStore();
  const key = `${providerId}:default`;
  const profile = store.profiles[key];
  if (profile?.type === "token" && profile.token) {
    return profile.token;
  }
  return null;
}

/**
 * Get stored credential for a provider as a parsed object.
 * Returns null if not found.
 */
export function getAuthProviderCredentialParsed<T = Record<string, unknown>>(
  providerId: string,
): T | null {
  const token = getAuthProviderCredential(providerId);
  if (!token) return null;
  try {
    return JSON.parse(token) as T;
  } catch {
    return null;
  }
}

/**
 * Remove stored credential for a provider.
 */
export function removeAuthProviderCredential(providerId: string): boolean {
  const store = ensureAuthProfileStore();
  const key = `${providerId}:default`;
  if (store.profiles[key]) {
    delete store.profiles[key];
    saveAuthProfileStore(store);
    return true;
  }
  return false;
}

/**
 * List all provider IDs that have stored credentials.
 */
export function listAuthorizedProviders(): Array<{
  id: string;
  capturedAt: number;
}> {
  const store = ensureAuthProfileStore();
  return Object.entries(store.profiles)
    .filter(([, profile]) => profile?.type === "token" && profile.token)
    .map(([key, profile]) => ({
      id: key.replace(":default", ""),
      capturedAt: profile.capturedAt || 0,
    }))
    .sort((a, b) => b.capturedAt - a.capturedAt);
}

/**
 * Get the path to the auth profiles file.
 */
export function getAuthProfilesPath(): string {
  return AUTH_PROFILES_PATH;
}
