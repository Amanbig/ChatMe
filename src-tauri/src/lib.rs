mod commands;
mod database;
mod models;

use database::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::async_runtime::block_on(async {
        let db = Database::new().await.expect("Failed to initialize database");

        tauri::Builder::default()
            .plugin(tauri_plugin_opener::init())
            .manage(db)
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
            ])
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    });
}
