use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::time::{timeout, Duration};

use crate::models::{McpServer, McpTransportType};

// JSON-RPC 2.0 structures
#[derive(Debug, Serialize, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: u64,
    method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct JsonRpcError {
    code: i32,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
}

// MCP Protocol structures
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct McpToolInfo {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "inputSchema")]
    pub input_schema: Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct InitializeParams {
    #[serde(rename = "protocolVersion")]
    protocol_version: String,
    capabilities: ClientCapabilities,
    #[serde(rename = "clientInfo")]
    client_info: ClientInfo,
}

#[derive(Debug, Serialize, Deserialize)]
struct ClientCapabilities {
    // Empty for now, can be extended
}

#[derive(Debug, Serialize, Deserialize)]
struct ClientInfo {
    name: String,
    version: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct InitializeResult {
    #[serde(rename = "protocolVersion")]
    protocol_version: String,
    capabilities: ServerCapabilities,
    #[serde(rename = "serverInfo")]
    server_info: Option<ServerInfo>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct ServerCapabilities {
    tools: Option<ToolsCapability>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ToolsCapability {
    #[serde(rename = "listChanged")]
    list_changed: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ServerInfo {
    name: String,
    version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ListToolsResult {
    tools: Vec<McpToolInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CallToolParams {
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    arguments: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCallResult {
    pub content: Vec<ToolContent>,
    #[serde(rename = "isError", default)]
    pub is_error: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum ToolContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image { data: String, #[serde(rename = "mimeType")] mime_type: String },
    #[serde(rename = "resource")]
    Resource { resource: ResourceContent },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResourceContent {
    pub uri: String,
    #[serde(rename = "mimeType")]
    pub mime_type: Option<String>,
    pub text: Option<String>,
}

// Connection state
#[derive(Debug, Clone, PartialEq)]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Error(String),
}

// MCP Client for a single server
pub struct McpClient {
    server_id: String,
    config: McpServer,
    status: Arc<RwLock<ConnectionStatus>>,
    request_id: AtomicU64,
    // For stdio transport
    child_process: Arc<Mutex<Option<Child>>>,
    stdin_tx: Arc<Mutex<Option<mpsc::Sender<String>>>>,
    pending_requests: Arc<RwLock<HashMap<u64, tokio::sync::oneshot::Sender<Result<Value>>>>>,
    // Discovered tools
    tools: Arc<RwLock<Vec<McpToolInfo>>>,
}

impl McpClient {
    pub fn new(config: McpServer) -> Self {
        Self {
            server_id: config.id.clone(),
            config,
            status: Arc::new(RwLock::new(ConnectionStatus::Disconnected)),
            request_id: AtomicU64::new(1),
            child_process: Arc::new(Mutex::new(None)),
            stdin_tx: Arc::new(Mutex::new(None)),
            pending_requests: Arc::new(RwLock::new(HashMap::new())),
            tools: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub fn server_id(&self) -> &str {
        &self.server_id
    }

    pub async fn status(&self) -> ConnectionStatus {
        self.status.read().await.clone()
    }

    pub async fn get_tools(&self) -> Vec<McpToolInfo> {
        self.tools.read().await.clone()
    }

    pub async fn connect(&self) -> Result<()> {
        {
            let mut status = self.status.write().await;
            *status = ConnectionStatus::Connecting;
        }

        let result = match self.config.transport_type {
            McpTransportType::Stdio => self.connect_stdio().await,
            McpTransportType::Sse => self.connect_sse().await,
        };

        match &result {
            Ok(_) => {
                let mut status = self.status.write().await;
                *status = ConnectionStatus::Connected;
            }
            Err(e) => {
                let mut status = self.status.write().await;
                *status = ConnectionStatus::Error(e.to_string());
            }
        }

        result
    }

    async fn connect_stdio(&self) -> Result<()> {
        let command = self.config.command.as_ref()
            .ok_or_else(|| anyhow!("No command specified for stdio transport"))?;

        let mut cmd = Command::new(command);

        if let Some(args) = &self.config.args {
            cmd.args(args);
        }

        if let Some(env) = &self.config.env {
            for (key, value) in env {
                cmd.env(key, value);
            }
        }

        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn()
            .map_err(|e| anyhow!("Failed to spawn MCP server process: {}", e))?;

        let stdin = child.stdin.take()
            .ok_or_else(|| anyhow!("Failed to get stdin handle"))?;
        let stdout = child.stdout.take()
            .ok_or_else(|| anyhow!("Failed to get stdout handle"))?;

        // Create channel for sending messages to stdin
        let (stdin_tx, mut stdin_rx) = mpsc::channel::<String>(100);

        // Spawn stdin writer task
        let mut stdin = stdin;
        tokio::spawn(async move {
            while let Some(msg) = stdin_rx.recv().await {
                if let Err(e) = stdin.write_all(msg.as_bytes()).await {
                    eprintln!("MCP stdin write error: {}", e);
                    break;
                }
                if let Err(e) = stdin.write_all(b"\n").await {
                    eprintln!("MCP stdin newline write error: {}", e);
                    break;
                }
                if let Err(e) = stdin.flush().await {
                    eprintln!("MCP stdin flush error: {}", e);
                    break;
                }
            }
        });

        // Spawn stdout reader task
        let pending = Arc::clone(&self.pending_requests);
        let status = Arc::clone(&self.status);
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                if line.trim().is_empty() {
                    continue;
                }

                match serde_json::from_str::<JsonRpcResponse>(&line) {
                    Ok(response) => {
                        if let Some(id) = response.id {
                            let mut pending_guard = pending.write().await;
                            if let Some(sender) = pending_guard.remove(&id) {
                                let result = if let Some(error) = response.error {
                                    Err(anyhow!("JSON-RPC error {}: {}", error.code, error.message))
                                } else {
                                    Ok(response.result.unwrap_or(Value::Null))
                                };
                                let _ = sender.send(result);
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("MCP stdout parse error: {} for line: {}", e, line);
                    }
                }
            }

            // Connection closed
            let mut status_guard = status.write().await;
            *status_guard = ConnectionStatus::Disconnected;
        });

        // Store handles
        {
            let mut child_guard = self.child_process.lock().await;
            *child_guard = Some(child);
        }
        {
            let mut stdin_guard = self.stdin_tx.lock().await;
            *stdin_guard = Some(stdin_tx);
        }

        // Initialize the connection
        self.initialize().await?;

        // List available tools
        self.refresh_tools().await?;

        Ok(())
    }

    async fn connect_sse(&self) -> Result<()> {
        // SSE transport implementation
        // For now, return an error - SSE requires more complex handling
        Err(anyhow!("SSE transport not yet implemented"))
    }

    async fn send_request(&self, method: &str, params: Option<Value>) -> Result<Value> {
        let id = self.request_id.fetch_add(1, Ordering::SeqCst);

        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id,
            method: method.to_string(),
            params,
        };

        let request_json = serde_json::to_string(&request)?;

        // Create response channel
        let (tx, rx) = tokio::sync::oneshot::channel();

        {
            let mut pending = self.pending_requests.write().await;
            pending.insert(id, tx);
        }

        // Send request
        {
            let stdin_guard = self.stdin_tx.lock().await;
            if let Some(stdin) = stdin_guard.as_ref() {
                stdin.send(request_json).await
                    .map_err(|e| anyhow!("Failed to send request: {}", e))?;
            } else {
                return Err(anyhow!("Not connected"));
            }
        }

        // Wait for response with timeout
        let timeout_ms = self.config.connection_timeout_ms.unwrap_or(30000) as u64;
        match timeout(Duration::from_millis(timeout_ms), rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err(anyhow!("Response channel closed")),
            Err(_) => Err(anyhow!("Request timed out")),
        }
    }

    async fn initialize(&self) -> Result<()> {
        let params = InitializeParams {
            protocol_version: "2024-11-05".to_string(),
            capabilities: ClientCapabilities {},
            client_info: ClientInfo {
                name: "ChatMe".to_string(),
                version: "0.5.0".to_string(),
            },
        };

        let result = self.send_request("initialize", Some(serde_json::to_value(params)?)).await?;
        let _init_result: InitializeResult = serde_json::from_value(result)?;

        // Send initialized notification
        let stdin_guard = self.stdin_tx.lock().await;
        if let Some(stdin) = stdin_guard.as_ref() {
            let notification = json!({
                "jsonrpc": "2.0",
                "method": "notifications/initialized"
            });
            stdin.send(serde_json::to_string(&notification)?).await
                .map_err(|e| anyhow!("Failed to send initialized notification: {}", e))?;
        }

        Ok(())
    }

    pub async fn refresh_tools(&self) -> Result<Vec<McpToolInfo>> {
        let result = self.send_request("tools/list", None).await?;
        let list_result: ListToolsResult = serde_json::from_value(result)?;

        {
            let mut tools = self.tools.write().await;
            *tools = list_result.tools.clone();
        }

        Ok(list_result.tools)
    }

    pub async fn call_tool(&self, name: &str, arguments: Option<Value>) -> Result<ToolCallResult> {
        let params = CallToolParams {
            name: name.to_string(),
            arguments,
        };

        let result = self.send_request("tools/call", Some(serde_json::to_value(params)?)).await?;
        let call_result: ToolCallResult = serde_json::from_value(result)?;

        Ok(call_result)
    }

    pub async fn disconnect(&self) -> Result<()> {
        // Close stdin channel
        {
            let mut stdin_guard = self.stdin_tx.lock().await;
            *stdin_guard = None;
        }

        // Kill child process if exists
        {
            let mut child_guard = self.child_process.lock().await;
            if let Some(mut child) = child_guard.take() {
                let _ = child.kill().await;
            }
        }

        // Clear pending requests
        {
            let mut pending = self.pending_requests.write().await;
            pending.clear();
        }

        // Clear tools
        {
            let mut tools = self.tools.write().await;
            tools.clear();
        }

        // Update status
        {
            let mut status = self.status.write().await;
            *status = ConnectionStatus::Disconnected;
        }

        Ok(())
    }
}

impl Drop for McpClient {
    fn drop(&mut self) {
        // Note: async cleanup should be done explicitly via disconnect()
        // This is a best-effort cleanup
    }
}

// Manager for all MCP clients
pub struct McpClientManager {
    clients: RwLock<HashMap<String, Arc<McpClient>>>,
}

impl McpClientManager {
    pub fn new() -> Self {
        Self {
            clients: RwLock::new(HashMap::new()),
        }
    }

    pub async fn add_server(&self, config: McpServer) -> Arc<McpClient> {
        let client = Arc::new(McpClient::new(config.clone()));
        let mut clients = self.clients.write().await;
        clients.insert(config.id.clone(), Arc::clone(&client));
        client
    }

    pub async fn remove_server(&self, server_id: &str) -> Result<()> {
        let client = {
            let mut clients = self.clients.write().await;
            clients.remove(server_id)
        };

        if let Some(client) = client {
            client.disconnect().await?;
        }

        Ok(())
    }

    pub async fn get_client(&self, server_id: &str) -> Option<Arc<McpClient>> {
        let clients = self.clients.read().await;
        clients.get(server_id).cloned()
    }

    pub async fn connect_server(&self, server_id: &str) -> Result<()> {
        let client = self.get_client(server_id).await
            .ok_or_else(|| anyhow!("Server not found: {}", server_id))?;
        client.connect().await
    }

    pub async fn disconnect_server(&self, server_id: &str) -> Result<()> {
        let client = self.get_client(server_id).await
            .ok_or_else(|| anyhow!("Server not found: {}", server_id))?;
        client.disconnect().await
    }

    pub async fn get_all_tools(&self) -> Vec<(String, McpToolInfo)> {
        let clients = self.clients.read().await;
        let mut all_tools = Vec::new();

        for (server_id, client) in clients.iter() {
            let tools = client.get_tools().await;
            for tool in tools {
                all_tools.push((server_id.clone(), tool));
            }
        }

        all_tools
    }

    pub async fn call_tool(&self, server_id: &str, tool_name: &str, arguments: Option<Value>) -> Result<ToolCallResult> {
        let client = self.get_client(server_id).await
            .ok_or_else(|| anyhow!("Server not found: {}", server_id))?;

        let status = client.status().await;
        if status != ConnectionStatus::Connected {
            return Err(anyhow!("Server not connected"));
        }

        client.call_tool(tool_name, arguments).await
    }

    pub async fn get_server_status(&self, server_id: &str) -> Option<ConnectionStatus> {
        let client = self.get_client(server_id).await?;
        Some(client.status().await)
    }

    pub async fn get_all_statuses(&self) -> HashMap<String, ConnectionStatus> {
        let clients = self.clients.read().await;
        let mut statuses = HashMap::new();

        for (server_id, client) in clients.iter() {
            statuses.insert(server_id.clone(), client.status().await);
        }

        statuses
    }
}

impl Default for McpClientManager {
    fn default() -> Self {
        Self::new()
    }
}
