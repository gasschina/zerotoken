import crypto from "node:crypto";
import { chromium } from "playwright-core";
import type { BrowserContext, Page } from "playwright-core";
import { getHeadersWithAuth } from "../../../extensions/browser/src/browser/cdp.helpers.js";
import {
  launchOpenClawChrome,
  stopOpenClawChrome,
  getChromeWebSocketUrl,
  type RunningChrome,
} from "../../../extensions/browser/src/browser/chrome.js";
import { resolveBrowserConfig, resolveProfile } from "../../../extensions/browser/src/browser/config.js";
import { loadConfig } from "../../config/io.js";
import type { ModelDefinitionConfig } from "../../config/types.models.js";

export interface ClaudeWebClientOptions {
  sessionKey: string;
  cookie?: string;
  userAgent?: string;
  organizationId?: string;
  deviceId?: string;
}

export interface ClaudeConversation {
  uuid: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Claude Web Client using Playwright browser context to bypass Cloudflare
 */
export class ClaudeWebClientBrowser {
  private sessionKey: string;
  private cookie: string;
  private userAgent: string;
  private organizationId?: string;
  private deviceId: string;
  private baseUrl = "https://claude.ai/api";
  private browser: BrowserContext | null = null;
  private page: Page | null = null;
  private running: RunningChrome | null = null;

  constructor(options: ClaudeWebClientOptions | string) {
    if (typeof options === "string") {
      const parsed = JSON.parse(options) as ClaudeWebClientOptions;
      this.sessionKey = parsed.sessionKey;
      this.cookie = parsed.cookie || `sessionKey=${parsed.sessionKey}`;
      this.userAgent = parsed.userAgent || "Mozilla/5.0";
      this.organizationId = parsed.organizationId;
      this.deviceId = parsed.deviceId || this.extractDeviceId(this.cookie) || crypto.randomUUID();
    } else {
      this.sessionKey = options.sessionKey;
      this.cookie = options.cookie || `sessionKey=${options.sessionKey}`;
      this.userAgent = options.userAgent || "Mozilla/5.0";
      this.organizationId = options.organizationId;
      this.deviceId = options.deviceId || this.extractDeviceId(this.cookie) || crypto.randomUUID();
    }
  }

  private extractDeviceId(cookie: string): string | undefined {
    const match = cookie.match(/anthropic-device-id=([^;]+)/);
    return match ? match[1] : undefined;
  }

  private async ensureBrowser() {
    if (this.browser && this.page) {
      return { browser: this.browser, page: this.page };
    }

    const rootConfig = loadConfig();
    const browserConfig = resolveBrowserConfig(rootConfig.browser, rootConfig);
    const profile = resolveProfile(browserConfig, browserConfig.defaultProfile);
    if (!profile) {
      throw new Error(`Could not resolve browser profile '${browserConfig.defaultProfile}'`);
    }

    // If attachOnly is true, connect to existing Chrome instead of launching
    if (browserConfig.attachOnly) {
      console.log(`[Claude Web Browser] Connecting to existing Chrome at ${profile.cdpUrl}`);

      let wsUrl: string | null = null;
      for (let i = 0; i < 10; i++) {
        wsUrl = await getChromeWebSocketUrl(profile.cdpUrl, 2000);
        if (wsUrl) {
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }

      if (!wsUrl) {
        throw new Error(
          `Failed to connect to Chrome at ${profile.cdpUrl}. ` +
            `Make sure Chrome is running in debug mode (./start-chrome-debug.sh)`,
        );
      }

      this.browser = await chromium
        .connectOverCDP(wsUrl, {
          headers: getHeadersWithAuth(wsUrl),
        })
        .then((b) => b.contexts()[0]);

      if (!this.browser) {
        throw new Error("Failed to connect to Chrome browser context");
      }

      // Find the Claude.ai page or create new one
      const pages = this.browser.pages();
      let claudePage = pages.find((p) => p.url().includes("claude.ai"));

      if (claudePage) {
        console.log(`[Claude Web Browser] Found existing Claude page: ${claudePage.url()}`);
        this.page = claudePage;
      } else {
        console.log(`[Claude Web Browser] No Claude page found, creating new one...`);
        this.page = await this.browser.newPage();
        await this.page.goto("https://claude.ai/new", { waitUntil: "domcontentloaded" });
      }

      console.log(`[Claude Web Browser] Connected to existing Chrome successfully`);
    } else {
      // Launch new Chrome
      this.running = await launchOpenClawChrome(browserConfig, profile);

      const cdpUrl = `http://127.0.0.1:${this.running.cdpPort}`;
      let wsUrl: string | null = null;

      for (let i = 0; i < 10; i++) {
        wsUrl = await getChromeWebSocketUrl(cdpUrl, 2000);
        if (wsUrl) {
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }

      if (!wsUrl) {
        throw new Error(`Failed to resolve Chrome WebSocket URL from ${cdpUrl}`);
      }

      this.browser = await chromium
        .connectOverCDP(wsUrl, {
          headers: getHeadersWithAuth(wsUrl),
        })
        .then((b) => b.contexts()[0]);

      if (!this.browser) {
        throw new Error("Failed to connect to Chrome browser context");
      }

      const pages = this.browser.pages();
      this.page = pages[0] ?? (await this.browser.newPage());
    }

    // Set cookies (only if we have them and they're not already set)
    const cookies = this.cookie.split(";").map((c) => {
      const [name, ...valueParts] = c.trim().split("=");
      return {
        name: name.trim(),
        value: valueParts.join("=").trim(),
        domain: ".claude.ai",
        path: "/",
      };
    });

    if (this.browser) {
      await this.browser.addCookies(cookies);
    }

    if (!this.browser || !this.page) {
      throw new Error("Failed to initialize browser context");
    }

    return { browser: this.browser, page: this.page };
  }

  async init() {
    if (this.organizationId) {
      return;
    }

    try {
      const { page } = await this.ensureBrowser();

      const response = await page.evaluate(
        async ({ baseUrl, deviceId }) => {
          const res = await fetch(`${baseUrl}/organizations`, {
            headers: {
              Accept: "application/json",
              "anthropic-client-platform": "web_claude_ai",
              "anthropic-device-id": deviceId,
            },
            credentials: "include",
          });

          if (!res.ok) {
            return { ok: false, status: res.status };
          }

          const data = await res.json();
          return { ok: true, data };
        },
        { baseUrl: this.baseUrl, deviceId: this.deviceId },
      );

      if (response.ok && Array.isArray(response.data) && response.data.length > 0) {
        this.organizationId = response.data[0].uuid;
        console.log(`[Claude Web Browser] Discovered organization ID: ${this.organizationId}`);
      } else {
        console.warn(`[Claude Web Browser] Failed to fetch organizations: ${response.status}`);
      }
    } catch (e) {
      console.warn(`[Claude Web Browser] Failed to discover organization: ${String(e)}`);
    }
  }

  async createConversation(): Promise<ClaudeConversation> {
    const { page } = await this.ensureBrowser();

    const url = this.organizationId
      ? `${this.baseUrl}/organizations/${this.organizationId}/chat_conversations`
      : `${this.baseUrl}/chat_conversations`;

    console.log(`[Claude Web Browser] Creating conversation at: ${url}`);

    const convUuid = crypto.randomUUID();
    const response = await page.evaluate(
      async ({ url, deviceId, convUuid }) => {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "anthropic-client-platform": "web_claude_ai",
            "anthropic-device-id": deviceId,
          },
          body: JSON.stringify({
            name: `Conversation ${new Date().toISOString()}`,
            uuid: convUuid,
          }),
          credentials: "include",
        });

        if (!res.ok) {
          const errorText = await res.text();
          return { ok: false, status: res.status, error: errorText };
        }

        const data = await res.json();
        return { ok: true, data };
      },
      { url, deviceId: this.deviceId, convUuid },
    );

    console.log(`[Claude Web Browser] Create conversation response: ${response.status}`);

    if (!response.ok) {
      console.error(
        `[Claude Web Browser] Create conversation failed: ${response.status} - ${response.error}`,
      );
      throw new Error(`Failed to create conversation: ${response.status}`);
    }

    return response.data as ClaudeConversation;
  }

  async chatCompletions(params: {
    conversationId?: string;
    message: string;
    model?: string;
    signal?: AbortSignal;
    attachments?: Array<{
      file_name: string;
      file_type: string;
      file_size: number;
      extracted_content: string;
    }>;
  }): Promise<ReadableStream<Uint8Array>> {
    let conversationId = params.conversationId;

    if (!conversationId) {
      const conversation = await this.createConversation();
      conversationId = conversation.uuid;
    }

    const { page } = await this.ensureBrowser();

    const url = this.organizationId
      ? `${this.baseUrl}/organizations/${this.organizationId}/chat_conversations/${conversationId}/completion`
      : `${this.baseUrl}/chat_conversations/${conversationId}/completion`;

    console.log(`[Claude Web Browser] Sending message to: ${url}`);
    console.log(`[Claude Web Browser] Conversation ID: ${conversationId}`);
    console.log(`[Claude Web Browser] Model: ${params.model || "claude-sonnet-4-6"}`);

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Map model IDs to Claude Web API format
    let modelId = params.model || "claude-sonnet-4-6";
    if (modelId.includes("claude-3-5-sonnet")) {
      modelId = "claude-sonnet-4-6";
    } else if (modelId.includes("claude-3-opus")) {
      modelId = "claude-opus-4-6";
    } else if (modelId.includes("claude-3-haiku")) {
      modelId = "claude-haiku-4-6";
    }

    const body = {
      prompt: params.message,
      parent_message_uuid: "00000000-0000-4000-8000-000000000000",
      model: modelId,
      timezone,
      rendering_mode: "messages",
      attachments: params.attachments || [],
      files: [],
      locale: "en-US",
      personalized_styles: [],
      sync_sources: [],
      tools: [],
    };

    // Use page.evaluate to make the request in browser context (bypasses Cloudflare)
    const responseData = await page.evaluate(
      async ({ url, body, deviceId }) => {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "anthropic-client-platform": "web_claude_ai",
            "anthropic-device-id": deviceId,
          },
          body: JSON.stringify(body),
          credentials: "include",
        });

        if (!res.ok) {
          const errorText = await res.text();
          return { ok: false, status: res.status, error: errorText };
        }

        // Read the stream in the browser and return as text
        const reader = res.body?.getReader();
        if (!reader) {
          return { ok: false, status: 500, error: "No response body" };
        }

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          fullText += decoder.decode(value, { stream: true });
        }

        return { ok: true, data: fullText };
      },
      { url, body, deviceId: this.deviceId },
    );

    console.log(
      `[Claude Web Browser] Message response: ${responseData.ok ? 200 : responseData.status}`,
    );

    if (!responseData.ok) {
      console.error(
        `[Claude Web Browser] Message failed: ${responseData.status} - ${responseData.error}`,
      );

      if (responseData.status === 401) {
        throw new Error(
          "Authentication failed. Please re-run onboarding to refresh your Claude session.",
        );
      }
      throw new Error(`Claude API error: ${responseData.status}`);
    }

    console.log(
      `[Claude Web Browser] Response data length: ${responseData.data?.length || 0} bytes`,
    );
    console.log(
      `[Claude Web Browser] Response preview: ${responseData.data?.substring(0, 200) || "empty"}`,
    );

    // Convert the text response to a ReadableStream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(responseData.data));
        controller.close();
      },
    });

    return stream;
  }

  async close() {
    if (this.running) {
      await stopOpenClawChrome(this.running);
      this.running = null;
    }
    this.browser = null;
    this.page = null;
  }

  async discoverModels(): Promise<ModelDefinitionConfig[]> {
    return [
      {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: "claude-opus-4-6",
        name: "Claude Opus 4.6",
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 16384,
      },
      {
        id: "claude-haiku-4-6",
        name: "Claude Haiku 4.6",
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 8192,
      },
    ];
  }
}
