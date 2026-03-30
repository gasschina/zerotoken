# ZeroToken 🔥

**零成本的本地免费 LLM API 服务**

通过浏览器自动化技术调用商业大模型，提供兼容 OpenAI 格式的本地 API。无需 API Key，无需付费，只需登录 Cookie 即可使用 Claude、ChatGPT、DeepSeek、Gemini 等 13 家主流大模型。

> **📝 近期更新 (2026-03-30)**
> - 修复 `authToken` 配置：空字符串现在正确识别为"无认证"
> - 简化示例配置：只保留 `kimi-web` 示例，默认端口改为 `18790`
> - 改进部署体验：避免与 OpenClaw 控制面板端口冲突

## ✨ 功能特点

- 🆓 **完全免费** - 通过浏览器自动化复用网页版额度，零成本
- 🔌 **OpenAI 兼容** - 标准 `/v1/chat/completions` 接口，兼容所有 OpenAI SDK 客户端
- 🌐 **13 家 Provider** - 支持 Claude、ChatGPT、DeepSeek、Gemini、Grok 等主流大模型
- 🔐 **一键登录** - `zerotoken login` 命令自动打开浏览器、捕获 Cookie
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
- **Chrome / Chromium / Edge / Brave** - 用于浏览器自动化（登录时需要）

### 安装步骤

```bash
# 克隆项目
git clone <repo-url> zerotoken
cd zerotoken

# 安装依赖
npm install

# 构建项目
npm run build

# 登录 Provider（二选一）
zerotoken login claude-web    # 登录单个 Provider
zerotoken login               # 交互式选择

# 启动服务
npm start
# 或
zerotoken
```

## 🔐 登录说明

ZeroToken 提供两种凭证获取方式：

1. **推荐：`zerotoken login` 命令** - 自动打开浏览器，捕获登录凭证
2. **手动方式** - 手动复制 Cookie 到配置文件

### 方式一：使用 `zerotoken login` 命令（推荐）

#### 快速开始

```bash
# 方式 A：交互式菜单（推荐新手使用）
zerotoken login

# 方式 B：直接登录指定 Provider
zerotoken login claude-web
zerotoken login deepseek-web
zerotoken login chatgpt-web

# 方式 C：登录所有 Provider
zerotoken login --all

# 查看已登录的 Provider
zerotoken login --list

# 删除所有已保存的凭证
zerotoken login --remove
```

#### 前置准备：启动 Chrome 调试模式

使用 `zerotoken login` 之前，需要先以调试模式启动 Chrome：

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222

# Windows
chrome.exe --remote-debugging-port=9222

# 或使用 Brave / Edge / Chromium 等浏览器
brave-browser --remote-debugging-port=9222
microsoft-edge --remote-debugging-port=9222
```

**注意：** 请确保关闭所有已有的 Chrome 实例后再启动调试模式，否则调试端口可能无法生效。

#### 各 Provider 详细登录说明

<details>
<summary><b>1. Claude (claude.ai)</b></summary>

- **服务地址：** https://claude.ai
- **所需账号：** Anthropic Claude 账号（免费或 Pro）
- **登录方式：**
  1. 运行 `zerotoken login claude-web`
  2. 程序自动打开 Chrome 调试窗口并导航到 claude.ai
  3. 在浏览器中登录你的 Claude 账号
  4. 登录成功后，程序自动捕获 `sessionKey` Cookie
- **捕获的凭证：** `sessionKey`（格式：`sk-ant-sid01-xxx` 或 `sk-ant-sid02-xxx`）+ 完整 Cookie + User-Agent
- **注意事项：**
  - 免费账号有使用次数限制
  - Pro 账号可使用更强模型（Opus 4.6）
  - sessionKey 有效期约 7 天，过期需重新登录
- **手动备用方法：**
  1. F12 → Application → Cookies → `https://claude.ai`
  2. 找到 `sessionKey` Cookie
  3. 在 `zerotoken.json` 中配置：
  ```json
  {
    "providers": {
      "claude-web": {
        "sessionKey": "sk-ant-sid01-xxx",
        "cookie": "sessionKey=sk-ant-sid01-xxx; ...其他Cookie"
      }
    }
  }
  ```
</details>

<details>
<summary><b>2. ChatGPT (chatgpt.com)</b></summary>

- **服务地址：** https://chatgpt.com
- **所需账号：** OpenAI 账号（免费、Plus 或 Team）
- **登录方式：**
  1. 运行 `zerotoken login chatgpt-web`
  2. 在浏览器中登录 ChatGPT
  3. 程序自动捕获 session-token
- **捕获的凭证：** `accessToken`（`__Secure-next-auth.session-token` Cookie）+ 完整 Cookie + User-Agent
- **注意事项：**
  - 免费账号只能使用 GPT-4o-mini
  - Plus 账号可使用 GPT-4、GPT-4 Turbo
  - session token 可能会分片为 `.0` 和 `.1` 两个 Cookie
- **手动备用方法：**
  1. F12 → Application → Cookies → `https://chatgpt.com`
  2. 找到 `__Secure-next-auth.session-token` Cookie
  ```json
  {
    "providers": {
      "chatgpt-web": {
        "accessToken": "__Secure-next-auth.session-token的值",
        "cookie": "完整的Cookie字符串"
      }
    }
  }
  ```
</details>

<details>
<summary><b>3. DeepSeek (chat.deepseek.com)</b></summary>

- **服务地址：** https://chat.deepseek.com
- **所需账号：** DeepSeek 账号（免费注册）
- **登录方式：**
  1. 运行 `zerotoken login deepseek-web`
  2. 在浏览器中登录 DeepSeek
  3. 程序自动捕获 bearer token 和 Cookie
- **捕获的凭证：** `bearer`（Bearer Token）+ 完整 Cookie + User-Agent
- **注意事项：**
  - DeepSeek 提供免费额度，无需付费
  - bearer token 需要通过 API 请求获取，登录后需要发送一条消息触发
  - Cookie 包含 `d_id`、`ds_session_id` 等关键字段
- **手动备用方法：**
  1. F12 → Network → 发送一条消息 → 找到任意 API 请求
  2. 从请求头复制 `Authorization: Bearer xxx` 中的 token
  3. 从请求头复制 `Cookie` 字段
  ```json
  {
    "providers": {
      "deepseek-web": {
        "bearer": "你的bearer token",
        "cookie": "完整的Cookie字符串"
      }
    }
  }
  ```
</details>

<details>
<summary><b>4. Gemini (gemini.google.com)</b></summary>

- **服务地址：** https://gemini.google.com/app
- **所需账号：** Google 账号
- **登录方式：**
  1. 运行 `zerotoken login gemini-web`
  2. 在浏览器中登录 Google 账号
  3. 等待页面加载完成，程序自动捕获 Cookie
- **捕获的凭证：** 完整 Cookie（包含 `SID`、`__Secure-1PSID` 等 Google 认证 Cookie）+ User-Agent
- **注意事项：**
  - 需要 Google 账号登录
  - 免费版有使用频率限制
  - Google Cookie 有效期较长（通常数周到数月）
- **手动备用方法：**
  1. F12 → Application → Cookies → `https://gemini.google.com`
  2. 复制所有 Cookie（特别是 `SID`、`HSID`、`SSID`、`__Secure-1PSID` 等）
  ```json
  {
    "providers": {
      "gemini-web": {
        "cookie": "SID=xxx; HSID=xxx; SSID=xxx; ..."
      }
    }
  }
  ```
</details>

<details>
<summary><b>5. Grok (grok.com)</b></summary>

- **服务地址：** https://grok.com
- **所需账号：** X (Twitter) 账号
- **登录方式：**
  1. 运行 `zerotoken login grok-web`
  2. 通过 X 账号登录 Grok
  3. 程序自动捕获 SSO Cookie
- **捕获的凭证：** 完整 Cookie（包含 `sso`、`_ga` 等）+ User-Agent
- **注意事项：**
  - 需要 X (Twitter) 账号
  - 部分 Grok 功能需要 X Premium
  - 免费用户可能有使用限制
- **手动备用方法：**
  1. F12 → Application → Cookies → `https://grok.com`
  2. 复制所有 Cookie
  ```json
  {
    "providers": {
      "grok-web": {
        "cookie": "完整的Cookie字符串"
      }
    }
  }
  ```
</details>

<details>
<summary><b>6. Qwen International (chat.qwen.ai)</b></summary>

- **服务地址：** https://chat.qwen.ai
- **所需账号：** 阿里云国际账号
- **登录方式：**
  1. 运行 `zerotoken login qwen-web`
  2. 在浏览器中登录阿里云账号
  3. 程序自动捕获 session Cookie
- **捕获的凭证：** `sessionToken` + 完整 Cookie + User-Agent
- **注意事项：**
  - 国际版需要阿里云国际账号
  - 访问 chat.qwen.ai 可能需要梯子
- **手动备用方法：**
  1. F12 → Application → Cookies → `https://chat.qwen.ai`
  ```json
  {
    "providers": {
      "qwen-web": {
        "cookie": "完整的Cookie字符串"
      }
    }
  }
  ```
</details>

<details>
<summary><b>7. Qwen CN (qianwen.com)</b></summary>

- **服务地址：** https://www.qianwen.com
- **所需账号：** 阿里云账号（支持支付宝快捷登录）
- **登录方式：**
  1. 运行 `zerotoken login qwen-cn-web`
  2. 在浏览器中登录通义千问
  3. 程序自动捕获 SSO ticket 和 XSRF token
- **捕获的凭证：** Cookie（包含 `tongyi_sso_ticket`）+ `xsrfToken` + User-Agent
- **注意事项：**
  - 国内版直连，不需要梯子
  - 支持支付宝账号快捷登录
  - 免费用户有每日使用限制
- **手动备用方法：**
  1. F12 → Application → Cookies → `https://www.qianwen.com`
  2. 找到 `tongyi_sso_ticket` 和 `XSRF-TOKEN`
  ```json
  {
    "providers": {
      "qwen-cn-web": {
        "cookie": "tongyi_sso_ticket=xxx; XSRF-TOKEN=xxx; ...",
        "xsrfToken": "XSRF-TOKEN的值"
      }
    }
  }
  ```
</details>

<details>
<summary><b>8. Kimi (kimi.com)</b></summary>

- **服务地址：** https://www.kimi.com
- **所需账号：** Moonshot / Kimi 账号（手机号注册）
- **登录方式：**
  1. 运行 `zerotoken login kimi-web`
  2. 在浏览器中登录 Kimi
  3. 程序自动捕获 access_token Cookie
- **捕获的凭证：** 完整 Cookie（包含 `access_token`）+ User-Agent
- **注意事项：**
  - 手机号注册即可使用
  - 免费用户有使用次数限制
  - 支持 128K 长上下文
- **手动备用方法：**
  1. F12 → Application → Cookies → `https://www.kimi.com`
  ```json
  {
    "providers": {
      "kimi-web": {
        "cookie": "access_token=xxx; ..."
      }
    }
  }
  ```
</details>

<details>
<summary><b>9. ChatGLM / 智谱清言 (chatglm.cn)</b></summary>

- **服务地址：** https://chatglm.cn
- **所需账号：** 智谱账号（手机号注册）
- **登录方式：**
  1. 运行 `zerotoken login glm-web`
  2. 在浏览器中登录智谱清言
  3. 程序自动捕获 `chatglm_refresh_token` Cookie
- **捕获的凭证：** 完整 Cookie（包含 `chatglm_refresh_token`）+ User-Agent
- **注意事项：**
  - 国内版，手机号注册
  - 支持 GLM-4-Plus 和 GLM-4-Think 模型
  - Think 模型支持深度推理
- **手动备用方法：**
  1. F12 → Application → Cookies → `https://chatglm.cn`
  ```json
  {
    "providers": {
      "glm-web": {
        "cookie": "chatglm_refresh_token=xxx; ..."
      }
    }
  }
  ```
</details>

<details>
<summary><b>10. GLM International (chat.z.ai)</b></summary>

- **服务地址：** https://chat.z.ai
- **所需账号：** Zhipu 国际版账号
- **登录方式：**
  1. 运行 `zerotoken login glm-intl-web`
  2. 在浏览器中登录
  3. 程序等待登录完成并捕获 Cookie
- **捕获的凭证：** 完整 Cookie（包含 `refresh_token` 等）+ User-Agent
- **注意事项：**
  - 国际版可能需要梯子访问
  - 登录检测时间较长（最多 10 分钟）
  - 支持邮箱注册
- **手动备用方法：**
  1. F12 → Application → Cookies → `https://chat.z.ai`
  ```json
  {
    "providers": {
      "glm-intl-web": {
        "cookie": "完整的Cookie字符串"
      }
    }
  }
  ```
</details>

<details>
<summary><b>11. Perplexity (perplexity.ai)</b></summary>

- **服务地址：** https://www.perplexity.ai
- **所需账号：** Perplexity 账号（Google/GitHub 登录）
- **登录方式：**
  1. 运行 `zerotoken login perplexity-web`
  2. 在浏览器中登录（支持 Google 或 GitHub OAuth）
  3. 程序自动捕获 session Cookie
- **捕获的凭证：** 完整 Cookie（包含 `__Secure-next-auth.session-token`）+ User-Agent
- **注意事项：**
  - 免费版有每日搜索次数限制
  - Pro 版支持更多功能和模型
  - Perplexity 特点是搜索+对话结合
- **手动备用方法：**
  1. F12 → Application → Cookies → `https://www.perplexity.ai`
  ```json
  {
    "providers": {
      "perplexity-web": {
        "cookie": "__Secure-next-auth.session-token=xxx; ..."
      }
    }
  }
  ```
</details>

<details>
<summary><b>12. Doubao 豆包 (doubao.com)</b></summary>

- **服务地址：** https://www.doubao.com/chat/
- **所需账号：** 字节跳动账号（支持抖音/今日头条登录）
- **登录方式：**
  1. 运行 `zerotoken login doubao-web`
  2. 在浏览器中登录豆包
  3. 程序自动捕获 `sessionid` Cookie
- **捕获的凭证：** `sessionid` + `ttwid` + 完整 Cookie + User-Agent
- **注意事项：**
  - 国内服务，手机号或抖音账号登录
  - 豆包免费版有使用频率限制
  - Cookie 包含 `ttwid`（用于反爬验证）
- **手动备用方法：**
  1. F12 → Application → Cookies → `https://www.doubao.com`
  2. 找到 `sessionid` 和 `ttwid`
  ```json
  {
    "providers": {
      "doubao-web": {
        "sessionid": "sessionid的值",
        "cookie": "sessionid=xxx; ttwid=xxx; ..."
      }
    }
  }
  ```
</details>

<details>
<summary><b>13. 小米 MiMo (xiaomimimo.com)</b></summary>

- **服务地址：** https://aistudio.xiaomimimo.com
- **所需账号：** 小米账号
- **登录方式：**
  1. 运行 `zerotoken login xiaomimo-web`
  2. 在浏览器中登录小米 AI Studio
  3. 程序自动捕获 token Cookie
- **捕获的凭证：** 完整 Cookie（包含 token/session/auth 相关 Cookie）+ User-Agent
- **注意事项：**
  - 需要小米账号登录
  - MiMo 是小米的大模型平台，支持多轮对话
  - 可能需要等待页面加载完成后才触发登录检测
- **手动备用方法：**
  1. F12 → Application → Cookies → `https://aistudio.xiaomimimo.com`
  ```json
  {
    "providers": {
      "xiaomimo-web": {
        "cookie": "完整的Cookie字符串"
      }
    }
  }
  ```
</details>

### 方式二：手动配置（高级用户）

如果不使用 `zerotoken login` 命令，可以手动将 Cookie 填入 `zerotoken.json`：

```bash
# 复制示例配置
cp zerotoken.example.json zerotoken.json
```

```json
{
  "port": 18789,
  "authToken": "your-secret-token",
  "providers": {
    "claude-web": { "cookie": "your-cookie-string" },
    "deepseek-web": { "cookie": "your-cookie-string" },
    "chatgpt-web": { "cookie": "your-cookie-string" },
    "gemini-web": { "cookie": "your-cookie-string" }
  }
}
```

**手动获取 Cookie 的通用方法：**
1. 以调试模式启动 Chrome：`google-chrome --remote-debugging-port=9222`
2. 打开目标网站并登录
3. F12 → Application → Cookies
4. 复制所有 Cookie 值

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
| `bearer` | DeepSeek Bearer Token |
| `sessionid` | Doubao Session ID |
| `userAgent` | 自定义 User-Agent |

### 凭证来源优先级

当同一 Provider 配置了多个凭证来源时，按以下优先级使用：

1. **`zerotoken.json` 配置文件** - `providers` 部分中的配置
2. **`~/.zerotoken/auth-profiles.json`** - `zerotoken login` 命令保存的凭证
3. **环境变量** - `ZEROTOKEN_<PROVIDER>` (如 `ZEROTOKEN_CLAUDE_WEB`)

环境变量可以设置为 JSON 字符串或纯 Cookie 字符串：

```bash
# JSON 格式
export ZEROTOKEN_CLAUDE_WEB='{"cookie":"sessionKey=xxx; ..."}'

# 纯 Cookie 格式
export ZEROTOKEN_DEEPSEEK_WEB='d_id=xxx; ds_session_id=xxx; ...'
```

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
| `ZEROTOKEN_<PROVIDER>` | - | Provider 凭证（JSON 或 Cookie 字符串） |

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

# 登录（交互式）
zerotoken login

# 登录指定 Provider
zerotoken login claude-web
zerotoken login deepseek-web
zerotoken login --all

# 管理凭证
zerotoken login --list
zerotoken login --remove

# 查看帮助
zerotoken --help
zerotoken login --help

# 查看版本
zerotoken --version
```

## ⚠️ 注意事项

1. **Chrome 调试模式** - 使用 `zerotoken login` 时，需先以 `--remote-debugging-port=9222` 启动 Chrome
2. **Cookie 过期** - Cookie 有有效期（通常数天到数周），过期后需重新登录
3. **账号安全** - 建议使用小号，避免主账号被封
4. **频率限制** - 各平台有请求频率限制，请勿过度使用
5. **仅限本地** - 建议仅在本地网络使用，不要暴露到公网
6. **凭证安全** - 登录凭证存储在 `~/.zerotoken/auth-profiles.json`，权限设为 600

## 📄 License

MIT
