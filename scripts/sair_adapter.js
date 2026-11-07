/**
 * SAIR (Siri-ously AI Router)
 * Universal Multi-Client Adapter Script for Apple Intelligence (iOS 27.3+)
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
      result[key] = decodeURIComponent(rawValue);
    } catch (e) {
      result[key] = rawValue;
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
    max_tokens: 400
  };

  const argumentMap = getArgumentMap();
  if (argumentMap.endpoint) defaults.endpoint = String(argumentMap.endpoint);
  if (argumentMap.api_key) defaults.api_key = String(argumentMap.api_key);
  if (argumentMap.model) defaults.model = String(argumentMap.model);
  if (argumentMap.notify) defaults.notify = String(argumentMap.notify).toLowerCase();
  if (argumentMap.fallback !== undefined && argumentMap.fallback !== null && argumentMap.fallback !== "") {
    const fallbackValue = String(argumentMap.fallback).toLowerCase();
    defaults.fallback = fallbackValue === "true" || fallbackValue === "1";
  }
  if (argumentMap.timeout_writing !== undefined && argumentMap.timeout_writing !== "") {
    defaults.timeout_writing = parseInt(argumentMap.timeout_writing, 10) || 15;
  }
  if (argumentMap.timeout_siri !== undefined && argumentMap.timeout_siri !== "") {
    defaults.timeout_siri = parseInt(argumentMap.timeout_siri, 10) || 7;
  }
  if (argumentMap.timeout_vision !== undefined && argumentMap.timeout_vision !== "") {
    defaults.timeout_vision = parseInt(argumentMap.timeout_vision, 10) || 10;
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
    const fallbackValue = String(psFallback).toLowerCase();
    defaults.fallback = fallbackValue === "true" || fallbackValue === "1";
  }
  const psTimeoutSiri = readPersistent("SAIR_TIMEOUT_SIRI");
  if (psTimeoutSiri) defaults.timeout_siri = parseInt(psTimeoutSiri, 10) || 7;
  const psTimeoutWriting = readPersistent("SAIR_TIMEOUT_WRITING");
  if (psTimeoutWriting) defaults.timeout_writing = parseInt(psTimeoutWriting, 10) || 15;
  const psTimeoutVision = readPersistent("SAIR_TIMEOUT_VISION");
  if (psTimeoutVision) defaults.timeout_vision = parseInt(psTimeoutVision, 10) || 10;

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
      result[key] = decodeURIComponent(rawValue);
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

  // Route: /sair/models -> fetch models from configured provider
  if (url.includes("/sair/models")) {
    const modelsUrl = config.endpoint.replace(/\/chat\/completions\/?$/, "/models");
    fetchHttp({
      method: "GET",
      url: modelsUrl,
      headers: {
        "Authorization": config.api_key ? "Bearer " + config.api_key : "",
        "Content-Type": "application/json"
      },
      timeout: 10
    }, function(err, resp, data) {
      if (err || !data) {
        doneWithResponse({
          status: 502,
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ error: "Failed to connect to provider /models", details: String(err) })
        });
        return;
      }
      doneWithResponse({
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
        body: data
      });
    });
    return true;
  }

  // Route: /sair/reset -> clear persistent configuration back to module defaults
  if (url.includes("/sair/reset")) {
    const keys = [
      "SAIR_ENDPOINT", "SAIR_API_KEY", "SAIR_MODEL", "SAIR_NOTIFY",
      "SAIR_FALLBACK", "SAIR_TIMEOUT_SIRI", "SAIR_TIMEOUT_WRITING", "SAIR_TIMEOUT_VISION"
    ];
    for (const k of keys) {
      writePersistent("", k);
    }
    doneWithResponse({
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        project: "SAIR (Siri-ously AI Router)",
        version: "1.1.0",
        client_runtime: detectClient(),
        message: "All persistent settings have been reset to module defaults.",
        timestamp: new Date().toISOString()
      }, null, 2)
    });
    return true;
  }

  // Route: /sair/config or /sair/status -> inspect or dynamically update configuration
  if (url.includes("/sair/config") || url.includes("/sair/status")) {
    let updateNotice = null;
    const query = parseUrlQuery(url);

    if (Object.keys(query).length > 0) {
      const updatedKeys = [];
      if (query.endpoint) { writePersistent(query.endpoint, "SAIR_ENDPOINT"); updatedKeys.push("endpoint"); }
      if (query.api_key !== undefined) { writePersistent(query.api_key, "SAIR_API_KEY"); updatedKeys.push("api_key"); }
      if (query.model) { writePersistent(query.model, "SAIR_MODEL"); updatedKeys.push("model"); }
      if (query.notify) { writePersistent(query.notify, "SAIR_NOTIFY"); updatedKeys.push("notify"); }
      if (query.fallback !== undefined) { writePersistent(query.fallback, "SAIR_FALLBACK"); updatedKeys.push("fallback"); }
      if (query.timeout_siri) { writePersistent(query.timeout_siri, "SAIR_TIMEOUT_SIRI"); updatedKeys.push("timeout_siri"); }
      if (query.timeout_writing) { writePersistent(query.timeout_writing, "SAIR_TIMEOUT_WRITING"); updatedKeys.push("timeout_writing"); }
      if (query.timeout_vision) { writePersistent(query.timeout_vision, "SAIR_TIMEOUT_VISION"); updatedKeys.push("timeout_vision"); }

      if (updatedKeys.length > 0) {
        updateNotice = `Updated configuration keys via URL: ${updatedKeys.join(", ")}`;
      }
    }

    const activeConfig = getConfiguration();
    const safeConfig = Object.assign({}, activeConfig, {
      api_key: activeConfig.api_key ? (activeConfig.api_key.slice(0, 4) + "••••••••" + activeConfig.api_key.slice(-4)) : "(none)"
    });

    const responsePayload = {
      project: "SAIR (Siri-ously AI Router)",
      version: "1.1.0",
      client_runtime: detectClient(),
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

// =========================================================================
// 3. Request Extraction: Prompt & Multimodal Image Detection
// =========================================================================

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

  const systemPrompt = imageUrl
    ? "你是由 Apple 智能 Siri 调用的视觉认知助手。请精准、简洁、口语化地识别图片并回答提问，重点突出，切勿多余开场白或客套话。"
    : "你是由 Apple 智能 Siri 调用的千问助手。请直接、高质量、口语化地回答用户指令，重点突出，切勿输出多余开场白或客套话。";

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
