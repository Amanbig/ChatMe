use crate::database::Database;
use crate::models::*;
use crate::file_operations::{
    open_with_default_app, read_directory_contents, search_in_files, 
    read_file_contents, write_file_contents, DirectoryContents, SearchResult
};
use crate::agentic::{AgentSession, AgentAction, AgentCapability};
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
