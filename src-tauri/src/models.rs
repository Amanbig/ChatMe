use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Chat {
    pub id: String,
    pub title: String,
    pub api_config_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: String,
    pub chat_id: String,
    pub content: String,
    pub role: MessageRole,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    #[sqlx(rename = "user")]
    User,
    #[sqlx(rename = "assistant")]
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ApiConfig {
    pub id: String,
    pub name: String,
    pub provider: ApiProvider,
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: Option<i32>,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
#[serde(rename_all = "lowercase")]
pub enum ApiProvider {
    #[sqlx(rename = "openai")]
    OpenAI,
    #[sqlx(rename = "anthropic")]
    Anthropic,
    #[sqlx(rename = "google")]
    Google,
    #[sqlx(rename = "ollama")]
    Ollama,
    #[sqlx(rename = "custom")]
    Custom,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatWithLastMessage {
    pub id: String,
    pub title: String,
    pub api_config_id: Option<String>,
    pub api_config_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_message: Option<String>,
    pub last_message_time: Option<DateTime<Utc>>,
    pub unread_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateChatRequest {
    pub title: String,
    pub api_config_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateMessageRequest {
    pub chat_id: String,
    pub content: String,
    pub role: MessageRole,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateChatRequest {
    pub title: String,
    pub api_config_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateApiConfigRequest {
    pub name: String,
    pub provider: ApiProvider,
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: Option<i32>,
    pub is_default: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateApiConfigRequest {
    pub name: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: Option<i32>,
    pub is_default: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatCompletionRequest {
    pub messages: Vec<ChatMessage>,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatCompletionResponse {
    pub choices: Vec<ChatChoice>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatChoice {
    pub message: ChatMessage,
}