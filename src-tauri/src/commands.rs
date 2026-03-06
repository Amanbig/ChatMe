use crate::database::Database;
use crate::models::*;
use crate::file_operations::{
    open_with_default_app, read_directory_contents, search_in_files,
    read_file_contents, write_file_contents, DirectoryContents, SearchResult
};
use crate::agentic::{AgentSession, AgentAction, AgentCapability};
use crate::tools::get_all_tool_definitions;
use crate::system_operations::{
    launch_application, get_installed_applications, execute_terminal_command,
    perform_file_operation, get_running_processes, kill_process, check_permission_level,
    FileSystemOperation, FileOperationType, PermissionLevel, AppInfo, CommandResult, ProcessInfo
};
use crate::llm_streaming;
use crate::permission_manager::PermissionManager;
use tauri::{State, Emitter};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Mutex;

#[tauri::command]
pub async fn create_chat(db: State<'_, Database>, request: CreateChatRequest) -> Result<Chat, String> {
    db.create_chat(request.title, request.api_config_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_chats(db: State<'_, Database>) -> Result<Vec<ChatWithLastMessage>, String> {
    db.get_chats().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_chat(db: State<'_, Database>, chat_id: String) -> Result<Option<Chat>, String> {
    db.get_chat(&chat_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_chat(
    db: State<'_, Database>,
    chat_id: String,
    request: UpdateChatRequest,
) -> Result<Chat, String> {
    db.update_chat(&chat_id, request.title, request.api_config_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_chat(db: State<'_, Database>, chat_id: String) -> Result<(), String> {
    db.delete_chat(&chat_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_message(
    db: State<'_, Database>,
    request: CreateMessageRequest,
) -> Result<Message, String> {
    db.create_message(request.chat_id, request.content, request.role, request.images, request.permission_request_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_messages(db: State<'_, Database>, chat_id: String) -> Result<Vec<Message>, String> {
    db.get_messages(&chat_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_message(db: State<'_, Database>, message_id: String) -> Result<(), String> {
    db.delete_message(&message_id)
        .await
        .map_err(|e| e.to_string())
}

// API Configuration commands
#[tauri::command]
pub async fn create_api_config(
    db: State<'_, Database>,
    request: CreateApiConfigRequest,
) -> Result<ApiConfig, String> {
    db.create_api_config(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_api_configs(db: State<'_, Database>) -> Result<Vec<ApiConfig>, String> {
    db.get_api_configs().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_api_config(db: State<'_, Database>, config_id: String) -> Result<Option<ApiConfig>, String> {
    db.get_api_config(&config_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_default_api_config(db: State<'_, Database>) -> Result<Option<ApiConfig>, String> {
    db.get_default_api_config().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_api_config(
    db: State<'_, Database>,
    config_id: String,
    request: UpdateApiConfigRequest,
) -> Result<ApiConfig, String> {
    db.update_api_config(&config_id, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_api_config(db: State<'_, Database>, config_id: String) -> Result<(), String> {
    db.delete_api_config(&config_id)
        .await
        .map_err(|e| e.to_string())
}

// Tool Execution Commands
#[tauri::command]
pub async fn create_tool_execution(
    db: State<'_, Database>,
    request: CreateToolExecutionRequest,
) -> Result<ToolExecutionRecord, String> {
    db.create_tool_execution(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tool_executions_for_message(
    db: State<'_, Database>,
    message_id: String,
) -> Result<Vec<ToolExecutionRecord>, String> {
    db.get_tool_executions_for_message(&message_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_tool_executions_for_messages(
    db: State<'_, Database>,
    message_ids: Vec<String>,
) -> Result<HashMap<String, Vec<ToolExecutionRecord>>, String> {
    db.get_tool_executions_for_messages(&message_ids)
        .await
        .map_err(|e| e.to_string())
}

// File Operations Commands
#[tauri::command]
pub async fn open_file_with_default_app(file_path: String) -> Result<String, String> {
    open_with_default_app(&file_path)
        .map_err(|e| e.to_string())?;
    Ok(format!("Opened {} with default application", file_path))
}

#[tauri::command]
pub async fn read_directory(
    directory_path: String,
    recursive: Option<bool>,
) -> Result<DirectoryContents, String> {
    read_directory_contents(&directory_path, recursive.unwrap_or(false))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_files(
    directory_path: String,
    pattern: String,
    file_extension: Option<String>,
    case_sensitive: Option<bool>,
    recursive: Option<bool>,
    max_results: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    search_in_files(
        &directory_path,
        &pattern,
        file_extension.as_deref(),
        case_sensitive.unwrap_or(false),
        recursive.unwrap_or(true),
        max_results,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_file(file_path: String) -> Result<String, String> {
    read_file_contents(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_file(file_path: String, contents: String) -> Result<String, String> {
    write_file_contents(&file_path, &contents)
        .map_err(|e| e.to_string())?;
    Ok(format!("Successfully wrote to {}", file_path))
}

#[tauri::command]
pub async fn get_current_directory() -> Result<String, String> {
    std::env::current_dir()
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

// Agentic Mode Commands
#[tauri::command]
pub async fn create_agent_session(session_id: String) -> Result<AgentSession, String> {
    Ok(AgentSession::new(session_id))
}

#[tauri::command]
pub async fn get_agent_capabilities() -> Result<Vec<AgentCapability>, String> {
    Ok(AgentSession::get_capabilities())
}

#[tauri::command]
pub async fn get_agent_tool_definitions() -> Result<Vec<ToolDefinition>, String> {
    Ok(get_all_tool_definitions())
}

#[tauri::command]
pub async fn execute_agent_action(
    agent_sessions: State<'_, Mutex<HashMap<String, AgentSession>>>,
    session_id: String,
    action_type: String,
    parameters: HashMap<String, serde_json::Value>,
) -> Result<AgentAction, String> {
    // Get the session from the map
    let session = {
        let sessions = agent_sessions.lock().map_err(|e| e.to_string())?;
        sessions.get(&session_id)
            .ok_or_else(|| "Agent session not found".to_string())?
            .clone()
    };
    
    // Execute the action
    let result = session.execute_action(&action_type, parameters).await.map_err(|e| e.to_string())?;
    
    Ok(result)
}

#[tauri::command]
pub async fn get_agent_session(
    agent_sessions: State<'_, Mutex<HashMap<String, AgentSession>>>,
    session_id: String,
) -> Result<AgentSession, String> {
    let sessions = agent_sessions.lock().map_err(|e| e.to_string())?;
    
    sessions.get(&session_id)
        .ok_or_else(|| "Agent session not found".to_string())
        .map(|session| session.clone())
}

#[tauri::command]
pub async fn create_or_get_agent_session(
    agent_sessions: State<'_, Mutex<HashMap<String, AgentSession>>>,
    session_id: String,
) -> Result<AgentSession, String> {
    let mut sessions = agent_sessions.lock().map_err(|e| e.to_string())?;
    
    if let Some(session) = sessions.get(&session_id) {
        Ok(session.clone())
    } else {
        let new_session = AgentSession::new(session_id.clone());
        let session_clone = new_session.clone();
        sessions.insert(session_id, new_session);
        Ok(session_clone)
    }
}

// System Operations Commands with Permission System
#[tauri::command]
pub async fn request_permission(
    window: tauri::Window,
    db: State<'_, Database>,
    permission_manager: State<'_, PermissionManager>,
    operation: String,
    parameters: HashMap<String, serde_json::Value>,
    chat_id: Option<String>,
) -> Result<bool, String> {
    let perm_check = check_permission_level(&operation, &parameters);

    // Convert to our permission request type
    let mut details = HashMap::new();
    for (k, v) in perm_check.details {
        details.insert(k, v);
    }

    let level_str = match perm_check.level {
        PermissionLevel::Safe => "Safe",
        PermissionLevel::Moderate => "Moderate",
        PermissionLevel::Dangerous => "Dangerous",
    };

    let level_converted = match perm_check.level {
        PermissionLevel::Safe => crate::permission_manager::PermissionLevel::Safe,
        PermissionLevel::Moderate => crate::permission_manager::PermissionLevel::Moderate,
        PermissionLevel::Dangerous => crate::permission_manager::PermissionLevel::Dangerous,
    };

    println!("[RUST] request_permission called for operation: {}, chat_id: {:?}, level: {:?}",
             operation, chat_id, level_str);

    // Check if this should be auto-approved (Safe, cached, or already pending)
    let is_cached = permission_manager.is_permission_cached(
        chat_id.clone(),
        operation.clone()
    ).await;

    println!("[RUST] Cache check result for operation '{}' in chat {:?}: is_cached = {}",
             operation, chat_id, is_cached);

    let is_pending = permission_manager.has_pending_permission(
        chat_id.clone(),
        &operation
    ).await;

    println!("[RUST] Pending check result for operation '{}' in chat {:?}: is_pending = {}",
             operation, chat_id, is_pending);

    // If Safe or cached, auto-approve
    if level_converted == crate::permission_manager::PermissionLevel::Safe || is_cached {
        println!("[RUST] ✅ Auto-approving: Safe={}, Cached={}",
                 level_converted == crate::permission_manager::PermissionLevel::Safe, is_cached);
        return Ok(true);
    }

    // If already pending, wait a moment and return error to avoid duplicate
    if is_pending {
        println!("[RUST] Another permission request for '{}' is already pending, skipping duplicate", operation);
        return Err("Permission request already pending. Please respond to the existing request.".to_string());
    }

    // Create permission record in database
    let chat_id_str = chat_id.clone().ok_or_else(|| "chat_id required for permission request".to_string())?;

    let permission = db.create_permission_request(
        chat_id_str.clone(),
        operation.clone(),
        perm_check.description.clone(),
        level_str.to_string(),
        details.clone(),
        "pending".to_string(),
    ).await.map_err(|e| e.to_string())?;

    println!("[RUST] Created permission record with ID: {}", permission.id);

    // Create system message linked to this permission
    let mut message = db.create_message(
        chat_id_str.clone(),
        format!("Permission required for operation: {}", operation),
        MessageRole::System,
        None,
        Some(permission.id.clone()),
    ).await.map_err(|e| e.to_string())?;

    println!("[RUST] Created system message with ID: {}", message.id);

    // Populate the permission_request field for the message
    message.permission_request = Some(permission.clone());

    // Emit event to notify frontend of new permission message
    window.emit("permission_message_created", &message)
        .map_err(|e| e.to_string())?;

    println!("[RUST] Emitted permission_message_created event");

    // Create permission manager request for oneshot channel communication
    // IMPORTANT: Use the same ID as the database permission so frontend can respond
    // IMPORTANT: Use the original operation name (snake_case) for cache consistency
    let pm_request = crate::permission_manager::PermissionRequest {
        id: permission.id.clone(), // Use the database permission ID
        operation: operation.clone(), // Use snake_case tool name for cache consistency
        description: perm_check.description.clone(),
        level: level_converted,
        details,
        chat_id,
    };

    // Wait for user response via permission manager
    let result = permission_manager.request_permission(pm_request).await;

    println!("[RUST] Permission response received: {:?}", result);

    // Update database with result
    match result {
        Ok(approved) => {
            let status = if approved { "approved" } else { "denied" };
            db.update_permission_status(&permission.id, status.to_string())
                .await
                .map_err(|e| e.to_string())?;
            println!("[RUST] Updated permission status to: {}", status);

            // Return the approval status - frontend will handle stopping execution if denied
            Ok(approved)
        }
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub async fn respond_to_permission(
    db: State<'_, Database>,
    permission_manager: State<'_, PermissionManager>,
    request_id: String,
    approved: bool,
) -> Result<(), String> {
    println!("[RUST] respond_to_permission called for ID: {}, approved: {}", request_id, approved);

    // Update database
    let status = if approved { "approved" } else { "denied" };
    db.update_permission_status(&request_id, status.to_string())
        .await
        .map_err(|e| e.to_string())?;

    // Notify permission manager (oneshot channel)
    let result = permission_manager.respond_to_permission(request_id.clone(), approved).await;
    println!("[RUST] respond_to_permission result for ID {}: {:?}", request_id, result);
    result
}

#[tauri::command]
pub async fn clear_chat_permissions(
    permission_manager: State<'_, PermissionManager>,
    chat_id: String,
) -> Result<(), String> {
    permission_manager.clear_chat_permissions(chat_id).await
}

#[tauri::command]
pub async fn clear_permission(
    permission_manager: State<'_, PermissionManager>,
    chat_id: String,
    operation: String,
) -> Result<(), String> {
    permission_manager.clear_permission(chat_id, operation).await
}

#[tauri::command]
pub async fn get_chat_permissions(
    permission_manager: State<'_, PermissionManager>,
    chat_id: String,
) -> Result<Vec<String>, String> {
    Ok(permission_manager.get_chat_permissions(chat_id).await)
}

#[tauri::command]
pub async fn launch_app(
    window: tauri::Window,
    app_path: String,
    arguments: Option<Vec<String>>,
    request_permission: bool,
) -> Result<u32, String> {
    if request_permission {
        let mut params = HashMap::new();
        params.insert("path".to_string(), json!(app_path));
        if let Some(ref args) = arguments {
            params.insert("arguments".to_string(), json!(args));
        }
        
        let permission = check_permission_level("launch_app", &params);
        
        // Emit permission request and wait for response
        window.emit("permission_request", json!({
            "operation": permission.operation,
            "description": permission.description,
            "level": permission.level,
            "details": permission.details,
            "callback_id": "launch_app"
        })).map_err(|e| e.to_string())?;
        
        // For now, proceed if not dangerous
        if permission.level == PermissionLevel::Dangerous {
            return Err("Permission denied: This operation requires explicit user permission".to_string());
        }
    }
    
    launch_application(&app_path, arguments)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_installed_apps() -> Result<Vec<AppInfo>, String> {
    get_installed_applications()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn execute_command(
    window: tauri::Window,
    command: String,
    working_directory: Option<String>,
    request_permission: bool,
) -> Result<CommandResult, String> {
    if request_permission {
        let mut params = HashMap::new();
        params.insert("command".to_string(), json!(command));
        if let Some(ref dir) = working_directory {
            params.insert("working_directory".to_string(), json!(dir));
        }
        
        let permission = check_permission_level("execute_command", &params);
        
        // Emit permission request
        window.emit("permission_request", json!({
            "operation": permission.operation,
            "description": permission.description,
            "level": permission.level,
            "details": permission.details,
            "callback_id": "execute_command"
        })).map_err(|e| e.to_string())?;
        
        // Block dangerous commands without explicit permission
        if permission.level == PermissionLevel::Dangerous {
            return Err("Permission denied: This command requires explicit user permission".to_string());
        }
    }
    
    execute_terminal_command(&command, working_directory.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn perform_file_system_operation(
    window: tauri::Window,
    operation_type: String,
    source: String,
    destination: Option<String>,
    recursive: bool,
    request_permission: bool,
) -> Result<String, String> {
    let file_op_type = match operation_type.as_str() {
        "copy" => FileOperationType::Copy,
        "move" => FileOperationType::Move,
        "delete" => FileOperationType::Delete,
        "create_directory" => FileOperationType::CreateDirectory,
        "rename" => FileOperationType::Rename,
        _ => return Err(format!("Invalid operation type: {}", operation_type)),
    };
    
    if request_permission && matches!(file_op_type, FileOperationType::Delete) {
        let mut params = HashMap::new();
        params.insert("path".to_string(), json!(source));
        
        let permission = check_permission_level("delete_file", &params);
        
        window.emit("permission_request", json!({
            "operation": permission.operation,
            "description": permission.description,
            "level": permission.level,
            "details": permission.details,
            "callback_id": "file_operation"
        })).map_err(|e| e.to_string())?;
        
        if permission.level == PermissionLevel::Dangerous {
            return Err("Permission denied: Deleting system files requires explicit permission".to_string());
        }
    }
    
    let operation = FileSystemOperation {
        operation_type: file_op_type,
        source,
        destination,
        recursive,
    };
    
    perform_file_operation(&operation)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_processes() -> Result<Vec<ProcessInfo>, String> {
    get_running_processes()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn terminate_process(
    window: tauri::Window,
    pid: u32,
    request_permission: bool,
) -> Result<String, String> {
    if request_permission {
        let mut params = HashMap::new();
        params.insert("pid".to_string(), json!(pid));
        
        let permission = check_permission_level("kill_process", &params);
        
        window.emit("permission_request", json!({
            "operation": permission.operation,
            "description": permission.description,
            "level": permission.level,
            "details": permission.details,
            "callback_id": "kill_process"
        })).map_err(|e| e.to_string())?;
        
        // Always require explicit permission for killing processes
        return Err("Permission required: Terminating processes requires explicit user permission".to_string());
    }
    
    kill_process(pid)
        .map_err(|e| e.to_string())?;

    Ok(format!("Successfully terminated process with PID: {}", pid))
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

/// Fetch available models from provider API (bypasses CORS)
#[tauri::command]
pub async fn fetch_provider_models(
    provider: String,
    api_key: String,
    base_url: Option<String>,
) -> Result<Vec<ModelInfo>, String> {
    let client = reqwest::Client::new();

    match provider.as_str() {
        "openai" => {
            let url = base_url.unwrap_or_else(|| "https://api.openai.com/v1".to_string());
            fetch_openai_models(&client, &api_key, &url).await
        }
        "anthropic" => {
            Ok(get_anthropic_models())
        }
        "deepseek" => {
            let url = base_url.unwrap_or_else(|| "https://api.deepseek.com/v1".to_string());
            fetch_openai_compatible_models(&client, &api_key, &url).await
        }
        "lmstudio" => {
            let url = base_url.unwrap_or_else(|| "http://localhost:1234/v1".to_string());
            fetch_openai_compatible_models(&client, &api_key, &url).await
        }
        "mistral" => {
            let url = base_url.unwrap_or_else(|| "https://api.mistral.ai/v1".to_string());
            fetch_openai_compatible_models(&client, &api_key, &url).await
        }
        "kimi" => {
            let url = base_url.unwrap_or_else(|| "https://api.moonshot.cn/v1".to_string());
            fetch_openai_compatible_models(&client, &api_key, &url).await
        }
        "openrouter" => {
            let url = base_url.unwrap_or_else(|| "https://openrouter.ai/api/v1".to_string());
            fetch_openai_compatible_models(&client, &api_key, &url).await
        }
        "together" => {
            let url = base_url.unwrap_or_else(|| "https://api.together.xyz/v1".to_string());
            fetch_openai_compatible_models(&client, &api_key, &url).await
        }
        "groq" => {
            let url = base_url.unwrap_or_else(|| "https://api.groq.com/openai/v1".to_string());
            fetch_openai_compatible_models(&client, &api_key, &url).await
        }
        "perplexity" => {
            let url = base_url.unwrap_or_else(|| "https://api.perplexity.ai".to_string());
            fetch_openai_compatible_models(&client, &api_key, &url).await
        }
        "ollama" => {
            let mut url = base_url.unwrap_or_else(|| "http://localhost:11434".to_string());
            // Strip /v1 suffix for Ollama
            if url.ends_with("/v1") || url.ends_with("/v1/") {
                url = url.trim_end_matches('/').trim_end_matches("/v1").to_string();
            }
            fetch_ollama_models(&client, &url).await
        }
        "google" => {
            Ok(get_google_models())
        }
        "custom" => {
            if let Some(url) = base_url {
                fetch_openai_compatible_models(&client, &api_key, &url).await
            } else {
                Ok(vec![])
            }
        }
        _ => Ok(vec![]),
    }
}

async fn fetch_openai_models(
    client: &reqwest::Client,
    api_key: &str,
    base_url: &str,
) -> Result<Vec<ModelInfo>, String> {
    let url = format!("{}/models", base_url);

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API returned error: {}", response.status()));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let models = json["data"]
        .as_array()
        .ok_or("Invalid response format")?
        .iter()
        .filter_map(|m| {
            let id = m["id"].as_str()?;
            if id.contains("gpt") {
                Some(ModelInfo {
                    id: id.to_string(),
                    name: id.to_string(),
                    description: None,
                })
            } else {
                None
            }
        })
        .collect();

    Ok(models)
}

async fn fetch_openai_compatible_models(
    client: &reqwest::Client,
    api_key: &str,
    base_url: &str,
) -> Result<Vec<ModelInfo>, String> {
    let url = format!("{}/models", base_url);

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API returned error: {}", response.status()));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let models = json["data"]
        .as_array()
        .ok_or("Invalid response format")?
        .iter()
        .filter_map(|m| {
            let id = m["id"].as_str()?;
            Some(ModelInfo {
                id: id.to_string(),
                name: id.to_string(),
                description: None,
            })
        })
        .collect();

    Ok(models)
}

async fn fetch_ollama_models(
    client: &reqwest::Client,
    base_url: &str,
) -> Result<Vec<ModelInfo>, String> {
    let url = format!("{}/api/tags", base_url);

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch Ollama models: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Ollama API returned error: {}", response.status()));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    let models = json["models"]
        .as_array()
        .ok_or("Invalid Ollama response format")?
        .iter()
        .filter_map(|m| {
            let name = m["name"].as_str()?;
            let size = m["size"].as_u64().unwrap_or(0);
            Some(ModelInfo {
                id: name.to_string(),
                name: name.to_string(),
                description: Some(format!("Size: {}", format_bytes(size))),
            })
        })
        .collect();

    Ok(models)
}

fn get_anthropic_models() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "claude-3-5-sonnet-20241022".to_string(),
            name: "Claude 3.5 Sonnet".to_string(),
            description: Some("Most intelligent model".to_string()),
        },
        ModelInfo {
            id: "claude-3-5-haiku-20241022".to_string(),
            name: "Claude 3.5 Haiku".to_string(),
            description: Some("Fastest model".to_string()),
        },
        ModelInfo {
            id: "claude-3-opus-20240229".to_string(),
            name: "Claude 3 Opus".to_string(),
            description: Some("Powerful model for complex tasks".to_string()),
        },
        ModelInfo {
            id: "claude-3-sonnet-20240229".to_string(),
            name: "Claude 3 Sonnet".to_string(),
            description: Some("Balanced model".to_string()),
        },
        ModelInfo {
            id: "claude-3-haiku-20240307".to_string(),
            name: "Claude 3 Haiku".to_string(),
            description: Some("Fast and efficient".to_string()),
        },
    ]
}

fn get_google_models() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "gemini-2.0-flash-exp".to_string(),
            name: "Gemini 2.0 Flash (Experimental)".to_string(),
            description: Some("Latest experimental model".to_string()),
        },
        ModelInfo {
            id: "gemini-1.5-pro".to_string(),
            name: "Gemini 1.5 Pro".to_string(),
            description: Some("Most capable model".to_string()),
        },
        ModelInfo {
            id: "gemini-1.5-flash".to_string(),
            name: "Gemini 1.5 Flash".to_string(),
            description: Some("Fast and efficient".to_string()),
        },
        ModelInfo {
            id: "gemini-1.0-pro".to_string(),
            name: "Gemini 1.0 Pro".to_string(),
            description: Some("Stable production model".to_string()),
        },
    ]
}

fn format_bytes(bytes: u64) -> String {
    if bytes == 0 {
        return "0 Bytes".to_string();
    }

    let k: f64 = 1024.0;
    let sizes = ["Bytes", "KB", "MB", "GB"];
    let i = (bytes as f64).log(k).floor() as usize;
    let size = (bytes as f64) / k.powi(i as i32);

    format!("{:.2} {}", size, sizes[i.min(3)])
}

/// Stream LLM request through Rust backend (bypasses CORS and Tauri HTTP plugin issues)
#[tauri::command]
pub async fn stream_llm_request(
    window: tauri::Window,
    provider: String,
    api_key: String,
    base_url: Option<String>,
    model: String,
    messages: Vec<serde_json::Value>,
    tools: Option<Vec<serde_json::Value>>,
    temperature: f32,
    max_tokens: Option<u32>,
    stream_id: String,
) -> Result<(), String> {
    // Route to appropriate streaming function based on provider
    match provider.as_str() {
        "anthropic" => {
            llm_streaming::stream_anthropic(
                &window,
                &api_key,
                &model,
                messages,
                tools,
                temperature,
                max_tokens,
                &stream_id,
            )
            .await
        }
        "google" => {
            llm_streaming::stream_google(
                &window,
                &api_key,
                &model,
                messages,
                tools,
                temperature,
                &stream_id,
            )
            .await
        }
        "openai" | "deepseek" | "mistral" | "lmstudio" | "kimi"
        | "openrouter" | "together" | "groq" | "perplexity" | "ollama" | "custom" => {
            let base_url = base_url.unwrap_or_else(|| {
                llm_streaming::get_default_base_url(&provider)
            });
            llm_streaming::stream_openai_compatible(
                &window,
                &base_url,
                &api_key,
                &model,
                messages,
                tools,
                temperature,
                max_tokens,
                &stream_id,
            )
            .await
        }
        _ => Err(format!("Provider '{}' is not yet supported for streaming", provider)),
    }
}

#[tauri::command]
pub fn get_system_info() -> Result<serde_json::Value, String> {
    Ok(json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "family": std::env::consts::FAMILY,
    }))
}

