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
            ])
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    });
}
