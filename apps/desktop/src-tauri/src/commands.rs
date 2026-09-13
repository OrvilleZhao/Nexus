use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentStatus {
    pub core: bool,
    pub bridge: bool,
    pub memory: bool,
    pub pdp: String,
}

#[tauri::command]
pub fn get_status() -> AgentStatus {
    AgentStatus {
        core: true,
        bridge: true,
        memory: true,
        pdp: "MockPdp".into(),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub api_type: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f64>,
}

#[tauri::command]
pub async fn chat_completion(request: ChatRequest) -> Result<String, String> {
    let client = reqwest::Client::new();
    match request.api_type.as_str() {
        "anthropic" => chat_anthropic(&client, &request).await,
        _ => chat_openai(&client, &request).await,
    }
}

#[tauri::command]
pub async fn test_provider(
    base_url: String,
    api_key: String,
    model: String,
    api_type: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = match api_type.as_str() {
        "anthropic" => format!("{}/v1/models", base_url.trim_end_matches('/')),
        _ => format!("{}/models", base_url.trim_end_matches('/')),
    };
    let resp = client
        .get(&url)
        .bearer_auth(&api_key)
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;
    let status = resp.status();
    if status.is_success() {
        Ok(format!("Connected — {model} endpoint reachable"))
    } else {
        let body = resp.text().await.unwrap_or_default();
        Err(format!("HTTP {status}: {body}"))
    }
}

async fn chat_openai(client: &reqwest::Client, r: &ChatRequest) -> Result<String, String> {
    let url = format!("{}/chat/completions", r.base_url.trim_end_matches('/'));
    let messages: Vec<serde_json::Value> = r
        .messages
        .iter()
        .map(|m| serde_json::json!({ "role": m.role, "content": m.content }))
        .collect();
    let body = serde_json::json!({
        "model": r.model,
        "messages": messages,
        "temperature": r.temperature.unwrap_or(0.7),
    });
    let resp = client
        .post(&url)
        .bearer_auth(&r.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;
    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("read body failed: {e}"))?;
    if !status.is_success() {
        return Err(format!("HTTP {status}: {text}"));
    }
    let v: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("invalid JSON: {e}"))?;
    v["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| format!("unexpected response shape: {text}"))
}

async fn chat_anthropic(client: &reqwest::Client, r: &ChatRequest) -> Result<String, String> {
    let url = format!("{}/v1/messages", r.base_url.trim_end_matches('/'));
    let system: Vec<&str> = r
        .messages
        .iter()
        .filter(|m| m.role == "system")
        .map(|m| m.content.as_str())
        .collect();
    let messages: Vec<serde_json::Value> = r
        .messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| serde_json::json!({ "role": m.role, "content": m.content }))
        .collect();
    let mut body = serde_json::json!({
        "model": r.model,
        "max_tokens": 4096,
        "messages": messages,
    });
    if !system.is_empty() {
        body["system"] = serde_json::json!(system.join("\n\n"));
    }
    let resp = client
        .post(&url)
        .header("x-api-key", &r.api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;
    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("read body failed: {e}"))?;
    if !status.is_success() {
        return Err(format!("HTTP {status}: {text}"));
    }
    let v: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("invalid JSON: {e}"))?;
    let mut out = String::new();
    if let Some(blocks) = v["content"].as_array() {
        for b in blocks {
            if b["type"] == "text" {
                if let Some(t) = b["text"].as_str() {
                    out.push_str(t);
                }
            }
        }
    }
    if out.is_empty() {
        return Err(format!("unexpected response shape: {text}"));
    }
    Ok(out)
}
