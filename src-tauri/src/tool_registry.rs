use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::agentic::AgentSession;
use crate::tools::get_all_tool_definitions;
use crate::mcp_client::{McpClientManager, McpToolInfo, ToolCallResult, ToolContent};
use crate::models::ToolDefinition;

/// Identifies where a tool comes from
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ToolSource {
    Builtin,
    McpServer(String), // server_id
}

impl ToolSource {
    pub fn as_str(&self) -> String {
        match self {
            ToolSource::Builtin => "builtin".to_string(),
            ToolSource::McpServer(id) => id.clone(),
        }
    }
}

/// A tool definition with its source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolWithSource {
    pub source: ToolSource,
    pub definition: ToolDefinition,
}

/// Registry that manages all available tools from all sources
pub struct ToolRegistry {
    mcp_manager: Arc<McpClientManager>,
    // Cache of MCP tools converted to ToolDefinition format
    mcp_tools_cache: RwLock<HashMap<String, Vec<ToolWithSource>>>,
}

impl ToolRegistry {
    pub fn new(mcp_manager: Arc<McpClientManager>) -> Self {
        Self {
            mcp_manager,
            mcp_tools_cache: RwLock::new(HashMap::new()),
        }
    }

    /// Get all builtin tool definitions
    pub fn get_builtin_tools(&self) -> Vec<ToolWithSource> {
        get_all_tool_definitions()
            .into_iter()
            .map(|def| ToolWithSource {
                source: ToolSource::Builtin,
                definition: def,
            })
            .collect()
    }

    /// Convert MCP tool info to our ToolDefinition format
    fn convert_mcp_tool(server_id: &str, tool: &McpToolInfo) -> ToolWithSource {
        // Prefix the tool name with server ID to avoid conflicts
        let prefixed_name = format!("mcp_{}_{}", server_id.replace("-", "_"), tool.name);

        ToolWithSource {
            source: ToolSource::McpServer(server_id.to_string()),
            definition: ToolDefinition {
                tool_type: "function".to_string(),
                function: crate::models::FunctionDefinition {
                    name: prefixed_name,
                    description: tool.description.clone().unwrap_or_else(|| format!("MCP tool: {}", tool.name)),
                    parameters: tool.input_schema.clone(),
                },
            },
        }
    }

    /// Refresh the cache of MCP tools from all connected servers
    pub async fn refresh_mcp_tools(&self) -> Result<()> {
        let all_mcp_tools = self.mcp_manager.get_all_tools().await;

        let mut cache = self.mcp_tools_cache.write().await;
        cache.clear();

        for (server_id, tool_info) in all_mcp_tools {
            let tool_with_source = Self::convert_mcp_tool(&server_id, &tool_info);
            cache.entry(server_id)
                .or_insert_with(Vec::new)
                .push(tool_with_source);
        }

        Ok(())
    }

    /// Get all MCP tools from the cache
    pub async fn get_mcp_tools(&self) -> Vec<ToolWithSource> {
        let cache = self.mcp_tools_cache.read().await;
        cache.values().flatten().cloned().collect()
    }

    /// Get all tools (builtin + MCP)
    pub async fn get_all_tools(&self) -> Vec<ToolWithSource> {
        let mut all_tools = self.get_builtin_tools();
        all_tools.extend(self.get_mcp_tools().await);
        all_tools
    }

    /// Get just the tool definitions (for sending to LLM)
    pub async fn get_all_tool_definitions(&self) -> Vec<ToolDefinition> {
        self.get_all_tools()
            .await
            .into_iter()
            .map(|t| t.definition)
            .collect()
    }

    /// Find which source a tool comes from by its name
    pub async fn find_tool_source(&self, tool_name: &str) -> Option<ToolSource> {
        // Check builtin first
        let builtin = self.get_builtin_tools();
        if builtin.iter().any(|t| t.definition.function.name == tool_name) {
            return Some(ToolSource::Builtin);
        }

        // Check MCP tools
        let mcp_tools = self.get_mcp_tools().await;
        for tool in mcp_tools {
            if tool.definition.function.name == tool_name {
                return Some(tool.source);
            }
        }

        None
    }

    /// Extract the original MCP tool name from the prefixed name
    pub fn extract_mcp_tool_name(prefixed_name: &str) -> Option<(String, String)> {
        // Format: mcp_{server_id}_{tool_name}
        if !prefixed_name.starts_with("mcp_") {
            return None;
        }

        let without_prefix = &prefixed_name[4..]; // Remove "mcp_"

        // Find the first underscore which separates server_id from tool_name
        // This is tricky because server_id also has underscores (was dashes)
        // We need to find a way to separate them
        // For now, we'll store a mapping when we create the tool

        // Actually, let's use a different approach - store the mapping
        None // This will be handled by looking up in our cache
    }

    /// Get original tool name and server ID from a prefixed MCP tool name
    pub async fn get_mcp_tool_info(&self, prefixed_name: &str) -> Option<(String, String)> {
        let cache = self.mcp_tools_cache.read().await;

        for (server_id, tools) in cache.iter() {
            for tool in tools {
                if tool.definition.function.name == prefixed_name {
                    // Extract original name by removing prefix
                    let prefix = format!("mcp_{}_", server_id.replace("-", "_"));
                    if let Some(original_name) = prefixed_name.strip_prefix(&prefix) {
                        return Some((server_id.clone(), original_name.to_string()));
                    }
                }
            }
        }

        None
    }

    /// Execute a tool call, routing to the appropriate backend
    pub async fn execute_tool(
        &self,
        session: &mut AgentSession,
        tool_name: &str,
        arguments: Value,
    ) -> Result<(ToolSource, Value)> {
        // Determine tool source
        let source = self.find_tool_source(tool_name).await
            .ok_or_else(|| anyhow!("Unknown tool: {}", tool_name))?;

        match &source {
            ToolSource::Builtin => {
                // Convert Value to HashMap
                let params: HashMap<String, Value> = match arguments {
                    Value::Object(map) => map.into_iter().collect(),
                    _ => HashMap::new(),
                };

                // Execute using AgentSession
                let action = session.execute_action(tool_name, params).await?;

                if action.success {
                    Ok((source, action.result.unwrap_or(Value::Null)))
                } else {
                    Err(anyhow!(action.error_message.unwrap_or_else(|| "Unknown error".to_string())))
                }
            }
            ToolSource::McpServer(server_id) => {
                // Get original tool name
                let (_, original_name) = self.get_mcp_tool_info(tool_name).await
                    .ok_or_else(|| anyhow!("Could not find MCP tool info for: {}", tool_name))?;

                // Execute via MCP client
                let result = self.mcp_manager
                    .call_tool(server_id, &original_name, Some(arguments))
                    .await?;

                // Convert MCP result to our format
                let result_value = self.convert_mcp_result(result)?;

                Ok((source, result_value))
            }
        }
    }

    /// Convert MCP tool result to a JSON value
    fn convert_mcp_result(&self, result: ToolCallResult) -> Result<Value> {
        if result.is_error {
            let error_text = result.content.iter()
                .filter_map(|c| match c {
                    ToolContent::Text { text } => Some(text.clone()),
                    _ => None,
                })
                .collect::<Vec<_>>()
                .join("\n");

            return Err(anyhow!("MCP tool error: {}", error_text));
        }

        // Combine all content into a result
        let contents: Vec<Value> = result.content.iter()
            .map(|c| match c {
                ToolContent::Text { text } => {
                    serde_json::json!({
                        "type": "text",
                        "text": text
                    })
                }
                ToolContent::Image { data, mime_type } => {
                    serde_json::json!({
                        "type": "image",
                        "data": data,
                        "mimeType": mime_type
                    })
                }
                ToolContent::Resource { resource } => {
                    serde_json::json!({
                        "type": "resource",
                        "uri": resource.uri,
                        "mimeType": resource.mime_type,
                        "text": resource.text
                    })
                }
            })
            .collect();

        // If there's only one text content, return just the text
        if contents.len() == 1 {
            if let Some(text) = contents[0].get("text") {
                return Ok(text.clone());
            }
        }

        Ok(Value::Array(contents))
    }
}
