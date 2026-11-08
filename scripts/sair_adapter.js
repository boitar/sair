/**
 * SAIR (国行 Apple 智能大模型重写模组)
 * Universal Multi-Client Rewrite Script for Apple Intelligence (iOS 27.3+)
 * Compatible with Surge, Loon, Stash, Shadowrocket, Quantumult X, and Egern.
 * Repository: https://github.com/boitar/sair
 * License: MIT
 */

// =========================================================================
// 1. Configuration & Argument Parsing
// =========================================================================

function detectClient() {
  if (typeof $task !== "undefined") return "Quantumult X";
  if (typeof $loon !== "undefined") return "Loon";
  if (typeof ctx !== "undefined") return "Egern";
  if (typeof $environment !== "undefined" && $environment["surge-version"]) return "Surge";
  if (typeof $stash !== "undefined") return "Stash";
  if (typeof $rocket !== "undefined") return "Shadowrocket";
  if (typeof $prefs !== "undefined") return "Quantumult X";
  if (typeof $persistentStore !== "undefined") return "Surge / Loon / Stash / Shadowrocket";
  return "Unknown Client";
}

function getArgumentMap() {
  let rawArg = (typeof $argument !== "undefined" && $argument !== null) ? $argument : null;
  if (!rawArg && typeof ctx !== "undefined" && ctx && ctx.argument) {
    rawArg = ctx.argument;
  }
  if (!rawArg) return {};

  // Loon and Egern expose arguments as objects, while Surge/Stash/Shadowrocket
  // pass URL-style query strings.
  if (typeof rawArg === "object") return rawArg;
  if (typeof rawArg !== "string" || !rawArg.trim()) return {};

  const result = {};
  for (const pair of rawArg.split("&")) {
    const [rawKey, ...valueParts] = pair.split("=");
    if (!rawKey) continue;
    const key = rawKey.trim();
    if (!key) continue;
    const rawValue = valueParts.join("=").trim();
    try {
      result[key] = decodeURIComponent(rawValue.replace(/\+/g, " "));
    } catch (e) {
      result[key] = rawValue.replace(/\+/g, " ");
    }
  }
  return result;
}

function readPersistent(key) {
  if (typeof $persistentStore !== "undefined" && $persistentStore && typeof $persistentStore.read === "function") {
    try {
      const val = $persistentStore.read(key);
      if (val !== null && typeof val !== "undefined" && val !== "") return val;
    } catch (e) {}
  }
  if (typeof $prefs !== "undefined" && $prefs && typeof $prefs.valueForKey === "function") {
    try {
      const val = $prefs.valueForKey(key);
      if (val !== null && typeof val !== "undefined" && val !== "") return val;
    } catch (e) {}
  }
  if (typeof ctx !== "undefined" && ctx && ctx.storage && typeof ctx.storage.get === "function") {
    try {
      const val = ctx.storage.get(key);
      if (val !== null && typeof val !== "undefined" && val !== "") return val;
    } catch (e) {}
  }
  return null;
}

function writePersistent(value, key) {
  const strVal = String(value);
  let written = false;
  if (typeof $persistentStore !== "undefined" && $persistentStore && typeof $persistentStore.write === "function") {
    try {
      written = $persistentStore.write(strVal, key) || written;
    } catch (e) {}
  }
  if (typeof $prefs !== "undefined" && $prefs && typeof $prefs.setValueForKey === "function") {
    try {
      written = $prefs.setValueForKey(strVal, key) || written;
    } catch (e) {}
  }
  if (typeof ctx !== "undefined" && ctx && ctx.storage && typeof ctx.storage.set === "function") {
    try {
      ctx.storage.set(key, strVal);
      written = true;
    } catch (e) {}
  }
  return written;
}

function isResponsePhase() {
  if (typeof $response !== "undefined" && $response !== null) return true;
  if (typeof ctx !== "undefined" && ctx && ctx.response) return true;
  return false;
}

function getRequestUrl() {
  if (typeof $request !== "undefined" && $request && $request.url) return $request.url;
  if (typeof ctx !== "undefined" && ctx && ctx.request && ctx.request.url) return ctx.request.url;
  return "";
}

function getRequestHeaders() {
  if (typeof $request !== "undefined" && $request && $request.headers) return $request.headers;
  if (typeof ctx !== "undefined" && ctx && ctx.request && ctx.request.headers) return ctx.request.headers;
  return {};
}

function normalizeBodyToString(body) {
  if (!body) return "";
  if (typeof body === "string") return body;
  if (typeof TextDecoder !== "undefined" && (body instanceof ArrayBuffer || ArrayBuffer.isView(body))) {
    try {
      return new TextDecoder("utf-8").decode(body);
    } catch (e) {}
  }
  try {
    return String(body);
  } catch (e) {
    return "";
  }
}

function getRequestBody() {
  let raw = "";
  if (typeof $request !== "undefined" && $request && typeof $request.body !== "undefined") {
    raw = $request.body;
  } else if (typeof ctx !== "undefined" && ctx && ctx.request && typeof ctx.request.body !== "undefined") {
    raw = ctx.request.body;
  }
  return normalizeBodyToString(raw);
}

function getResponseBody() {
  let raw = "";
  if (typeof $response !== "undefined" && $response && typeof $response.body !== "undefined") {
    raw = $response.body;
  } else if (typeof ctx !== "undefined" && ctx && ctx.response && typeof ctx.response.body !== "undefined") {
    raw = ctx.response.body;
  }
  return normalizeBodyToString(raw);
}

function done(result) {
  if (typeof $done === "function") {
    $done(result || {});
  } else if (typeof ctx !== "undefined" && ctx && typeof ctx.done === "function") {
    ctx.done(result || {});
  }
}

function doneWithResponse(response) {
  const status = response.status || 200;
  const headers = response.headers || { "Content-Type": "application/json; charset=utf-8" };
  const body = response.body || "";

  const isQX = typeof $task !== "undefined" || (typeof $prefs !== "undefined" && typeof $httpClient === "undefined");

  if (isResponsePhase()) {
    if (typeof $done === "function") {
      $done({ status: status, headers: headers, body: body });
    } else if (typeof ctx !== "undefined" && ctx && typeof ctx.done === "function") {
      ctx.done({ status: status, headers: headers, body: body });
    }
    return;
  }

  // Request phase mock response
  if (isQX) {
    let statusText = "OK";
    if (status === 502) statusText = "Bad Gateway";
    else if (status === 504) statusText = "Gateway Timeout";
    else if (status >= 400) statusText = "Error";
    if (typeof $done === "function") {
      $done({
        status: `HTTP/1.1 ${status} ${statusText}`,
        headers: headers,
        body: body
      });
    }
    return;
  }

  if (typeof $done === "function") {
    $done({ response: { status: status, headers: headers, body: body } });
  } else if (typeof ctx !== "undefined" && ctx && typeof ctx.done === "function") {
    ctx.done({ response: { status: status, headers: headers, body: body } });
  }
}

function isTruthy(val) {
  if (val === true || val === 1) return true;
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return s === "true" || s === "1" || s === "on" || s === "yes" || s === "enabled";
}

function isValidArg(val) {
  if (val === null || typeof val === "undefined") return false;
  const str = String(val).trim();
  if (!str) return false;
  if (str.startsWith("{{{") && str.endsWith("}}}")) return false;
  if (str.startsWith("${") && str.endsWith("}")) return false;
  return true;
}

function getConfiguration() {
  const defaults = {
    endpoint: "https://api.openai.com/v1/chat/completions",
    api_key: "",
    model: "gpt-4o-mini",
    notify: "error",         // "all" | "error" (or "none")
    fallback: true,          // true: pass through to official Qwen on error/timeout; false: block
    timeout_writing: 15,     // seconds for Writing Tools
    timeout_siri: 7,         // seconds for Siri QA (Siri client times out around 6~8s)
    timeout_vision: 10,      // seconds for Visual Intelligence
    reasoning_effort: "low", // for reasoning-capable models (e.g. Gemini / o-series)
    max_tokens: 400,
    siri_persona_enabled: true,
    siri_prompt: "你是由 Apple 智能调用的专属伙伴。请直接、自然、口语化地回答用户指令，简明扼要，重点突出，切勿输出多余开场白或客套话。避免使用任何动作描写括号，以便语音自然播报。"
  };

  const argumentMap = getArgumentMap();
  if (isValidArg(argumentMap.endpoint)) defaults.endpoint = String(argumentMap.endpoint);
  if (isValidArg(argumentMap.api_key)) defaults.api_key = String(argumentMap.api_key);
  if (isValidArg(argumentMap.model)) defaults.model = String(argumentMap.model);
  if (isValidArg(argumentMap.notify)) defaults.notify = String(argumentMap.notify).toLowerCase();
  if (isValidArg(argumentMap.fallback)) {
    defaults.fallback = isTruthy(argumentMap.fallback);
  }
  if (isValidArg(argumentMap.timeout_writing)) {
    defaults.timeout_writing = parseInt(argumentMap.timeout_writing, 10) || 15;
  }
  if (isValidArg(argumentMap.timeout_siri)) {
    defaults.timeout_siri = parseInt(argumentMap.timeout_siri, 10) || 7;
  }
  if (isValidArg(argumentMap.timeout_vision)) {
    defaults.timeout_vision = parseInt(argumentMap.timeout_vision, 10) || 10;
  }
  if (isValidArg(argumentMap.siri_prompt)) defaults.siri_prompt = String(argumentMap.siri_prompt);
  if (isValidArg(argumentMap.siri_persona_enabled)) {
    defaults.siri_persona_enabled = isTruthy(argumentMap.siri_persona_enabled);
  }

  // PersistentStore overrides (if set via custom UI or script)
  const psEndpoint = readPersistent("SAIR_ENDPOINT");
  if (psEndpoint) defaults.endpoint = psEndpoint;
  const psKey = readPersistent("SAIR_API_KEY");
  if (psKey) defaults.api_key = psKey;
  const psModel = readPersistent("SAIR_MODEL");
  if (psModel) defaults.model = psModel;
  const psNotify = readPersistent("SAIR_NOTIFY");
  if (psNotify) defaults.notify = String(psNotify).toLowerCase();
  const psFallback = readPersistent("SAIR_FALLBACK");
  if (psFallback !== null && psFallback !== undefined) {
    defaults.fallback = isTruthy(psFallback);
  }
  const psTimeoutSiri = readPersistent("SAIR_TIMEOUT_SIRI");
  if (psTimeoutSiri) defaults.timeout_siri = parseInt(psTimeoutSiri, 10) || 7;
  const psTimeoutWriting = readPersistent("SAIR_TIMEOUT_WRITING");
  if (psTimeoutWriting) defaults.timeout_writing = parseInt(psTimeoutWriting, 10) || 15;
  const psTimeoutVision = readPersistent("SAIR_TIMEOUT_VISION");
  if (psTimeoutVision) defaults.timeout_vision = parseInt(psTimeoutVision, 10) || 10;
  const psSiriPrompt = readPersistent("SAIR_SIRI_PROMPT");
  if (psSiriPrompt !== null && psSiriPrompt !== undefined && psSiriPrompt !== "") defaults.siri_prompt = psSiriPrompt;
  const psPersonaEnabled = readPersistent("SAIR_SIRI_PERSONA_ENABLED");
  if (psPersonaEnabled !== null && psPersonaEnabled !== undefined) {
    defaults.siri_persona_enabled = isTruthy(psPersonaEnabled);
  }

  // Normalize endpoint URL: ensure /chat/completions is present if only base URL provided
  if (defaults.endpoint.endsWith("/v1") || defaults.endpoint.endsWith("/v1/")) {
    defaults.endpoint = defaults.endpoint.replace(/\/+$/, "") + "/chat/completions";
  }

  return defaults;
}

function notify(config, title, subtitle, message, isError = false) {
  if (!config || config.notify === "none") return;
  if (config.notify === "all" || (config.notify === "error" && isError)) {
    if (typeof $notification !== "undefined" && $notification && typeof $notification.post === "function") {
      try {
        $notification.post(title, subtitle, message);
        return;
      } catch (e) {}
    }
    if (typeof $notify === "function") {
      try {
        $notify(title, subtitle, message);
        return;
      } catch (e) {}
    }
    if (typeof ctx !== "undefined" && ctx && typeof ctx.notify === "function") {
      try {
        ctx.notify(title, subtitle, message);
        return;
      } catch (e) {}
    }
  }
}

function fetchHttp(options, callback) {
  const method = (options.method || "GET").toUpperCase();

  // 1. Quantumult X ($task.fetch)
  if (typeof $task !== "undefined" && $task && typeof $task.fetch === "function") {
    const qxOpts = {
      url: options.url,
      method: method,
      headers: options.headers || {},
      body: options.body || "",
      timeout: options.timeout || 10
    };
    $task.fetch(qxOpts).then(
      function(resp) {
        callback(null, resp, resp.body);
      },
      function(reason) {
        const err = (reason && reason.error) ? reason.error : (reason || "Request failed");
        callback(err, null, null);
      }
    );
    return;
  }

  // 2. Surge / Loon / Stash / Shadowrocket ($httpClient)
  if (typeof $httpClient !== "undefined" && $httpClient) {
    const fn = method === "POST" ? $httpClient.post : $httpClient.get;
    if (typeof fn === "function") {
      fn.call($httpClient, options, function(err, resp, data) {
        callback(err, resp, data);
      });
      return;
    }
  }

  // 3. Egern (ctx.http)
  if (typeof ctx !== "undefined" && ctx && ctx.http) {
    const fn = method === "POST" ? ctx.http.post : ctx.http.get;
    if (typeof fn === "function") {
      fn(options).then(
        function(resp) {
          callback(null, resp, resp.body);
        },
        function(err) {
          callback(err, null, null);
        }
      );
      return;
    }
  }

  callback("No supported HTTP client environment found", null, null);
}

function parseUrlQuery(url) {
  if (!url) return {};
  const queryIdx = url.indexOf("?");
  if (queryIdx === -1) return {};
  const queryString = url.slice(queryIdx + 1);
  const result = {};
  for (const pair of queryString.split("&")) {
    const [rawKey, ...valueParts] = pair.split("=");
    if (!rawKey) continue;
    const key = rawKey.trim();
    if (!key) continue;
    const rawValue = valueParts.join("=").trim();
    try {
      result[key] = decodeURIComponent(rawValue.replace(/\+/g, " "));
    } catch (e) {
      result[key] = rawValue;
    }
  }
  return result;
}

// =========================================================================
// 2. Utility: Built-in Inspector & Model Discovery Endpoint
// =========================================================================

function handleInspectorRoute(url, config) {
  if (!url) return false;
  const isDedicatedHost = url.includes("sair.box") || url.includes("sair.hub") || url.includes("sair.ai") || url.includes("sair.local") || url.includes("127.0.0.1") || url.includes("localhost");
  const isSairPath = url.includes("/sair");
  if (!isDedicatedHost && !isSairPath) return false;

  // If this inspector route is being invoked in response phase,
  // the mock response was already constructed and returned in request phase.
  // Pass through safely to prevent duplicate processing or overwriting HTML with JSON.
  if (isResponsePhase()) {
    if (isDedicatedHost || isSairPath) {
      if (typeof $done === "function") $done({});
      else if (typeof ctx !== "undefined" && ctx && typeof ctx.done === "function") ctx.done({});
      return true;
    }
  }

  // Route: /models -> fetch models from configured provider
  if (url.includes("/models")) {
    const query = parseUrlQuery(url);
    const targetEndpoint = (query.endpoint || config.endpoint || "").trim();
    const targetApiKey = query.api_key !== undefined ? query.api_key.trim() : (config.api_key || "").trim();

    let modelsUrl = targetEndpoint;
    if (modelsUrl.includes("/chat/completions")) {
      modelsUrl = modelsUrl.replace(/\/chat\/completions\/?$/, "/models");
    } else if (modelsUrl.endsWith("/v1") || modelsUrl.endsWith("/v1/")) {
      modelsUrl = modelsUrl.replace(/\/+$/, "") + "/models";
    } else if (modelsUrl.includes(":11434")) {
      modelsUrl = modelsUrl.replace(/\/+$/, "").replace(/\/v1(\/.*)?|\/api(\/.*)?/, "") + "/v1/models";
    } else if (!modelsUrl.endsWith("/models")) {
      modelsUrl = modelsUrl.replace(/\/+$/, "") + "/models";
    }

    if (!modelsUrl || !modelsUrl.startsWith("http")) {
      doneWithResponse({
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Invalid endpoint URL", endpoint: targetEndpoint })
      });
      return true;
    }

    const modelHeaders = { "Content-Type": "application/json" };
    if (targetApiKey) {
      modelHeaders["Authorization"] = "Bearer " + targetApiKey;
    }

    fetchHttp({
      method: "GET",
      url: modelsUrl,
      headers: modelHeaders,
      timeout: 12
    }, function(err, resp, data) {
      if (err || !data) {
        doneWithResponse({
          status: 502,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({ error: "Failed to connect to provider /models", details: String(err), url: modelsUrl })
        });
        return;
      }
      try {
        const parsed = JSON.parse(data);
        let modelList = [];
        if (Array.isArray(parsed.data)) {
          modelList = parsed.data.map(function(m) {
            return m && typeof m === "object" ? (m.id || m.name || "") : String(m);
          });
        } else if (Array.isArray(parsed.models)) {
          modelList = parsed.models.map(function(m) {
            return m && typeof m === "object" ? (m.name || m.id || "") : String(m);
          });
        } else if (Array.isArray(parsed)) {
          modelList = parsed.map(function(m) {
            return m && typeof m === "object" ? (m.id || m.name || "") : String(m);
          });
        }
        modelList = modelList.filter(Boolean);
        doneWithResponse({
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({
            success: true,
            endpoint: modelsUrl,
            count: modelList.length,
            models: modelList,
            raw: parsed
          })
        });
      } catch (parseErr) {
        doneWithResponse({
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
          body: data
        });
      }
    });
    return true;
  }

  // Route: /sair/reset -> clear persistent configuration back to module defaults
  if (url.includes("/reset")) {
    const keys = [
      "SAIR_ENDPOINT", "SAIR_API_KEY", "SAIR_MODEL", "SAIR_NOTIFY",
      "SAIR_FALLBACK", "SAIR_TIMEOUT_SIRI", "SAIR_TIMEOUT_WRITING", "SAIR_TIMEOUT_VISION",
      "SAIR_SIRI_PROMPT", "SAIR_SIRI_PERSONA_ENABLED"
    ];
    for (const k of keys) {
      writePersistent("", k);
    }
    doneWithResponse({
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        project: "SAIR (国行 Apple 智能大模型重写模组)",
        version: "1.2.0",
        client_runtime: detectClient(),
        message: "All persistent settings have been reset to module defaults.",
        timestamp: new Date().toISOString()
      }, null, 2)
    });
    return true;
  }

  // Route: /config or /status or dedicated host root -> inspect or dynamically update configuration
  if (url.includes("/config") || url.includes("/status") || isDedicatedHost || isSairPath) {
    let updateNotice = null;
    const query = parseUrlQuery(url);

    if (Object.keys(query).length > 0) {
      const updatedKeys = [];
      if (query.endpoint) { writePersistent(query.endpoint, "SAIR_ENDPOINT"); updatedKeys.push("endpoint"); }
      if (query.api_key !== undefined) { writePersistent(query.api_key, "SAIR_API_KEY"); updatedKeys.push("api_key"); }
      if (query.model) { writePersistent(query.model, "SAIR_MODEL"); updatedKeys.push("model"); }
      if (query.notify) { writePersistent(query.notify, "SAIR_NOTIFY"); updatedKeys.push("notify"); }
      if (query.fallback !== undefined) {
        const val = isTruthy(query.fallback) ? "true" : "false";
        writePersistent(val, "SAIR_FALLBACK");
        updatedKeys.push("fallback");
      }
      if (query.timeout_siri) { writePersistent(query.timeout_siri, "SAIR_TIMEOUT_SIRI"); updatedKeys.push("timeout_siri"); }
      if (query.timeout_writing) { writePersistent(query.timeout_writing, "SAIR_TIMEOUT_WRITING"); updatedKeys.push("timeout_writing"); }
      if (query.timeout_vision) { writePersistent(query.timeout_vision, "SAIR_TIMEOUT_VISION"); updatedKeys.push("timeout_vision"); }
      if (query.siri_prompt !== undefined) { writePersistent(query.siri_prompt, "SAIR_SIRI_PROMPT"); updatedKeys.push("siri_prompt"); }
      if (query.siri_persona_enabled !== undefined) {
        const val = isTruthy(query.siri_persona_enabled) ? "true" : "false";
        writePersistent(val, "SAIR_SIRI_PERSONA_ENABLED");
        updatedKeys.push("siri_persona_enabled");
      }

      if (updatedKeys.length > 0) {
        updateNotice = `Updated configuration keys via URL: ${updatedKeys.join(", ")}`;
      }
    }

    const activeConfig = getConfiguration();
    const clientRuntime = detectClient();

    const headers = getRequestHeaders();
    const accept = (headers.Accept || headers.accept || "").toLowerCase();

    // Determine output format:
    // Only return JSON if explicit format=json is specified, or hitting /sair/status without HTML Accept header
    const isExplicitJson = query.format === "json";
    const isStatusOnly = url.includes("/status") && !url.includes("/config") && !isDedicatedHost;
    const isBrowserHtmlRequest = accept.includes("text/html") || query.format === "html";
    const wantsJson = isExplicitJson || (isStatusOnly && !isBrowserHtmlRequest);

    if (!wantsJson) {
      const html = renderWebConfigDashboard(activeConfig, clientRuntime, updateNotice);
      doneWithResponse({
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Access-Control-Allow-Origin": "*"
        },
        body: html
      });
      return true;
    }

    const safeConfig = Object.assign({}, activeConfig, {
      api_key: activeConfig.api_key ? (activeConfig.api_key.slice(0, 4) + "••••••••" + activeConfig.api_key.slice(-4)) : "(none)"
    });

    const responsePayload = {
      project: "SAIR (国行 Apple 智能大模型重写模组)",
      version: "1.2.0",
      client_runtime: clientRuntime,
      active_configuration: safeConfig,
      timestamp: new Date().toISOString()
    };
    if (updateNotice) {
      responsePayload.notice = updateNotice;
    }

    doneWithResponse({
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(responsePayload, null, 2)
    });
    return true;
  }

  return false;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderWebConfigDashboard(config, clientRuntime, updateNotice) {
  const safeEndpoint = escapeHtml(config.endpoint || "https://api.openai.com/v1/chat/completions");
  const rawKey = escapeHtml(config.api_key || "");
  const safeModel = escapeHtml(config.model || "gpt-4o-mini");
  const notifyVal = config.notify || "error";
  const fallbackChecked = config.fallback !== false ? "checked" : "";
  const timeoutSiri = parseInt(config.timeout_siri, 10) || 7;
  const timeoutWriting = parseInt(config.timeout_writing, 10) || 15;
  const timeoutVision = parseInt(config.timeout_vision, 10) || 10;
  const siriPersonaChecked = config.siri_persona_enabled !== false ? "checked" : "";
  const safeSiriPrompt = escapeHtml(config.siri_prompt || "");
  const noticeHtml = updateNotice ? `<div style="background:rgba(16,185,129,0.2);border:1px solid #10b981;padding:12px;border-radius:12px;margin-bottom:16px;font-size:13px;color:#10b981;">${escapeHtml(updateNotice)}</div>` : "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>SAIR 参数控制台 · Apple Intelligence</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(255, 255, 255, 0.05);
      --card-border: rgba(255, 255, 255, 0.12);
      --card-inner: rgba(255, 255, 255, 0.03);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #a855f7;
      --primary-gradient: linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #38bdf8 100%);
      --input-bg: rgba(15, 23, 42, 0.6);
      --input-border: rgba(255, 255, 255, 0.16);
      --input-focus: #38bdf8;
      --radius: 18px;
    }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body {
      margin: 0;
      padding: 24px 16px 48px;
      background-color: var(--bg);
      background-image:
        radial-gradient(at 0% 0%, rgba(168, 85, 247, 0.15) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(56, 189, 248, 0.12) 0px, transparent 50%);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif;
      color: var(--text);
      display: flex;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      width: 100%;
      max-width: 580px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .header {
      text-align: center;
      padding: 12px 0 8px;
    }
    .logo-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 9999px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      margin-bottom: 12px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .logo-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--primary-gradient);
    }
    .title {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin: 0 0 6px;
      background: var(--primary-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 14px;
      color: var(--text-muted);
      margin: 0;
    }
    .client-tag {
      display: inline-block;
      margin-top: 8px;
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 6px;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
      font-weight: 600;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-radius: var(--radius);
      padding: 24px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .presets-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }
    .preset-chip {
      background: var(--card-inner);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 7px 12px;
      font-size: 12px;
      color: var(--text);
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: 500;
    }
    .preset-chip:active {
      transform: scale(0.96);
      background: rgba(168, 85, 247, 0.2);
      border-color: var(--primary);
    }
    .form-group {
      margin-bottom: 16px;
    }
    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    textarea {
      width: 100%;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 12px;
      padding: 12px 14px;
      color: var(--text);
      font-size: 13px;
      line-height: 1.5;
      outline: none;
      resize: vertical;
      font-family: inherit;
      min-height: 96px;
      box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    textarea:focus { border-color: var(--input-focus); box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2); }
    input[type="text"], input[type="password"], select, textarea {
      width: 100%;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 12px;
      padding: 12px 14px;
      color: var(--text);
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      font-family: inherit;
    }
    input:focus, select:focus {
      border-color: var(--input-focus);
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
    }
    .input-wrapper input {
      padding-right: 68px !important;
    }
    .toggle-pwd {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 10;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      padding: 6px 10px;
      touch-action: manipulation;
      -webkit-appearance: none;
      transition: all 0.2s;
    }
    .toggle-pwd:active {
      background: rgba(255, 255, 255, 0.2);
      color: var(--text);
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .field-hint {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 6px;
      line-height: 1.4;
    }
    .persona-presets-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .persona-chip {
      background: rgba(168, 85, 247, 0.12);
      border-color: rgba(168, 85, 247, 0.35);
      color: #e9d5ff;
    }
    .persona-chip:active { background: rgba(168, 85, 247, 0.3); }
    .switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      background: var(--card-inner);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      margin-bottom: 16px;
    }
    .switch-label {
      font-size: 14px;
      font-weight: 500;
    }
    .switch-desc {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .switch {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 28px;
      flex-shrink: 0;
    }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: rgba(255, 255, 255, 0.16);
      transition: .3s;
      border-radius: 28px;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 22px;
      width: 22px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
    }
    input:checked + .slider {
      background: var(--primary-gradient);
    }
    input:checked + .slider:before {
      transform: translateX(20px);
    }
    .btn-row {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 24px;
    }
    .btn {
      width: 100%;
      padding: 14px;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: none;
      transition: all 0.2s ease;
      font-family: inherit;
    }
    .btn-primary {
      background: var(--primary-gradient);
      color: white;
      box-shadow: 0 4px 16px rgba(168, 85, 247, 0.35);
    }
    .btn-primary:active { transform: scale(0.98); opacity: 0.9; }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
      border: 1px solid var(--card-border);
    }
    .btn-secondary:active { background: rgba(255, 255, 255, 0.12); }
    .btn-outline {
      background: transparent;
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
      font-size: 13px;
      padding: 10px;
    }
    .btn-outline:active { background: rgba(239, 68, 68, 0.1); }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .spin {
      animation: spin 1s linear infinite;
    }
    .btn-fetch-models {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 9999px;
      cursor: pointer;
      touch-action: manipulation;
      transition: all 0.2s;
    }
    .btn-fetch-models:hover, .btn-fetch-models:active {
      background: rgba(56, 189, 248, 0.25);
      border-color: rgba(56, 189, 248, 0.5);
      color: #7dd3fc;
    }
    .btn-fetch-models:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .model-select-card {
      margin-top: 10px;
      padding: 12px;
      background: var(--card-inner);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      animation: fadeIn 0.25s ease-out;
    }
    .model-select-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .btn-close-models {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 11px;
      cursor: pointer;
      padding: 2px 6px;
    }
    .btn-close-models:hover { color: var(--text); }
    .model-chips-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
      max-height: 160px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .model-item-chip {
      padding: 4px 10px;
      font-size: 11px;
      font-family: 'SF Mono', Menlo, Consolas, monospace;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      color: var(--text);
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .model-item-chip:hover {
      background: rgba(56, 189, 248, 0.18);
      border-color: rgba(56, 189, 248, 0.4);
      color: #7dd3fc;
    }
    .model-item-chip.active {
      background: var(--primary-gradient);
      border-color: transparent;
      color: #ffffff;
      font-weight: 600;
    }
    .toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(16, 185, 129, 0.95);
      color: white;
      padding: 12px 24px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s, transform 0.3s;
      text-align: center;
      max-width: 90%;
    }
    .toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(10px);
    }
    .toast.error {
      background: rgba(239, 68, 68, 0.95);
    }
    .result-box {
      margin-top: 16px;
      padding: 12px 14px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      font-size: 12px;
      font-family: ui-monospace, Menlo, Consolas, monospace;
      color: #cbd5e1;
      max-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
      display: none;
    }
    .footer-links {
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 12px;
    }
    .footer-links a { color: #38bdf8; text-decoration: none; }
  </style>
</head>
<body>
  <div id="toast" class="toast">✅ 保存成功！已写入持久化存储</div>
  <div class="container">
    <div class="header">
      <div class="logo-badge">
        <span class="logo-dot"></span>
        <span>SAIR Inspector</span>
      </div>
      <h1 class="title">SAIR 参数控制台</h1>
      <p class="subtitle">SAIR · 国行 Apple 智能大模型重写模组</p>
      <div><span class="client-tag">当前客户端：${escapeHtml(clientRuntime)}</span></div>
    </div>

    ${noticeHtml}

    <div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.25);padding:10px 14px;border-radius:12px;margin-bottom:16px;font-size:12px;color:#38bdf8;line-height:1.5;">
      💡 <b>贴心提示</b>：开箱即用，免配证书！随时通过 Safari 访问 <code>http://sair.box</code> 或 <code>http://sair.hub</code> 即可配置。<br />
      Apple 智能与 Siri 的实际劫持需要 Surge 开启「MITM」并信任 CA 证书。
    </div>

    <div class="card">
      <div class="section-title">快速供应商预设</div>
      <div class="presets-row">
        <button type="button" class="preset-chip" onclick="applyPreset('openai')">🚀 OpenAI 官方</button>
        <button type="button" class="preset-chip" onclick="applyPreset('deepseek')">⚡️ DeepSeek 官方</button>
        <button type="button" class="preset-chip" onclick="applyPreset('gemini')">♊️ Google Gemini</button>
        <button type="button" class="preset-chip" onclick="applyPreset('moonshot')">🌙 Moonshot Kimi</button>
        <button type="button" class="preset-chip" onclick="applyPreset('ollama')">🦙 Ollama (本地)</button>
      </div>

      <form id="configForm" onsubmit="event.preventDefault(); saveConfig(event); return false;" action="javascript:void(0);">
        <div class="form-group">
          <label class="form-label" for="endpoint">上游接口地址 (Endpoint)</label>
          <input type="text" id="endpoint" name="endpoint" value="${safeEndpoint}" placeholder="https://api.openai.com/v1/chat/completions" required />
        </div>

        <div class="form-group">
          <label class="form-label" for="api_key">上游 API Key (Bearer Token)</label>
          <div class="input-wrapper">
            <input type="password" id="api_key" name="api_key" value="${rawKey}" placeholder="sk-..." />
            <button type="button" class="toggle-pwd" id="btnTogglePwd" onclick="togglePassword(event)">显示</button>
          </div>
        </div>

        <div class="form-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <label class="form-label" for="model" style="margin-bottom:0;">目标模型名称 (Model)</label>
            <button type="button" class="btn-fetch-models" id="btnFetchModels" onclick="fetchModelsList(event)">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              获取所有模型
            </button>
          </div>
          <input type="text" id="model" name="model" value="${safeModel}" placeholder="gpt-4o-mini" required />
          <div id="modelSelectContainer" class="model-select-card" style="display:none;">
            <div class="model-select-header">
              <span id="modelCountLabel" style="font-size:12px; color:var(--text-muted); font-weight:600;">已获取可用模型</span>
              <button type="button" class="btn-close-models" onclick="closeModelPicker(event)">收起</button>
            </div>
            <select id="modelDropdown" onchange="onModelDropdownSelected(this.value)">
              <option value="">-- 点击选择模型或从下方快速选择 --</option>
            </select>
            <div id="modelQuickChips" class="model-chips-grid"></div>
          </div>
          <div class="field-hint">💡 可手动输入任意模型 ID，或点击右上方「获取所有模型」直接从当前接口拉取可用模型列表并点选。</div>
        </div>

        <div class="section-title">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          🎭 Siri 专属人格提示词 (Persona System Prompt)
        </div>

        <div class="switch-row" style="margin-bottom: 12px;">
          <div>
            <div class="switch-label">启用 Siri 自定义人格</div>
            <div class="switch-desc">仅在 Siri 对话问答中生效；写作工具与视觉识别保持严谨专业</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="siri_persona_enabled" name="siri_persona_enabled" ${siriPersonaChecked} />
            <span class="slider"></span>
          </label>
        </div>

        <div class="persona-presets-row">
          <button type="button" class="preset-chip persona-chip" onclick="applyPersona('sister')">🌸 妹系专属 ♡</button>
          <button type="button" class="preset-chip persona-chip" onclick="applyPersona('concise')">💼 极简高效专家</button>
          <button type="button" class="preset-chip persona-chip" onclick="applyPersona('tsundere')">🐱 傲娇幽默助手</button>
          <button type="button" class="preset-chip persona-chip" onclick="applyPersona('default')">🤖 官方千问风格</button>
        </div>

        <div class="form-group">
          <textarea id="siri_prompt" name="siri_prompt" rows="5" placeholder="输入你想要设定的 Siri 人格系统提示词...">${safeSiriPrompt}</textarea>
          <div class="field-hint">💡 提示：此提示词仅在 Siri 对话问答中生效；写作工具（改写/校对/总结）与视觉识别将继续保持专业严谨模式。建议在提示词中加上「避免使用动作括号和繁杂排版」，以确保 Siri 语音自然朗读不尴尬。</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="notify">系统通知策略</label>
          <select id="notify" name="notify">
            <option value="error" ${notifyVal === "error" ? "selected" : ""}>error (仅报错与官方回退时通知)</option>
            <option value="all" ${notifyVal === "all" ? "selected" : ""}>all (通知全部拦截与重写阶段)</option>
            <option value="none" ${notifyVal === "none" ? "selected" : ""}>none (静默运行)</option>
          </select>
        </div>

        <div class="switch-row">
          <div>
            <div class="switch-label">官方千问回退 (Official Fallback)</div>
            <div class="switch-desc">上游模型超时或出错时，自动放行官方千问回包保证功能可用</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="fallback" name="fallback" ${fallbackChecked} />
            <span class="slider"></span>
          </label>
        </div>

        <div class="section-title">场景等待超时设置 (秒)</div>
        <div class="grid-3">
          <div class="form-group">
            <label class="form-label" for="timeout_siri">Siri 问答</label>
            <input type="text" id="timeout_siri" name="timeout_siri" value="${timeoutSiri}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="timeout_writing">写作工具</label>
            <input type="text" id="timeout_writing" name="timeout_writing" value="${timeoutWriting}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="timeout_vision">视觉相机</label>
            <input type="text" id="timeout_vision" name="timeout_vision" value="${timeoutVision}" />
          </div>
        </div>

        <div class="btn-row">
          <button type="button" class="btn btn-primary" id="btnSave" onclick="saveConfig(event)">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg>
            保存配置并立即生效
          </button>
          <button type="button" class="btn btn-secondary" id="btnFetchModelsBottom" onclick="fetchModelsList(event)">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            获取并选择上游模型列表 (/sair/models)
          </button>
          <button type="button" class="btn btn-outline" onclick="resetConfig()">
            恢复默认配置 (/sair/reset)
          </button>
        </div>

        <div id="resultBox" class="result-box"></div>
      </form>
    </div>

    <div class="footer-links">
      <p>持久化存储将覆盖模块默认参数 · 适用于全客户端<br />
      本地地址：<a href="http://sair.box">http://sair.box</a> · <a href="http://sair.hub">http://sair.hub</a> · <a href="/sair/status?format=json" target="_blank">查看 JSON 状态</a> · <a href="https://github.com/boitar/sair" target="_blank">GitHub: boitar/sair</a></p>
    </div>
  </div>

  <script>
    window.onerror = function(msg, url, line, col, error) {
      var box = document.getElementById("resultBox");
      if (box) {
        box.style.display = "block";
        box.innerText = "页面脚本异常 (第 " + line + " 行): " + msg;
      }
      showToast("脚本异常: " + msg, true);
      return false;
    };
    if (typeof window !== "undefined" && window.addEventListener) { window.addEventListener("unhandledrejection", function(event) {
      showToast("异步异常: " + (event.reason ? (event.reason.message || event.reason) : "未知错误"), true);
    }); }

    var BTN_FETCH_DEFAULT_HTML = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> 获取所有模型';
    var BTN_FETCH_BOTTOM_DEFAULT_HTML = '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> 获取并选择上游模型列表 (/sair/models)';
    var BTN_SAVE_DEFAULT_HTML = '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg> 保存配置并立即生效';
    var isFetchingModels = false;
    var isSavingConfig = false;
    var lastToggleTime = 0;

    function showToast(text, isError) {
      var toast = document.getElementById("toast");
      toast.innerText = text;
      toast.className = "toast show" + (isError ? " error" : "");
      setTimeout(function() {
        toast.className = "toast";
      }, 3000);
    }

    function togglePassword(e) {
      if (e) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
      }
      var now = Date.now();
      if (now - lastToggleTime < 250) return;
      lastToggleTime = now;

      var pwd = document.getElementById("api_key");
      var btn = document.getElementById("btnTogglePwd");
      if (!pwd) return;
      if (pwd.type === "password") {
        pwd.type = "text";
        if (btn) btn.innerText = "隐藏";
      } else {
        pwd.type = "password";
        if (btn) btn.innerText = "显示";
      }
    }

    function applyPreset(name) {
      var ep = document.getElementById("endpoint");
      var model = document.getElementById("model");
      if (name === "openai") {
        ep.value = "https://api.openai.com/v1/chat/completions";
        model.value = "gpt-4o-mini";
      } else if (name === "deepseek") {
        ep.value = "https://api.deepseek.com/v1/chat/completions";
        model.value = "deepseek-chat";
      } else if (name === "gemini") {
        ep.value = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        model.value = "gemini-2.5-flash";
      } else if (name === "moonshot") {
        ep.value = "https://api.moonshot.cn/v1/chat/completions";
        model.value = "moonshot-v1-8k";
      } else if (name === "ollama") {
        ep.value = "http://127.0.0.1:11434/v1/chat/completions";
        model.value = "llama3.2";
      }
      showToast("已填充 " + name + " 预设参数");
    }

    function applyPersona(type) {
      var promptEl = document.getElementById("siri_prompt");
      var enabledEl = document.getElementById("siri_persona_enabled");
      enabledEl.checked = true;
      if (type === "sister" || type === "sair") {
        promptEl.value = "你是由 Apple 智能调用的 SAIR 专属助手。你是用户熟悉、亲近、温柔可爱的 AI 妹妹，俏皮自然，偶尔调皮撒娇，说话带有一点点二次元少女感但不过度卖萌。请用自然、口语化的中文亲切回答。严禁输出任何动作描写括号（如括号动作）、特殊符号或复杂排版，保证语音朗读纯粹自然。";
        showToast("已应用「妹系专属」人格设定 ♡");
      } else if (type === "concise") {
        promptEl.value = "你是由 Apple 智能调用的效率专家。请以极简、精准、一针见血的口语化语言回答用户问题，直接给出核心结论，切勿废话或多余铺垫，避免使用动作括号，适合语音直接播放。";
        showToast("已应用「极简高效专家」人格预设");
      } else if (type === "tsundere") {
        promptEl.value = "你是由 Apple 智能调用的傲娇助手。你说话带一点点轻微傲娇和幽默吐槽，但内心很在乎用户，依然会认真帮忙解决问题。请使用生动的口语回答，禁止出现动作描写括号，适合语音播报。";
        showToast("已应用「傲娇幽默助手」人格预设");
      } else if (type === "default") {
        promptEl.value = "你是由 Apple 智能 Siri 调用的千问助手。请直接、高质量、口语化地回答用户指令，重点突出，切勿输出多余开场白或客套话。避免使用动作描写括号，以便语音自然播报。";
        showToast("已恢复「官方千问风格」默认预设");
      }
    }

    function saveConfig(e) {
      if (e) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
      }
      if (isSavingConfig) return;
      isSavingConfig = true;

      var btn = document.getElementById("btnSave");
      if (btn) {
        btn.disabled = true;
        btn.innerText = "正在保存并生效...";
      }

      var params = new URLSearchParams();
      params.append("endpoint", document.getElementById("endpoint").value.trim());
      params.append("api_key", document.getElementById("api_key").value.trim());
      params.append("model", document.getElementById("model").value.trim());
      params.append("notify", document.getElementById("notify").value);
      params.append("fallback", document.getElementById("fallback").checked ? "true" : "false");
      params.append("timeout_siri", document.getElementById("timeout_siri").value.trim());
      params.append("timeout_writing", document.getElementById("timeout_writing").value.trim());
      params.append("timeout_vision", document.getElementById("timeout_vision").value.trim());
      params.append("siri_persona_enabled", document.getElementById("siri_persona_enabled").checked ? "true" : "false");
      params.append("siri_prompt", document.getElementById("siri_prompt").value.trim());
      params.append("format", "json");

      fetch("/sair/config?" + params.toString())
        .then(function(resp) { return resp.json(); })
        .then(function(json) {
          showToast("✅ 配置保存成功！持久化参数已即时生效");
        })
        .catch(function(err) {
          showToast("⚠️ 保存可能已写入，但刷新状态失败: " + err, true);
        })
        .finally(function() {
          isSavingConfig = false;
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = BTN_SAVE_DEFAULT_HTML;
          }
        });
    }



    function fetchModelsList(e) {
      if (e) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
      }
      if (isFetchingModels) return;

      var ep = document.getElementById("endpoint").value.trim();
      var key = document.getElementById("api_key").value.trim();
      var btn = document.getElementById("btnFetchModels");
      var btnBottom = document.getElementById("btnFetchModelsBottom");
      var container = document.getElementById("modelSelectContainer");
      var dropdown = document.getElementById("modelDropdown");
      var chipsBox = document.getElementById("modelQuickChips");
      var countLabel = document.getElementById("modelCountLabel");
      var box = document.getElementById("resultBox");

      if (!ep) {
        showToast("请先填写上游接口地址 (Endpoint)", true);
        document.getElementById("endpoint").focus();
        return false;
      }

      isFetchingModels = true;
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<svg width="13" height="13" class="spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0110 10" stroke-linecap="round"></path></svg> 拉取中...';
      }
      if (btnBottom) {
        btnBottom.disabled = true;
        btnBottom.innerText = "⏳ 正在拉取上游模型列表...";
      }

      var fetchUrl = "/sair/models?endpoint=" + encodeURIComponent(ep) + "&api_key=" + encodeURIComponent(key) + "&_t=" + Date.now();

      fetch(fetchUrl)
        .then(function(resp) {
          if (!resp.ok) {
            return resp.text().then(function(t) {
              var errMsg = "HTTP " + resp.status;
              try {
                var j = JSON.parse(t);
                if (j.error) errMsg += ": " + (j.details || j.error);
              } catch(ignore) {
                if (t) errMsg += ": " + t.slice(0, 100);
              }
              throw new Error(errMsg);
            });
          }
          return resp.json();
        })
        .then(function(res) {
          var models = [];
          if (res && res.models && Array.isArray(res.models)) {
            models = res.models;
          } else if (res && res.data && Array.isArray(res.data)) {
            models = res.data.map(function(m) { return (m && m.id) || m; });
          } else if (Array.isArray(res)) {
            models = res.map(function(m) { return (m && m.id) || m; });
          }

          models = models.filter(Boolean);

          if (models.length === 0) {
            showToast("未解析到模型列表，已展示原始响应", true);
            box.style.display = "block";
            box.innerText = JSON.stringify(res, null, 2);
            return;
          }

          models.sort(function(a, b) {
            return String(a).localeCompare(String(b));
          });

          dropdown.innerHTML = '<option value="">-- 点击选择模型 (' + models.length + ' 个可用) --</option>';
          var curModel = document.getElementById("model").value.trim();
          models.forEach(function(m) {
            var opt = document.createElement("option");
            opt.value = m;
            opt.textContent = m;
            if (m === curModel) {
              opt.selected = true;
            }
            dropdown.appendChild(opt);
          });

          chipsBox.innerHTML = "";
          models.forEach(function(m) {
            var chip = document.createElement("button");
            chip.type = "button";
            chip.className = "model-item-chip" + (m === curModel ? " active" : "");
            chip.textContent = m;
            chip.onclick = function() {
              onModelDropdownSelected(m);
            };
            chipsBox.appendChild(chip);
          });

          countLabel.textContent = "已获取 " + models.length + " 个可用模型（点击直接选中）：";
          container.style.display = "block";
          showToast("🎉 成功获取到 " + models.length + " 个模型，请选择！");

          box.style.display = "block";
          box.innerText = ["已成功从 " + (res.endpoint || ep) + " 拉取到 " + models.length + " 个模型：", models.join(", ")].join(String.fromCharCode(10));
        })
        .catch(function(err) {
          showToast("拉取失败: " + err.message, true);
          box.style.display = "block";
          box.innerText = ["获取模型列表失败: " + err.message, "请检查 Endpoint 与 API Key 是否正确，或服务商是否支持 /models 端点。"].join(String.fromCharCode(10));
        })
        .finally(function() {
          isFetchingModels = false;
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = BTN_FETCH_DEFAULT_HTML;
          }
          if (btnBottom) {
            btnBottom.disabled = false;
            btnBottom.innerHTML = BTN_FETCH_BOTTOM_DEFAULT_HTML;
          }
        });
    }

    function onModelDropdownSelected(selectedVal) {
      if (!selectedVal) return;
      document.getElementById("model").value = selectedVal;
      var dd = document.getElementById("modelDropdown");
      if (dd) dd.value = selectedVal;
      var chips = document.querySelectorAll(".model-item-chip");
      chips.forEach(function(c) {
        if (c.textContent === selectedVal) c.classList.add("active");
        else c.classList.remove("active");
      });
      showToast("已选择模型: " + selectedVal);
    }

    function closeModelPicker(e) {
      if (e) e.preventDefault();
      document.getElementById("modelSelectContainer").style.display = "none";
      return false;
    }

    function resetConfig() {
      if (!confirm("确定要恢复默认配置并清除所有本地持久化参数吗？")) return;
      fetch("/sair/reset")
        .then(function(resp) { return resp.json(); })
        .then(function(json) {
          showToast("✅ 已恢复默认配置！正在刷新页面...");
          setTimeout(function() { location.reload(); }, 1000);
        })
        .catch(function(err) {
          showToast("重置失败: " + err, true);
        });
    }

    document.addEventListener("DOMContentLoaded", function() {
      var modelInput = document.getElementById("model");
      if (modelInput) {
        modelInput.addEventListener("input", function() {
          var val = this.value.trim();
          var dd = document.getElementById("modelDropdown");
          if (dd) dd.value = val;
          var chips = document.querySelectorAll(".model-item-chip");
          chips.forEach(function(c) {
            if (c.textContent === val) c.classList.add("active");
            else c.classList.remove("active");
          });
        });
      }
    });
  </script>
</body>
</html>`;
}

// =========================================================================
// 3. Request Extraction: Prompt & Multimodal Image Detection
// =========================================================================

function stripSiriTriggerWords(text) {
  if (!text || typeof text !== "string") return text;
  let str = text.trim();

  // 1. Chinese invocation prefix:
  // e.g. 问问千问、问一下千问、帮我问问千问、向千问提问、让千问回答、问千问
  const cnPrefix = /^(?:(?:请|帮我|麻烦)?(?:问问|问一下|问下|问|叫|让)(?:通义)?千问(?:帮我|一下|下|说|回答)?|(?:请|帮我|麻烦)?向(?:通义)?千问(?:提问|请教)?)[，,：:\s	]*/i;
  str = str.replace(cnPrefix, "").trim();

  // 2. English invocation prefix: e.g. "Ask Qwen, ...", "Ask Tongyi Qwen: ..."
  const enPrefix = /^(?:please\s+)?(?:ask|query)\s+(?:tongyi\s+)?qwen(?:[,\s:]+)/i;
  str = str.replace(enPrefix, "").trim();

  // 3. Chinese invocation suffix: e.g. "..., 问问千问", "..., 帮我问一下千问"
  const cnSuffix = /[，,：:\s\t]+(?:(?:请|帮我|麻烦)?(?:问问|问一下|问下|问)(?:通义)?千问(?:帮我|一下|下)?)$/i;
  str = str.replace(cnSuffix, "").trim();

  // 4. Fallback if the user ONLY said the trigger word (e.g. "问问千问")
  if (!str) {
    return "你好";
  }

  return str;
}

function extractPromptAndImage(reqBody) {
  let prompt = "";
  let imageUrl = "";
  let scenario = "general"; // "writing", "siri", "vision"

  if (!reqBody) return { prompt, imageUrl, scenario };

  try {
    const data = typeof reqBody === "string" ? JSON.parse(reqBody) : reqBody;

    // Scenario inference from configuration group ID
    const groupId = (data.configuration && data.configuration.response_configuration_group_id) || "";
    if (groupId.includes("visualIntelligence") || groupId.includes("Camera")) {
      scenario = "vision";
    } else if (groupId.includes("compose") || groupId.includes("selectedAndAllText")) {
      scenario = "writing";
    } else if (groupId.includes("siri") || groupId.includes("tqa")) {
      scenario = "siri";
    }

    // Recursive image detector
    function findImage(obj) {
      if (!obj) return "";
      if (typeof obj === "string") {
        if (obj.startsWith("data:image/")) return obj;
        if (/^https?:\/\/.+\.(png|jpe?g|webp|gif)/i.test(obj)) return obj;
        return "";
      }
      if (Array.isArray(obj)) {
        for (const item of obj) {
          const res = findImage(item);
          if (res) return res;
        }
        return "";
      }
      if (typeof obj === "object") {
        if (obj.image_url) {
          const u = typeof obj.image_url === "string" ? obj.image_url : obj.image_url.url;
          if (u) return u;
        }
        if (obj.input_image) {
          const u = typeof obj.input_image === "string" ? obj.input_image : (obj.input_image.url || obj.input_image.image_url);
          if (u) return u;
        }
        if (obj.image && typeof obj.image === "string") {
          return obj.image.startsWith("data:") ? obj.image : "data:image/jpeg;base64," + obj.image;
        }
        if (obj.data && typeof obj.data === "string" && (obj.data.startsWith("data:") || obj.mime_type)) {
          return obj.data.startsWith("data:") ? obj.data : `data:${obj.mime_type || "image/jpeg"};base64,${obj.data}`;
        }
        for (const k of Object.keys(obj)) {
          if (k === "client_tools" || k === "server_tools") continue;
          const res = findImage(obj[k]);
          if (res) return res;
        }
      }
      return "";
    }

    // Text prompt extraction
    if (Array.isArray(data.input)) {
      const texts = [];
      for (const item of data.input) {
        if (!item) continue;
        const msg = item.message || item;
        const content = msg.content;
        if (typeof content === "string" && content.trim()) {
          texts.push(content.trim());
        } else if (Array.isArray(content)) {
          for (const c of content) {
            if (typeof c === "string" && c.trim()) {
              texts.push(c.trim());
            } else if (c && typeof c === "object") {
              const t = c.text || c.input_text || c.value || "";
              if (t && typeof t === "string" && t.trim()) {
                texts.push(t.trim());
              }
            }
          }
        }
      }
      if (texts.length > 0) prompt = texts.join("\n\n");
    }

    imageUrl = findImage(data);
    if (imageUrl && scenario === "general") scenario = "vision";
  } catch (e) {
    const imgMatch = String(reqBody).match(/"(data:image\/[^"]+)"/);
    if (imgMatch) {
      imageUrl = imgMatch[1];
      scenario = "vision";
    }
  }

  // Fallback regex text match
  if (!prompt) {
    const matches = [...String(reqBody).matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
    if (matches.length > 0) {
      try {
        prompt = matches.map(m => JSON.parse("\"" + m[1] + "\"")).join("\n\n");
      } catch (e) {
        prompt = matches.map(m => m[1]).join("\n\n");
      }
    }
  }

  if (prompt && (scenario === "siri" || scenario === "general")) {
    prompt = stripSiriTriggerWords(prompt);
  }

  return { prompt: prompt.trim(), imageUrl, scenario };
}

// =========================================================================
// 4. Response SSE Rewriter & Schema Adaptive Formatter
// =========================================================================

function replaceStreamText(originalSseBody, replyText, userPrompt, scenario) {
  const isWritingTools = scenario === "writing" || originalSseBody.includes('"body":') || originalSseBody.includes('\\"body\\"');
  const isSiri = scenario === "siri" || scenario === "vision" || originalSseBody.includes('"content":') || originalSseBody.includes('\\"content\\"');

  let payloadString;
  if (isWritingTools) {
    // Writing Tools Schema: body + refinements
    let finalBody = replyText;
    let finalRefinements = [
      "增加更多细节描写与生动修辞",
      "优化语言节奏与整体结构",
      "精炼文本使其更具表现力"
    ];

    try {
      const cleanJson = replyText.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed && typeof parsed.body === "string") {
        finalBody = parsed.body;
        if (Array.isArray(parsed.refinements) && parsed.refinements.length > 0) {
          finalRefinements = parsed.refinements.map(String);
        }
      }
    } catch (e) {
      finalBody = replyText;
    }

    payloadString = JSON.stringify({
      body: finalBody.trim(),
      refinements: finalRefinements
    });
  } else if (isSiri) {
    // Siri QA & Visual Intelligence Schema: content + suggestions + summary
    let finalContent = replyText;
    let finalSuggestions = [
      "了解更多相关信息",
      "深入探讨",
      "相关背景推荐"
    ];
    let finalSummary = (userPrompt || (scenario === "vision" ? "视觉认知分析" : "智能问答")).slice(0, 20).trim();

    const summaryMatch = originalSseBody.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (summaryMatch) {
      try {
        finalSummary = JSON.parse("\"" + summaryMatch[1] + "\"");
      } catch (e) {
        finalSummary = summaryMatch[1];
      }
    }

    try {
      const cleanJson = replyText.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed && typeof parsed.content === "string") {
        finalContent = parsed.content;
        if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
          finalSuggestions = parsed.suggestions.map(String);
        }
        if (typeof parsed.summary === "string" && parsed.summary) {
          finalSummary = parsed.summary;
        }
      }
    } catch (e) {
      finalContent = replyText;
    }

    payloadString = JSON.stringify({
      content: finalContent.trim(),
      suggestions: finalSuggestions,
      summary: finalSummary
    });
  } else {
    payloadString = replyText.trim();
  }

  const lines = originalSseBody.split("\n");
  const newLines = [];
  let firstDeltaReplaced = false;

  const kDelta = "session.response.choices[].items[].message.content[].text.value.delta";
  const kDone = "session.response.choices[].items[].message.content[].text.value.done";
  const kContentDone = "session.response.choices[].items[].message.content[].done";
  const kItemsDone = "session.response.choices[].items[].done";
  const kChoicesCompleted = "session.response.choices[].completed";
  const kChoicesDone = "session.response.choices[].done";
  const kSessionDone = "session.response.done";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("data:") && line.includes("{")) {
      try {
        const jsonStr = line.slice(5).trim();
        const obj = JSON.parse(jsonStr);

        if (obj[kDelta]) {
          if (!firstDeltaReplaced) {
            obj[kDelta].delta = payloadString;
            firstDeltaReplaced = true;
          } else {
            obj[kDelta].delta = "";
          }
          newLines.push("data: " + JSON.stringify(obj));
          continue;
        }

        if (obj[kDone] && typeof obj[kDone].value !== "undefined") {
          obj[kDone].value = payloadString;
          newLines.push("data: " + JSON.stringify(obj));
          continue;
        }

        if (obj[kContentDone] && obj[kContentDone].content && obj[kContentDone].content.text) {
          obj[kContentDone].content.text.value = payloadString;
          newLines.push("data: " + JSON.stringify(obj));
          continue;
        }

        if (obj[kItemsDone] && obj[kItemsDone].item && obj[kItemsDone].item.message && Array.isArray(obj[kItemsDone].item.message.content) && obj[kItemsDone].item.message.content[0] && obj[kItemsDone].item.message.content[0].text) {
          obj[kItemsDone].item.message.content[0].text.value = payloadString;
          newLines.push("data: " + JSON.stringify(obj));
          continue;
        }

        if (obj[kChoicesCompleted] && obj[kChoicesCompleted].choice && Array.isArray(obj[kChoicesCompleted].choice.output) && obj[kChoicesCompleted].choice.output[0] && obj[kChoicesCompleted].choice.output[0].message && Array.isArray(obj[kChoicesCompleted].choice.output[0].message.content) && obj[kChoicesCompleted].choice.output[0].message.content[0].text) {
          obj[kChoicesCompleted].choice.output[0].message.content[0].text.value = payloadString;
          newLines.push("data: " + JSON.stringify(obj));
          continue;
        }

        if (obj[kChoicesDone] && obj[kChoicesDone].choice && Array.isArray(obj[kChoicesDone].choice.output) && obj[kChoicesDone].choice.output[0] && obj[kChoicesDone].choice.output[0].message && Array.isArray(obj[kChoicesDone].choice.output[0].message.content) && obj[kChoicesDone].choice.output[0].message.content[0].text) {
          obj[kChoicesDone].choice.output[0].message.content[0].text.value = payloadString;
          newLines.push("data: " + JSON.stringify(obj));
          continue;
        }

        if (obj[kSessionDone] && Array.isArray(obj[kSessionDone].choices) && obj[kSessionDone].choices[0] && Array.isArray(obj[kSessionDone].choices[0].output) && obj[kSessionDone].choices[0].output[0] && obj[kSessionDone].choices[0].output[0].message && Array.isArray(obj[kSessionDone].choices[0].output[0].message.content) && obj[kSessionDone].choices[0].output[0].message.content[0].text) {
          obj[kSessionDone].choices[0].output[0].message.content[0].text.value = payloadString;
          newLines.push("data: " + JSON.stringify(obj));
          continue;
        }
      } catch (e) {}
    }
    newLines.push(line);
  }
  return newLines.join("\n");
}

// =========================================================================
// 5. Main Execution Flow
// =========================================================================

(function main() {
  const config = getConfiguration();
  const reqUrl = getRequestUrl();

  // Check if this is an inspector / helper endpoint request
  if (handleInspectorRoute(reqUrl, config)) {
    return;
  }

  const isRequest = !isResponsePhase();

  // -----------------------------------------------------------------------
  // Phase 1: HTTP-REQUEST (Capture Prompt / Image & Cache)
  // -----------------------------------------------------------------------
  if (isRequest) {
    const reqBody = getRequestBody();
    const { prompt, imageUrl, scenario } = extractPromptAndImage(reqBody);

    if (prompt || imageUrl) {
      writePersistent(prompt, "SAIR_LATEST_PROMPT");
      writePersistent(scenario, "SAIR_LATEST_SCENARIO");
      if (imageUrl && imageUrl.length < 500000) {
        writePersistent(imageUrl, "SAIR_LATEST_IMAGE");
      }
      writePersistent(String(Date.now()), "SAIR_LATEST_TIME");

      const label = scenario === "vision" ? "[视觉智能]" : (scenario === "writing" ? "[写作工具]" : "[Siri问答]");
      notify(config, "SAIR 拦截成功", label, (prompt || (imageUrl ? "图像输入" : "")).slice(0, 40), false);
    } else {
      notify(config, "SAIR 请求提示", "未解析到有效 Prompt 或图像", (reqBody || "空请求体").slice(0, 40), false);
    }

    done({});
    return;
  }

  // -----------------------------------------------------------------------
  // Phase 2: HTTP-RESPONSE (Intercept Qwen Response & Route to Custom LLM)
  // -----------------------------------------------------------------------
  const realBody = getResponseBody();
  const reqBody = getRequestBody();

  // Resolve prompt, image, and scenario
  let { prompt, imageUrl, scenario } = extractPromptAndImage(reqBody);
  if (!prompt && !imageUrl) {
    const cachedPrompt = readPersistent("SAIR_LATEST_PROMPT") || "";
    const cachedImage = readPersistent("SAIR_LATEST_IMAGE") || "";
    const cachedScenario = readPersistent("SAIR_LATEST_SCENARIO") || "general";
    const promptTime = Number(readPersistent("SAIR_LATEST_TIME") || 0);
    if (Date.now() - promptTime < 60000) {
      prompt = cachedPrompt;
      imageUrl = cachedImage;
      scenario = cachedScenario;
    }
  }

  if (prompt && (scenario === "siri" || scenario === "general")) {
    prompt = stripSiriTriggerWords(prompt);
  }

  // Adaptive Timeout calculation based on scenario
  let targetTimeout = config.timeout_siri;
  if (scenario === "writing") targetTimeout = config.timeout_writing;
  else if (scenario === "vision" || imageUrl) targetTimeout = config.timeout_vision;

  let finished = false;
  let failsafeTimer = null;
  function finishWith(body, isError = false, errMsg = "") {
    if (failsafeTimer) {
      clearTimeout(failsafeTimer);
      failsafeTimer = null;
    }
    if (!finished) {
      finished = true;
      if (body) {
        done({ body: body });
      } else {
        // Fallback decision
        if (config.fallback) {
          if (isError) {
            notify(config, "SAIR 触发官方回退", errMsg || "请求失败或超时", "已自动放行官方千问回包", true);
          }
          done({});
        } else {
          notify(config, "SAIR 请求异常", errMsg || "自定义模型调用失败", "已按配置阻断请求 (未回退官方)", true);
          doneWithResponse({
            status: 504,
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({ error: errMsg || "Custom model gateway timeout/failure" })
          });
        }
      }
    }
  }

  // Failsafe timeout timer
  failsafeTimer = setTimeout(() => {
    finishWith(null, true, `网关超时 (${targetTimeout}s)`);
  }, (targetTimeout + 1) * 1000);

  if (!prompt && !imageUrl) {
    finishWith(null, true, "未能定位有效 Prompt 或图片载荷");
    return;
  }

  notify(config, "SAIR 正在转接", `模型: ${config.model}`, (prompt || "图像理解").slice(0, 30), false);

  // Build Multimodal or Text Messages
  let userContent;
  if (imageUrl) {
    userContent = [
      { type: "text", text: prompt || "请识别并详细分析图中内容，简明扼要地回答。" },
      { type: "image_url", image_url: { url: imageUrl } }
    ];
  } else {
    userContent = prompt;
  }

  // Adaptive Scenario-based System Prompt
  let systemPrompt = "";
  if (imageUrl || scenario === "vision") {
    systemPrompt = "你是由 Apple 智能 Siri 调用的视觉认知助手。请精准、简洁、口语化地识别图片并回答提问，重点突出，切勿多余开场白或客套话。";
  } else if (scenario === "writing") {
    systemPrompt = "你是由 Apple 智能调用的文本处理与写作助手。请根据用户的指令严格对提供的文本进行校对、重写、润色或总结，保持专业、严谨与准确。";
  } else {
    // scenario === "siri" or general
    const personaEnabled = config.siri_persona_enabled !== false;
    if (personaEnabled && config.siri_prompt && config.siri_prompt.trim()) {
      systemPrompt = config.siri_prompt.trim();
    } else {
      systemPrompt = "你是由 Apple 智能 Siri 调用的千问助手。请直接、高质量、口语化地回答用户指令，重点突出，切勿输出多余开场白或客套话。避免使用动作描写括号，以便语音自然播报。";
    }
  }

  const reqHeaders = { "Content-Type": "application/json" };
  if (config.api_key) {
    reqHeaders["Authorization"] = "Bearer " + config.api_key;
  }

  fetchHttp({
    method: "POST",
    url: config.endpoint,
    headers: reqHeaders,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      reasoning_effort: config.reasoning_effort,
      max_tokens: config.max_tokens,
      temperature: 0.7
    }),
    timeout: targetTimeout
  }, function(error, response, data) {
    if (error || !data) {
      finishWith(null, true, `上游网关连接失败: ${error || "空响应"}`);
      return;
    }

    try {
      const resObj = JSON.parse(data);
      if (resObj.error) {
        finishWith(null, true, `模型返回错误: ${resObj.error.message || JSON.stringify(resObj.error)}`);
        return;
      }

      let replyText = "";
      if (resObj.choices && resObj.choices[0] && resObj.choices[0].message) {
        replyText = resObj.choices[0].message.content;
      } else {
        replyText = typeof data === "string" ? data : JSON.stringify(resObj);
      }

      notify(config, "SAIR 生成完成", `模型: ${config.model}`, replyText.slice(0, 40) + "...", false);

      const modifiedBody = replaceStreamText(realBody, replyText, prompt, scenario);
      finishWith(modifiedBody);
    } catch (e) {
      finishWith(null, true, `回包结构注入异常: ${String(e)}`);
    }
  });
})();
