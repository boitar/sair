<div align="center">

<img src="assets/banner.svg" width="100%" alt="SAIR - Siri-ously AI Router Banner" />

<br />

[![Platform](https://img.shields.io/badge/iOS-27.3%2B-A855F7?style=flat-square&logo=apple&logoColor=white)](#prerequisites)
[![Surge](https://img.shields.io/badge/Surge-Dual--Hook%20Engine-38BDF8?style=flat-square)](sgmodule/sair.sgmodule)
[![Loon](https://img.shields.io/badge/Loon-Plugin-8B5CF6?style=flat-square)](loon/sair.plugin)
[![Protocol](https://img.shields.io/badge/API-OpenAI%20Compatible-10B981?style=flat-square)](#provider-configuration-examples)
[![SSE](https://img.shields.io/badge/Stream-27--State%20SSE-EC4899?style=flat-square)](docs/protocol_analysis.md)
[![License](https://img.shields.io/badge/License-MIT-64748B?style=flat-square)](LICENSE)

<p align="center">
  <b>Your Intelligence. Your Models.</b><br />
  A lightweight, zero-dependency model router for Mainland China Apple Intelligence (iOS 27.3+) powered by Surge and Loon.
</p>

<p align="center">
  <a href="README.md">简体中文</a> &nbsp;｜&nbsp; <b>English</b>
</p>

<p align="center">
  <a href="#key-features">Key features</a> ·
  <a href="#architecture-and-request-flow">Architecture</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#one-click-installation">One-click install</a> ·
  <a href="#configuration-reference">Configuration</a> ·
  <a href="#provider-configuration-examples">Examples</a> ·
  <a href="#faq">FAQ</a>
</p>

</div>

---

## Overview

**Apple Intelligence** extensions in Mainland China connect directly from the device to Alibaba's Qwen gateway (`prod-yabuli.qianwen.com`) over standard TLS 1.3. SAIR uses Surge or Loon `http-request` and `http-response` hooks to transparently intercept the flow, dispatch the prompt to a custom model gateway, and rewrite the returned SSE payload on-device.

The native **Writing Tools**, **Siri QA**, and **Visual Intelligence** entry points remain unchanged. The underlying model can be switched to any provider compatible with OpenAI `/v1/chat/completions`, including OpenAI, Gemini, Claude, DeepSeek, OpenRouter, or self-hosted Ollama / vLLM gateways.

> [!TIP]
> Start with [Quick start](#quick-start) if you want to try it immediately. Read [`docs/protocol_analysis.md`](docs/protocol_analysis.md) for the full network flow, event hierarchy, and payload contracts.

## Key features

| Capability | Description |
| :--- | :--- |
| **Three native scenarios** | Supports Writing Tools, Siri conversational QA, and Visual Intelligence while preserving the native UI flow. |
| **27-state SSE rewrite** | Preserves Apple's original event skeleton while replacing the final text payload and scenario-specific JSON schema. |
| **Multimodal passthrough** | Recursively extracts Base64 images or image URLs and converts them into OpenAI Vision-compatible `image_url` messages. |
| **Scenario-aware timeouts** | Uses separate timeout windows for Siri, Visual Intelligence, and Writing Tools to reduce client disconnects. |
| **Official fallback** | Passes through the original Qwen response when the custom gateway times out or returns an error. |
| **Safari inspector** | Use `/sair/status` for a masked runtime configuration and `/sair/models` to discover upstream models. |

### Native scenario adaptation

- **Writing Tools (`compose_selectedAndAllText`)**: Produces `{"body": "...", "refinements": ["..."]}` so the native refinement buttons remain available.
- **Siri QA (`siri.tqa`)**: Produces `{"content": "...", "suggestions": ["..."], "summary": "..."}` for the summary card, voice readout, and follow-up chips.
- **Visual Intelligence (`siri.visualIntelligenceCamera`)**: Detects camera image input and sends it upstream as a standard multimodal message.

## Architecture and request flow

```mermaid
sequenceDiagram
    autonumber
    participant iOS as iPhone / iPad<br/>Apple Intelligence
    participant Req as Surge SAIR<br/>http-request
    participant Qwen as Official Qwen Gateway<br/>prod-yabuli.qianwen.com
    participant Resp as Surge SAIR<br/>http-response
    participant LLM as Custom Model Gateway<br/>OpenAI Compatible

    iOS->>Req: Query / rewrite / camera capture
    Note over Req: Detect scenario<br/>Cache prompt and image payload
    Req->>Qwen: Forward original request for a valid session skeleton
    Qwen-->>Resp: Return the 27-state SSE stream
    Resp->>LLM: Dispatch /v1/chat/completions
    alt Upstream succeeds within the scenario timeout
        LLM-->>Resp: Return generated content
        Note over Resp: Apply the scenario JSON schema<br/>Rewrite SSE text nodes
        Resp-->>iOS: Deliver the custom model response
    else Timeout or upstream error with fallback=true
        Resp-->>iOS: Pass through the original Qwen response
    end
```

See [`docs/protocol_analysis.md`](docs/protocol_analysis.md) for the complete topology, event hierarchy, and JSON contracts.

## Quick start

### Prerequisites

1. **Device and OS**: An iPhone or iPad running iOS 27.3+ with Mainland China Apple Intelligence enabled.
2. **Proxy client**: Surge iOS 5.x+ with **MITM**, **Rewrite**, and **Scripting** enabled, or Loon 3.5.1 (983)+.
3. **Certificate trust**: Fully trust the selected client's MITM CA certificate under *Settings → General → About → Certificate Trust Settings*.
4. **Provider credentials**: An upstream service and API key compatible with OpenAI `/v1/chat/completions`.

### One-click installation

This is the recommended installation path.

The buttons below open the import flow in the selected client. After importing, fill in the
provider endpoint and API key in the module/plugin arguments, then enable MITM and certificate
trust as required by the client.

The one-click import entries come from the `custom` development branch; the module and plugin load
the adapter script from `main` so the installation entry and runtime script can evolve separately.

<table>
  <thead>
    <tr>
      <th>Surge</th>
      <th>Loon</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <a href="surge:///install-module?url=https%3A%2F%2Fraw.githubusercontent.com%2Fboitar%2Fsair%2Fcustom%2Fsgmodule%2Fsair.sgmodule">Import the Surge module</a>
      </td>
      <td>
        <a href="https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fboitar%2Fsair%2Fcustom%2Floon%2Fsair.plugin">Import the Loon plugin</a>
        <br />
        <sub><a href="loon://import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fboitar%2Fsair%2Fcustom%2Floon%2Fsair.plugin">Use the Loon scheme</a></sub>
      </td>
    </tr>
  </tbody>
</table>

### Manual Surge module installation

If the one-click link does not open Surge, open **Modules → Install New Module** in Surge iOS and enter:

```text
https://raw.githubusercontent.com/boitar/sair/custom/sgmodule/sair.sgmodule
```

The module adds the MITM hostname and registers SAIR's request and response hooks automatically.

### Manual Loon plugin installation

If the one-click link does not open Loon, open **Plugins → Add Plugin** in Loon and enter:

```text
https://raw.githubusercontent.com/boitar/sair/custom/loon/sair.plugin
```

After enabling it, Loon will show the configurable SAIR arguments.

### Configure the model gateway

In **Modules → SAIR → Edit Arguments** in Surge, or in the SAIR plugin argument panel in Loon, enter your provider endpoint and API key:

```ini
endpoint=https://api.openai.com/v1/chat/completions&api_key=sk-your-api-key&model=gpt-4o-mini
```

If you provide only a provider's `/v1` base URL, the script appends `/chat/completions` automatically.

The Loon plugin registers the shared [`scripts/sair_adapter.js`](scripts/sair_adapter.js) for both
request and response phases and appends `prod-yabuli.qianwen.com` to the MITM hostname list. `notify`,
`fallback`, and the three scenario timeouts are also configurable there; the script accepts both
Loon's argument object and Surge's `key=value` argument string.

### Verify in Safari

Keep the selected proxy client running and open these endpoints in Safari:

- **Runtime status and active configuration**: [`https://prod-yabuli.qianwen.com/sair/status`](https://prod-yabuli.qianwen.com/sair/status)
- **Upstream model discovery**: [`https://prod-yabuli.qianwen.com/sair/models`](https://prod-yabuli.qianwen.com/sair/models)

`/sair/status` exposes only a masked API key. If it does not load, check the MITM hostname and certificate trust first.

## Configuration reference

### Module / plugin arguments

| Parameter | Default | Description |
| :--- | :--- | :--- |
| `endpoint` | `https://api.openai.com/v1/chat/completions` | OpenAI-compatible chat completions URL; a `/v1` base URL is also accepted. |
| `api_key` | *(empty)* | Upstream API key, sent as a `Bearer` token. |
| `model` | `gpt-4o-mini` | Target model name; Visual Intelligence requires image input support. |
| `notify` | `error` | `error` notifies on errors/fallbacks, `all` notifies every stage, and `none` stays silent. |
| `fallback` | `true` | `true` passes through the official Qwen response on failure; `false` returns HTTP `504`. |
| `timeout_siri` | `7` | Siri timeout in seconds, tuned for the client's roughly 6–8 second window. |
| `timeout_vision` | `10` | Visual Intelligence timeout in seconds. |
| `timeout_writing` | `15` | Writing Tools timeout in seconds. |

### Configuration precedence

When the same option is set in multiple places, the order is:

```text
$persistentStore override > client module/plugin argument > script default
```

Supported persistent store keys:

| Persistent key | Target option | Example value |
| :--- | :--- | :--- |
| `SAIR_ENDPOINT` | `endpoint` | `https://api.deepseek.com/v1/chat/completions` |
| `SAIR_API_KEY` | `api_key` | `sk-...` |
| `SAIR_MODEL` | `model` | `deepseek-chat` |
| `SAIR_NOTIFY` | `notify` | `error` / `all` / `none` |
| `SAIR_FALLBACK` | `fallback` | `true` / `false` |

### Fixed upstream request options

The following values are currently written by [`scripts/sair_adapter.js`](scripts/sair_adapter.js) and are not module arguments:

| Option | Current value |
| :--- | :--- |
| `reasoning_effort` | `low` |
| `max_tokens` | `400` |
| `temperature` | `0.7` |

## Provider configuration examples

> [!TIP]
> Siri has a strict 6–8 second client-side window, so low-latency models are recommended. Visual Intelligence also requires image input support from the upstream model.

**OpenAI**

```ini
endpoint=https://api.openai.com/v1/chat/completions&api_key=sk-proj-xxxx&model=gpt-4o-mini&notify=error&fallback=true
```

**Google Gemini (OpenAI-compatible endpoint)**

```ini
endpoint=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions&api_key=AIzaSyXXXX&model=gemini-2.5-flash&notify=error&fallback=true
```

**DeepSeek**

```ini
endpoint=https://api.deepseek.com/v1/chat/completions&api_key=sk-xxxx&model=deepseek-chat&notify=error&fallback=true
```

**OpenRouter**

```ini
endpoint=https://openrouter.ai/api/v1/chat/completions&api_key=sk-or-v1-xxxx&model=google/gemini-2.5-flash&notify=error&fallback=true
```

## Compatibility and known limitations

- SAIR provides a Surge iOS 5.x+ module and a Loon 3.5.1 (983)+ plugin backed by the same dual-phase adapter.
- The Loon plugin uses the newer Script syntax for object arguments; upgrade Loon to the declared minimum before installing it.
- The official Qwen channel must remain reachable because SAIR uses the original request and SSE session skeleton for response rewriting.
- Siri's waiting window is short, so complex reasoning models may trigger the official fallback.
- Visual Intelligence images consume the proxy script request-body buffer; the Surge module sets `max-size` to `16777216` (16 MB).
- SAIR handles OpenAI Chat Completions-compatible upstreams. It does not translate arbitrary provider protocols.

## Repository structure

```text
SAIR/
├── assets/
│   └── banner.svg              # README hero image and routing visual
├── docs/
│   └── protocol_analysis.md    # Network topology and 27-state SSE analysis
├── scripts/
│   └── sair_adapter.js         # Surge / Loon dual-phase adapter and SSE rewriter
├── sgmodule/
│   └── sair.sgmodule           # Surge iOS module definition
├── loon/
│   └── sair.plugin             # Loon plugin definition and arguments
├── LICENSE                     # MIT License
├── README.md                   # Primary Simplified Chinese documentation
└── README_EN.md                # English documentation
```

## FAQ

<details>
<summary><b>1. Why does Siri sometimes still return the official Qwen response?</b></summary>
<br />

The upstream model usually exceeded `timeout_siri` (7 seconds by default) or returned an error. With `fallback=true`, SAIR releases the original Qwen response automatically. Temporarily set `notify=all` to inspect the reason, or switch to a faster model.
</details>

<details>
<summary><b>2. Why is /sair/status unreachable or showing a certificate warning?</b></summary>
<br />

Make sure the selected client's MITM is enabled, `prod-yabuli.qianwen.com` is included in its MITM hostname list, and the corresponding CA certificate is fully trusted by iOS.
</details>

<details>
<summary><b>3. Does this support Loon, Quantumult X, or Stash?</b></summary>
<br />

Loon is supported through [`loon/sair.plugin`](loon/sair.plugin). Quantumult X and Stash still
require their own rule migration and mappings for the `$httpClient`, `$persistentStore`, and dual-phase
`$done` lifecycle used by [`scripts/sair_adapter.js`](scripts/sair_adapter.js).
</details>

## Disclaimer

This project is intended solely for network protocol research, security evaluation, and personal educational use.

- **Apple**, **iOS**, **Siri**, and **Apple Intelligence** are registered trademarks of Apple Inc. **Qwen (通义千问)** is a registered trademark of Alibaba Group.
- This project is not affiliated with, endorsed by, or sponsored by Apple Inc. or Alibaba Group. Users are responsible for complying with applicable laws and provider terms.

## License

Released under the [MIT License](LICENSE). Copyright © 2026 boitar.
