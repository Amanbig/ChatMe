mod commands;
mod database;
mod models;
mod file_operations;
mod agentic;

use database::Database;
use std::collections::HashMap;
use std::sync::Mutex;
use agentic::AgentSession;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::async_runtime::block_on(async {
        let db = Database::new().await.expect("Failed to initialize database");
        let agent_sessions: Mutex<HashMap<String, AgentSession>> = Mutex::new(HashMap::new());

        tauri::Builder::default()
            .plugin(tauri_plugin_opener::init())
            .manage(db)
            .manage(agent_sessions)
            .invoke_handler(tauri::generate_handler![
                commands::create_chat,
                commands::get_chats,
                commands::get_chat,
                commands::update_chat,
                commands::delete_chat,
                commands::create_message,
                commands::get_messages,
                commands::delete_message,
                commands::create_api_config,
                commands::get_api_configs,
                commands::get_api_config,
                commands::get_default_api_config,
                commands::update_api_config,
                commands::delete_api_config,
                commands::send_ai_message,
                commands::send_ai_message_streaming,
                // File operations
                commands::open_file_with_default_app,
                commands::read_directory,
                commands::search_files,
                commands::read_file,
                commands::write_file,
                // Agentic mode
                commands::create_agent_session,
                commands::get_agent_capabilities,
                commands::execute_agent_action,
                commands::get_agent_session,
                commands::create_or_get_agent_session,
            ])
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    });
}
