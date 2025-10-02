use crate::database::Database;
use crate::models::*;
use crate::file_operations::{
    open_with_default_app, read_directory_contents, search_in_files, 
    read_file_contents, write_file_contents, DirectoryContents, SearchResult
};
use crate::agentic::{AgentSession, AgentAction, AgentCapability};
use crate::system_operations::{
    launch_application, get_installed_applications, execute_terminal_command,
    perform_file_operation, get_running_processes, kill_process, check_permission_level,
    FileSystemOperation, FileOperationType, PermissionLevel, AppInfo, CommandResult, ProcessInfo
};
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
    db.create_message(request.chat_id, request.content, request.role, request.images)
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

#[tauri::command]
pub async fn send_ai_message(
    db: State<'_, Database>,
    chat_id: String,
    user_message: String,
) -> Result<Message, String> {
    // Get the chat to find its API config
    let chat = db.get_chat(&chat_id).await.map_err(|e| e.to_string())?;
    let chat = chat.ok_or("Chat not found")?;

    // Get API config (use chat's config or default)
    let api_config = if let Some(config_id) = &chat.api_config_id {
        db.get_api_config(config_id).await.map_err(|e| e.to_string())?
    } else {
        db.get_default_api_config().await.map_err(|e| e.to_string())?
    };

    let api_config = api_config.ok_or("No API configuration found")?;

    // Create user message
    let _user_msg = db.create_message(chat_id.clone(), user_message.clone(), MessageRole::User, None)
        .await
        .map_err(|e| e.to_string())?;

    // Get recent messages for context
    let messages = db.get_messages(&chat_id).await.map_err(|e| e.to_string())?;
    
    // Convert to chat format (take last 10 messages for context)
    let chat_messages: Vec<ChatMessage> = messages
        .iter()
        .rev()
        .take(10)
        .rev()
        .map(|msg| {
            let content = if let Some(images) = &msg.images {
                if !images.is_empty() {
                    // Create vision format with text and images
                    let mut content_array = vec![];
                    
                    // Add text content if present
                    if !msg.content.is_empty() {
                        content_array.push(json!({
                            "type": "text",
                            "text": msg.content
                        }));
                    }
                    
                    // Add images
                    for image in images {
                        content_array.push(json!({
                            "type": "image_url",
                            "image_url": {
                                "url": image
                            }
                        }));
                    }
                    
                    json!(content_array)
                } else {
                    // No images, just text
                    json!(msg.content)
                }
            } else {
                // No images, just text
                json!(msg.content)
            };

            ChatMessage {
                role: match msg.role {
                    MessageRole::User => "user".to_string(),
                    MessageRole::Assistant => "assistant".to_string(),
                },
                content,
            }
        })
        .collect();

    // Send to LLM
    let ai_response = db.send_chat_completion(&api_config, chat_messages)
        .await
        .map_err(|e| e.to_string())?;

    // Create assistant message
    let assistant_msg = db.create_message(chat_id, ai_response, MessageRole::Assistant, None)
        .await
        .map_err(|e| e.to_string())?;

    Ok(assistant_msg)
}

#[tauri::command]
pub async fn send_ai_message_streaming(
    window: tauri::Window,
    db: State<'_, Database>,
    chat_id: String,
    user_message: String,
    images: Option<Vec<String>>,
) -> Result<String, String> {
    // Get the chat to find its API config
    let chat = db.get_chat(&chat_id).await.map_err(|e| e.to_string())?;
    let chat = chat.ok_or("Chat not found")?;

    // Get API config (use chat's config or default)
    let api_config = if let Some(config_id) = &chat.api_config_id {
        db.get_api_config(config_id).await.map_err(|e| e.to_string())?
    } else {
        db.get_default_api_config().await.map_err(|e| e.to_string())?
    };

    let api_config = api_config.ok_or("No API configuration found")?;

    // Create user message
    let user_msg = db.create_message(chat_id.clone(), user_message.clone(), MessageRole::User, images)
        .await
        .map_err(|e| e.to_string())?;

    // Emit user message to frontend
    window.emit("message_created", &user_msg).map_err(|e| e.to_string())?;

    // Get recent messages for context
    let messages = db.get_messages(&chat_id).await.map_err(|e| e.to_string())?;
    
    // Convert to chat format (take last 10 messages for context)
    let chat_messages: Vec<ChatMessage> = messages
        .iter()
        .rev()
        .take(10)
        .rev()
        .map(|msg| {
            let content = if let Some(images) = &msg.images {
                if !images.is_empty() {
                    // Create vision format with text and images
                    let mut content_array = vec![];
                    
                    // Add text content if present
                    if !msg.content.is_empty() {
                        content_array.push(json!({
                            "type": "text",
                            "text": msg.content
                        }));
                    }
                    
                    // Add images
                    for image in images {
                        content_array.push(json!({
                            "type": "image_url",
                            "image_url": {
                                "url": image
                            }
                        }));
                    }
                    
                    json!(content_array)
                } else {
                    // No images, just text
                    json!(msg.content)
                }
            } else {
                // No images, just text
                json!(msg.content)
            };

            ChatMessage {
                role: match msg.role {
                    MessageRole::User => "user".to_string(),
                    MessageRole::Assistant => "assistant".to_string(),
                },
                content,
            }
        })
        .collect();

    // Create a placeholder assistant message for streaming
    let assistant_msg_id = uuid::Uuid::new_v4().to_string();
    
    // Emit streaming start event
    window.emit("streaming_start", json!({
        "message_id": assistant_msg_id,
        "chat_id": chat_id
    })).map_err(|e| e.to_string())?;

    // Send to LLM with streaming
    let ai_response = db.send_chat_completion_streaming(&api_config, chat_messages, &window, &assistant_msg_id, &chat_id)
        .await
        .map_err(|e| e.to_string())?;

    // Create final assistant message in database
    let assistant_msg = db.create_message(chat_id, ai_response, MessageRole::Assistant, None)
        .await
        .map_err(|e| e.to_string())?;

    // Emit final message created event
    window.emit("final_message_created", &assistant_msg).map_err(|e| e.to_string())?;

    Ok(assistant_msg.id)
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
    operation: String,
    parameters: HashMap<String, serde_json::Value>,
) -> Result<bool, String> {
    let permission = check_permission_level(&operation, &parameters);
    
    // Emit permission request to frontend
    window.emit("permission_request", json!({
        "operation": permission.operation,
        "description": permission.description,
        "level": permission.level,
        "details": permission.details,
    })).map_err(|e| e.to_string())?;
    
    // In a real implementation, you would wait for user response
    // For now, we'll return based on permission level
    match permission.level {
        PermissionLevel::Safe => Ok(true),
        PermissionLevel::Moderate => Ok(true), // Should wait for user confirmation
        PermissionLevel::Dangerous => Ok(false), // Should require explicit permission
    }
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
