/**
 * ZeroToken Login Command
 * Interactive browser-based login for all 13 web providers.
 */

import * as readline from "node:readline";
import {
  saveAuthProviderCredential,
  listAuthorizedProviders,
  removeAuthProviderCredential,
} from "./auth-store.js";

// ─── Provider definitions ─────────────────────────────────────────────────────

type ProviderLoginFn = (params: {
  onProgress: (msg: string) => void;
  openUrl: (url: string) => Promise<boolean>;
}) => Promise<unknown>;

type ProviderInfo = {
  id: string;
  name: string;
  url: string;
  loginFn: () => Promise<ProviderLoginFn>;
  credentialKeys: string[];
  description: string;
};

const PROVIDERS: Array<ProviderInfo> = [
  {
    id: "claude-web",
    name: "Claude (claude.ai)",
    url: "https://claude.ai",
    credentialKeys: ["sessionKey", "cookie", "userAgent"],
    description: "Anthropic Claude - sk-ant-sid01/02 sessionKey",
    loginFn: () => import("./zero-token/providers/claude-web-auth.js").then((m) => m.loginClaudeWeb),
  },
  {
    id: "chatgpt-web",
    name: "ChatGPT (chatgpt.com)",
    url: "https://chatgpt.com",
    credentialKeys: ["accessToken", "cookie", "userAgent"],
    description: "OpenAI ChatGPT - session-token cookie",
    loginFn: () => import("./zero-token/providers/chatgpt-web-auth.js").then((m) => m.loginChatGPTWeb),
  },
  {
    id: "deepseek-web",
    name: "DeepSeek (chat.deepseek.com)",
    url: "https://chat.deepseek.com",
    credentialKeys: ["cookie", "bearer", "userAgent"],
    description: "DeepSeek Research - bearer token + cookies",
    loginFn: () => import("./zero-token/providers/deepseek-web-auth.js").then((m) => m.loginDeepseekWeb),
  },
  {
    id: "gemini-web",
    name: "Gemini (gemini.google.com)",
    url: "https://gemini.google.com/app",
    credentialKeys: ["cookie", "userAgent"],
    description: "Google Gemini - Google auth cookies",
    loginFn: () => import("./zero-token/providers/gemini-web-auth.js").then((m) => m.loginGeminiWeb),
  },
  {
    id: "grok-web",
    name: "Grok (grok.com)",
    url: "https://grok.com",
    credentialKeys: ["cookie", "userAgent"],
    description: "xAI Grok - SSO cookies",
    loginFn: () => import("./zero-token/providers/grok-web-auth.js").then((m) => m.loginGrokWeb),
  },
  {
    id: "qwen-web",
    name: "Qwen International (chat.qwen.ai)",
    url: "https://chat.qwen.ai",
    credentialKeys: ["sessionToken", "cookie", "userAgent"],
    description: "Alibaba Qwen - session cookie",
    loginFn: () => import("./zero-token/providers/qwen-web-auth.js").then((m) => m.loginQwenWeb),
  },
  {
    id: "qwen-cn-web",
    name: "Qwen CN (qianwen.com)",
    url: "https://www.qianwen.com",
    credentialKeys: ["cookie", "xsrfToken", "userAgent"],
    description: "Alibaba Qwen CN (domestic) - SSO ticket",
    loginFn: () => import("./zero-token/providers/qwen-cn-web-auth.js").then((m) => m.loginQwenCNWeb),
  },
  {
    id: "kimi-web",
    name: "Kimi (kimi.com)",
    url: "https://www.kimi.com",
    credentialKeys: ["cookie", "userAgent"],
    description: "Moonshot Kimi - access_token cookie",
    loginFn: () => import("./zero-token/providers/kimi-web-auth.js").then((m) => m.loginKimiWeb),
  },
  {
    id: "glm-web",
    name: "ChatGLM (chatglm.cn)",
    url: "https://chatglm.cn",
    credentialKeys: ["cookie", "userAgent"],
    description: "Zhipu ChatGLM (domestic) - refresh_token",
    loginFn: () => import("./zero-token/providers/glm-web-auth.js").then((m) => m.loginZWeb),
  },
  {
    id: "glm-intl-web",
    name: "GLM International (chat.z.ai)",
    url: "https://chat.z.ai",
    credentialKeys: ["cookie", "userAgent"],
    description: "Zhipu GLM (international) - auth cookies",
    loginFn: () => import("./zero-token/providers/glm-intl-web-auth.js").then((m) => m.loginGlmIntlWeb),
  },
  {
    id: "perplexity-web",
    name: "Perplexity (perplexity.ai)",
    url: "https://www.perplexity.ai",
    credentialKeys: ["cookie", "userAgent"],
    description: "Perplexity AI - session cookies",
    loginFn: () => import("./zero-token/providers/perplexity-web-auth.js").then((m) => m.loginPerplexityWeb),
  },
  {
    id: "doubao-web",
    name: "Doubao (doubao.com)",
    url: "https://www.doubao.com/chat/",
    credentialKeys: ["sessionid", "cookie", "userAgent"],
    description: "ByteDance Doubao - sessionid cookie",
    loginFn: () => import("./zero-token/providers/doubao-web-auth.js").then((m) => m.loginDoubaoWeb),
  },
  {
    id: "xiaomimo-web",
    name: "Xiaomi MiMo (xiaomimimo.com)",
    url: "https://aistudio.xiaomimimo.com",
    credentialKeys: ["cookie", "userAgent"],
    description: "Xiaomi MiMo AI Studio - auth cookies",
    loginFn: () => import("./zero-token/providers/xiaomimo-web-auth.js").then((m) => m.loginXiaomiMimoWeb),
  },
];

// ─── Readline helpers ─────────────────────────────────────────────────────────

function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function showBanner(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                   🔐 ZeroToken Login 🔐                    ║
║                                                              ║
║  Browser-based credential capture for web LLM providers.    ║
║  Your credentials are stored locally in ~/.zerotoken/        ║
╚══════════════════════════════════════════════════════════════╝
`);
}

function showProviderList(): void {
  const authorized = new Set(listAuthorizedProviders().map((p) => p.id));

  console.log("  #  Status   Provider");
  console.log("  ─── ─────── ─────────────────────────────────────────");
  PROVIDERS.forEach((p, i) => {
    const status = authorized.has(p.id) ? "✅ " : "⬜ ";
    const num = `${i + 1}`.padStart(2);
    console.log(`  ${num} ${status}  ${p.name}`);
  });
  console.log(`\n  a = Login all    r = Remove all    q = Quit\n`);
}

// ─── Login logic ─────────────────────────────────────────────────────────────

async function openUrl(url: string): Promise<boolean> {
  try {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    const platform = process.platform;
    let cmd: string;
    if (platform === "darwin") {
      cmd = `open "${url}"`;
    } else if (platform === "win32") {
      cmd = `start "" "${url}"`;
    } else {
      cmd = `xdg-open "${url}"`;
    }
    await execAsync(cmd);
    return true;
  } catch {
    console.log(`  Please open manually: ${url}`);
    return false;
  }
}

async function loginProvider(provider: ProviderInfo): Promise<boolean> {
  console.log(`\n  ── Logging in to ${provider.name} ──`);
  console.log(`  URL: ${provider.url}`);
  console.log(`  Description: ${provider.description}\n`);

  try {
    const loginFn = await provider.loginFn();

    const result = await loginFn({
      onProgress: (msg: string) => {
        console.log(`  [${provider.id}] ${msg}`);
      },
      openUrl,
    });

    if (result && typeof result === "object") {
      const creds = result as Record<string, unknown>;
      // Extract the relevant credential keys
      const credentialObj: Record<string, unknown> = {};
      for (const key of provider.credentialKeys) {
        if (creds[key] !== undefined) {
          credentialObj[key] = creds[key];
        }
      }

      // Special handling for DeepSeek which has "bearer" field
      if (provider.id === "deepseek-web" && creds.bearer) {
        credentialObj.bearer = creds.bearer;
      }

      // Special handling for Doubao which has "sessionid" field
      if (provider.id === "doubao-web" && creds.sessionid) {
        credentialObj.sessionid = creds.sessionid;
      }

      // Special handling for Qwen CN which has "xsrfToken" and "ut"
      if (provider.id === "qwen-cn-web" && creds.xsrfToken) {
        credentialObj.xsrfToken = creds.xsrfToken;
      }
      if (provider.id === "qwen-cn-web" && creds.ut) {
        credentialObj.ut = creds.ut;
      }

      saveAuthProviderCredential(provider.id, credentialObj);
      console.log(`  ✅ ${provider.name} - credentials saved successfully!\n`);
      return true;
    }

    console.log(`  ❌ ${provider.name} - no credentials returned\n`);
    return false;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ ${provider.name} - failed: ${message}\n`);
    return false;
  }
}

async function loginAll(): Promise<void> {
  console.log("  Logging in to ALL providers...\n");

  const results: Array<{ id: string; name: string; success: boolean }> = [];

  for (const provider of PROVIDERS) {
    const success = await loginProvider(provider);
    results.push({ id: provider.id, name: provider.name, success });
  }

  // Summary
  console.log("\n  ═══════════════════════════════════════════════════════");
  console.log("  Login Summary:");
  console.log("  ───────────────────────────────────────────────────────");

  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  for (const r of succeeded) {
    console.log(`  ✅ ${r.name}`);
  }
  for (const r of failed) {
    console.log(`  ❌ ${r.name}`);
  }

  console.log(`\n  Total: ${succeeded.length} succeeded, ${failed.length} failed`);
  console.log("  ═══════════════════════════════════════════════════════\n");
}

async function removeAllCredentials(): Promise<void> {
  const authorized = listAuthorizedProviders();
  if (authorized.length === 0) {
    console.log("  No stored credentials found.\n");
    return;
  }

  console.log(`  Found ${authorized.length} stored credentials:`);
  for (const p of authorized) {
    console.log(`    - ${p.id}`);
  }

  const rl = createReadline();
  const confirm = await question(rl, "  Are you sure you want to remove all? (y/N): ");
  rl.close();

  if (confirm.toLowerCase() === "y") {
    for (const p of authorized) {
      removeAuthProviderCredential(p.id);
    }
    console.log("  ✅ All credentials removed.\n");
  } else {
    console.log("  Cancelled.\n");
  }
}

// ─── Interactive menu ────────────────────────────────────────────────────────

async function interactiveLogin(): Promise<void> {
  showBanner();

  while (true) {
    showProviderList();
    const rl = createReadline();
    const input = await question(rl, "  Select provider (#), 'a' for all, 'r' to remove, 'q' to quit: ");
    rl.close();

    if (input.toLowerCase() === "q") {
      console.log("\n  Goodbye! 👋\n");
      break;
    }

    if (input.toLowerCase() === "a") {
      await loginAll();
      continue;
    }

    if (input.toLowerCase() === "r") {
      await removeAllCredentials();
      continue;
    }

    const num = parseInt(input, 10);
    if (num >= 1 && num <= PROVIDERS.length) {
      await loginProvider(PROVIDERS[num - 1]);
    } else {
      // Try to match by provider name
      const matched = PROVIDERS.find(
        (p) =>
          p.id === input.toLowerCase() ||
          p.id.startsWith(input.toLowerCase()) ||
          p.name.toLowerCase().includes(input.toLowerCase()),
      );
      if (matched) {
        await loginProvider(matched);
      } else {
        console.log(`  Invalid selection: ${input}. Enter a number (1-${PROVIDERS.length}), 'a', 'r', or 'q'.\n`);
      }
    }
  }
}

// ─── Non-interactive login ───────────────────────────────────────────────────

async function loginSpecific(providerName: string): Promise<void> {
  const provider = PROVIDERS.find(
    (p) =>
      p.id === providerName.toLowerCase() ||
      p.id.replace(/-web$/, "") === providerName.toLowerCase() ||
      p.id.replace(/-web$/, "") === providerName.toLowerCase(),
  );

  if (!provider) {
    console.error(`  Unknown provider: ${providerName}`);
    console.error(`  Available providers: ${PROVIDERS.map((p) => p.id).join(", ")}`);
    process.exit(1);
  }

  const success = await loginProvider(provider);
  process.exit(success ? 0 : 1);
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function runLoginCommand(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === "--interactive" || args[0] === "-i") {
    await interactiveLogin();
  } else if (args[0] === "--all" || args[0] === "-a") {
    showBanner();
    await loginAll();
  } else if (args[0] === "--remove" || args[0] === "-r") {
    await removeAllCredentials();
  } else if (args[0] === "--list" || args[0] === "-l") {
    const authorized = listAuthorizedProviders();
    if (authorized.length === 0) {
      console.log("  No stored credentials.");
    } else {
      console.log("  Authorized providers:");
      for (const p of authorized) {
        const date = new Date(p.capturedAt).toLocaleString();
        console.log(`    ✅ ${p.id} (captured: ${date})`);
      }
    }
  } else if (args[0] === "--help" || args[0] === "-h") {
    showBanner();
    console.log("  Usage: zerotoken login [options] [provider]");
    console.log("");
    console.log("  Options:");
    console.log("    (no args)       Interactive mode (show menu)");
    console.log("    -a, --all       Login to all providers");
    console.log("    -r, --remove    Remove all stored credentials");
    console.log("    -l, --list      List authorized providers");
    console.log("    -h, --help      Show this help message");
    console.log("");
    console.log("  Providers:");
    PROVIDERS.forEach((p, i) => {
      console.log(`    ${p.id.padEnd(18)} ${p.description}`);
    });
    console.log("");
    console.log("  Examples:");
    console.log("    zerotoken login                 # Interactive menu");
    console.log("    zerotoken login claude-web      # Login to Claude");
    console.log("    zerotoken login deepseek        # Login to DeepSeek");
    console.log("    zerotoken login --all            # Login to all");
    console.log("    zerotoken login --list           # Show authorized\n");
  } else {
    // Specific provider
    await loginSpecific(args[0]);
  }
}
