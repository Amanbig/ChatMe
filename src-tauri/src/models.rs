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
    #[sqlx(skip)]
    pub images: Option<Vec<String>>,
    pub permission_request_id: Option<String>,
    #[sqlx(skip)]
    pub permission_request: Option<PermissionRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PermissionRequest {
    pub id: String,
    pub chat_id: String,
    pub operation: String,
    pub description: String,
    pub level: String, // "Safe" | "Moderate" | "Dangerous"
    #[sqlx(skip)]
    pub details: std::collections::HashMap<String, String>,
    pub status: String, // "pending" | "approved" | "denied"
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    #[sqlx(rename = "user")]
    User,
    #[sqlx(rename = "assistant")]
    Assistant,
    #[sqlx(rename = "system")]
    System,
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

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
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
    #[sqlx(rename = "mistral")]
    Mistral,
    #[sqlx(rename = "deepseek")]
    DeepSeek,
    #[sqlx(rename = "lmstudio")]
    LMStudio,
    #[sqlx(rename = "kimi")]
    Kimi,
    #[sqlx(rename = "openrouter")]
    OpenRouter,
    #[sqlx(rename = "together")]
    Together,
    #[sqlx(rename = "groq")]
    Groq,
    #[sqlx(rename = "perplexity")]
    Perplexity,
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
    pub images: Option<Vec<String>>,
    pub permission_request_id: Option<String>,
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





// Tool Definition Types (OpenAI format as canonical)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: String, // Always "function"
    pub function: FunctionDefinition,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FunctionDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value, // JSON Schema object
}

