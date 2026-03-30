# ZeroToken 🔥

**零成本的本地免费 LLM API 服务**

通过浏览器自动化技术调用商业大模型，提供兼容 OpenAI 格式的本地 API。无需 API Key，无需付费，只需登录 Cookie 即可使用 Claude、ChatGPT、DeepSeek、Gemini 等 13 家主流大模型。

## ✨ 功能特点

- 🆓 **完全免费** - 通过浏览器自动化复用网页版额度，零成本
- 🔌 **OpenAI 兼容** - 标准 `/v1/chat/completions` 接口，兼容所有 OpenAI SDK 客户端
- 🌐 **13 家 Provider** - 支持 Claude、ChatGPT、DeepSeek、Gemini、Grok 等主流大模型
- ⚡ **流式输出** - 支持 SSE 流式传输，实时返回生成内容
- 🔒 **可选认证** - 支持 Bearer Token 认证保护
- 🐳 **轻量部署** - 单文件部署，Node.js >= 22 即可运行

## 📋 支持的模型

| Provider | API ID | 支持模型 |
|----------|--------|---------|
| **Claude** | `claude-web` | claude-sonnet-4-6, claude-opus-4-6, claude-haiku-4-6 |
| **ChatGPT** | `chatgpt-web` | gpt-4, gpt-4-turbo, gpt-3.5-turbo |
| **DeepSeek** | `deepseek-web` | deepseek-chat, deepseek-reasoner, deepseek-reasoner-search |
| **Gemini** | `gemini-web` | gemini-pro, gemini-ultra |
| **Grok** | `grok-web` | grok-1, grok-2 |
| **Qwen (国际)** | `qwen-web` | qwen3.5-plus, qwen3.5-turbo |
| **Qwen (国内)** | `qwen-cn-web` | Qwen3.5-Plus, Qwen3.5-Turbo |
| **Kimi** | `kimi-web` | moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k |
| **GLM (国内)** | `glm-web` | glm-4-plus, glm-4-think |
| **GLM (国际)** | `glm-intl-web` | glm-4-plus, glm-4-think |
| **Perplexity** | `perplexity-web` | perplexity-web, perplexity-pro |
| **Doubao** | `doubao-web` | doubao-seed-2.0, doubao-pro |
| **小米 MiMo** | `xiaomimo-web` | xiaomimo-chat |

## 🚀 安装

### 前置条件

- **Node.js** >= 22.12.0
- **Chrome / Chromium / Edge** - 需要以调试模式运行

### 安装步骤

```bash
# 克隆项目
git clone <repo-url> zerotoken
cd zerotoken

# 安装依赖
npm install

# 复制配置文件
cp zerotoken.example.json zerotoken.json

# 编辑配置，填入 Cookie
vim zerotoken.json

# 启动服务
npm start
```

## ⚙️ 配置说明

### 配置文件 `zerotoken.json`

```json
{
  "port": 18789,
  "authToken": "your-secret-token",
  "providers": {
    "deepseek-web": {
      "cookie": "your-cookie-string"
    }
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `port` | `number` | 服务端口，默认 `18789` |
| `authToken` | `string` | API 认证 Token，留空则不启用认证 |
| `providers` | `object` | 各 Provider 的认证配置 |

### Provider 认证配置

每个 Provider 支持以下字段：

| 字段 | 说明 |
|------|------|
| `cookie` | 网页版 Cookie 字符串 |
| `sessionKey` | Claude 的 sessionKey |
| `accessToken` | API 访问令牌 |
| `userAgent` | 自定义 User-Agent |

## 🍪 Cookie 获取方法

### 启动 Chrome 调试模式

首先以远程调试模式启动 Chrome：

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222

# Windows
chrome.exe --remote-debugging-port=9222
```

### 获取各 Provider 的 Cookie

**通用方法：**
1. 用调试模式的 Chrome 打开对应的网站
2. 登录账号
3. 打开开发者工具 (F12) → Application → Cookies
4. 复制所有 Cookie 值

**各 Provider 详细说明：**

<details>
<summary><b>Claude (claude.ai)</b></summary>

1. 打开 https://claude.ai 并登录
2. F12 → Application → Cookies → https://claude.ai
3. 找到 `sessionKey` Cookie，值为 `sk-ant-sid01-xxx` 或 `sk-ant-sid02-xxx` 格式
4. 配置：
```json
{
  "providers": {
    "claude-web": {
      "sessionKey": "sk-ant-sid01-xxx",
      "cookie": "sessionKey=sk-ant-sid01-xxx; other cookies..."
    }
  }
}
```
</details>

<details>
<summary><b>DeepSeek (chat.deepseek.com)</b></summary>

1. 打开 https://chat.deepseek.com 并登录
2. F12 → Network → 随便发一条消息 → 找到请求头中的 Cookie
3. 配置：
```json
{
  "providers": {
    "deepseek-web": {
      "cookie": "你的完整 Cookie 字符串"
    }
  }
}
```
</details>

<details>
<summary><b>ChatGPT (chatgpt.com)</b></summary>

1. 打开 https://chatgpt.com 并登录
2. F12 → Network → 找到请求头中的 Cookie
3. 配置：
```json
{
  "providers": {
    "chatgpt-web": {
      "cookie": "你的完整 Cookie 字符串"
    }
  }
}
```
</details>

<details>
<summary><b>Gemini (gemini.google.com)</b></summary>

1. 打开 https://gemini.google.com 并登录
2. F12 → Network → 找到请求头中的 Cookie
3. 配置：
```json
{
  "providers": {
    "gemini-web": {
      "cookie": "你的完整 Cookie 字符串"
    }
  }
}
```
</details>

## 📡 API 接口文档

### `GET /` - 服务信息

```bash
curl http://localhost:18789/
```

### `GET /health` - 健康检查

```bash
curl http://localhost:18789/health
```

### `GET /v1/models` - 获取模型列表

```bash
curl http://localhost:18789/v1/models
```

响应：
```json
{
  "object": "list",
  "data": [
    { "id": "deepseek-chat", "object": "model", "created": 1234567890, "owned_by": "deepseek-web" },
    { "id": "claude-sonnet-4-6", "object": "model", "created": 1234567890, "owned_by": "claude-web" }
  ]
}
```

### `POST /v1/chat/completions` - 对话补全

**请求体（兼容 OpenAI 格式）：**

```json
{
  "model": "deepseek-chat",
  "messages": [
    { "role": "system", "content": "你是一个有帮助的助手" },
    { "role": "user", "content": "你好，介绍一下自己" }
  ],
  "stream": true
}
```

**非流式请求：**

```bash
curl http://localhost:18789/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

**流式请求：**

```bash
curl http://localhost:18789/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
```

**带认证的请求：**

```bash
curl http://localhost:18789/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-token" \
  -d '{
    "model": "claude-sonnet-4-6",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

## 🔗 集成到 OpenAI SDK

### Python

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:18789/v1",
    api_key="your-secret-token"  # 如果设置了 authToken
)

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "你好"}],
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content, end="")
```

### Node.js

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:18789/v1",
  apiKey: "your-secret-token",
});

const stream = await client.chat.completions.create({
  model: "claude-sonnet-4-6",
  messages: [{ role: "user", content: "你好" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
```

### 配合其他工具

ZeroToken 兼容任何支持 OpenAI API 格式的工具，包括但不限于：

- **Continue** (VS Code 插件)
- **Cline** (VS Code 插件)
- **ChatBox** (桌面客户端)
- **LobeChat** (Web 客户端)
- **Open WebUI**
- **Cursor** (编辑器)

只需将 `base_url` 设置为 `http://localhost:18789/v1` 即可。

## 🌍 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ZEROTOKEN_PORT` | `18789` | 服务端口 |
| `ZEROTOKEN_AUTH_TOKEN` | - | API 认证 Token |
| `ZEROTOKEN_CDP_URL` | `http://127.0.0.1:9222` | Chrome 调试地址 |
| `ZEROTOKEN_ATTACH_ONLY` | `true` | 是否仅附加模式（不自动启动浏览器） |

## 📜 CLI 命令

```bash
# 启动服务（使用默认配置）
zerotoken

# 指定端口
zerotoken --port 8080

# 指定配置文件
zerotoken --config /path/to/zerotoken.json

# 设置认证 Token
zerotoken --auth my-secret-token

# 查看帮助
zerotoken --help

# 查看版本
zerotoken --version
```

## ⚠️ 注意事项

1. **Chrome 调试模式** - 使用前必须以 `--remote-debugging-port=9222` 参数启动 Chrome
2. **Cookie 过期** - Cookie 有有效期，过期后需要重新获取
3. **账号安全** - 建议使用小号，避免主账号被封
4. **频率限制** - 各平台有请求频率限制，请勿过度使用
5. **仅限本地** - 建议仅在本地网络使用，不要暴露到公网

## 📄 License

MIT
