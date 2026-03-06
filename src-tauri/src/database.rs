use anyhow::Result;
use chrono::Utc;
use sqlx::{migrate::MigrateDatabase, Pool, Sqlite, SqlitePool, Row};
use std::path::PathBuf;
use uuid::Uuid;

use crate::models::*;

pub struct Database {
    pool: Pool<Sqlite>,
}

impl Database {
    pub async fn new() -> Result<Self> {
        let app_dir = dirs::data_local_dir()
            .map(|dir| dir.join("chatme"))
            .unwrap_or_else(|| PathBuf::from("."));
        
        std::fs::create_dir_all(&app_dir)?;
        let database_path = app_dir.join("chatme.db");
        let database_url = format!("sqlite:{}", database_path.display());

        // Create database if it doesn't exist
        if !Sqlite::database_exists(&database_url).await.unwrap_or(false) {
            Sqlite::create_database(&database_url).await?;
        }

        let pool = SqlitePool::connect(&database_url).await?;

        // Run migrations
        sqlx::migrate!("./migrations").run(&pool).await.map_err(|e| {
            eprintln!("Migration error: {}", e);
            e
        })?;

        Ok(Database { pool })
    }

    // Chat operations
    pub async fn create_chat(&self, title: String, api_config_id: Option<String>) -> Result<Chat> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let chat = sqlx::query_as::<_, Chat>(
            "INSERT INTO chats (id, title, api_config_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING *"
        )
        .bind(&id)
        .bind(&title)
        .bind(&api_config_id)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(chat)
    }

    pub async fn get_chats(&self) -> Result<Vec<ChatWithLastMessage>> {
        let rows = sqlx::query(
            r#"
            SELECT 
                c.id,
                c.title,
                c.api_config_id,
                ac.name as api_config_name,
                c.created_at,
                c.updated_at,
                m.content as last_message,
                m.created_at as last_message_time
            FROM chats c
            LEFT JOIN api_configs ac ON c.api_config_id = ac.id
            LEFT JOIN (
                SELECT DISTINCT chat_id, content, created_at,
                       ROW_NUMBER() OVER (PARTITION BY chat_id ORDER BY created_at DESC) as rn
                FROM messages
            ) m ON c.id = m.chat_id AND m.rn = 1
            ORDER BY COALESCE(m.created_at, c.updated_at) DESC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let chats = rows
            .into_iter()
            .map(|row| {
                ChatWithLastMessage {
                    id: row.get("id"),
                    title: row.get("title"),
                    api_config_id: row.get("api_config_id"),
                    api_config_name: row.get("api_config_name"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                    last_message: row.get("last_message"),
                    last_message_time: row.get("last_message_time"),
                    unread_count: 0, // TODO: Implement unread count logic
                }
            })
            .collect();

        Ok(chats)
    }

    pub async fn get_chat(&self, chat_id: &str) -> Result<Option<Chat>> {
        let chat = sqlx::query_as::<_, Chat>("SELECT * FROM chats WHERE id = ?")
            .bind(chat_id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(chat)
    }

    pub async fn update_chat(&self, chat_id: &str, title: String, api_config_id: Option<String>) -> Result<Chat> {
        let now = Utc::now();
        
        let chat = sqlx::query_as::<_, Chat>(
            "UPDATE chats SET title = ?, api_config_id = ?, updated_at = ? WHERE id = ? RETURNING *"
        )
        .bind(&title)
        .bind(&api_config_id)
        .bind(now)
        .bind(chat_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(chat)
    }

    pub async fn delete_chat(&self, chat_id: &str) -> Result<()> {
        // Delete messages first (foreign key constraint)
        sqlx::query("DELETE FROM messages WHERE chat_id = ?")
            .bind(chat_id)
            .execute(&self.pool)
            .await?;

        // Delete chat
        sqlx::query("DELETE FROM chats WHERE id = ?")
            .bind(chat_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // Message operations
    pub async fn create_message(&self, chat_id: String, content: String, role: MessageRole, images: Option<Vec<String>>, permission_request_id: Option<String>) -> Result<Message> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        // Serialize images to JSON string if present
        let images_json = match images.as_ref() {
            Some(imgs) if !imgs.is_empty() => Some(serde_json::to_string(imgs)?),
            _ => None,
        };

        sqlx::query(
            "INSERT INTO messages (id, chat_id, content, role, created_at, images, permission_request_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&chat_id)
        .bind(&content)
        .bind(&role)
        .bind(now)
        .bind(&images_json)
        .bind(&permission_request_id)
        .execute(&self.pool)
        .await?;

        // Update chat's updated_at timestamp
        sqlx::query("UPDATE chats SET updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(&chat_id)
            .execute(&self.pool)
            .await?;

        Ok(Message {
            id,
            chat_id,
            content,
            role,
            created_at: now,
            images,
            permission_request_id,
            permission_request: None,
        })
    }

    pub async fn get_messages(&self, chat_id: &str) -> Result<Vec<Message>> {
        // Query messages with optional permission_request join
        let rows = sqlx::query(
            "SELECT
                m.id, m.chat_id, m.content, m.role, m.created_at, m.images, m.permission_request_id,
                p.id as perm_id, p.chat_id as perm_chat_id, p.operation, p.description, p.level,
                p.details, p.status, p.created_at as perm_created_at, p.updated_at as perm_updated_at
            FROM messages m
            LEFT JOIN permission_requests p ON m.permission_request_id = p.id
            WHERE m.chat_id = ?
            ORDER BY m.created_at ASC"
        )
        .bind(chat_id)
        .fetch_all(&self.pool)
        .await?;

        let mut messages = Vec::new();
        for row in rows {
            let role_str: String = row.try_get("role")?;
            let role = match role_str.as_str() {
                "user" => MessageRole::User,
                "assistant" => MessageRole::Assistant,
                "system" => MessageRole::System,
                _ => return Err(anyhow::anyhow!("Invalid message role: {}", role_str)),
            };

            // Parse images from JSON string
            let images: Option<Vec<String>> = match row.try_get::<Option<String>, _>("images")? {
                Some(images_str) => serde_json::from_str(&images_str).ok(),
                None => None,
            };

            let permission_request_id: Option<String> = row.try_get("permission_request_id")?;

            // Build permission_request if joined
            let permission_request = if let Some(perm_id) = row.try_get::<Option<String>, _>("perm_id")? {
                let details_json: Option<String> = row.try_get("details")?;
                let details = match details_json {
                    Some(json_str) => serde_json::from_str(&json_str).unwrap_or_default(),
                    None => std::collections::HashMap::new(),
                };

                Some(crate::models::PermissionRequest {
                    id: perm_id,
                    chat_id: row.try_get("perm_chat_id")?,
                    operation: row.try_get("operation")?,
                    description: row.try_get("description")?,
                    level: row.try_get("level")?,
                    details,
                    status: row.try_get("status")?,
                    created_at: row.try_get("perm_created_at")?,
                    updated_at: row.try_get("perm_updated_at")?,
                })
            } else {
                None
            };

            messages.push(Message {
                id: row.try_get("id")?,
                chat_id: row.try_get("chat_id")?,
                content: row.try_get("content")?,
                role,
                created_at: row.try_get("created_at")?,
                images,
                permission_request_id,
                permission_request,
            });
        }

        Ok(messages)
    }

    pub async fn delete_message(&self, message_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM messages WHERE id = ?")
            .bind(message_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // Permission operations
    pub async fn create_permission_request(
        &self,
        chat_id: String,
        operation: String,
        description: String,
        level: String,
        details: std::collections::HashMap<String, String>,
        status: String,
    ) -> Result<crate::models::PermissionRequest> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        // Serialize details to JSON string
        let details_json = serde_json::to_string(&details)?;

        sqlx::query(
            "INSERT INTO permission_requests (id, chat_id, operation, description, level, details, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&chat_id)
        .bind(&operation)
        .bind(&description)
        .bind(&level)
        .bind(&details_json)
        .bind(&status)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(crate::models::PermissionRequest {
            id,
            chat_id,
            operation,
            description,
            level,
            details,
            status,
            created_at: now,
            updated_at: now,
        })
    }

    pub async fn get_permission_request(&self, permission_id: &str) -> Result<Option<crate::models::PermissionRequest>> {
        let row = sqlx::query(
            "SELECT id, chat_id, operation, description, level, details, status, created_at, updated_at FROM permission_requests WHERE id = ?"
        )
        .bind(permission_id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => {
                let details_json: String = row.try_get("details")?;
                let details = serde_json::from_str(&details_json).unwrap_or_default();

                Ok(Some(crate::models::PermissionRequest {
                    id: row.try_get("id")?,
                    chat_id: row.try_get("chat_id")?,
                    operation: row.try_get("operation")?,
                    description: row.try_get("description")?,
                    level: row.try_get("level")?,
                    details,
                    status: row.try_get("status")?,
                    created_at: row.try_get("created_at")?,
                    updated_at: row.try_get("updated_at")?,
                }))
            }
            None => Ok(None),
        }
    }

    pub async fn update_permission_status(&self, permission_id: &str, status: String) -> Result<()> {
        let now = Utc::now();

        sqlx::query(
            "UPDATE permission_requests SET status = ?, updated_at = ? WHERE id = ?"
        )
        .bind(&status)
        .bind(now)
        .bind(permission_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_chat_permissions(&self, chat_id: &str) -> Result<Vec<crate::models::PermissionRequest>> {
        let rows = sqlx::query(
            "SELECT id, chat_id, operation, description, level, details, status, created_at, updated_at FROM permission_requests WHERE chat_id = ? ORDER BY created_at DESC"
        )
        .bind(chat_id)
        .fetch_all(&self.pool)
        .await?;

        let mut permissions = Vec::new();
        for row in rows {
            let details_json: String = row.try_get("details")?;
            let details = serde_json::from_str(&details_json).unwrap_or_default();

            permissions.push(crate::models::PermissionRequest {
                id: row.try_get("id")?,
                chat_id: row.try_get("chat_id")?,
                operation: row.try_get("operation")?,
                description: row.try_get("description")?,
                level: row.try_get("level")?,
                details,
                status: row.try_get("status")?,
                created_at: row.try_get("created_at")?,
                updated_at: row.try_get("updated_at")?,
            });
        }

        Ok(permissions)
    }

    // API Configuration operations
    pub async fn create_api_config(&self, request: CreateApiConfigRequest) -> Result<ApiConfig> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        // If this is set as default, unset all other defaults
        if request.is_default {
            sqlx::query("UPDATE api_configs SET is_default = FALSE")
                .execute(&self.pool)
                .await?;
        }

        let config = sqlx::query_as::<_, ApiConfig>(
            r#"
            INSERT INTO api_configs (
                id, name, provider, api_key, base_url, model, 
                temperature, max_tokens, is_default, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
            RETURNING *
            "#
        )
        .bind(&id)
        .bind(&request.name)
        .bind(&request.provider)
        .bind(&request.api_key)
        .bind(&request.base_url)
        .bind(&request.model)
        .bind(request.temperature)
        .bind(request.max_tokens)
        .bind(request.is_default)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(config)
    }

    pub async fn get_api_configs(&self) -> Result<Vec<ApiConfig>> {
        let configs = sqlx::query_as::<_, ApiConfig>(
            "SELECT * FROM api_configs ORDER BY is_default DESC, name ASC"
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(configs)
    }

    pub async fn get_api_config(&self, config_id: &str) -> Result<Option<ApiConfig>> {
        let config = sqlx::query_as::<_, ApiConfig>(
            "SELECT * FROM api_configs WHERE id = ?"
        )
        .bind(config_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(config)
    }

    pub async fn get_default_api_config(&self) -> Result<Option<ApiConfig>> {
        let config = sqlx::query_as::<_, ApiConfig>(
            "SELECT * FROM api_configs WHERE is_default = TRUE LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(config)
    }

    pub async fn update_api_config(&self, config_id: &str, request: UpdateApiConfigRequest) -> Result<ApiConfig> {
        let now = Utc::now();

        // If this is set as default, unset all other defaults
        if request.is_default {
            sqlx::query("UPDATE api_configs SET is_default = FALSE")
                .execute(&self.pool)
                .await?;
        }

        let config = sqlx::query_as::<_, ApiConfig>(
            r#"
            UPDATE api_configs SET 
                name = ?, api_key = ?, base_url = ?, model = ?, 
                temperature = ?, max_tokens = ?, is_default = ?, updated_at = ?
            WHERE id = ? 
            RETURNING *
            "#
        )
        .bind(&request.name)
        .bind(&request.api_key)
        .bind(&request.base_url)
        .bind(&request.model)
        .bind(request.temperature)
        .bind(request.max_tokens)
        .bind(request.is_default)
        .bind(now)
        .bind(config_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(config)
    }

    pub async fn delete_api_config(&self, config_id: &str) -> Result<()> {
        // Don't allow deleting if it's the only config or if chats are using it
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM api_configs")
            .fetch_one(&self.pool)
            .await?;

        if count <= 1 {
            return Err(anyhow::anyhow!("Cannot delete the last API configuration"));
        }

        let chats_using: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM chats WHERE api_config_id = ?")
            .bind(config_id)
            .fetch_one(&self.pool)
            .await?;

        if chats_using > 0 {
            return Err(anyhow::anyhow!("Cannot delete API configuration that is being used by chats"));
        }

        sqlx::query("DELETE FROM api_configs WHERE id = ?")
            .bind(config_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // LLM Integration

    // Tool Execution operations
    pub async fn create_tool_execution(&self, request: CreateToolExecutionRequest) -> Result<ToolExecutionRecord> {
        let id = Uuid::new_v4().to_string();

        // Parse timestamps from ISO strings
        let started_at = chrono::DateTime::parse_from_rfc3339(&request.started_at)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let completed_at = request.completed_at.as_ref().and_then(|s| {
            chrono::DateTime::parse_from_rfc3339(s)
                .map(|dt| dt.with_timezone(&Utc))
                .ok()
        });

        // Serialize JSON fields
        let arguments_json = serde_json::to_string(&request.arguments)?;
        let result_json = request.result.as_ref().map(|r| serde_json::to_string(r)).transpose()?;

        sqlx::query(
            r#"
            INSERT INTO tool_executions (
                id, message_id, tool_call_id, tool_name, tool_source,
                arguments, result, success, error_message, execution_order,
                started_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&id)
        .bind(&request.message_id)
        .bind(&request.tool_call_id)
        .bind(&request.tool_name)
        .bind(&request.tool_source)
        .bind(&arguments_json)
        .bind(&result_json)
        .bind(request.success)
        .bind(&request.error_message)
        .bind(request.execution_order)
        .bind(started_at)
        .bind(completed_at)
        .execute(&self.pool)
        .await?;

        Ok(ToolExecutionRecord {
            id,
            message_id: request.message_id,
            tool_call_id: request.tool_call_id,
            tool_name: request.tool_name,
            tool_source: request.tool_source,
            arguments: request.arguments,
            result: request.result,
            success: request.success,
            error_message: request.error_message,
            execution_order: request.execution_order,
            started_at,
            completed_at,
        })
    }

    pub async fn get_tool_executions_for_message(&self, message_id: &str) -> Result<Vec<ToolExecutionRecord>> {
        let rows = sqlx::query(
            r#"
            SELECT id, message_id, tool_call_id, tool_name, tool_source,
                   arguments, result, success, error_message, execution_order,
                   started_at, completed_at
            FROM tool_executions
            WHERE message_id = ?
            ORDER BY execution_order ASC
            "#
        )
        .bind(message_id)
        .fetch_all(&self.pool)
        .await?;

        let mut executions = Vec::new();
        for row in rows {
            let arguments_json: String = row.try_get("arguments")?;
            let arguments: serde_json::Value = serde_json::from_str(&arguments_json)?;

            let result_json: Option<String> = row.try_get("result")?;
            let result: Option<serde_json::Value> = result_json
                .map(|s| serde_json::from_str(&s))
                .transpose()?;

            executions.push(ToolExecutionRecord {
                id: row.try_get("id")?,
                message_id: row.try_get("message_id")?,
                tool_call_id: row.try_get("tool_call_id")?,
                tool_name: row.try_get("tool_name")?,
                tool_source: row.try_get("tool_source")?,
                arguments,
                result,
                success: row.try_get("success")?,
                error_message: row.try_get("error_message")?,
                execution_order: row.try_get("execution_order")?,
                started_at: row.try_get("started_at")?,
                completed_at: row.try_get("completed_at")?,
            });
        }

        Ok(executions)
    }

    pub async fn get_tool_executions_for_messages(&self, message_ids: &[String]) -> Result<std::collections::HashMap<String, Vec<ToolExecutionRecord>>> {
        if message_ids.is_empty() {
            return Ok(std::collections::HashMap::new());
        }

        // Build placeholders for IN clause
        let placeholders: Vec<String> = message_ids.iter().map(|_| "?".to_string()).collect();
        let query = format!(
            r#"
            SELECT id, message_id, tool_call_id, tool_name, tool_source,
                   arguments, result, success, error_message, execution_order,
                   started_at, completed_at
            FROM tool_executions
            WHERE message_id IN ({})
            ORDER BY message_id, execution_order ASC
            "#,
            placeholders.join(", ")
        );

        let mut query_builder = sqlx::query(&query);
        for id in message_ids {
            query_builder = query_builder.bind(id);
        }

        let rows = query_builder.fetch_all(&self.pool).await?;

        let mut result_map: std::collections::HashMap<String, Vec<ToolExecutionRecord>> = std::collections::HashMap::new();

        for row in rows {
            let arguments_json: String = row.try_get("arguments")?;
            let arguments: serde_json::Value = serde_json::from_str(&arguments_json)?;

            let result_json: Option<String> = row.try_get("result")?;
            let result: Option<serde_json::Value> = result_json
                .map(|s| serde_json::from_str(&s))
                .transpose()?;

            let message_id: String = row.try_get("message_id")?;
            let execution = ToolExecutionRecord {
                id: row.try_get("id")?,
                message_id: message_id.clone(),
                tool_call_id: row.try_get("tool_call_id")?,
                tool_name: row.try_get("tool_name")?,
                tool_source: row.try_get("tool_source")?,
                arguments,
                result,
                success: row.try_get("success")?,
                error_message: row.try_get("error_message")?,
                execution_order: row.try_get("execution_order")?,
                started_at: row.try_get("started_at")?,
                completed_at: row.try_get("completed_at")?,
            };

            result_map.entry(message_id).or_insert_with(Vec::new).push(execution);
        }

        Ok(result_map)
    }

    // MCP Server operations
    pub async fn create_mcp_server(&self, request: CreateMcpServerRequest) -> Result<McpServer> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        // Serialize JSON fields
        let args_json = request.args.as_ref().map(|a| serde_json::to_string(a)).transpose()?;
        let env_json = request.env.as_ref().map(|e| serde_json::to_string(e)).transpose()?;
        let headers_json = request.headers.as_ref().map(|h| serde_json::to_string(h)).transpose()?;

        sqlx::query(
            r#"
            INSERT INTO mcp_servers (
                id, name, transport_type, command, args, env, url, headers,
                enabled, auto_connect, connection_timeout_ms, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&id)
        .bind(&request.name)
        .bind(&request.transport_type)
        .bind(&request.command)
        .bind(&args_json)
        .bind(&env_json)
        .bind(&request.url)
        .bind(&headers_json)
        .bind(request.enabled)
        .bind(request.auto_connect)
        .bind(request.connection_timeout_ms)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await?;

        Ok(McpServer {
            id,
            name: request.name,
            transport_type: request.transport_type,
            command: request.command,
            args: request.args,
            env: request.env,
            url: request.url,
            headers: request.headers,
            enabled: request.enabled,
            auto_connect: request.auto_connect,
            connection_timeout_ms: request.connection_timeout_ms,
            created_at: now,
            updated_at: now,
        })
    }

    pub async fn get_mcp_servers(&self) -> Result<Vec<McpServer>> {
        let rows = sqlx::query(
            "SELECT * FROM mcp_servers ORDER BY name ASC"
        )
        .fetch_all(&self.pool)
        .await?;

        let mut servers = Vec::new();
        for row in rows {
            let transport_type_str: String = row.try_get("transport_type")?;
            let transport_type = match transport_type_str.as_str() {
                "stdio" => McpTransportType::Stdio,
                "sse" => McpTransportType::Sse,
                _ => return Err(anyhow::anyhow!("Invalid transport type: {}", transport_type_str)),
            };

            let args: Option<Vec<String>> = row.try_get::<Option<String>, _>("args")?
                .and_then(|s| serde_json::from_str(&s).ok());
            let env: Option<std::collections::HashMap<String, String>> = row.try_get::<Option<String>, _>("env")?
                .and_then(|s| serde_json::from_str(&s).ok());
            let headers: Option<std::collections::HashMap<String, String>> = row.try_get::<Option<String>, _>("headers")?
                .and_then(|s| serde_json::from_str(&s).ok());

            servers.push(McpServer {
                id: row.try_get("id")?,
                name: row.try_get("name")?,
                transport_type,
                command: row.try_get("command")?,
                args,
                env,
                url: row.try_get("url")?,
                headers,
                enabled: row.try_get("enabled")?,
                auto_connect: row.try_get("auto_connect")?,
                connection_timeout_ms: row.try_get("connection_timeout_ms")?,
                created_at: row.try_get("created_at")?,
                updated_at: row.try_get("updated_at")?,
            });
        }

        Ok(servers)
    }

    pub async fn get_mcp_server(&self, server_id: &str) -> Result<Option<McpServer>> {
        let row = sqlx::query("SELECT * FROM mcp_servers WHERE id = ?")
            .bind(server_id)
            .fetch_optional(&self.pool)
            .await?;

        match row {
            Some(row) => {
                let transport_type_str: String = row.try_get("transport_type")?;
                let transport_type = match transport_type_str.as_str() {
                    "stdio" => McpTransportType::Stdio,
                    "sse" => McpTransportType::Sse,
                    _ => return Err(anyhow::anyhow!("Invalid transport type: {}", transport_type_str)),
                };

                let args: Option<Vec<String>> = row.try_get::<Option<String>, _>("args")?
                    .and_then(|s| serde_json::from_str(&s).ok());
                let env: Option<std::collections::HashMap<String, String>> = row.try_get::<Option<String>, _>("env")?
                    .and_then(|s| serde_json::from_str(&s).ok());
                let headers: Option<std::collections::HashMap<String, String>> = row.try_get::<Option<String>, _>("headers")?
                    .and_then(|s| serde_json::from_str(&s).ok());

                Ok(Some(McpServer {
                    id: row.try_get("id")?,
                    name: row.try_get("name")?,
                    transport_type,
                    command: row.try_get("command")?,
                    args,
                    env,
                    url: row.try_get("url")?,
                    headers,
                    enabled: row.try_get("enabled")?,
                    auto_connect: row.try_get("auto_connect")?,
                    connection_timeout_ms: row.try_get("connection_timeout_ms")?,
                    created_at: row.try_get("created_at")?,
                    updated_at: row.try_get("updated_at")?,
                }))
            }
            None => Ok(None),
        }
    }

    pub async fn update_mcp_server(&self, server_id: &str, request: UpdateMcpServerRequest) -> Result<McpServer> {
        let now = Utc::now();

        let args_json = request.args.as_ref().map(|a| serde_json::to_string(a)).transpose()?;
        let env_json = request.env.as_ref().map(|e| serde_json::to_string(e)).transpose()?;
        let headers_json = request.headers.as_ref().map(|h| serde_json::to_string(h)).transpose()?;

        sqlx::query(
            r#"
            UPDATE mcp_servers SET
                name = ?, transport_type = ?, command = ?, args = ?, env = ?,
                url = ?, headers = ?, enabled = ?, auto_connect = ?,
                connection_timeout_ms = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(&request.name)
        .bind(&request.transport_type)
        .bind(&request.command)
        .bind(&args_json)
        .bind(&env_json)
        .bind(&request.url)
        .bind(&headers_json)
        .bind(request.enabled)
        .bind(request.auto_connect)
        .bind(request.connection_timeout_ms)
        .bind(now)
        .bind(server_id)
        .execute(&self.pool)
        .await?;

        Ok(McpServer {
            id: server_id.to_string(),
            name: request.name,
            transport_type: request.transport_type,
            command: request.command,
            args: request.args,
            env: request.env,
            url: request.url,
            headers: request.headers,
            enabled: request.enabled,
            auto_connect: request.auto_connect,
            connection_timeout_ms: request.connection_timeout_ms,
            created_at: now, // Will be overwritten by actual value
            updated_at: now,
        })
    }

    pub async fn delete_mcp_server(&self, server_id: &str) -> Result<()> {
        // Tools will be cascade deleted
        sqlx::query("DELETE FROM mcp_servers WHERE id = ?")
            .bind(server_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // MCP Tool operations
    pub async fn sync_mcp_tools(&self, server_id: &str, tools: Vec<(String, Option<String>, serde_json::Value)>) -> Result<Vec<McpTool>> {
        let now = Utc::now();

        // Delete existing tools for this server
        sqlx::query("DELETE FROM mcp_tools WHERE server_id = ?")
            .bind(server_id)
            .execute(&self.pool)
            .await?;

        let mut result_tools = Vec::new();

        for (name, description, input_schema) in tools {
            let id = Uuid::new_v4().to_string();
            let schema_json = serde_json::to_string(&input_schema)?;

            sqlx::query(
                r#"
                INSERT INTO mcp_tools (id, server_id, name, description, input_schema, enabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, ?, ?)
                "#
            )
            .bind(&id)
            .bind(server_id)
            .bind(&name)
            .bind(&description)
            .bind(&schema_json)
            .bind(now)
            .bind(now)
            .execute(&self.pool)
            .await?;

            result_tools.push(McpTool {
                id,
                server_id: server_id.to_string(),
                name,
                description,
                input_schema,
                enabled: true,
                created_at: now,
                updated_at: now,
            });
        }

        Ok(result_tools)
    }

    pub async fn get_mcp_tools_for_server(&self, server_id: &str) -> Result<Vec<McpTool>> {
        let rows = sqlx::query(
            "SELECT * FROM mcp_tools WHERE server_id = ? ORDER BY name ASC"
        )
        .bind(server_id)
        .fetch_all(&self.pool)
        .await?;

        let mut tools = Vec::new();
        for row in rows {
            let schema_json: String = row.try_get("input_schema")?;
            let input_schema: serde_json::Value = serde_json::from_str(&schema_json)?;

            tools.push(McpTool {
                id: row.try_get("id")?,
                server_id: row.try_get("server_id")?,
                name: row.try_get("name")?,
                description: row.try_get("description")?,
                input_schema,
                enabled: row.try_get("enabled")?,
                created_at: row.try_get("created_at")?,
                updated_at: row.try_get("updated_at")?,
            });
        }

        Ok(tools)
    }

    pub async fn get_enabled_mcp_tools(&self) -> Result<Vec<McpTool>> {
        let rows = sqlx::query(
            r#"
            SELECT t.* FROM mcp_tools t
            INNER JOIN mcp_servers s ON t.server_id = s.id
            WHERE t.enabled = 1 AND s.enabled = 1
            ORDER BY s.name, t.name
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let mut tools = Vec::new();
        for row in rows {
            let schema_json: String = row.try_get("input_schema")?;
            let input_schema: serde_json::Value = serde_json::from_str(&schema_json)?;

            tools.push(McpTool {
                id: row.try_get("id")?,
                server_id: row.try_get("server_id")?,
                name: row.try_get("name")?,
                description: row.try_get("description")?,
                input_schema,
                enabled: row.try_get("enabled")?,
                created_at: row.try_get("created_at")?,
                updated_at: row.try_get("updated_at")?,
            });
        }

        Ok(tools)
    }

    pub async fn toggle_mcp_tool(&self, tool_id: &str, enabled: bool) -> Result<()> {
        let now = Utc::now();

        sqlx::query("UPDATE mcp_tools SET enabled = ?, updated_at = ? WHERE id = ?")
            .bind(enabled)
            .bind(now)
            .bind(tool_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }
}