/**
 * ZeroToken Server - OpenAI-compatible API server
 * Provides free access to commercial LLMs via web automation.
 */
import express from "express";
import type { Request, Response } from "express";
import {
  getWebStreamFactory,
  listWebStreamApiIds,
  type WebStreamApiId,
} from "./zero-token/streams/web-stream-factories.js";
import type { ModelDefinitionConfig } from "./config/types.models.js";
import {
  buildDeepseekWebProvider,
  buildClaudeWebProvider,
  buildChatGPTWebProvider,
  buildQwenWebProvider,
  buildQwenCNWebProvider,
  buildKimiWebProvider,
  buildGeminiWebProvider,
  buildGrokWebProvider,
  buildZWebProvider,
  buildGlmIntlWebProvider,
  buildPerplexityWebProvider,
  buildXiaomiMimoWebProvider,
  buildDoubaoWebProvider,
} from "./zero-token/bridge/web-providers.js";
import type { OpenClawConfig } from "./config/config.js";
import { loadConfig } from "./config/io.js";
import { getAuthProviderCredential } from "./auth-store.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ZeroTokenConfig = {
  port?: number;
  authToken?: string;
  providers?: Record<string, ProviderCredentialConfig>;
  browser?: OpenClawConfig["browser"];
};

export type ProviderCredentialConfig = {
  cookie?: string;
  sessionKey?: string;
  accessToken?: string;
  userAgent?: string;
  organizationId?: string;
  deviceId?: string;
};

type OpenAIChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

type OpenAIChatRequest = {
  model: string;
  messages: OpenAIChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  n?: number;
  stop?: string | string[];
  user?: string;
};

type OpenAIModelObject = {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
};

// ─── Provider registry ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PROVIDER_BUILDERS: Record<
  string,
  (params?: { apiKey?: string }) => Promise<{ api?: string; models: ModelDefinitionConfig[] }>
> = {
  "deepseek-web": buildDeepseekWebProvider,
  "claude-web": buildClaudeWebProvider,
  "chatgpt-web": buildChatGPTWebProvider,
  "qwen-web": buildQwenWebProvider,
  "qwen-cn-web": buildQwenCNWebProvider,
  "kimi-web": buildKimiWebProvider,
  "gemini-web": buildGeminiWebProvider,
  "grok-web": buildGrokWebProvider,
  "glm-web": buildZWebProvider,
  "glm-intl-web": buildGlmIntlWebProvider,
  "perplexity-web": buildPerplexityWebProvider,
  "xiaomimo-web": (p) => Promise.resolve(buildXiaomiMimoWebProvider(p)),
  "doubao-web": buildDoubaoWebProvider,
};

/**
 * Model ID → provider API mapping.
 * This maps common model name patterns to their zero-token provider API.
 */
const MODEL_TO_PROVIDER: Record<string, WebStreamApiId> = {
  // Claude
  "claude-sonnet-4-6": "claude-web",
  "claude-opus-4-6": "claude-web",
  "claude-haiku-4-6": "claude-web",
  "claude-sonnet-4-5": "claude-web",
  "claude-opus-4": "claude-web",
  "claude-3-5-sonnet": "claude-web",
  "claude-3-opus": "claude-web",
  "claude-3-haiku": "claude-web",
  // ChatGPT
  "gpt-4": "chatgpt-web",
  "gpt-4-turbo": "chatgpt-web",
  "gpt-4o": "chatgpt-web",
  "gpt-3.5-turbo": "chatgpt-web",
  // DeepSeek
  "deepseek-chat": "deepseek-web",
  "deepseek-reasoner": "deepseek-web",
  "deepseek-v3": "deepseek-web",
  "deepseek-r1": "deepseek-web",
  // Gemini
  "gemini-pro": "gemini-web",
  "gemini-ultra": "gemini-web",
  // Grok
  "grok-1": "grok-web",
  "grok-2": "grok-web",
  // Qwen
  "qwen-max": "qwen-web",
  "qwen3.5-plus": "qwen-web",
  "qwen3.5-turbo": "qwen-web",
  // Kimi
  "moonshot-v1-8k": "kimi-web",
  "moonshot-v1-32k": "kimi-web",
  "moonshot-v1-128k": "kimi-web",
  // GLM
  "glm-4-plus": "glm-web",
  "glm-4-think": "glm-web",
  // Perplexity
  "perplexity-web": "perplexity-web",
  "perplexity-pro": "perplexity-web",
  // Doubao
  "doubao-seed-2.0": "doubao-web",
  "doubao-pro": "doubao-web",
  // XiaomiMimo
  "xiaomimo-chat": "xiaomimo-web",
};

// ─── Server ───────────────────────────────────────────────────────────────────

export interface ZeroTokenServerOptions {
  port?: number;
  authToken?: string;
  config?: ZeroTokenConfig;
}

export function createServer(options: ZeroTokenServerOptions = {}) {
  const rootConfig = loadConfig();
  const ztConfig: ZeroTokenConfig = options.config || (rootConfig as unknown as ZeroTokenConfig);

  const port = options.port || ztConfig.port || parseInt(process.env.ZEROTOKEN_PORT || "18789", 10);
  // Treat empty string, null, or undefined as no auth token
  const authToken = (options.authToken || ztConfig.authToken || process.env.ZEROTOKEN_AUTH_TOKEN || "").trim() || undefined;
  const providers = ztConfig.providers || {};

  /**
   * Resolve the provider API for a given model ID.
   * First checks explicit model mapping, then tries to match by prefix.
   */
  function resolveProviderApi(modelId: string): WebStreamApiId | undefined {
    // Direct match
    if (MODEL_TO_PROVIDER[modelId]) {
      return MODEL_TO_PROVIDER[modelId];
    }

    // Prefix match (e.g., "claude-" → claude-web, "deepseek-" → deepseek-web)
    for (const [pattern, apiId] of Object.entries(MODEL_TO_PROVIDER)) {
      if (modelId.startsWith(pattern.split("-").slice(0, -1).join("-"))) {
        return apiId;
      }
    }

    // Try matching model ID to a provider name directly
    const apiIds = listWebStreamApiIds();
    for (const apiId of apiIds) {
      if (modelId.startsWith(apiId.replace("-web", ""))) {
        return apiId;
      }
    }

    return undefined;
  }

  /**
   * Get the cookie/credential string for a provider.
   * Resolution order:
   *   1. zerotoken.json config file (providers section)
   *   2. ~/.zerotoken/auth-profiles.json (from login command)
   *   3. Environment variable ZEROTOKEN_<PROVIDER> (JSON string)
   */
  function getProviderCredential(apiId: string): string {
    // 1. Check zerotoken.json config file
    const creds = providers[apiId];
    if (creds) {
      if (creds.sessionKey) {
        return JSON.stringify(creds);
      }
      if (creds.accessToken) {
        return JSON.stringify(creds);
      }
      if (creds.cookie) {
        return JSON.stringify({ cookie: creds.cookie, userAgent: creds.userAgent });
      }
    }

    // 2. Check auth-store (from zerotoken login command)
    const storedCred = getAuthProviderCredential(apiId);
    if (storedCred) {
      return storedCred;
    }

    // 3. Check environment variable (e.g., ZEROTOKEN_CLAUDE_WEB)
    const envKey = `ZEROTOKEN_${apiId.replace(/-/g, "_").toUpperCase()}`;
    const envVal = process.env[envKey];
    if (envVal) {
      // If it looks like JSON, use it directly; otherwise treat as cookie string
      if (envVal.startsWith("{")) {
        return envVal;
      }
      return JSON.stringify({ cookie: envVal });
    }

    return "";
  }

  /**
   * Check API key authentication.
   */
  function checkAuth(req: Request, res: Response): boolean {
    if (!authToken) return true;

    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    // Also support ?key= query param (for compatibility with some clients)
    const queryToken = req.query.key as string | undefined;

    if (bearerToken !== authToken && queryToken !== authToken) {
      res.status(401).json({
        error: {
          message: "Invalid authentication token",
          type: "invalid_request_error",
          code: "invalid_api_key",
        },
      });
      return false;
    }
    return true;
  }

  // ─── Route handlers ──────────────────────────────────────────────────────

  /**
   * GET /v1/models - List available models
   */
  async function handleModels(_req: Request, res: Response) {
    if (!checkAuth(_req, res)) return;

    const allModels: OpenAIModelObject[] = [];

    for (const [apiId, builder] of Object.entries(PROVIDER_BUILDERS)) {
      // Check if provider has credentials from any source
      const hasConfigCreds = !!providers[apiId];
      const hasStoredCreds = !!getAuthProviderCredential(apiId);
      const hasEnvCreds = !!process.env[`ZEROTOKEN_${apiId.replace(/-/g, "_").toUpperCase()}`];

      if (!hasConfigCreds && !hasStoredCreds && !hasEnvCreds) {
        continue; // Skip unconfigured providers
      }

      try {
        const provider = await builder();
        const providerApi = provider.api || apiId;
        for (const model of provider.models) {
          allModels.push({
            id: model.id,
            object: "model",
            created: Math.floor(Date.now() / 1000),
            owned_by: providerApi,
          });
        }
      } catch {
        // Skip providers that fail to build
      }
    }

    res.json({
      object: "list",
      data: allModels,
    });
  }

  /**
   * POST /v1/chat/completions - Chat completions
   */
  async function handleChatCompletions(req: Request, res: Response) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    console.log(`[server] ${requestId} - Received request. model=${req.body.model}, stream=${req.body.stream}`);
    if (!checkAuth(req, res)) return;

    const body = req.body as OpenAIChatRequest;
    console.log(`[server] ${requestId} - body parsed. messages count: ${body.messages?.length}`);

    if (!body.model) {
      res.status(400).json({
        error: {
          message: "Missing required field: model",
          type: "invalid_request_error",
          code: "missing_field",
        },
      });
      return;
    }

    if (!body.messages || body.messages.length === 0) {
      res.status(400).json({
        error: {
          message: "Missing required field: messages",
          type: "invalid_request_error",
          code: "missing_field",
        },
      });
      return;
    }

    const apiId = resolveProviderApi(body.model);
    if (!apiId) {
      res.status(400).json({
        error: {
          message: `Unknown model: ${body.model}. Available models can be listed via GET /v1/models`,
          type: "invalid_request_error",
          code: "model_not_found",
        },
      });
      return;
    }

    const factory = getWebStreamFactory(apiId);
    if (!factory) {
      res.status(500).json({
        error: {
          message: `Stream factory not found for: ${apiId}`,
          type: "server_error",
          code: "factory_not_found",
        },
      });
      return;
    }

    const credential = getProviderCredential(apiId);
    if (!credential) {
      res.status(400).json({
        error: {
          message: `No credentials configured for provider: ${apiId}. Add credentials in zerotoken.json under "providers.${apiId}"`,
          type: "invalid_request_error",
          code: "credentials_missing",
        },
      });
      return;
    }

    const streamFn = factory(credential);

    // Build the context object expected by pi-agent-core StreamFn
    const contextMessages = body.messages.map((m) => {
      if (m.role === "system") {
        return { role: "system", content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) };
      }
      if (m.role === "assistant") {
        const parts: Array<{ type: string; text?: string; id?: string; name?: string; arguments?: unknown }> = [];
        if (typeof m.content === "string") {
          parts.push({ type: "text", text: m.content });
        }
        if (m.tool_calls) {
          for (const tc of m.tool_calls) {
            parts.push({
              type: "toolCall",
              id: tc.id,
              name: tc.function.name,
              arguments: JSON.parse(tc.function.arguments || "{}"),
            });
          }
        }
        return { role: "assistant", content: parts };
      }
      if (m.role === "tool") {
        return {
          role: "toolResult",
          toolCallId: m.tool_call_id || "",
          toolName: m.name || "",
          content: [{ type: "text", text: typeof m.content === "string" ? m.content : "" }],
        };
      }
      // user
      return { role: "user", content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) };
    });

    const modelRef = {
      id: body.model,
      api: apiId as string,
      provider: apiId as string,
    };

    const streamContext = {
      messages: contextMessages,
      sessionId: req.headers["x-session-id"] as string | undefined,
      systemPrompt: contextMessages.find((m) => m.role === "system")
        ? (contextMessages.find((m) => m.role === "system") as { content: string }).content
        : "",
    };

    try {
      let stream: any = streamFn(modelRef as any, streamContext as any, {});
      // StreamFn may return a Promise - await if needed
      if (stream && typeof stream.then === "function") {
        stream = await stream;
      }

      if (body.stream) {
        // SSE streaming mode
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        let fullContent = "";
        let finishReason = "stop";

        stream.on("data", (event: any) => {
          if (event.type === "text_delta" && event.delta) {
            fullContent += event.delta;
            const chunk = {
              id: `chatcmpl-${Date.now()}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: body.model,
              choices: [
                {
                  index: 0,
                  delta: { content: event.delta },
                  finish_reason: null,
                },
              ],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          } else if (event.type === "thinking_delta" && event.delta) {
            // Forward thinking as content with a prefix (or could use a custom field)
            // For OpenAI compat, we'll just include it in the stream
            const chunk = {
              id: `chatcmpl-${Date.now()}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: body.model,
              choices: [
                {
                  index: 0,
                  delta: { content: event.delta },
                  finish_reason: null,
                },
              ],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          } else if (event.type === "done") {
            finishReason = event.reason === "toolUse" ? "tool_calls" : "stop";
          }
        });

        stream.on("end", () => {
          const finalChunk = {
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: body.model,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: finishReason,
              },
            ],
          };
          res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        });

        stream.on("error", (err: any) => {
          console.error("[zerotoken] Stream error:", err);
          const errorChunk = {
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: body.model,
            choices: [
              {
                index: 0,
                delta: { content: `[Error: ${err?.errorMessage || String(err)}]` },
                finish_reason: "stop",
              },
            ],
          };
          res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        });
      } else {
        // Non-streaming mode - consume the stream to get full result
        try {
          console.log("[server] Non-stream mode, consuming stream of type:", typeof stream);
          let fullContent = "";
          let finishReason = "stop";

          // pi-ai AssistantMessageEventStream supports async iteration
          let eventCount = 0;
          for await (const event of stream as any) {
            eventCount++;
            console.log("[server] Stream event #" + eventCount + ":", event.type, event.delta ? `delta: ${event.delta.slice(0, 50)}` : '');
            if (event.type === "text_delta" && event.delta) {
              fullContent += event.delta;
            } else if (event.type === "thinking_delta" && event.delta) {
              fullContent += event.delta;
            } else if (event.type === "done") {
              finishReason = event.reason === "toolUse" ? "tool_calls" : "stop";
            }
          }
          console.log("[server] Stream consumed. Events:", eventCount, "Final content length:", fullContent.length, "Content:", fullContent.slice(0, 100));

          console.log("[server] Sending response. fullContent:", fullContent.slice(0, 100), "finishReason:", finishReason);
          res.json({
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: body.model,
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: fullContent,
                },
                finish_reason: finishReason,
              },
            ],
            usage: {
              prompt_tokens: 0,
              completion_tokens: fullContent.length,
              total_tokens: fullContent.length,
            },
          });
          console.log("[server] Response sent.");
        } catch (err) {
          console.error("[zerotoken] Non-stream chat error:", err);
          res.status(500).json({
            error: {
              message: err instanceof Error ? err.message : String(err),
              type: "server_error",
              code: "internal_error",
            },
          });
        }
      }
    } catch (err) {
      console.error("[zerotoken] Chat completions error:", err);
      res.status(500).json({
        error: {
          message: err instanceof Error ? err.message : String(err),
          type: "server_error",
          code: "internal_error",
        },
      });
    }
  }

  /**
   * GET /health - Health check endpoint
   */
  function handleHealth(_req: Request, res: Response) {
    res.json({
      status: "ok",
      version: "1.0.0",
      providers: Object.keys(providers),
      uptime: process.uptime(),
    });
  }

  /**
   * GET / - Root endpoint with info
   */
  function handleRoot(_req: Request, res: Response) {
    res.json({
      name: "zerotoken",
      version: "1.0.0",
      description: "Zero Token - Free local API for commercial LLMs via web automation",
      endpoints: {
        chat: "POST /v1/chat/completions",
        models: "GET /v1/models",
        health: "GET /health",
      },
      configured_providers: Object.keys(providers),
    });
  }

  return {
    port,
    authToken,
    handleRoot,
    handleHealth,
    handleModels,
    handleChatCompletions,
  };
}

/**
 * Start the ZeroToken HTTP server.
 * Creates an Express app, wires up routes, and starts listening.
 */
export async function startServer(options: ZeroTokenServerOptions = {}): Promise<void> {
  const { port, handleRoot, handleHealth, handleModels, handleChatCompletions } = createServer(options);

  const app = express();

  // Parse JSON request bodies
  app.use(express.json({ limit: "10mb" }));

  // Routes
  app.get("/", handleRoot);
  app.get("/health", handleHealth);
  app.get("/v1/models", handleModels);
  app.post("/v1/chat/completions", handleChatCompletions);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        message: "Not found",
        type: "invalid_request_error",
        code: "not_found",
      },
    });
  });

  return new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(`
╔══════════════════════════════════════════════════════╗
║               🔥 ZeroToken v1.0.0 🔥                ║
║                                                      ║
║   OpenAI-compatible API server is running            ║
║   Local:   http://localhost:${port}                    ║
║   Models:  http://localhost:${port}/v1/models          ║
║   Health:  http://localhost:${port}/health             ║
║                                                      ║
║   Compatible with any OpenAI SDK client:              ║
║   base_url = "http://localhost:${port}/v1"            ║
╚══════════════════════════════════════════════════════╝
`);
      resolve();
    });
  });
}
