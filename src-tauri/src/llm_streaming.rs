use futures_util::StreamExt;
use reqwest;
use serde_json;
use std::collections::HashMap;
use tauri::{Emitter, Window};

/// Stream an OpenAI-compatible chat completion request
pub async fn stream_openai_compatible(
    window: &Window,
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: Vec<serde_json::Value>,
    tools: Option<Vec<serde_json::Value>>,
    temperature: f32,
    max_tokens: Option<u32>,
    stream_id: &str,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    let mut body = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": true,
    });

    if let Some(tools) = tools {
        body["tools"] = serde_json::json!(tools);
    }

    if let Some(max_tokens) = max_tokens {
        body["max_tokens"] = serde_json::json!(max_tokens);
    }

    let response = client
        .post(format!("{}/chat/completions", base_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, error_text));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut full_content = String::new();
    let mut tool_calls: Vec<serde_json::Value> = Vec::new();
    let mut tool_calls_map: HashMap<usize, serde_json::Value> = HashMap::new();

    window
        .emit(&format!("streaming_start_{}", stream_id), ())
        .map_err(|e| format!("Failed to emit streaming_start: {}", e))?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process complete lines
        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() || !line.starts_with("data: ") {
                continue;
            }

            let data = &line[6..];
            if data == "[DONE]" {
                break;
            }

            let json: serde_json::Value = match serde_json::from_str(data) {
                Ok(j) => j,
                Err(_) => continue, // Skip malformed JSON
            };

            if let Some(choices) = json["choices"].as_array() {
                for choice in choices {
                    let delta = &choice["delta"];

                    // Handle content
                    if let Some(content) = delta["content"].as_str() {
                        full_content.push_str(content);
                        window
                            .emit(
                                &format!("streaming_chunk_{}", stream_id),
                                serde_json::json!({
                                    "chunk": content,
                                    "full_content": full_content
                                }),
                            )
                            .map_err(|e| format!("Failed to emit streaming_chunk: {}", e))?;
                    }

                    // Handle tool calls
                    if let Some(tool_calls_delta) = delta["tool_calls"].as_array() {
                        for tc in tool_calls_delta {
                            let index = tc["index"].as_u64().unwrap_or(0) as usize;

                            if !tool_calls_map.contains_key(&index) {
                                tool_calls_map.insert(
                                    index,
                                    serde_json::json!({
                                        "id": tc["id"].as_str().unwrap_or(""),
                                        "type": "function",
                                        "function": {
                                            "name": tc["function"]["name"].as_str().unwrap_or(""),
                                            "arguments": tc["function"]["arguments"].as_str().unwrap_or("")
                                        }
                                    }),
                                );
                            } else {
                                let existing = tool_calls_map.get_mut(&index).unwrap();
                                if let Some(name) = tc["function"]["name"].as_str() {
                                    existing["function"]["name"] = serde_json::json!(name);
                                }
                                if let Some(args) = tc["function"]["arguments"].as_str() {
                                    let current_args =
                                        existing["function"]["arguments"].as_str().unwrap_or("");
                                    existing["function"]["arguments"] =
                                        serde_json::json!(format!("{}{}", current_args, args));
                                }
                                if let Some(id) = tc["id"].as_str() {
                                    existing["id"] = serde_json::json!(id);
                                }
                            }
                        }
                    }

                    // Handle finish_reason
                    if let Some(finish_reason) = choice["finish_reason"].as_str() {
                        if finish_reason == "tool_calls" {
                            tool_calls = tool_calls_map.values().cloned().collect();
                        }
                    }
                }
            }
        }
    }

    // Emit tool calls if present
    if !tool_calls.is_empty() {
        window
            .emit(
                &format!("streaming_tool_calls_{}", stream_id),
                serde_json::json!({
                    "tool_calls": tool_calls
                }),
            )
            .map_err(|e| format!("Failed to emit streaming_tool_calls: {}", e))?;
    }

    window
        .emit(&format!("streaming_complete_{}", stream_id), ())
        .map_err(|e| format!("Failed to emit streaming_complete: {}", e))?;

    Ok(())
}

/// Stream an Anthropic chat completion request
pub async fn stream_anthropic(
    window: &Window,
    api_key: &str,
    model: &str,
    messages: Vec<serde_json::Value>,
    tools: Option<Vec<serde_json::Value>>,
    temperature: f32,
    max_tokens: Option<u32>,
    stream_id: &str,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    // Convert OpenAI message format to Anthropic format
    let mut anthropic_messages: Vec<serde_json::Value> = Vec::new();
    let mut system_message: Option<String> = None;

    for msg in messages {
        if msg["role"] == "system" {
            system_message = msg["content"].as_str().map(|s| s.to_string());
        } else if msg["role"] != "tool" {
            anthropic_messages.push(serde_json::json!({
                "role": msg["role"],
                "content": msg["content"]
            }));
        }
    }

    let mut body = serde_json::json!({
        "model": model,
        "messages": anthropic_messages,
        "temperature": temperature,
        "max_tokens": max_tokens.unwrap_or(4096),
        "stream": true,
    });

    if let Some(system) = system_message {
        body["system"] = serde_json::json!(system);
    }

    if let Some(tools) = tools {
        // Convert OpenAI tool format to Anthropic format
        let anthropic_tools: Vec<serde_json::Value> = tools
            .iter()
            .map(|t| {
                serde_json::json!({
                    "name": t["function"]["name"],
                    "description": t["function"]["description"],
                    "input_schema": t["function"]["parameters"]
                })
            })
            .collect();
        body["tools"] = serde_json::json!(anthropic_tools);
    }

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, error_text));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut full_content = String::new();
    let mut tool_calls: Vec<serde_json::Value> = Vec::new();

    window
        .emit(&format!("streaming_start_{}", stream_id), ())
        .map_err(|e| format!("Failed to emit streaming_start: {}", e))?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() || !line.starts_with("data: ") {
                continue;
            }

            let data = &line[6..];
            if data == "[DONE]" {
                break;
            }

            let json: serde_json::Value = match serde_json::from_str(data) {
                Ok(j) => j,
                Err(_) => continue,
            };

            // Handle content delta
            if json["type"] == "content_block_delta" {
                if let Some(text) = json["delta"]["text"].as_str() {
                    full_content.push_str(text);
                    window
                        .emit(
                            &format!("streaming_chunk_{}", stream_id),
                            serde_json::json!({
                                "chunk": text,
                                "full_content": full_content
                            }),
                        )
                        .map_err(|e| format!("Failed to emit streaming_chunk: {}", e))?;
                }
            }

            // Handle tool use
            if json["type"] == "content_block_start" {
                if json["content_block"]["type"] == "tool_use" {
                    let tool_use = &json["content_block"];
                    tool_calls.push(serde_json::json!({
                        "id": tool_use["id"],
                        "type": "function",
                        "function": {
                            "name": tool_use["name"],
                            "arguments": serde_json::to_string(&tool_use["input"]).unwrap_or_default()
                        }
                    }));
                }
            }
        }
    }

    if !tool_calls.is_empty() {
        window
            .emit(
                &format!("streaming_tool_calls_{}", stream_id),
                serde_json::json!({
                    "tool_calls": tool_calls
                }),
            )
            .map_err(|e| format!("Failed to emit streaming_tool_calls: {}", e))?;
    }

    window
        .emit(&format!("streaming_complete_{}", stream_id), ())
        .map_err(|e| format!("Failed to emit streaming_complete: {}", e))?;

    Ok(())
}

/// Stream a Google Gemini chat completion request
pub async fn stream_google(
    window: &Window,
    api_key: &str,
    model: &str,
    messages: Vec<serde_json::Value>,
    tools: Option<Vec<serde_json::Value>>,
    temperature: f32,
    stream_id: &str,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    // Convert messages to Google format
    let mut google_contents: Vec<serde_json::Value> = Vec::new();
    let mut system_instruction: Option<String> = None;

    for msg in messages {
        if msg["role"] == "system" {
            system_instruction = msg["content"].as_str().map(|s| s.to_string());
        } else if msg["role"] == "user" {
            google_contents.push(serde_json::json!({
                "role": "user",
                "parts": [{"text": msg["content"]}]
            }));
        } else if msg["role"] == "assistant" {
            google_contents.push(serde_json::json!({
                "role": "model",
                "parts": [{"text": msg["content"]}]
            }));
        }
    }

    let mut body = serde_json::json!({
        "contents": google_contents,
        "generationConfig": {
            "temperature": temperature,
        }
    });

    if let Some(system) = system_instruction {
        body["systemInstruction"] = serde_json::json!({
            "parts": [{"text": system}]
        });
    }

    if let Some(tools) = tools {
        let google_tools: Vec<serde_json::Value> = tools
            .iter()
            .map(|t| {
                serde_json::json!({
                    "name": t["function"]["name"],
                    "description": t["function"]["description"],
                    "parameters": t["function"]["parameters"]
                })
            })
            .collect();
        body["tools"] = serde_json::json!([{
            "functionDeclarations": google_tools
        }]);
    }

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?key={}",
        model, api_key
    );

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, error_text));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut full_content = String::new();
    let mut tool_calls: Vec<serde_json::Value> = Vec::new();

    window
        .emit(&format!("streaming_start_{}", stream_id), ())
        .map_err(|e| format!("Failed to emit streaming_start: {}", e))?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            let json: serde_json::Value = match serde_json::from_str(&line) {
                Ok(j) => j,
                Err(_) => continue,
            };

            if let Some(candidates) = json["candidates"].as_array() {
                for candidate in candidates {
                    if let Some(content) = candidate["content"].as_object() {
                        if let Some(parts) = content["parts"].as_array() {
                            for part in parts {
                                // Handle text content
                                if let Some(text) = part["text"].as_str() {
                                    full_content.push_str(text);
                                    window
                                        .emit(
                                            &format!("streaming_chunk_{}", stream_id),
                                            serde_json::json!({
                                                "chunk": text,
                                                "full_content": full_content
                                            }),
                                        )
                                        .map_err(|e| format!("Failed to emit streaming_chunk: {}", e))?;
                                }

                                // Handle function calls
                                if let Some(function_call) = part["functionCall"].as_object() {
                                    tool_calls.push(serde_json::json!({
                                        "id": format!("google-{}", tool_calls.len()),
                                        "type": "function",
                                        "function": {
                                            "name": function_call["name"],
                                            "arguments": serde_json::to_string(&function_call["args"]).unwrap_or_default()
                                        }
                                    }));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if !tool_calls.is_empty() {
        window
            .emit(
                &format!("streaming_tool_calls_{}", stream_id),
                serde_json::json!({
                    "tool_calls": tool_calls
                }),
            )
            .map_err(|e| format!("Failed to emit streaming_tool_calls: {}", e))?;
    }

    window
        .emit(&format!("streaming_complete_{}", stream_id), ())
        .map_err(|e| format!("Failed to emit streaming_complete: {}", e))?;

    Ok(())
}

/// Get default base URL for a provider
pub fn get_default_base_url(provider: &str) -> String {
    match provider {
        "openai" => "https://api.openai.com/v1".to_string(),
        "deepseek" => "https://api.deepseek.com/v1".to_string(),
        "mistral" => "https://api.mistral.ai/v1".to_string(),
        "lmstudio" => "http://localhost:1234/v1".to_string(),
        "kimi" => "https://api.moonshot.cn/v1".to_string(),
        "openrouter" => "https://openrouter.ai/api/v1".to_string(),
        "together" => "https://api.together.xyz/v1".to_string(),
        "groq" => "https://api.groq.com/openai/v1".to_string(),
        "perplexity" => "https://api.perplexity.ai".to_string(),
        "ollama" => "http://localhost:11434/v1".to_string(),
        _ => "https://api.openai.com/v1".to_string(),
    }
}
