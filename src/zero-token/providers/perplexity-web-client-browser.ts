import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { getHeadersWithAuth } from "../../../extensions/browser/src/browser/cdp.helpers.js";
import { getChromeWebSocketUrl, launchOpenClawChrome } from "../../../extensions/browser/src/browser/chrome.js";
import { resolveBrowserConfig, resolveProfile } from "../../../extensions/browser/src/browser/config.js";
import { loadConfig } from "../../config/io.js";
import type { ModelDefinitionConfig } from "../../config/types.models.js";

export interface PerplexityWebClientOptions {
  cookie: string;
  userAgent?: string;
}

const PERPLEXITY_BASE_URL = "https://www.perplexity.ai";

export class PerplexityWebClientBrowser {
  private options: PerplexityWebClientOptions;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private initialized = false;
  lastConversationId: string | undefined;

  constructor(options: PerplexityWebClientOptions | string) {
    if (typeof options === "string") {
      try {
        const parsed = JSON.parse(options) as PerplexityWebClientOptions;
        this.options = { cookie: parsed.cookie, userAgent: parsed.userAgent };
      } catch {
        this.options = { cookie: options, userAgent: "Mozilla/5.0" };
      }
    } else {
      this.options = options;
    }
  }

  private parseCookies(): Array<{ name: string; value: string; domain: string; path: string }> {
    return this.options.cookie
      .split(";")
      .filter((c) => c.trim().includes("="))
      .map((cookie) => {
        const [name, ...valueParts] = cookie.trim().split("=");
        return {
          name: name?.trim() ?? "",
          value: valueParts.join("=").trim(),
          domain: ".perplexity.ai",
          path: "/",
        };
      })
      .filter((c) => c.name.length > 0);
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const rootConfig = loadConfig();
    const browserConfig = resolveBrowserConfig(rootConfig.browser, rootConfig);
    const profile = resolveProfile(browserConfig, browserConfig.defaultProfile);
    if (!profile) {
      throw new Error(`Could not resolve browser profile '${browserConfig.defaultProfile}'`);
    }

    let wsUrl: string | null = null;

    if (browserConfig.attachOnly) {
      console.log(`[Perplexity Web Browser] Connecting to existing Chrome at ${profile.cdpUrl}`);
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
            `Make sure Chrome is running in debug mode.`,
        );
      }
    } else {
      const running = await launchOpenClawChrome(browserConfig, profile);
      const cdpUrl = `http://127.0.0.1:${running.cdpPort}`;
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
    }

    const connectedBrowser = await chromium.connectOverCDP(wsUrl, {
      headers: getHeadersWithAuth(wsUrl),
    });
    this.browser = connectedBrowser;
    this.context = connectedBrowser.contexts()[0];

    const pages = this.context.pages();
    const perplexityPage = pages.find((p) => p.url().includes("perplexity.ai"));
    if (perplexityPage) {
      console.log(`[Perplexity Web Browser] Found existing Perplexity page`);
      this.page = perplexityPage;
    } else {
      this.page = await this.context.newPage();
      await this.page.goto(PERPLEXITY_BASE_URL, { waitUntil: "domcontentloaded" });
    }

    const cookies = this.parseCookies();
    if (cookies.length > 0) {
      try {
        await this.context.addCookies(cookies);
      } catch (e) {
        console.warn("[Perplexity Web Browser] Failed to add some cookies:", e);
      }
    }

    this.initialized = true;
  }

  async chatCompletions(params: {
    conversationId?: string;
    message: string;
    model: string;
    signal?: AbortSignal;
  }): Promise<ReadableStream<Uint8Array>> {
    if (!this.page) {
      throw new Error("PerplexityWebClientBrowser not initialized");
    }

    const { conversationId, message, model } = params;
    console.log(
      `[Perplexity Web Browser] Sending request... conversationId=${conversationId ?? "(new)"} messageLen=${message.length}`,
    );

    const evalResult = await this.page.evaluate(
      async ({
        conversationId,
        message,
        model,
      }: {
        conversationId?: string;
        message: string;
        model: string;
      }) => {
        const MODEL_MAP_INTERNAL: Record<string, string> = {
          "perplexity-web": "sonar",
          "perplexity-pro": "sonar-pro",
        };
        const modelInternal = MODEL_MAP_INTERNAL[model] || model || "sonar";

        // Try to get conversation ID from URL if not provided
        let convId = conversationId;
        if (!convId) {
          const m = window.location.pathname.match(/\/search\/([a-zA-Z0-9_-]+)/);
          convId = m?.[1] ?? undefined;
        }
        if (!convId) {
          const m = window.location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);
          convId = m?.[1] ?? undefined;
        }

        // Build query params
        const paramsObj: Record<string, string> = {
          q: message,
          source: "search",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: navigator.language || "en-US",
        };
        if (convId) {
          paramsObj["session"] = convId;
        }
        const queryString = new URLSearchParams(paramsObj).toString();

        // Call the Perplexity frontend API endpoint
        // The web app uses SSE for streaming responses
        const response = await fetch(`https://www.perplexity.ai/search?${queryString}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({
            query: message,
            model: modelInternal,
            source: "default",
            mode: "copilot",
            ...(convId ? { session_id: convId } : {}),
          }),
          credentials: "include",
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(
            `Perplexity API error: ${response.status} ${response.statusText} - ${errText.slice(0, 300)}`,
          );
        }

        // Return the SSE stream as text
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const chunks: number[][] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          chunks.push(Array.from(value));
        }

        return { chunks, conversationId: convId };
      },
      { conversationId, message, model },
    );

    const timeoutMs = 120000;
    const result = await Promise.race([
      evalResult,
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Perplexity request timed out (${timeoutMs / 1000}s). Please ensure perplexity.ai is logged in.`,
              ),
            ),
          timeoutMs,
        ),
      ),
    ]).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Perplexity Web Browser] Error:`, msg);
      throw err;
    });

    const apiResult = result as { chunks: number[][]; conversationId?: string };
    this.lastConversationId = apiResult.conversationId ?? undefined;

    const fullBytes = apiResult.chunks.flatMap((c) => c);
    const fullText = new TextDecoder().decode(new Uint8Array(fullBytes));
    console.log(`[Perplexity Web Browser] Response length: ${fullBytes.length} bytes`);

    // Parse SSE lines and extract content
    const lines = fullText.split("\n").filter((line) => line.trim());
    const parsedChunks: string[] = [];
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        const content =
          data.text ?? data.content ?? data.delta ?? data.choices?.[0]?.delta?.content;
        if (typeof content === "string" && content) {
          parsedChunks.push(content);
        }
      } catch {
        // Skip unparseable lines
      }
    }

    let index = 0;
    return new ReadableStream({
      pull(controller) {
        if (index < parsedChunks.length) {
          const line = JSON.stringify({ contentDelta: parsedChunks[index] }) + "\n";
          controller.enqueue(new TextEncoder().encode(line));
          index++;
        } else {
          controller.close();
        }
      },
    });
  }

  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.initialized = false;
  }

  async discoverModels(): Promise<ModelDefinitionConfig[]> {
    return [
      {
        id: "perplexity-web",
        name: "Perplexity (Sonar)",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
      },
      {
        id: "perplexity-pro",
        name: "Perplexity Pro",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 8192,
      },
    ];
  }
}
