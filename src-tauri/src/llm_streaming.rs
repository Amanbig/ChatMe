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
    let mut pending_tool_results: Vec<serde_json::Value> = Vec::new();

    for msg in &messages {
        if msg["role"] == "system" {
            system_message = msg["content"].as_str().map(|s| s.to_string());
        } else if msg["role"] == "user" {
            // If we have pending tool results, add them as a user message first
            if !pending_tool_results.is_empty() {
                anthropic_messages.push(serde_json::json!({
                    "role": "user",
                    "content": pending_tool_results.clone()
                }));
                pending_tool_results.clear();
            }

            // Handle multimodal content
            if msg["content"].is_array() {
                anthropic_messages.push(serde_json::json!({
                    "role": "user",
                    "content": msg["content"]
                }));
            } else {
                anthropic_messages.push(serde_json::json!({
                    "role": "user",
                    "content": msg["content"]
                }));
            }
        } else if msg["role"] == "assistant" {
            // If we have pending tool results, add them as a user message first
            if !pending_tool_results.is_empty() {
                anthropic_messages.push(serde_json::json!({
                    "role": "user",
                    "content": pending_tool_results.clone()
                }));
                pending_tool_results.clear();
            }

            // Check if this assistant message has tool_calls
            if let Some(tool_calls) = msg["tool_calls"].as_array() {
                // Convert to Anthropic format with tool_use content blocks
                let mut content_blocks: Vec<serde_json::Value> = Vec::new();

                // Add text content if present
                if let Some(text) = msg["content"].as_str() {
                    if !text.is_empty() {
                        content_blocks.push(serde_json::json!({
                            "type": "text",
                            "text": text
                        }));
                    }
                }

                // Add tool_use blocks
                for tc in tool_calls {
                    let args_str = tc["function"]["arguments"].as_str().unwrap_or("{}");
                    let args: serde_json::Value = serde_json::from_str(args_str).unwrap_or(serde_json::json!({}));

                    content_blocks.push(serde_json::json!({
                        "type": "tool_use",
                        "id": tc["id"],
                        "name": tc["function"]["name"],
                        "input": args
                    }));
                }

                anthropic_messages.push(serde_json::json!({
                    "role": "assistant",
                    "content": content_blocks
                }));
            } else {
                // Regular assistant message
                anthropic_messages.push(serde_json::json!({
                    "role": "assistant",
                    "content": msg["content"]
                }));
            }
        } else if msg["role"] == "tool" {
            // Collect tool results to send as a user message with tool_result content blocks
            let tool_call_id = msg["tool_call_id"].as_str().unwrap_or("");
            let content = if msg["content"].is_string() {
                msg["content"].as_str().unwrap_or("").to_string()
            } else {
                serde_json::to_string(&msg["content"]).unwrap_or_default()
            };

            pending_tool_results.push(serde_json::json!({
                "type": "tool_result",
                "tool_use_id": tool_call_id,
                "content": content
            }));
        }
    }

    // Add any remaining tool results
    if !pending_tool_results.is_empty() {
        anthropic_messages.push(serde_json::json!({
            "role": "user",
            "content": pending_tool_results
        }));
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
    // Track current tool use being streamed (index -> (id, name, accumulated_input))
    let mut current_tool_uses: HashMap<usize, (String, String, String)> = HashMap::new();

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

            // Handle content delta (text)
            if json["type"] == "content_block_delta" {
                let index = json["index"].as_u64().unwrap_or(0) as usize;

                // Text delta
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

                // Input JSON delta for tool use
                if let Some(partial_json) = json["delta"]["partial_json"].as_str() {
                    if let Some((_, _, ref mut accumulated)) = current_tool_uses.get_mut(&index) {
                        accumulated.push_str(partial_json);
                    }
                }
            }

            // Handle tool use start
            if json["type"] == "content_block_start" {
                let index = json["index"].as_u64().unwrap_or(0) as usize;
                if json["content_block"]["type"] == "tool_use" {
                    let tool_use = &json["content_block"];
                    let id = tool_use["id"].as_str().unwrap_or("").to_string();
                    let name = tool_use["name"].as_str().unwrap_or("").to_string();
                    current_tool_uses.insert(index, (id, name, String::new()));
                }
            }

            // Handle content block stop - finalize tool use
            if json["type"] == "content_block_stop" {
                let index = json["index"].as_u64().unwrap_or(0) as usize;
                if let Some((id, name, accumulated_input)) = current_tool_uses.remove(&index) {
                    // Only add if we have a valid tool (has id and name)
                    if !id.is_empty() && !name.is_empty() {
                        tool_calls.push(serde_json::json!({
                            "id": id,
                            "type": "function",
                            "function": {
                                "name": name,
                                "arguments": if accumulated_input.is_empty() { "{}".to_string() } else { accumulated_input }
                            }
                        }));
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
    let mut pending_function_responses: Vec<serde_json::Value> = Vec::new();

    for msg in &messages {
        if msg["role"] == "system" {
            system_instruction = msg["content"].as_str().map(|s| s.to_string());
        } else if msg["role"] == "user" {
            // If we have pending function responses, add them first
            if !pending_function_responses.is_empty() {
                google_contents.push(serde_json::json!({
                    "role": "user",
                    "parts": pending_function_responses.clone()
                }));
                pending_function_responses.clear();
            }

            // Handle multimodal content
            if msg["content"].is_array() {
                google_contents.push(serde_json::json!({
                    "role": "user",
                    "parts": msg["content"]
                }));
            } else {
                google_contents.push(serde_json::json!({
                    "role": "user",
                    "parts": [{"text": msg["content"]}]
                }));
            }
        } else if msg["role"] == "assistant" {
            // If we have pending function responses, add them first
            if !pending_function_responses.is_empty() {
                google_contents.push(serde_json::json!({
                    "role": "user",
                    "parts": pending_function_responses.clone()
                }));
                pending_function_responses.clear();
            }

            // Check if this assistant message has tool_calls
            if let Some(tool_calls) = msg["tool_calls"].as_array() {
                let mut parts: Vec<serde_json::Value> = Vec::new();

                // Add text content if present
                if let Some(text) = msg["content"].as_str() {
                    if !text.is_empty() {
                        parts.push(serde_json::json!({"text": text}));
                    }
                }

                // Add functionCall parts
                for tc in tool_calls {
                    let args_str = tc["function"]["arguments"].as_str().unwrap_or("{}");
                    let args: serde_json::Value = serde_json::from_str(args_str).unwrap_or(serde_json::json!({}));

                    parts.push(serde_json::json!({
                        "functionCall": {
                            "name": tc["function"]["name"],
                            "args": args
                        }
                    }));
                }

                google_contents.push(serde_json::json!({
                    "role": "model",
                    "parts": parts
                }));
            } else {
                // Regular assistant message
                google_contents.push(serde_json::json!({
                    "role": "model",
                    "parts": [{"text": msg["content"]}]
                }));
            }
        } else if msg["role"] == "tool" {
            // Collect function responses to send as a user message
            let tool_name = msg["name"].as_str().unwrap_or("");
            let content = if msg["content"].is_string() {
                serde_json::from_str(msg["content"].as_str().unwrap_or("{}")).unwrap_or(serde_json::json!({}))
            } else {
                msg["content"].clone()
            };

            pending_function_responses.push(serde_json::json!({
                "functionResponse": {
                    "name": tool_name,
                    "response": content
                }
            }));
        }
    }

    // Add any remaining function responses
    if !pending_function_responses.is_empty() {
        google_contents.push(serde_json::json!({
            "role": "user",
            "parts": pending_function_responses
        }));
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
