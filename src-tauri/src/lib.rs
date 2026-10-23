mod commands;
mod database;
mod models;
mod file_operations;
mod agentic;
mod system_operations;
mod tools;
mod llm_streaming;
mod permission_manager;
mod mcp_client;
mod tool_registry;
pub mod web_search;
pub mod tts;

use database::Database;
use permission_manager::PermissionManager;
use mcp_client::McpClientManager;
use tool_registry::ToolRegistry;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use agentic::AgentSession;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        // Fix WebKitGTK DMA-BUF permission denied error with NVIDIA drivers on Linux
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    tauri::async_runtime::block_on(async {
        let db = Database::new().await.expect("Failed to initialize database");
        let agent_sessions: Mutex<HashMap<String, AgentSession>> = Mutex::new(HashMap::new());
        let permission_manager = PermissionManager::new();
        let mcp_manager = Arc::new(McpClientManager::new());
        let tool_registry = Arc::new(ToolRegistry::new(Arc::clone(&mcp_manager)));

        tauri::Builder::default()
            .plugin(tauri_plugin_opener::init())
            .manage(db)
            .manage(agent_sessions)
            .manage(permission_manager)
            .manage(mcp_manager)
            .manage(tool_registry)
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
                // Tool executions
                commands::create_tool_execution,
                commands::get_tool_executions_for_message,
                commands::get_tool_executions_for_messages,
                // File operations
                commands::open_file_with_default_app,
                commands::read_directory,
                commands::search_files,
                commands::read_file,
                commands::read_document,
                commands::duckduckgo_search,
                commands::write_file,
                commands::get_current_directory,
                // Agentic mode
                commands::create_agent_session,
                commands::get_agent_capabilities,
                commands::get_agent_tool_definitions,
                commands::execute_agent_action,
                commands::get_agent_session,
                commands::create_or_get_agent_session,
                // System operations with permissions
                commands::request_permission,
                commands::respond_to_permission,
                commands::clear_chat_permissions,
                commands::clear_permission,
                commands::get_chat_permissions,
                commands::launch_app,
                commands::get_installed_apps,
                commands::execute_command,
                commands::perform_file_system_operation,
                commands::get_processes,
                commands::terminate_process,
                // LLM operations
                commands::fetch_provider_models,
                commands::stream_llm_request,
                // System info
                commands::get_system_info,
                // MCP server management
                commands::create_mcp_server,
                commands::get_mcp_servers,
                commands::get_mcp_server,
                commands::update_mcp_server,
                commands::delete_mcp_server,
                commands::get_mcp_tools_for_server,
                commands::get_enabled_mcp_tools,
                commands::toggle_mcp_tool,
                // MCP connection management
                commands::connect_mcp_server,
                commands::disconnect_mcp_server,
                commands::get_mcp_server_status,
                commands::get_all_mcp_statuses,
                commands::get_merged_tool_definitions,
                commands::execute_tool_routed,
                commands::get_tts_status,
                commands::get_native_tts_voices,
                commands::native_speak,
                commands::native_cancel_speech,
            ])
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    });
}
