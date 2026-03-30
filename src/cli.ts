#!/usr/bin/env node
/**
 * ZeroToken CLI - Entry point for the ZeroToken server.
 * Loads environment variables from .env and starts the OpenAI-compatible API server.
 */
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { startServer, type ZeroTokenServerOptions } from "./server.js";

const VERSION = "1.0.0";

function printHelp() {
  console.log(`
ZeroToken v${VERSION} - 零成本的本地免费 LLM API 服务

用法:
  zerotoken [选项]

选项:
  --port, -p <端口>         指定服务端口 (默认: 18789)
  --config, -c <路径>       指定配置文件路径 (默认: ./zerotoken.json)
  --auth <token>            设置认证 Token
  --help, -h                显示帮助信息
  --version, -v             显示版本号

环境变量:
  ZEROTOKEN_PORT            服务端口 (默认: 18789)
  ZEROTOKEN_AUTH_TOKEN      API 认证 Token
  ZEROTOKEN_CDP_URL         Chrome 调试地址 (默认: http://127.0.0.1:9222)
  ZEROTOKEN_ATTACH_ONLY     是否仅附加模式 (默认: true)

配置文件 (zerotoken.json):
  {
    "port": 18789,
    "authToken": "your-secret-token",
    "providers": {
      "claude-web": { "cookie": "sessionKey=xxx" },
      "deepseek-web": { "cookie": "xxx" }
    }
  }

示例:
  zerotoken                          # 使用默认配置启动
  zerotoken --port 8080              # 指定端口
  zerotoken --config /path/to.json   # 指定配置文件
  zerotoken --auth my-secret         # 设置认证 Token

启动 Chrome (调试模式):
  chrome --remote-debugging-port=9222

使用 API:
  curl http://localhost:18789/v1/chat/completions \\
    -H "Content-Type: application/json" \\
    -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"你好"}],"stream":true}'
`);
}

function printVersion() {
  console.log(`zerotoken v${VERSION}`);
}

function parseArgs(args: string[]): {
  port?: number;
  configPath?: string;
  authToken?: string;
  help: boolean;
  version: boolean;
} {
  const result = {
    port: undefined as number | undefined,
    configPath: undefined as string | undefined,
    authToken: undefined as string | undefined,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--port":
      case "-p":
        result.port = parseInt(args[++i], 10);
        if (isNaN(result.port) || result.port < 1 || result.port > 65535) {
          console.error("错误: 无效的端口号，请使用 1-65535 之间的数字");
          process.exit(1);
        }
        break;

      case "--config":
      case "-c":
        result.configPath = args[++i];
        if (!result.configPath) {
          console.error("错误: 请指定配置文件路径");
          process.exit(1);
        }
        break;

      case "--auth":
        result.authToken = args[++i];
        if (!result.authToken) {
          console.error("错误: 请指定认证 Token");
          process.exit(1);
        }
        break;

      case "--help":
      case "-h":
        result.help = true;
        break;

      case "--version":
      case "-v":
        result.version = true;
        break;

      default:
        console.error(`错误: 未知选项: ${arg}`);
        console.error("使用 --help 查看帮助信息");
        process.exit(1);
    }
  }

  return result;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.help) {
    printHelp();
    process.exit(0);
  }

  if (parsed.version) {
    printVersion();
    process.exit(0);
  }

  const options: ZeroTokenServerOptions = {};

  // Load config from file if specified
  if (parsed.configPath) {
    const configFilePath = resolve(parsed.configPath);
    if (!existsSync(configFilePath)) {
      console.error(`错误: 配置文件不存在: ${configFilePath}`);
      process.exit(1);
    }
    try {
      const content = readFileSync(configFilePath, "utf-8");
      const config = JSON.parse(content);
      Object.assign(options, config);
    } catch (err) {
      console.error(`错误: 解析配置文件失败: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }

  // CLI args override config file
  if (parsed.port) {
    options.port = parsed.port;
  }
  if (parsed.authToken) {
    options.authToken = parsed.authToken;
  }

  try {
    await startServer(options);
  } catch (err) {
    console.error("启动 ZeroToken 服务器失败:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
