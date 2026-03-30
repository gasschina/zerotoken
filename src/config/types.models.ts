/**
 * Minimal model config types needed by zero-token providers.
 * Extracted from the openclaw-zero-token project.
 */

export type ModelApi =
  | "openai-completions"
  | "openai-responses"
  | "anthropic-messages"
  | "google-generative-ai"
  | "ollama"
  | "chatgpt-web"
  | "claude-web"
  | "deepseek-web"
  | "gemini-web"
  | "glm-web"
  | "glm-intl-web"
  | "grok-web"
  | "kimi-web"
  | "qwen-web"
  | "qwen-cn-web"
  | "doubao-web"
  | "xiaomimo-web"
  | "perplexity-web";

export type ModelCompatConfig = {
  supportsStore?: boolean;
  supportsDeveloperRole?: boolean;
  supportsReasoningEffort?: boolean;
  supportsUsageInStreaming?: boolean;
  supportsTools?: boolean;
  supportsStrictMode?: boolean;
  maxTokensField?: "max_completion_tokens" | "max_tokens";
  thinkingFormat?: "openai" | "zai" | "qwen" | "openrouter" | "qwen-chat-template";
  requiresToolResultName?: boolean;
  requiresAssistantAfterToolResult?: boolean;
  requiresThinkingAsText?: boolean;
  requiresMistralToolIds?: boolean;
  requiresOpenAiAnthropicToolPayload?: boolean;
  toolSchemaProfile?: string;
  nativeWebSearchTool?: boolean;
  toolCallArgumentsEncoding?: string;
  unsupportedToolSchemaKeywords?: string[];
};

export type ModelProviderAuthMode = "api-key" | "aws-sdk" | "oauth" | "token";

export type ModelDefinitionConfig = {
  id: string;
  name: string;
  api?: ModelApi;
  reasoning: boolean;
  input: Array<"text" | "image">;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
  headers?: Record<string, string>;
  compat?: ModelCompatConfig;
  provider?: string;
  [key: string]: unknown;
};

export type ModelProviderConfig = {
  baseUrl: string;
  apiKey?: string;
  auth?: ModelProviderAuthMode;
  api?: ModelApi;
  models: ModelDefinitionConfig[];
};

export type ModelsConfig = {
  mode?: "merge" | "replace";
  providers?: Record<string, ModelProviderConfig>;
};
