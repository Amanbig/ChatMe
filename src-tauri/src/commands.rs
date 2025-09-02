use crate::database::Database;
use crate::models::*;
use tauri::{State, Emitter};

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
    db.create_message(request.chat_id, request.content, request.role)
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
    let user_msg = db.create_message(chat_id.clone(), user_message.clone(), MessageRole::User)
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
        .map(|msg| ChatMessage {
            role: match msg.role {
                MessageRole::User => "user".to_string(),
                MessageRole::Assistant => "assistant".to_string(),
            },
            content: msg.content.clone(),
        })
        .collect();

    // Send to LLM
    let ai_response = db.send_chat_completion(&api_config, chat_messages)
        .await
        .map_err(|e| e.to_string())?;

    // Create assistant message
    let assistant_msg = db.create_message(chat_id, ai_response, MessageRole::Assistant)
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
    let user_msg = db.create_message(chat_id.clone(), user_message.clone(), MessageRole::User)
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
        .map(|msg| ChatMessage {
            role: match msg.role {
                MessageRole::User => "user".to_string(),
                MessageRole::Assistant => "assistant".to_string(),
            },
            content: msg.content.clone(),
        })
        .collect();

    // Create a placeholder assistant message for streaming
    let assistant_msg_id = uuid::Uuid::new_v4().to_string();
    
    // Emit streaming start event
    window.emit("streaming_start", serde_json::json!({
        "message_id": assistant_msg_id,
        "chat_id": chat_id
    })).map_err(|e| e.to_string())?;

    // Send to LLM with streaming
    let ai_response = db.send_chat_completion_streaming(&api_config, chat_messages, &window, &assistant_msg_id)
        .await
        .map_err(|e| e.to_string())?;

    // Create final assistant message in database
    let assistant_msg = db.create_message(chat_id, ai_response.clone(), MessageRole::Assistant)
        .await
        .map_err(|e| e.to_string())?;

    // Emit streaming complete event
    window.emit("streaming_complete", serde_json::json!({
        "message_id": assistant_msg_id,
        "final_message": assistant_msg
    })).map_err(|e| e.to_string())?;

    Ok(assistant_msg.id)
}