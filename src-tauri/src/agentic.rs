use serde::{Deserialize, Serialize, Serializer};
use std::collections::HashMap;
use std::sync::{Mutex, Arc};
use anyhow::{Result, anyhow};
use crate::file_operations::{read_directory_contents, search_in_files, read_file_contents, write_file_contents, open_with_default_app};
use crate::system_operations::{
    get_installed_applications, launch_application, execute_terminal_command,
    perform_file_operation, get_running_processes, kill_process, check_permission_level,
    FileSystemOperation, FileOperationType, PermissionLevel};
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentAction {
    pub action_type: String,
    pub description: String,
    pub parameters: HashMap<String, serde_json::Value>,
    pub result: Option<serde_json::Value>,
    pub success: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AgentSession {
    pub id: String,
    pub active: bool,
    pub actions: Arc<Mutex<Vec<AgentAction>>>,
    pub context: HashMap<String, serde_json::Value>,
    pub current_directory: Arc<Mutex<String>>,
    pub capabilities: Vec<String>,
}

impl Serialize for AgentSession {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("AgentSession", 5)?;
        state.serialize_field("id", &self.id)?;
        state.serialize_field("active", &self.active)?;
        
        let actions = self.actions.lock().map_err(serde::ser::Error::custom)?.clone();
        state.serialize_field("actions", &actions)?;
        
        state.serialize_field("context", &self.context)?;
        
        let current_dir = self.current_directory.lock().map_err(serde::ser::Error::custom)?.clone();
        state.serialize_field("current_directory", &current_dir)?;
        
        state.serialize_field("capabilities", &self.capabilities)?;
        state.end()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentCapability {
    pub name: String,
    pub description: String,
    pub parameters: Vec<AgentParameter>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentParameter {
    pub name: String,
    pub parameter_type: String,
    pub description: String,
    pub required: bool,
    pub default_value: Option<serde_json::Value>,
}

impl AgentSession {
    pub fn new(id: String) -> Self {
        let current_directory = std::env::current_dir()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        
        Self {
            id,
            active: true,
            actions: Arc::new(Mutex::new(Vec::new())),
            context: HashMap::new(),
            current_directory: Arc::new(Mutex::new(current_directory)),
            capabilities: vec![
                "list_directory".to_string(),
                "read_file".to_string(),
                "write_file".to_string(),
                "search_files".to_string(),
                "open_file".to_string(),
                "change_directory".to_string(),
                "get_file_info".to_string(),
                "launch_application".to_string(),
                "get_installed_apps".to_string(),
                "execute_command".to_string(),
                "file_operation".to_string(),
                "get_processes".to_string(),
                "kill_process".to_string(),
            ],
        }
    }
    
    pub fn get_capabilities() -> Vec<AgentCapability> {
        vec![
            AgentCapability {
                name: "list_directory".to_string(),
                description: "List contents of a directory".to_string(),
                parameters: vec![
                    AgentParameter {
                        name: "path".to_string(),
                        parameter_type: "string".to_string(),
                        description: "Directory path to list".to_string(),
                        required: false,
                        default_value: Some(serde_json::Value::String(".".to_string())),
                    },
                    AgentParameter {
                        name: "recursive".to_string(),
                        parameter_type: "boolean".to_string(),
                        description: "Whether to list recursively".to_string(),
                        required: false,
                        default_value: Some(serde_json::Value::Bool(false)),
                    },
                ],
            },
            AgentCapability {
                name: "read_file".to_string(),
                description: "Read contents of a text file".to_string(),
                parameters: vec![
                    AgentParameter {
                        name: "path".to_string(),
                        parameter_type: "string".to_string(),
                        description: "File path to read".to_string(),
                        required: true,
                        default_value: None,
                    },
                ],
            },
            AgentCapability {
                name: "write_file".to_string(),
                description: "Write contents to a file".to_string(),
                parameters: vec![
                    AgentParameter {
                        name: "path".to_string(),
                        parameter_type: "string".to_string(),
                        description: "File path to write to".to_string(),
                        required: true,
                        default_value: None,
                    },
                    AgentParameter {
                        name: "content".to_string(),
                        parameter_type: "string".to_string(),
                        description: "Content to write to the file".to_string(),
                        required: true,
                        default_value: None,
                    },
                ],
            },
            AgentCapability {
                name: "search_files".to_string(),
                description: "Search for text patterns in files using regex".to_string(),
                parameters: vec![
                    AgentParameter {
                        name: "pattern".to_string(),
                        parameter_type: "string".to_string(),
                        description: "Regex pattern to search for".to_string(),
                        required: true,
                        default_value: None,
                    },
                    AgentParameter {
                        name: "directory".to_string(),
                        parameter_type: "string".to_string(),
                        description: "Directory to search in".to_string(),
                        required: false,
                        default_value: Some(serde_json::Value::String(".".to_string())),
                    },
                    AgentParameter {
                        name: "file_extension".to_string(),
                        parameter_type: "string".to_string(),
                        description: "Filter by file extension (e.g., 'rs', 'js')".to_string(),
                        required: false,
                        default_value: None,
                    },
                    AgentParameter {
                        name: "case_sensitive".to_string(),
                        parameter_type: "boolean".to_string(),
                        description: "Whether the search should be case sensitive".to_string(),
                        required: false,
                        default_value: Some(serde_json::Value::Bool(false)),
                    },
                    AgentParameter {
                        name: "recursive".to_string(),
                        parameter_type: "boolean".to_string(),
                        description: "Whether to search recursively".to_string(),
                        required: false,
                        default_value: Some(serde_json::Value::Bool(true)),
                    },
                    AgentParameter {
                        name: "max_results".to_string(),
                        parameter_type: "number".to_string(),
                        description: "Maximum number of results to return".to_string(),
                        required: false,
                        default_value: Some(serde_json::Value::Number(serde_json::Number::from(100))),
                    },
                ],
            },
            AgentCapability {
                name: "open_file".to_string(),
                description: "Open a file with the default system application".to_string(),
                parameters: vec![
                    AgentParameter {
                        name: "path".to_string(),
                        parameter_type: "string".to_string(),
                        description: "File or directory path to open".to_string(),
                        required: true,
                        default_value: None,
                    },
                ],
            },
            AgentCapability {
                name: "change_directory".to_string(),
                description: "Change the current working directory for the agent".to_string(),
                parameters: vec![
                    AgentParameter {
                        name: "path".to_string(),
                        parameter_type: "string".to_string(),
                        description: "Directory path to change to".to_string(),
                        required: true,
                        default_value: None,
                    },
                ],
            },
        ]
    }
    
    pub async fn execute_action(&self, action_type: &str, parameters: HashMap<String, serde_json::Value>) -> Result<AgentAction> {
        let mut action = AgentAction {
            action_type: action_type.to_string(),
            description: format!("Executing {}", action_type),
            parameters: parameters.clone(),
            result: None,
            success: false,
            error_message: None,
        };
        
        let result = match action_type {
            "list_directory" => self.execute_list_directory(&parameters).await,
            "read_file" => self.execute_read_file(&parameters).await,
            "write_file" => self.execute_write_file(&parameters).await,
            "search_files" => self.execute_search_files(&parameters).await,
            "open_file" => self.execute_open_file(&parameters).await,
            "change_directory" => self.execute_change_directory(&parameters).await,
            "launch_application" => self.execute_launch_application(&parameters).await,
            "get_installed_apps" => self.execute_get_installed_apps(&parameters).await,
            "execute_command" => self.execute_command(&parameters).await,
            "file_operation" => self.execute_file_operation(&parameters).await,
            "get_processes" => self.execute_get_processes(&parameters).await,
            "kill_process" => self.execute_kill_process(&parameters).await,
            _ => Err(anyhow!("Unknown action type: {}", action_type)),
        };
        
        match result {
            Ok(value) => {
                action.result = Some(value);
                action.success = true;
                action.description = format!("Successfully executed {}", action_type);
            }
            Err(err) => {
                action.success = false;
                action.error_message = Some(err.to_string());
                action.description = format!("Failed to execute {}: {}", action_type, err);
            }
        }
        
        if let Ok(mut actions) = self.actions.lock() {
            actions.push(action.clone());
        }
        Ok(action)
    }
    
    async fn execute_list_directory(&self, params: &HashMap<String, serde_json::Value>) -> Result<serde_json::Value> {
        let path = params.get("path")
            .and_then(|v| v.as_str())
            .unwrap_or(".");
        
        let recursive = params.get("recursive")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        
        let contents = read_directory_contents(path, recursive)?;
        Ok(serde_json::to_value(contents)?)
    }
    
    async fn execute_read_file(&self, params: &HashMap<String, serde_json::Value>) -> Result<serde_json::Value> {
        let path = params.get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing required parameter: path"))?;
        
        let contents = read_file_contents(path)?;
        Ok(serde_json::Value::String(contents))
    }
    
    async fn execute_write_file(&self, params: &HashMap<String, serde_json::Value>) -> Result<serde_json::Value> {
        let path = params.get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing required parameter: path"))?;
        
        let content = params.get("content")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing required parameter: content"))?;
        
        write_file_contents(path, content)?;
        Ok(serde_json::Value::String(format!("Successfully wrote to {}", path)))
    }
    
    async fn execute_search_files(&self, params: &HashMap<String, serde_json::Value>) -> Result<serde_json::Value> {
        let pattern = params.get("pattern")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing required parameter: pattern"))?;
        
        let directory = params.get("directory")
            .and_then(|v| v.as_str())
            .unwrap_or(".");
        
        let file_extension = params.get("file_extension")
            .and_then(|v| v.as_str());
        
        let case_sensitive = params.get("case_sensitive")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        
        let recursive = params.get("recursive")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);
        
        let max_results = params.get("max_results")
            .and_then(|v| v.as_u64())
            .map(|v| v as usize);
        
        let results = search_in_files(
            directory,
            pattern,
            file_extension,
            case_sensitive,
            recursive,
            max_results,
        )?;
        
        Ok(serde_json::to_value(results)?)
    }
    
    async fn execute_open_file(&self, params: &HashMap<String, serde_json::Value>) -> Result<serde_json::Value> {
        let path = params.get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing required parameter: path"))?;
        
        open_with_default_app(path)?;
        Ok(serde_json::Value::String(format!("Opened {} with default application", path)))
    }
    
    async fn execute_change_directory(&self, params: &HashMap<String, serde_json::Value>) -> Result<serde_json::Value> {
        let path = params.get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing required parameter: path"))?;
        
        let path = std::path::Path::new(path);
        if !path.exists() || !path.is_dir() {
            return Err(anyhow!("Directory does not exist: {}", path.display()));
        }
        
        if let Ok(mut current_dir) = self.current_directory.lock() {
            *current_dir = path.to_string_lossy().to_string();
        }
        
        let dir_display = if let Ok(current_dir) = self.current_directory.lock() {
            current_dir.clone()
        } else {
            "unknown".to_string()
        };
        
        Ok(serde_json::Value::String(format!("Changed directory to {}", dir_display)))
    }
    
    async fn execute_launch_application(&self, params: &HashMap<String, serde_json::Value>) -> Result<serde_json::Value> {
        let app_path = params.get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing required parameter: path"))?;
        
        let args = params.get("arguments")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect());
        
        let pid = launch_application(app_path, args)?;
        Ok(serde_json::json!({
            "success": true,
            "pid": pid,
            "message": format!("Launched application: {}", app_path)
        }))
    }
    
    async fn execute_get_installed_apps(&self, _params: &HashMap<String, serde_json::Value>) -> Result<serde_json::Value> {
        let apps = get_installed_applications()?;
        Ok(serde_json::to_value(apps)?)
    }
    
    async fn execute_command(&self, params: &HashMap<String, serde_json::Value>) -> Result<serde_json::Value> {
        let command = params.get("command")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing required parameter: command"))?;
        
        let working_dir = params.get("working_directory")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| {
                self.current_directory.lock().ok()
                    .map(|dir| dir.clone())
            });
        
        // Check permission level
        let permission = check_permission_level("execute_command", params);
        if permission.level == PermissionLevel::Dangerous {
            return Err(anyhow!("Command requires explicit user permission: {}", command));
        }
        
        let result = execute_terminal_command(command, working_dir.as_deref())?;
        Ok(serde_json::to_value(result)?)
    }
    
    async fn execute_file_operation(&self, params: &HashMap<String, serde_json::Value>) -> Result<serde_json::Value> {
        let operation_type = params.get("operation_type")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing required parameter: operation_type"))?;
        
        let source = params.get("source")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing required parameter: source"))?;
        
        let destination = params.get("destination")
            .and_then(|v| v.as_str())
            .map(String::from);
        
        let recursive = params.get("recursive")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        
        let file_op_type = match operation_type {
            "copy" => FileOperationType::Copy,
            "move" => FileOperationType::Move,
            "delete" => FileOperationType::Delete,
            "create_directory" => FileOperationType::CreateDirectory,
            "rename" => FileOperationType::Rename,
            _ => return Err(anyhow!("Invalid operation type: {}", operation_type)),
        };
        
        let operation = FileSystemOperation {
            operation_type: file_op_type,
            source: source.to_string(),
            destination,
            recursive,
        };
        
        let result = perform_file_operation(&operation)?;
        Ok(serde_json::Value::String(result))
    }
    
    async fn execute_get_processes(&self, _params: &HashMap<String, serde_json::Value>) -> Result<serde_json::Value> {
        let processes = get_running_processes()?;
        Ok(serde_json::to_value(processes)?)
    }
    
    async fn execute_kill_process(&self, params: &HashMap<String, serde_json::Value>) -> Result<serde_json::Value> {
        let pid = params.get("pid")
            .and_then(|v| v.as_u64())
            .map(|v| v as u32)
            .ok_or_else(|| anyhow!("Missing required parameter: pid"))?;
        
        // Check permission level
        let permission = check_permission_level("kill_process", params);
        if permission.level == PermissionLevel::Dangerous {
            return Err(anyhow!("Killing process requires explicit user permission: PID {}", pid));
        }
        
        kill_process(pid)?;
        Ok(serde_json::Value::String(format!("Successfully terminated process with PID: {}", pid)))
    }
}
