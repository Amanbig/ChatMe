use anyhow::Result;
use chrono::Utc;
use sqlx::{migrate::MigrateDatabase, Pool, Sqlite, SqlitePool, Row};
use std::path::PathBuf;
use uuid::Uuid;
use reqwest::Client;
use serde_json::json;
use tauri::Emitter;

use crate::models::*;

pub struct Database {
    pool: Pool<Sqlite>,
}

impl Database {
    pub async fn new() -> Result<Self> {
        let app_dir = dirs::data_local_dir()
            .map(|dir| dir.join("chatme"))
            .unwrap_or_else(|| PathBuf::from("."));
        
        std::fs::create_dir_all(&app_dir)?;
        let database_path = app_dir.join("chatme.db");
        let database_url = format!("sqlite:{}", database_path.display());

        // Create database if it doesn't exist
        if !Sqlite::database_exists(&database_url).await.unwrap_or(false) {
            Sqlite::create_database(&database_url).await?;
        }

        let pool = SqlitePool::connect(&database_url).await?;

        // Run migrations
        sqlx::migrate!("./migrations").run(&pool).await.map_err(|e| {
            eprintln!("Migration error: {}", e);
            e
        })?;

        Ok(Database { pool })
    }

    // Chat operations
    pub async fn create_chat(&self, title: String, api_config_id: Option<String>) -> Result<Chat> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let chat = sqlx::query_as::<_, Chat>(
            "INSERT INTO chats (id, title, api_config_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING *"
        )
        .bind(&id)
        .bind(&title)
        .bind(&api_config_id)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(chat)
    }

    pub async fn get_chats(&self) -> Result<Vec<ChatWithLastMessage>> {
        let rows = sqlx::query(
            r#"
            SELECT 
                c.id,
                c.title,
                c.api_config_id,
                ac.name as api_config_name,
                c.created_at,
                c.updated_at,
                m.content as last_message,
                m.created_at as last_message_time
            FROM chats c
            LEFT JOIN api_configs ac ON c.api_config_id = ac.id
            LEFT JOIN (
                SELECT DISTINCT chat_id, content, created_at,
                       ROW_NUMBER() OVER (PARTITION BY chat_id ORDER BY created_at DESC) as rn
                FROM messages
            ) m ON c.id = m.chat_id AND m.rn = 1
            ORDER BY COALESCE(m.created_at, c.updated_at) DESC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let chats = rows
            .into_iter()
            .map(|row| {
                ChatWithLastMessage {
                    id: row.get("id"),
                    title: row.get("title"),
                    api_config_id: row.get("api_config_id"),
                    api_config_name: row.get("api_config_name"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                    last_message: row.get("last_message"),
                    last_message_time: row.get("last_message_time"),
                    unread_count: 0, // TODO: Implement unread count logic
                }
            })
            .collect();

        Ok(chats)
    }

    pub async fn get_chat(&self, chat_id: &str) -> Result<Option<Chat>> {
        let chat = sqlx::query_as::<_, Chat>("SELECT * FROM chats WHERE id = ?")
            .bind(chat_id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(chat)
    }

    pub async fn update_chat(&self, chat_id: &str, title: String, api_config_id: Option<String>) -> Result<Chat> {
        let now = Utc::now();
        
        let chat = sqlx::query_as::<_, Chat>(
            "UPDATE chats SET title = ?, api_config_id = ?, updated_at = ? WHERE id = ? RETURNING *"
        )
        .bind(&title)
        .bind(&api_config_id)
        .bind(now)
        .bind(chat_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(chat)
    }

    pub async fn delete_chat(&self, chat_id: &str) -> Result<()> {
        // Delete messages first (foreign key constraint)
        sqlx::query("DELETE FROM messages WHERE chat_id = ?")
            .bind(chat_id)
            .execute(&self.pool)
            .await?;

        // Delete chat
        sqlx::query("DELETE FROM chats WHERE id = ?")
            .bind(chat_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // Message operations
    pub async fn create_message(&self, chat_id: String, content: String, role: MessageRole) -> Result<Message> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let message = sqlx::query_as::<_, Message>(
            "INSERT INTO messages (id, chat_id, content, role, created_at) VALUES (?, ?, ?, ?, ?) RETURNING *"
        )
        .bind(&id)
        .bind(&chat_id)
        .bind(&content)
        .bind(&role)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        // Update chat's updated_at timestamp
        sqlx::query("UPDATE chats SET updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(&chat_id)
            .execute(&self.pool)
            .await?;

        Ok(message)
    }

    pub async fn get_messages(&self, chat_id: &str) -> Result<Vec<Message>> {
        let messages = sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC"
        )
        .bind(chat_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(messages)
    }

    pub async fn delete_message(&self, message_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM messages WHERE id = ?")
            .bind(message_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // API Configuration operations
    pub async fn create_api_config(&self, request: CreateApiConfigRequest) -> Result<ApiConfig> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        // If this is set as default, unset all other defaults
        if request.is_default {
            sqlx::query("UPDATE api_configs SET is_default = FALSE")
                .execute(&self.pool)
                .await?;
        }

        let config = sqlx::query_as::<_, ApiConfig>(
            r#"
            INSERT INTO api_configs (
                id, name, provider, api_key, base_url, model, 
                temperature, max_tokens, is_default, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
            RETURNING *
            "#
        )
        .bind(&id)
        .bind(&request.name)
        .bind(&request.provider)
        .bind(&request.api_key)
        .bind(&request.base_url)
        .bind(&request.model)
        .bind(request.temperature)
        .bind(request.max_tokens)
        .bind(request.is_default)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(config)
    }

    pub async fn get_api_configs(&self) -> Result<Vec<ApiConfig>> {
        let configs = sqlx::query_as::<_, ApiConfig>(
            "SELECT * FROM api_configs ORDER BY is_default DESC, name ASC"
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(configs)
    }

    pub async fn get_api_config(&self, config_id: &str) -> Result<Option<ApiConfig>> {
        let config = sqlx::query_as::<_, ApiConfig>(
            "SELECT * FROM api_configs WHERE id = ?"
        )
        .bind(config_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(config)
    }

    pub async fn get_default_api_config(&self) -> Result<Option<ApiConfig>> {
        let config = sqlx::query_as::<_, ApiConfig>(
            "SELECT * FROM api_configs WHERE is_default = TRUE LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(config)
    }

    pub async fn update_api_config(&self, config_id: &str, request: UpdateApiConfigRequest) -> Result<ApiConfig> {
        let now = Utc::now();

        // If this is set as default, unset all other defaults
        if request.is_default {
            sqlx::query("UPDATE api_configs SET is_default = FALSE")
                .execute(&self.pool)
                .await?;
        }

        let config = sqlx::query_as::<_, ApiConfig>(
            r#"
            UPDATE api_configs SET 
                name = ?, api_key = ?, base_url = ?, model = ?, 
                temperature = ?, max_tokens = ?, is_default = ?, updated_at = ?
            WHERE id = ? 
            RETURNING *
            "#
        )
        .bind(&request.name)
        .bind(&request.api_key)
        .bind(&request.base_url)
        .bind(&request.model)
        .bind(request.temperature)
        .bind(request.max_tokens)
        .bind(request.is_default)
        .bind(now)
        .bind(config_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(config)
    }

    pub async fn delete_api_config(&self, config_id: &str) -> Result<()> {
        // Don't allow deleting if it's the only config or if chats are using it
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM api_configs")
            .fetch_one(&self.pool)
            .await?;

        if count <= 1 {
            return Err(anyhow::anyhow!("Cannot delete the last API configuration"));
        }

        let chats_using: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM chats WHERE api_config_id = ?")
            .bind(config_id)
            .fetch_one(&self.pool)
            .await?;

        if chats_using > 0 {
            return Err(anyhow::anyhow!("Cannot delete API configuration that is being used by chats"));
        }

        sqlx::query("DELETE FROM api_configs WHERE id = ?")
            .bind(config_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // LLM Integration
    pub async fn send_chat_completion(&self, config: &ApiConfig, messages: Vec<ChatMessage>) -> Result<String> {
        let client = Client::new();
        
        match config.provider {
            ApiProvider::OpenAI => {
                let url = config.base_url.as_deref().unwrap_or("https://api.openai.com/v1/chat/completions");
                
                let request_body = json!({
                    "model": config.model,
                    "messages": messages,
                    "temperature": config.temperature,
                    "max_tokens": config.max_tokens
                });

                let response = client
                    .post(url)
                    .header("Authorization", format!("Bearer {}", config.api_key))
                    .header("Content-Type", "application/json")
                    .json(&request_body)
                    .send()
                    .await?;

                if !response.status().is_success() {
                    let error_text = response.text().await?;
                    return Err(anyhow::anyhow!("API request failed: {}", error_text));
                }

                // Try to parse as ChatCompletionResponse, but provide better error handling
                let response_text = response.text().await?;
                
                match serde_json::from_str::<ChatCompletionResponse>(&response_text) {
                    Ok(completion) => {
                        if let Some(choice) = completion.choices.first() {
                            Ok(choice.message.content.clone())
                        } else {
                            Err(anyhow::anyhow!("No response choices from API"))
                        }
                    },
                    Err(parse_error) => {
                        // Log the actual response for debugging
                        eprintln!("Failed to parse OpenAI API response: {}", parse_error);
                        eprintln!("Response body: {}", response_text);
                        Err(anyhow::anyhow!("Failed to parse API response: {}. Response: {}", parse_error, response_text))
                    }
                }
            },
            ApiProvider::Anthropic => {
                let url = config.base_url.as_deref().unwrap_or("https://api.anthropic.com/v1/messages");
                
                // Convert messages to Anthropic format
                let anthropic_messages: Vec<serde_json::Value> = messages.into_iter().map(|msg| {
                    json!({
                        "role": if msg.role == "assistant" { "assistant" } else { "user" },
                        "content": msg.content
                    })
                }).collect();

                let request_body = json!({
                    "model": config.model,
                    "max_tokens": config.max_tokens.unwrap_or(1000),
                    "messages": anthropic_messages
                });

                let response = client
                    .post(url)
                    .header("x-api-key", &config.api_key)
                    .header("anthropic-version", "2023-06-01")
                    .header("Content-Type", "application/json")
                    .json(&request_body)
                    .send()
                    .await?;

                if !response.status().is_success() {
                    let error_text = response.text().await?;
                    return Err(anyhow::anyhow!("Anthropic API request failed: {}", error_text));
                }

                let response_json: serde_json::Value = response.json().await?;
                
                if let Some(content) = response_json["content"][0]["text"].as_str() {
                    Ok(content.to_string())
                } else {
                    Err(anyhow::anyhow!("Invalid response format from Anthropic API"))
                }
            },
            ApiProvider::Ollama => {
                let url = format!(
                    "{}/api/chat", 
                    config.base_url.as_deref().unwrap_or("http://localhost:11434")
                );
                
                let request_body = json!({
                    "model": config.model,
                    "messages": messages,
                    "stream": false,
                    "options": {
                        "temperature": config.temperature
                    }
                });

                let response = client
                    .post(&url)
                    .header("Content-Type", "application/json")
                    .json(&request_body)
                    .send()
                    .await?;

                if !response.status().is_success() {
                    let error_text = response.text().await?;
                    return Err(anyhow::anyhow!("Ollama API request failed: {}", error_text));
                }

                let response_json: serde_json::Value = response.json().await?;
                
                if let Some(content) = response_json["message"]["content"].as_str() {
                    Ok(content.to_string())
                } else {
                    Err(anyhow::anyhow!("Invalid response format from Ollama API"))
                }
            },
            ApiProvider::Google => {
                let url = config.base_url.as_deref().unwrap_or("https://generativelanguage.googleapis.com/v1beta/models");
                let full_url = format!("{}/{}:generateContent?key={}", url, config.model, config.api_key);
                
                // Convert messages to Google format
                let google_contents: Vec<serde_json::Value> = messages.into_iter().map(|msg| {
                    json!({
                        "role": if msg.role == "assistant" { "model" } else { "user" },
                        "parts": [{"text": msg.content}]
                    })
                }).collect();

                let request_body = json!({
                    "contents": google_contents,
                    "generationConfig": {
                        "temperature": config.temperature,
                        "maxOutputTokens": config.max_tokens.unwrap_or(1000)
                    }
                });

                let response = client
                    .post(&full_url)
                    .header("Content-Type", "application/json")
                    .json(&request_body)
                    .send()
                    .await?;

                if !response.status().is_success() {
                    let error_text = response.text().await?;
                    return Err(anyhow::anyhow!("Google API request failed: {}", error_text));
                }

                let response_json: serde_json::Value = response.json().await?;
                
                if let Some(content) = response_json["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                    Ok(content.to_string())
                } else {
                    Err(anyhow::anyhow!("Invalid response format from Google API"))
                }
            },
            ApiProvider::Custom => {
                // For custom providers, assume OpenAI-compatible API format
                let url = config.base_url.as_deref().ok_or_else(|| {
                    anyhow::anyhow!("Base URL is required for custom providers")
                })?;
                
                let request_body = json!({
                    "model": config.model,
                    "messages": messages,
                    "temperature": config.temperature,
                    "max_tokens": config.max_tokens
                });

                let mut request_builder = client
                    .post(url)
                    .header("Content-Type", "application/json");

                // Add authorization header if API key is provided
                if !config.api_key.is_empty() {
                    request_builder = request_builder.header("Authorization", format!("Bearer {}", config.api_key));
                }

                let response = request_builder
                    .json(&request_body)
                    .send()
                    .await?;

                if !response.status().is_success() {
                    let error_text = response.text().await?;
                    return Err(anyhow::anyhow!("Custom API request failed: {}", error_text));
                }

                // Try to parse as ChatCompletionResponse, but provide better error handling
                let response_text = response.text().await?;
                
                match serde_json::from_str::<ChatCompletionResponse>(&response_text) {
                    Ok(completion) => {
                        if let Some(choice) = completion.choices.first() {
                            Ok(choice.message.content.clone())
                        } else {
                            Err(anyhow::anyhow!("No response choices from custom API"))
                        }
                    },
                    Err(parse_error) => {
                        // Log the actual response for debugging
                        eprintln!("Failed to parse custom API response: {}", parse_error);
                        eprintln!("Response body: {}", response_text);
                        Err(anyhow::anyhow!("Failed to parse custom API response: {}. Response: {}", parse_error, response_text))
                    }
                }
            }
        }
    }

    pub async fn send_chat_completion_streaming(
        &self, 
        config: &ApiConfig, 
        messages: Vec<ChatMessage>,
        window: &tauri::Window,
        message_id: &str,
        chat_id: &str
    ) -> Result<String> {
        let client = Client::new();
        
        match config.provider {
            ApiProvider::OpenAI => {
                let url = config.base_url.as_deref().unwrap_or("https://api.openai.com/v1/chat/completions");
                
                let request_body = json!({
                    "model": config.model,
                    "messages": messages,
                    "temperature": config.temperature,
                    "max_tokens": config.max_tokens,
                    "stream": true
                });

                let response = client
                    .post(url)
                    .header("Authorization", format!("Bearer {}", config.api_key))
                    .header("Content-Type", "application/json")
                    .json(&request_body)
                    .send()
                    .await?;

                if !response.status().is_success() {
                    let error_text = response.text().await?;
                    return Err(anyhow::anyhow!("API request failed: {}", error_text));
                }

                let mut full_response = String::new();
                let mut stream = response.bytes_stream();
                
                use futures_util::StreamExt;
                
                while let Some(chunk) = stream.next().await {
                    let chunk = chunk?;
                    let chunk_str = String::from_utf8_lossy(&chunk);
                    
                    // Parse SSE format
                    for line in chunk_str.lines() {
                        if line.starts_with("data: ") {
                            let data = &line[6..];
                            if data == "[DONE]" {
                                break;
                            }
                            
                            if let Ok(json_data) = serde_json::from_str::<serde_json::Value>(data) {
                                if let Some(choices) = json_data["choices"].as_array() {
                                    if let Some(choice) = choices.first() {
                                        if let Some(delta) = choice["delta"].as_object() {
                                            if let Some(content) = delta["content"].as_str() {
                                                full_response.push_str(content);
                                                
                                                // Emit streaming chunk to frontend
                                                let _ = window.emit("streaming_chunk", serde_json::json!({
                                                    "message_id": message_id,
                                                    "chunk": content,
                                                    "full_content": full_response
                                                }));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Emit streaming complete event with the content
                let _ = window.emit("streaming_complete", serde_json::json!({
                    "message_id": message_id,
                    "content": full_response,
                    "chat_id": chat_id
                }));

                Ok(full_response)
            },
            // For other providers, fall back to non-streaming for now
            _ => {
                // Simulate streaming by sending the full response in chunks
                let response = self.send_chat_completion(config, messages).await?;
                
                // Split response into words and send as chunks
                let words: Vec<&str> = response.split_whitespace().collect();
                let mut current_content = String::new();
                
                for (i, word) in words.iter().enumerate() {
                    current_content.push_str(word);
                    if i < words.len() - 1 {
                        current_content.push(' ');
                    }
                    
                    // Emit chunk
                    let _ = window.emit("streaming_chunk", serde_json::json!({
                        "message_id": message_id,
                        "chunk": format!("{} ", word),
                        "full_content": current_content
                    }));
                    
                    // Small delay to simulate streaming
                    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
                }
                
                // Emit streaming complete event with the content
                let _ = window.emit("streaming_complete", serde_json::json!({
                    "message_id": message_id,
                    "content": response,
                    "chat_id": chat_id
                }));

                Ok(response)
            }
        }
    }
}