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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String, // "user" | "assistant" | "tool" | "system"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<serde_json::Value>, // Can be string or array, null for tool calls
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>, // When assistant makes tool calls
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>, // When role is "tool"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>, // Tool name when role is "tool"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatCompletionResponse {
    pub choices: Vec<ChatChoice>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<serde_json::Value>, // Token usage stats
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatChoice {
    pub message: ChatMessage,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>, // "stop" | "tool_calls" | "length"
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

// Tool Call Types (in LLM response)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCall {
    pub id: String, // OpenAI requires unique ID per call
    #[serde(rename = "type")]
    pub call_type: String, // "function"
    pub function: FunctionCall,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String, // JSON string of parameters
}

// Tool Execution Tracking
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolExecution {
    pub tool_call_id: String,
    pub tool_name: String,
    pub arguments: serde_json::Value,
    pub result: Option<serde_json::Value>,
    pub success: bool,
    pub error_message: Option<String>,
    pub timestamp: DateTime<Utc>,
}

// Conversation Turn (for multi-turn tool use)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationTurn {
    pub assistant_message: ChatMessage,
    pub tool_executions: Vec<ToolExecution>,
}