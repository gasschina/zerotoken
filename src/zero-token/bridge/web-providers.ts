/**
 * Web model provider definitions (catalog + discovery) for Zero Token.
 * Kept out of `models-config.providers.ts` to reduce core merge surface.
 */
import type { OpenClawConfig } from "../../config/config.js";
import type { ModelDefinitionConfig } from "../../config/types.models.js";

type ModelsConfigNonNull = NonNullable<OpenClawConfig["models"]>;
type ProviderConfig = NonNullable<ModelsConfigNonNull["providers"]>[string];

export const DEEPSEEK_WEB_BASE_URL = "https://chat.deepseek.com";
export const DEEPSEEK_WEB_DEFAULT_MODEL_ID = "deepseek-chat";
const DEEPSEEK_WEB_DEFAULT_CONTEXT_WINDOW = 64000;
const DEEPSEEK_WEB_DEFAULT_MAX_TOKENS = 8192;
const DEEPSEEK_WEB_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const DOUBAO_WEB_BASE_URL = "https://www.doubao.com";
export const DOUBAO_WEB_DEFAULT_MODEL_ID = "doubao-seed-2.0";
const DOUBAO_WEB_DEFAULT_CONTEXT_WINDOW = 64000;
const DOUBAO_WEB_DEFAULT_MAX_TOKENS = 8192;
const DOUBAO_WEB_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const CLAUDE_WEB_BASE_URL = "https://claude.ai";
export const CLAUDE_WEB_DEFAULT_MODEL_ID = "claude-sonnet-4-6";
const CLAUDE_WEB_DEFAULT_CONTEXT_WINDOW = 200000;
const CLAUDE_WEB_DEFAULT_MAX_TOKENS = 8192;
const CLAUDE_WEB_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const CHATGPT_WEB_BASE_URL = "https://chatgpt.com";
export const CHATGPT_WEB_DEFAULT_MODEL_ID = "gpt-4";
const CHATGPT_WEB_DEFAULT_CONTEXT_WINDOW = 128000;
const CHATGPT_WEB_DEFAULT_MAX_TOKENS = 4096;
const CHATGPT_WEB_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const QWEN_WEB_BASE_URL = "https://chat.qwen.ai";
export const QWEN_WEB_DEFAULT_MODEL_ID = "qwen-max";
const QWEN_WEB_DEFAULT_CONTEXT_WINDOW = 32000;
const QWEN_WEB_DEFAULT_MAX_TOKENS = 8192;
const QWEN_WEB_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const KIMI_WEB_BASE_URL = "https://www.kimi.com";
export const KIMI_WEB_DEFAULT_MODEL_ID = "moonshot-v1-32k";
const KIMI_WEB_DEFAULT_CONTEXT_WINDOW = 32000;
const KIMI_WEB_DEFAULT_MAX_TOKENS = 4096;
const KIMI_WEB_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const GEMINI_WEB_BASE_URL = "https://gemini.google.com";
export const GEMINI_WEB_DEFAULT_MODEL_ID = "gemini-pro";
const GEMINI_WEB_DEFAULT_CONTEXT_WINDOW = 32000;
const GEMINI_WEB_DEFAULT_MAX_TOKENS = 8192;
const GEMINI_WEB_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const GROK_WEB_BASE_URL = "https://grok.com";
export const GROK_WEB_DEFAULT_MODEL_ID = "grok-2";
const GROK_WEB_DEFAULT_CONTEXT_WINDOW = 32000;
const GROK_WEB_DEFAULT_MAX_TOKENS = 4096;
const GROK_WEB_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const Z_WEB_BASE_URL = "https://chatglm.cn";
export const Z_WEB_DEFAULT_MODEL_ID = "glm-4-plus";
const Z_WEB_DEFAULT_CONTEXT_WINDOW = 128000;
const Z_WEB_DEFAULT_MAX_TOKENS = 4096;
const Z_WEB_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const GLM_INTL_WEB_BASE_URL = "https://chat.z.ai";
export const GLM_INTL_WEB_DEFAULT_MODEL_ID = "glm-4-plus";
const GLM_INTL_WEB_DEFAULT_CONTEXT_WINDOW = 128000;
const GLM_INTL_WEB_DEFAULT_MAX_TOKENS = 4096;
const GLM_INTL_WEB_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const PERPLEXITY_WEB_BASE_URL = "https://www.perplexity.ai";
export const PERPLEXITY_WEB_DEFAULT_MODEL_ID = "perplexity-web";
const PERPLEXITY_WEB_DEFAULT_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
const PERPLEXITY_WEB_DEFAULT_CONTEXT_WINDOW = 128000;

const QWEN_CN_WEB_BASE_URL = "https://chat2.qianwen.com";
const QWEN_CN_WEB_DEFAULT_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
const QWEN_CN_WEB_DEFAULT_CONTEXT_WINDOW = 128000;
const QWEN_CN_WEB_DEFAULT_MAX_TOKENS = 4096;

const XIAOMIMO_WEB_BASE_URL = "https://aistudio.xiaomimimo.com";
const XIAOMIMO_WEB_DEFAULT_CONTEXT_WINDOW = 128000;
const XIAOMIMO_WEB_DEFAULT_MAX_TOKENS = 4096;
const XIAOMIMO_WEB_DEFAULT_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export async function discoverDeepseekWebModels(params?: {
  _?: never;
  apiKey?: string;
}): Promise<ModelDefinitionConfig[]> {
  if (params?.apiKey) {
    try {
      const auth = JSON.parse(params.apiKey);
      const { DeepSeekWebClient } = await import("../providers/deepseek-web-client.js");
      const client = new DeepSeekWebClient(auth);
      return await client.discoverModels();
    } catch (e) {
      console.warn("[DeepSeekWeb] Dynamic discovery failed, falling back to built-in list:", e);
    }
  }

  return [
    {
      id: "deepseek-chat",
      name: "DeepSeek V3 (Web)",
      reasoning: false,
      input: ["text"],
      cost: DEEPSEEK_WEB_DEFAULT_COST,
      contextWindow: DEEPSEEK_WEB_DEFAULT_CONTEXT_WINDOW,
      maxTokens: DEEPSEEK_WEB_DEFAULT_MAX_TOKENS,
    },
    {
      id: "deepseek-reasoner",
      name: "DeepSeek R1 (Web)",
      reasoning: true,
      input: ["text"],
      cost: DEEPSEEK_WEB_DEFAULT_COST,
      contextWindow: DEEPSEEK_WEB_DEFAULT_CONTEXT_WINDOW,
      maxTokens: DEEPSEEK_WEB_DEFAULT_MAX_TOKENS,
    },
    {
      id: "deepseek-chat-search",
      name: "DeepSeek V3 (Web + Search)",
      reasoning: false,
      input: ["text"],
      cost: DEEPSEEK_WEB_DEFAULT_COST,
      contextWindow: DEEPSEEK_WEB_DEFAULT_CONTEXT_WINDOW,
      maxTokens: DEEPSEEK_WEB_DEFAULT_MAX_TOKENS,
    },
    {
      id: "deepseek-reasoner-search",
      name: "DeepSeek R1 (Web + Search)",
      reasoning: true,
      input: ["text"],
      cost: DEEPSEEK_WEB_DEFAULT_COST,
      contextWindow: DEEPSEEK_WEB_DEFAULT_CONTEXT_WINDOW,
      maxTokens: DEEPSEEK_WEB_DEFAULT_MAX_TOKENS,
    },
  ];
}

export async function buildDeepseekWebProvider(params?: {
  _?: never;
  apiKey?: string;
}): Promise<ProviderConfig> {
  const models = await discoverDeepseekWebModels(params);
  return {
    baseUrl: DEEPSEEK_WEB_BASE_URL,
    api: "deepseek-web",
    models,
  };
}

export async function discoverDoubaoWebModels(params?: {
  _?: never;
  apiKey?: string;
}): Promise<ModelDefinitionConfig[]> {
  if (params?.apiKey) {
    try {
      const auth = JSON.parse(params.apiKey);
      const { DoubaoWebClient } = await import("../providers/doubao-web-client.js");
      const client = new DoubaoWebClient(auth);
      return await client.discoverModels();
    } catch (e) {
      console.warn("[DoubaoWeb] Dynamic discovery failed, falling back to built-in list:", e);
    }
  }

  return [
    {
      id: "doubao-seed-2.0",
      name: "Doubao-Seed 2.0 (Web)",
      reasoning: true,
      input: ["text"],
      cost: DOUBAO_WEB_DEFAULT_COST,
      contextWindow: DOUBAO_WEB_DEFAULT_CONTEXT_WINDOW,
      maxTokens: DOUBAO_WEB_DEFAULT_MAX_TOKENS,
    },
    {
      id: "doubao-pro",
      name: "Doubao Pro (Web)",
      reasoning: false,
      input: ["text"],
      cost: DOUBAO_WEB_DEFAULT_COST,
      contextWindow: DOUBAO_WEB_DEFAULT_CONTEXT_WINDOW,
      maxTokens: DOUBAO_WEB_DEFAULT_MAX_TOKENS,
    },
  ];
}

export async function buildDoubaoWebProvider(params?: {
  _?: never;
  apiKey?: string;
}): Promise<ProviderConfig> {
  const models = await discoverDoubaoWebModels(params);
  return {
    baseUrl: DOUBAO_WEB_BASE_URL,
    api: "doubao-web",
    models,
  };
}

export async function discoverClaudeWebModels(params?: {
  _?: never;
  apiKey?: string;
}): Promise<ModelDefinitionConfig[]> {
  if (params?.apiKey) {
    try {
      const auth = JSON.parse(params.apiKey);
      const { ClaudeWebClientBrowser } = await import("../providers/claude-web-client-browser.js");
      const client = new ClaudeWebClientBrowser(auth);
      const models = await client.discoverModels();
      await client.close();
      return models;
    } catch (e) {
      console.warn("[ClaudeWeb] Dynamic discovery failed, falling back to built-in list:", e);
    }
  }

  return [
    {
      id: "claude-sonnet-4-6",
      name: "Claude Sonnet 4.6 (Web)",
      reasoning: false,
      input: ["text", "image"],
      cost: CLAUDE_WEB_DEFAULT_COST,
      contextWindow: CLAUDE_WEB_DEFAULT_CONTEXT_WINDOW,
      maxTokens: CLAUDE_WEB_DEFAULT_MAX_TOKENS,
    },
    {
      id: "claude-opus-4-6",
      name: "Claude Opus 4.6 (Web)",
      reasoning: false,
      input: ["text", "image"],
      cost: CLAUDE_WEB_DEFAULT_COST,
      contextWindow: CLAUDE_WEB_DEFAULT_CONTEXT_WINDOW,
      maxTokens: 16384,
    },
    {
      id: "claude-haiku-4-6",
      name: "Claude Haiku 4.6 (Web)",
      reasoning: false,
      input: ["text", "image"],
      cost: CLAUDE_WEB_DEFAULT_COST,
      contextWindow: CLAUDE_WEB_DEFAULT_CONTEXT_WINDOW,
      maxTokens: CLAUDE_WEB_DEFAULT_MAX_TOKENS,
    },
  ];
}

export async function buildClaudeWebProvider(params?: {
  _?: never;
  apiKey?: string;
}): Promise<ProviderConfig> {
  const models = await discoverClaudeWebModels(params);
  return {
    baseUrl: CLAUDE_WEB_BASE_URL,
    api: "claude-web",
    models,
  };
}

export async function buildChatGPTWebProvider(_params?: {
  _?: never;
  apiKey?: string;
}): Promise<ProviderConfig> {
  return {
    baseUrl: CHATGPT_WEB_BASE_URL,
    api: "chatgpt-web",
    models: [
      {
        id: "gpt-4",
        name: "GPT-4 (Web)",
        reasoning: false,
        input: ["text", "image"],
        cost: CHATGPT_WEB_DEFAULT_COST,
        contextWindow: CHATGPT_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: CHATGPT_WEB_DEFAULT_MAX_TOKENS,
      },
      {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo (Web)",
        reasoning: false,
        input: ["text", "image"],
        cost: CHATGPT_WEB_DEFAULT_COST,
        contextWindow: CHATGPT_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: CHATGPT_WEB_DEFAULT_MAX_TOKENS,
      },
      {
        id: "gpt-3.5-turbo",
        name: "GPT-3.5 Turbo (Web)",
        reasoning: false,
        input: ["text"],
        cost: CHATGPT_WEB_DEFAULT_COST,
        contextWindow: 16000,
        maxTokens: 4096,
      },
    ],
  };
}

export async function buildQwenWebProvider(_params?: {
  _?: never;
  apiKey?: string;
}): Promise<ProviderConfig> {
  return {
    baseUrl: QWEN_WEB_BASE_URL,
    api: "qwen-web",
    models: [
      {
        id: "qwen3.5-plus",
        name: "Qwen 3.5 Plus",
        reasoning: false,
        input: ["text"],
        cost: QWEN_WEB_DEFAULT_COST,
        contextWindow: QWEN_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: QWEN_WEB_DEFAULT_MAX_TOKENS,
      },
      {
        id: "qwen3.5-turbo",
        name: "Qwen 3.5 Turbo",
        reasoning: false,
        input: ["text"],
        cost: QWEN_WEB_DEFAULT_COST,
        contextWindow: QWEN_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: QWEN_WEB_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

export async function buildQwenCNWebProvider(_params?: {
  _?: never;
  apiKey?: string;
}): Promise<ProviderConfig> {
  return {
    baseUrl: QWEN_CN_WEB_BASE_URL,
    api: "qwen-cn-web",
    models: [
      {
        id: "Qwen3.5-Plus",
        name: "Qwen 3.5 Plus (国内版)",
        reasoning: false,
        input: ["text"],
        cost: QWEN_CN_WEB_DEFAULT_COST,
        contextWindow: QWEN_CN_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: QWEN_CN_WEB_DEFAULT_MAX_TOKENS,
      },
      {
        id: "Qwen3.5-Turbo",
        name: "Qwen 3.5 Turbo (国内版)",
        reasoning: false,
        input: ["text"],
        cost: QWEN_CN_WEB_DEFAULT_COST,
        contextWindow: QWEN_CN_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: QWEN_CN_WEB_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

export async function buildKimiWebProvider(_params?: {
  _?: never;
  apiKey?: string;
}): Promise<ProviderConfig> {
  return {
    baseUrl: KIMI_WEB_BASE_URL,
    api: "kimi-web",
    models: [
      {
        id: "moonshot-v1-8k",
        name: "Moonshot v1 8K (Web)",
        reasoning: false,
        input: ["text"],
        cost: KIMI_WEB_DEFAULT_COST,
        contextWindow: 8000,
        maxTokens: 4096,
      },
      {
        id: "moonshot-v1-32k",
        name: "Moonshot v1 32K (Web)",
        reasoning: false,
        input: ["text"],
        cost: KIMI_WEB_DEFAULT_COST,
        contextWindow: KIMI_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: KIMI_WEB_DEFAULT_MAX_TOKENS,
      },
      {
        id: "moonshot-v1-128k",
        name: "Moonshot v1 128K (Web)",
        reasoning: false,
        input: ["text"],
        cost: KIMI_WEB_DEFAULT_COST,
        contextWindow: 128000,
        maxTokens: 4096,
      },
    ],
  };
}

export async function buildGeminiWebProvider(_params?: {
  _?: never;
  apiKey?: string;
}): Promise<ProviderConfig> {
  return {
    baseUrl: GEMINI_WEB_BASE_URL,
    api: "gemini-web",
    models: [
      {
        id: "gemini-pro",
        name: "Gemini Pro (Web)",
        reasoning: false,
        input: ["text", "image"],
        cost: GEMINI_WEB_DEFAULT_COST,
        contextWindow: GEMINI_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GEMINI_WEB_DEFAULT_MAX_TOKENS,
      },
      {
        id: "gemini-ultra",
        name: "Gemini Ultra (Web)",
        reasoning: false,
        input: ["text", "image"],
        cost: GEMINI_WEB_DEFAULT_COST,
        contextWindow: GEMINI_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GEMINI_WEB_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

export async function buildGrokWebProvider(_params?: {
  _?: never;
  apiKey?: string;
}): Promise<ProviderConfig> {
  return {
    baseUrl: GROK_WEB_BASE_URL,
    api: "grok-web",
    models: [
      {
        id: "grok-1",
        name: "Grok 1 (Web)",
        reasoning: false,
        input: ["text"],
        cost: GROK_WEB_DEFAULT_COST,
        contextWindow: GROK_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GROK_WEB_DEFAULT_MAX_TOKENS,
      },
      {
        id: "grok-2",
        name: "Grok 2 (Web)",
        reasoning: false,
        input: ["text"],
        cost: GROK_WEB_DEFAULT_COST,
        contextWindow: GROK_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GROK_WEB_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

export async function buildZWebProvider(_params?: {
  _?: never;
  apiKey?: string;
}): Promise<ProviderConfig> {
  return {
    baseUrl: Z_WEB_BASE_URL,
    api: "glm-web",
    models: [
      {
        id: "glm-4-plus",
        name: "glm-4 Plus (Web)",
        reasoning: false,
        input: ["text"],
        cost: Z_WEB_DEFAULT_COST,
        contextWindow: Z_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: Z_WEB_DEFAULT_MAX_TOKENS,
      },
      {
        id: "glm-4-think",
        name: "glm-4 Think (Web)",
        reasoning: true,
        input: ["text"],
        cost: Z_WEB_DEFAULT_COST,
        contextWindow: Z_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: Z_WEB_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

export async function buildGlmIntlWebProvider(_params?: {
  _?: never;
  apiKey?: string;
}): Promise<ProviderConfig> {
  return {
    baseUrl: GLM_INTL_WEB_BASE_URL,
    api: "glm-intl-web",
    models: [
      {
        id: "glm-4-plus",
        name: "GLM-4 Plus (International)",
        reasoning: false,
        input: ["text"],
        cost: GLM_INTL_WEB_DEFAULT_COST,
        contextWindow: GLM_INTL_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_INTL_WEB_DEFAULT_MAX_TOKENS,
      },
      {
        id: "glm-4-think",
        name: "GLM-4 Think (International)",
        reasoning: true,
        input: ["text"],
        cost: GLM_INTL_WEB_DEFAULT_COST,
        contextWindow: GLM_INTL_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: GLM_INTL_WEB_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}

export async function buildPerplexityWebProvider(_params?: {
  _?: never;
  apiKey?: string;
}): Promise<ProviderConfig> {
  return {
    baseUrl: PERPLEXITY_WEB_BASE_URL,
    api: "perplexity-web",
    models: [
      {
        id: "perplexity-web",
        name: "Perplexity (Sonar)",
        reasoning: false,
        input: ["text"],
        cost: PERPLEXITY_WEB_DEFAULT_COST,
        contextWindow: PERPLEXITY_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: 4096,
      },
      {
        id: "perplexity-pro",
        name: "Perplexity Pro",
        reasoning: false,
        input: ["text"],
        cost: PERPLEXITY_WEB_DEFAULT_COST,
        contextWindow: PERPLEXITY_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: 8192,
      },
    ],
  };
}

export function buildXiaomiMimoWebProvider(_params?: {
  _?: never;
  apiKey?: string;
}): ProviderConfig {
  return {
    baseUrl: XIAOMIMO_WEB_BASE_URL,
    api: "xiaomimo-web",
    models: [
      {
        id: "xiaomimo-chat",
        name: "MiMo Chat",
        reasoning: false,
        input: ["text"],
        cost: XIAOMIMO_WEB_DEFAULT_COST,
        contextWindow: XIAOMIMO_WEB_DEFAULT_CONTEXT_WINDOW,
        maxTokens: XIAOMIMO_WEB_DEFAULT_MAX_TOKENS,
      },
    ],
  };
}
