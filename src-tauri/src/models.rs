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

// Tool Execution - persisted tool call history
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ToolExecutionRecord {
    pub id: String,
    pub message_id: String,
    pub tool_call_id: String,
    pub tool_name: String,
    pub tool_source: String, // "builtin" or mcp_server_id
    #[sqlx(skip)]
    pub arguments: serde_json::Value,
    #[sqlx(skip)]
    pub result: Option<serde_json::Value>,
    pub success: bool,
    pub error_message: Option<String>,
    pub execution_order: i32,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateToolExecutionRequest {
    pub message_id: String,
    pub tool_call_id: String,
    pub tool_name: String,
    pub tool_source: String,
    pub arguments: serde_json::Value,
    pub result: Option<serde_json::Value>,
    pub success: bool,
    pub error_message: Option<String>,
    pub execution_order: i32,
    pub started_at: String, // ISO string from frontend
    pub completed_at: Option<String>,
}

// MCP Server - configuration for Model Context Protocol servers
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "TEXT")]
#[serde(rename_all = "lowercase")]
pub enum McpTransportType {
    #[sqlx(rename = "stdio")]
    Stdio,
    #[sqlx(rename = "sse")]
    Sse,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct McpServer {
    pub id: String,
    pub name: String,
    pub transport_type: McpTransportType,
    pub command: Option<String>,
    #[sqlx(skip)]
    pub args: Option<Vec<String>>,
    #[sqlx(skip)]
    pub env: Option<std::collections::HashMap<String, String>>,
    pub url: Option<String>,
    #[sqlx(skip)]
    pub headers: Option<std::collections::HashMap<String, String>>,
    pub enabled: bool,
    pub auto_connect: bool,
    pub connection_timeout_ms: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateMcpServerRequest {
    pub name: String,
    pub transport_type: McpTransportType,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Option<std::collections::HashMap<String, String>>,
    pub url: Option<String>,
    pub headers: Option<std::collections::HashMap<String, String>>,
    pub enabled: bool,
    pub auto_connect: bool,
    pub connection_timeout_ms: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateMcpServerRequest {
    pub name: String,
    pub transport_type: McpTransportType,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Option<std::collections::HashMap<String, String>>,
    pub url: Option<String>,
    pub headers: Option<std::collections::HashMap<String, String>>,
    pub enabled: bool,
    pub auto_connect: bool,
    pub connection_timeout_ms: Option<i32>,
}

// MCP Tool - tool discovered from an MCP server
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct McpTool {
    pub id: String,
    pub server_id: String,
    pub name: String,
    pub description: Option<String>,
    #[sqlx(skip)]
    pub input_schema: serde_json::Value,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// MCP Server with its tools for API responses
#[derive(Debug, Serialize, Deserialize)]
pub struct McpServerWithTools {
    #[serde(flatten)]
    pub server: McpServer,
    pub tools: Vec<McpTool>,
    pub connection_status: String, // "connected" | "disconnected" | "error"
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

