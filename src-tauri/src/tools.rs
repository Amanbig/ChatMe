use crate::models::{ToolDefinition, FunctionDefinition};
use crate::agentic::{AgentCapability, AgentParameter, AgentSession};
use serde_json::json;

/// Convert AgentCapability to OpenAI ToolDefinition format
pub fn capability_to_tool_definition(capability: &AgentCapability) -> ToolDefinition {
    ToolDefinition {
        tool_type: "function".to_string(),
        function: FunctionDefinition {
            name: capability.name.clone(),
            description: capability.description.clone(),
            parameters: build_json_schema(&capability.parameters),
        },
    }
}

/// Build JSON Schema from AgentParameters
fn build_json_schema(parameters: &[AgentParameter]) -> serde_json::Value {
    let mut properties = serde_json::Map::new();
    let mut required = Vec::new();

    for param in parameters {
        if param.required {
            required.push(param.name.clone());
        }

        let param_type = match param.parameter_type.as_str() {
            "string" => "string",
            "number" => "number",
            "boolean" => "boolean",
            "array" => "array",
            "object" => "object",
            _ => "string", // Default fallback
        };

        let mut param_schema = json!({
            "type": param_type,
            "description": param.description,
        });

        if let Some(default) = &param.default_value {
            param_schema["default"] = default.clone();
        }

        properties.insert(param.name.clone(), param_schema);
    }

    json!({
        "type": "object",
        "properties": properties,
        "required": required,
    })
}

/// Get all available tools as ToolDefinitions
pub fn get_all_tool_definitions() -> Vec<ToolDefinition> {
    let capabilities = AgentSession::get_capabilities();
    capabilities.iter()
        .map(capability_to_tool_definition)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capability_to_tool_definition() {
        let cap = AgentCapability {
            name: "read_file".to_string(),
            description: "Read file contents".to_string(),
            parameters: vec![
                AgentParameter {
                    name: "path".to_string(),
                    parameter_type: "string".to_string(),
                    description: "File path".to_string(),
                    required: true,
                    default_value: None,
                },
            ],
        };

        let tool = capability_to_tool_definition(&cap);

        assert_eq!(tool.function.name, "read_file");
        assert_eq!(tool.tool_type, "function");

        let params = tool.function.parameters;
        assert_eq!(params["type"], "object");
        assert!(params["properties"]["path"].is_object());
        assert_eq!(params["required"], json!(["path"]));
    }

    #[test]
    fn test_build_json_schema() {
        let parameters = vec![
            AgentParameter {
                name: "path".to_string(),
                parameter_type: "string".to_string(),
                description: "File path".to_string(),
                required: true,
                default_value: None,
            },
            AgentParameter {
                name: "recursive".to_string(),
                parameter_type: "boolean".to_string(),
                description: "Recursive flag".to_string(),
                required: false,
                default_value: Some(json!(false)),
            },
        ];

        let schema = build_json_schema(&parameters);

        assert_eq!(schema["type"], "object");
        assert_eq!(schema["required"], json!(["path"]));
        assert_eq!(schema["properties"]["path"]["type"], "string");
        assert_eq!(schema["properties"]["recursive"]["type"], "boolean");
        assert_eq!(schema["properties"]["recursive"]["default"], false);
    }
}
