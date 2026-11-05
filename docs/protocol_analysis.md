# Apple Intelligence (China Mainland) Protocol Analysis

This document details the reverse-engineered network protocol, endpoint architecture, and data contracts of Apple Intelligence (iOS 27.3 Beta) with the Qwen (通义千问) extension.

---

## 1. Network Topology & Direct Cloud Architecture

Contrary to Apple's Private Cloud Compute (PCC) model used for first-party foundation models, third-party model extensions in China mainland operate via a **direct client-to-cloud HTTPS connection**:

```
+----------------+      1. Intent & Ticket      +-----------------------+
|  Apple Device  | ---------------------------> | Apple Dispatch Cloud  |
|  (iOS 27.3)    |                              | (petropluvialis/siri) |
+----------------+                              +-----------------------+
        |
        | 2. Direct TLS Handshake & Realtime Session
        v
+-------------------------------+
| Alibaba Cloud Hangzhou        |
| (prod-yabuli.qianwen.com:443) |
+-------------------------------+
```

### Key Network Characteristics
* **Endpoint**: `https://prod-yabuli.qianwen.com/v1/sessions/responses`
* **Transport**: HTTPS (HTTP/1.1 & HTTP/2 over TLS 1.3).
* **SSL Pinning**: **None detected**. Standard iOS system certificate trust store is honored, allowing transparent Surge MITM decryption.
* **Payload Format**: `application/json` (Request) and `text/event-stream; charset=utf-8` (Response).

---

## 2. Realtime SSE Hierarchy (27 Discrete Events)

Apple Intelligence expects an OpenAI Realtime Session-compatible hierarchical Server-Sent Events (SSE) stream:

```
event: session.created
data: {"type":"session.created","session.created":{"id":"sess_...","expires_at":...}}

event: session.response.created
data: {"type":"session.response.created","session.response.created":{"id":"resp_...","model":"qwenapp-apple-tqa"}}

event: session.response.choices[].added
data: {"type":"session.response.choices[].added",...}

event: session.response.choices[].items[].added
data: {"type":"session.response.choices[].items[].added","session.response.choices[].items[].added":{"choice_index":0,"item":{"type":"message","message":{"role":"assistant","content":[]}}}}

event: session.response.choices[].items[].message.content[].added
data: {"type":"session.response.choices[].items[].message.content[].added",...}

event: session.response.choices[].items[].message.content[].text.value.delta
data: {"type":"session.response.choices[].items[].message.content[].text.value.delta","session.response.choices[].items[].message.content[].text.value.delta":{"delta":"..."}}

... (additional delta chunks) ...

event: session.response.choices[].items[].message.content[].text.value.done
data: {"type":"session.response.choices[].items[].message.content[].text.value.done","session.response.choices[].items[].message.content[].text.value.done":{"value":"..."}}

event: session.response.choices[].items[].message.content[].done
data: {"type":"session.response.choices[].items[].message.content[].done",...}

event: session.response.choices[].items[].done
data: {"type":"session.response.choices[].items[].done",...}

event: session.response.choices[].completed
data: {"type":"session.response.choices[].completed",...}

event: session.response.choices[].done
data: {"type":"session.response.choices[].done",...}

event: session.response.done
data: {"type":"session.response.done",...}
```

---

## 3. Scenario-Specific Payload Schemas

iOS Apple Intelligence strictly validates the JSON schema inside `text.value.delta` depending on the interaction context:

### A. Writing Tools (`compose_selectedAndAllText`)
Expected JSON inside the SSE stream:
```json
{
  "body": "The rewritten or newly generated text content...",
  "refinements": [
    "Make it more poetic and expressive",
    "Adjust pacing and rhythm",
    "Add sensory descriptions"
  ]
}
```
*Note: If `refinements` array is omitted or named `suggestions`, iOS Writing Tools immediately aborts with "Cannot Compose / Feature unavailable".*

### B. Siri QA (`siri.tqa`)
Expected JSON inside the SSE stream:
```json
{
  "content": "The concise conversational answer to the user's query...",
  "suggestions": [
    "Learn more about this topic",
    "Related background information",
    "Step-by-step instructions"
  ],
  "summary": "Short title of the query"
}
```
*Latency note: Siri has a strict 6–8 second client-side response timeout.*

### C. Visual Intelligence (`siri.visualIntelligenceCamera`)
The request includes a base64 encoded JPEG in `input`:
```json
{
  "configuration": {
    "response_configuration_group_id": "siri.visualIntelligenceCamera"
  },
  "input": [
    {
      "message": {
        "content": [
          {
            "type": "image_url",
            "image_url": {
              "url": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
            }
          }
        ]
      }
    }
  ]
}
```
The response adheres to the Siri QA structure with visual identification findings.
