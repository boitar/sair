# SAIR

**Siri-ously AI Router**  
*Your Intelligence. Your Models.*

An Apple Intelligence request router powered by Surge and compatible proxy clients.

[English](#english) | [中文说明](#chinese)

---

<a name="english"></a>
## English

### Overview

**SAIR (Siri-ously AI Router)** is a lightweight, zero-dependency proxy adapter for China Mainland Apple Intelligence (iOS 27.3+). It intercepts network calls originally routed to Alibaba's Qwen (`prod-yabuli.qianwen.com`) and transparently translates them to any OpenAI-compatible LLM endpoint (such as OpenAI ChatGPT, Google Gemini via proxy, DeepSeek, Claude, or self-hosted models).

With SAIR, your native iOS Writing Tools, Siri conversational QA, and Visual Intelligence query your models of choice with full streaming support and zero modifications to your operating system.

### Key Features

* **Complete Native Coverage**: Full out-of-the-box support for:
  * **Writing Tools** (Compose / Rewrite / Refine) with native refinement prompts.
  * **Siri Conversational QA** (Voice & Text) with interactive suggestion chips.
  * **Visual Intelligence** (Camera Control / Photo Identification) with automatic high-resolution Base64 image extraction.
* **Dual-Hook Surge Architecture**: Overcomes client buffer constraints by staging prompts in `http-request` and dynamically rewriting the 27-state Server-Sent Events (SSE) stream in `http-response`.
* **Zero SSL Pinning Issues**: Apple Intelligence connects directly from iOS to the cloud provider via TLS 1.3 without certificate pinning, allowing clean MITM interception.
* **Configurable Fallback & Resilience**:
  * **Configurable Fallbacks**: Automatically fall back to official Qwen if your custom LLM provider times out or errors.
  * **Per-Scenario Timeouts**: Granular timeout thresholds for Writing Tools, Siri, and Visual Intelligence to avoid client disconnects.
  * **Customizable Notifications**: Choose between full notifications, errors only, or completely silent operation.
* **Built-in Model Inspector**: Access `https://prod-yabuli.qianwen.com/sair/models` directly in Safari to discover available models from your provider.

---

### Request Flow & Protocol Architecture

```
+--------------------+        1. Query / Context        +-------------------------+
|                    | -------------------------------> |   Surge iOS Adapter     |
|  Apple Device      |                                  |   (Request Hook)        |
|  (iOS 27.3 Beta)   | <-------------------------------+-------------------------+
|                    |        4. Injected SSE Stream                 |
+--------------------+                                               | 2. Standard Chat /
                                                                     |    Vision Request
                                                                     v
                                                        +-------------------------+
                                                        | Any OpenAI-Compatible  |
                                                        | LLM Gateway / Provider  |
                                                        +-------------------------+
```

1. **Direct Cloud Connectivity**: Unlike Apple's Private Cloud Compute (PCC) used for Western markets, China mainland Apple Intelligence delegates third-party extensions directly to `prod-yabuli.qianwen.com`.
2. **Realtime SSE Hierarchy**: Responses are delivered as a 27-event stream (`session.created` -> `session.response.choices[].items[].message.content[].text.value.delta` -> `session.response.done`).
3. **Adaptive JSON Schemas**:
   * Writing Tools requires: `{"body": "...", "refinements": ["..."]}`
   * Siri QA requires: `{"content": "...", "suggestions": ["..."], "summary": "..."}`
   * Visual Intelligence requires multi-modal Base64 image parsing.

For comprehensive technical protocol specifications, see [docs/protocol_analysis.md](docs/protocol_analysis.md).

---

### Installation & Usage

#### Prerequisites
* An iOS device running iOS 27.3 Beta with Apple Intelligence enabled.
* **Surge iOS** with **MITM enabled** and the Surge CA certificate installed and trusted in *Settings -> General -> About -> Certificate Trust Settings*.
* An API key and endpoint for any OpenAI-compatible provider (e.g., OpenAI, OpenRouter, DeepSeek, or a local Magpie/LiteLLM gateway).

#### Step 1: Install the Surge Module
Install the module directly into Surge iOS:
```
https://raw.githubusercontent.com/boitar/sair/main/sgmodule/sair.sgmodule
```

#### Step 2: Configure Module Arguments
In Surge iOS, navigate to **Modules -> SAIR -> Edit Arguments**, and configure your parameters:

```ini
endpoint=https://api.openai.com/v1/chat/completions&api_key={{SECRET_16z7h4v2}}
```

#### Supported Arguments:
| Parameter | Default | Description |
| :--- | :--- | :--- |
| `endpoint` | `https://api.openai.com/v1/chat/completions` | OpenAI-compatible chat completions URL |
| `api_key` | (empty) | Your API Key / Bearer token |
| `model` | `gpt-4o-mini` | Target LLM model name |
| `notify` | `error` | Notification level: `all` (all intercepts), `error` (only on error/fallback), `none` |
| `fallback` | `true` | Fall back to official Qwen upon provider failure or timeout |
| `timeout_siri` | `7` | Siri QA timeout in seconds (Siri times out after 6~8s) |
| `timeout_vision` | `10` | Visual Intelligence timeout in seconds |
| `timeout_writing`| `15` | Writing Tools timeout in seconds |

#### Step 3: Verify & Discover Models
Open Safari on your iPhone with Surge running and visit:
* `https://prod-yabuli.qianwen.com/sair/models` — Lists all models returned by your provider.
* `https://prod-yabuli.qianwen.com/sair/status` — Displays the active SAIR runtime configuration.

---

<a name="chinese"></a>
## 中文说明

### 项目介绍

**SAIR (Siri-ously AI Router)** 是一个专为中国大陆版 Apple 智能（iOS 27.3+）设计的轻量化代理请求路由项目。它通过 Surge 等网络调试工具，在设备本地透明拦截 Apple 智能发往阿里千问（`prod-yabuli.qianwen.com`）的网络请求，并无感转接至用户指定的任何兼容 OpenAI 规范的大模型网关（例如 OpenAI ChatGPT、Gemini、Claude、DeepSeek、自建 Ollama/vLLM 服务等）。

通过 SAIR，用户可以继续使用系统原生的 Siri 语音唤醒、系统级写作工具润色以及视觉相机识图，而底层模型完全由用户自主掌控。

### 核心功能

* **三大原生场景全覆盖**：
  * **写作工具**（润饰/创作）：完美适配 `body` 与 `refinements` 交互规范，生成正文并携带自定义建议引导按钮。
  * **Siri 智能问答**（语音/打字）：智能控制推理延迟（~3.5s），避开 Siri 客户端 6~8 秒超时限制，完整呈现图文卡片与语音朗读。
  * **视觉智能**（相机控制/拍图提问）：突破 Surge 默认缓冲区瓶颈（支持最高 16MB 数据包），自动提取高分辨率 Base64 图像并进行多模态视觉理解。
* **双向 Hook 架构**：在 `http-request` 阶段捕获并持久化 Prompt 与图像，在 `http-response` 阶段无缝重写 27 级层次化 Server-Sent Events (SSE) 事件流。
* **无 SSL Pinning 阻碍**：国行 Apple 智能直连云端，不含证书绑定，系统信任 Surge CA 根证书即可完全解密。
* **高可靠容错与通知**：
  * **官方回退保护**：当自定义大模型超时或报错时，可自动放行原版千问回包，确保系统功能不宕机。
  * **细粒度超时控制**：分别针对写作工具、Siri、视觉提问设置独立超时。
  * **通知级别可选**：支持全部通知（调试用）、仅通知失败（日常用）或完全静默。
* **内置模型发现探测**：Safari 直接访问 `https://prod-yabuli.qianwen.com/sair/models` 即可实时查看服务商支持的所有模型。

---

### 请求链路与协议分析

```
+--------------------+        1. 用户提问/拍照/润色       +-------------------------+
|                    | -------------------------------> |   Surge iOS 脚本引擎    |
|  iPhone 客户端     |                                  |   (Request 拦截 Hook)   |
|  (iOS 27.3 Beta)   | <-------------------------------+-------------------------+
|                    |        4. 注入修改后的 SSE 事件流              |
+--------------------+                                               | 2. 发起 OpenAI 规范
                                                                     |    多模态/文本调用
                                                                     v
                                                        +-------------------------+
                                                        | 用户自定义大模型提供商  |
                                                        | (OpenAI / DeepSeek 等)  |
                                                        +-------------------------+
```

详细的协议逆向数据、状态机事件流程及 JSON Schema 请参阅 [docs/protocol_analysis.md](docs/protocol_analysis.md)。

---

### 安装与使用方法

#### 1. 前置环境要求
* iPhone（已更新至 iOS 27.3 Beta 并启用 Apple 智能）。
* 已安装 **Surge iOS**，并在 *设置 -> 通用 -> 关于本机 -> 证书信任设置* 中信任了 Surge 生成的 MITM 根证书。
* 一个可用的大模型 API Key 及兼容 OpenAI 规范的 Endpoint。

#### 2. 安装 Surge 模块
在 Surge iOS 中添加模块链接：
```
https://raw.githubusercontent.com/boitar/sair/main/sgmodule/sair.sgmodule
```

#### 3. 配置模块参数
在 Surge 模块列表中点击 **SAIR -> 参数设置 (Arguments)**，填写你的参数：
```ini
endpoint=https://api.openai.com/v1/chat/completions&api_key={{SECRET_l5b6b1o6}}
```

#### 4. 在线验证
在手机开启 Surge 的状态下，使用 Safari 访问：
* `https://prod-yabuli.qianwen.com/sair/models`：查看该 Key 下的所有可用模型列表。
* `https://prod-yabuli.qianwen.com/sair/status`：查看当前模块运行状态与参数。

---

### 已知限制 (Known Limitations)

1. **版本限定**：目前初版专为 **Surge iOS (5.x+)** 设计与验证，其他客户端（如 Loon / Quantumult X / Shadowrocket）需按其脚本语法适配。
2. **Siri 严格超时**：Siri 对第三方扩展的响应等待窗口通常在 6~8 秒以内。建议选择响应迅速的模型（如 `gpt-4o-mini`、`gemini-2.5-flash`、`deepseek-chat`），若使用深度思考模型，请降低 reasoning 消耗以避免 Siri 提前断连。
3. **官方通道依赖**：本方案基于国行 Apple 智能现有的千问扩展通道运行，系统仍需具备调用千问扩展的系统权限。

---

### 免责声明 (Disclaimer)

本项目仅用于网络协议逆向、网络安全性评估及个人学术开发研究。  
Apple、iOS、Siri、Apple Intelligence 为 Apple Inc. 的注册商标；通义千问为阿里巴巴集团商标。本项目与上述公司无任何官方关联或商业合作。使用本项目所产生的一切后果由使用者自行承担。

---

### License

Released under the [MIT License](LICENSE). Copyright (c) 2026 boitar.
