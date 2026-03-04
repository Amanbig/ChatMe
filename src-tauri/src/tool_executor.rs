use crate::models::{ToolCall, ToolExecution};
use crate::agentic::AgentSession;
use anyhow::{Result, anyhow};
use chrono::Utc;
use serde_json::json;
use std::collections::HashMap;

pub struct ToolExecutor {
    session: AgentSession,
}

impl ToolExecutor {
    pub fn new(session: AgentSession) -> Self {
        Self { session }
    }

    /// Execute a batch of tool calls
    pub async fn execute_tool_calls(
        &self,
        tool_calls: Vec<ToolCall>
    ) -> Vec<ToolExecution> {
        let mut executions = Vec::new();

        for tool_call in tool_calls {
            let execution = self.execute_single_tool_call(tool_call).await;
            executions.push(execution);
        }

        executions
    }

    /// Execute a single tool call
    async fn execute_single_tool_call(&self, tool_call: ToolCall) -> ToolExecution {
        let timestamp = Utc::now();
        let tool_name = tool_call.function.name.clone();

        // Parse arguments
        let arguments: Result<serde_json::Value> =
            serde_json::from_str(&tool_call.function.arguments)
                .map_err(|e| anyhow!("Invalid arguments JSON: {}", e));

        let arguments = match arguments {
            Ok(args) => args,
            Err(e) => {
                return ToolExecution {
                    tool_call_id: tool_call.id,
                    tool_name,
                    arguments: json!({}),
                    result: None,
                    success: false,
                    error_message: Some(e.to_string()),
                    timestamp,
                };
            }
        };

        // Convert JSON Value to HashMap for AgentSession
        let params: HashMap<String, serde_json::Value> =
            serde_json::from_value(arguments.clone())
                .unwrap_or_default();

        // Execute via AgentSession
        match self.session.execute_action(&tool_name, params).await {
            Ok(action) => {
                ToolExecution {
                    tool_call_id: tool_call.id,
                    tool_name,
                    arguments,
                    result: action.result,
                    success: action.success,
                    error_message: action.error_message,
                    timestamp,
                }
            }
            Err(e) => {
                ToolExecution {
                    tool_call_id: tool_call.id,
                    tool_name,
                    arguments,
                    result: None,
                    success: false,
                    error_message: Some(e.to_string()),
                    timestamp,
                }
            }
        }
    }

    /// Convert executions to tool result messages (JSON strings) for LLM
    pub fn executions_to_tool_results_content(executions: &[ToolExecution]) -> Vec<(String, String, String)> {
        // Returns (tool_call_id, tool_name, content_json_string)
        executions.iter().map(|exec| {
            let content = if exec.success {
                serde_json::to_string(&exec.result).unwrap_or_else(|_| "null".to_string())
            } else {
                json!({
                    "error": exec.error_message.clone().unwrap_or_else(|| "Unknown error".to_string())
                }).to_string()
            };

            (
                exec.tool_call_id.clone(),
                exec.tool_name.clone(),
                content
            )
        }).collect()
    }

    // Parallel execution would require the futures crate
    // Uncomment and add `futures = "0.3"` to Cargo.toml to enable
    /*
    /// Execute tool calls in parallel (for independent tools)
    #[allow(dead_code)]
    pub async fn execute_tool_calls_parallel(
        &self,
        tool_calls: Vec<ToolCall>
    ) -> Vec<ToolExecution> {
        use futures::future::join_all;

        let futures: Vec<_> = tool_calls.into_iter()
            .map(|tc| self.execute_single_tool_call(tc))
            .collect();

        join_all(futures).await
    }
    */
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_executions_to_tool_results_content() {
        let executions = vec![
            ToolExecution {
                tool_call_id: "call_123".to_string(),
                tool_name: "read_file".to_string(),
                arguments: json!({"path": "test.txt"}),
                result: Some(json!("file contents")),
                success: true,
                error_message: None,
                timestamp: Utc::now(),
            },
            ToolExecution {
                tool_call_id: "call_456".to_string(),
                tool_name: "write_file".to_string(),
                arguments: json!({"path": "out.txt", "content": "data"}),
                result: None,
                success: false,
                error_message: Some("Permission denied".to_string()),
                timestamp: Utc::now(),
            },
        ];

        let results = ToolExecutor::executions_to_tool_results_content(&executions);

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].0, "call_123");
        assert_eq!(results[0].1, "read_file");
        assert!(results[0].2.contains("file contents"));

        assert_eq!(results[1].0, "call_456");
        assert_eq!(results[1].1, "write_file");
        assert!(results[1].2.contains("error"));
        assert!(results[1].2.contains("Permission denied"));
    }
}
