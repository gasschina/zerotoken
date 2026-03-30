import type { StreamFn } from "@mariozechner/pi-agent-core";
import { createChatGPTWebStreamFn } from "./chatgpt-web-stream.js";
import { createClaudeWebStreamFn } from "./claude-web-stream.js";
import { createDeepseekWebStreamFn } from "./deepseek-web-stream.js";
import { createDoubaoWebStreamFn } from "./doubao-web-stream.js";
import { createGeminiWebStreamFn } from "./gemini-web-stream.js";
import { createGlmIntlWebStreamFn } from "./glm-intl-web-stream.js";
import { createGlmWebStreamFn } from "./glm-web-stream.js";
import { createGrokWebStreamFn } from "./grok-web-stream.js";
import { createKimiWebStreamFn } from "./kimi-web-stream.js";
import { createPerplexityWebStreamFn } from "./perplexity-web-stream.js";
import { createQwenCNWebStreamFn } from "./qwen-cn-web-stream.js";
import { createQwenWebStreamFn } from "./qwen-web-stream.js";
import { createXiaomiMimoWebStreamFn } from "./xiaomimo-web-stream.js";

/** model.api → stream factory (matches former attempt.ts / compact.ts branches). */
const WEB_STREAM_FACTORIES = {
  "deepseek-web": createDeepseekWebStreamFn,
  "claude-web": createClaudeWebStreamFn,
  "doubao-web": createDoubaoWebStreamFn,
  "chatgpt-web": createChatGPTWebStreamFn,
  "qwen-web": createQwenWebStreamFn,
  "qwen-cn-web": createQwenCNWebStreamFn,
  "kimi-web": createKimiWebStreamFn,
  "gemini-web": createGeminiWebStreamFn,
  "grok-web": createGrokWebStreamFn,
  "glm-web": createGlmWebStreamFn,
  "glm-intl-web": createGlmIntlWebStreamFn,
  "perplexity-web": createPerplexityWebStreamFn,
  "xiaomimo-web": createXiaomiMimoWebStreamFn,
} as const satisfies Record<string, (cookie: string) => StreamFn>;

export type WebStreamApiId = keyof typeof WEB_STREAM_FACTORIES;

export function getWebStreamFactory(api: string): ((cookie: string) => StreamFn) | undefined {
  return WEB_STREAM_FACTORIES[api as WebStreamApiId];
}

export function listWebStreamApiIds(): WebStreamApiId[] {
  return Object.keys(WEB_STREAM_FACTORIES) as WebStreamApiId[];
}
