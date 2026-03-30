/**
 * Minimal config types needed by zero-token bridge.
 * Extracted from the openclaw-zero-token project.
 */

import type { ModelsConfig } from "./types.models.js";

export type BrowserConfig = {
  attachOnly?: boolean;
  defaultProfile?: string;
  profiles?: Record<string, BrowserProfileConfig>;
};

export type BrowserProfileConfig = {
  cdpUrl?: string;
  userDataDir?: string;
  headless?: boolean;
};

export type OpenClawConfig = {
  models?: ModelsConfig;
  browser?: BrowserConfig;
  gateway?: {
    auth?: {
      token?: string;
    };
  };
  [key: string]: unknown;
};
