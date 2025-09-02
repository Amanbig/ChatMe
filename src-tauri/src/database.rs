use anyhow::Result;
use chrono::Utc;
use sqlx::{migrate::MigrateDatabase, Pool, Sqlite, SqlitePool};
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
    pub async fn create_chat(&self, title: String) -> Result<Chat> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let chat = sqlx::query_as::<_, Chat>(
            "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING *"
        )
        .bind(&id)
        .bind(&title)
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
                c.created_at,
                c.updated_at,
                m.content as last_message,
                m.created_at as last_message_time
            FROM chats c
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
                use sqlx::Row;
                ChatWithLastMessage {
                    id: row.get("id"),
                    title: row.get("title"),
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

    pub async fn update_chat(&self, chat_id: &str, title: String) -> Result<Chat> {
        let now = Utc::now();
        
        let chat = sqlx::query_as::<_, Chat>(
            "UPDATE chats SET title = ?, updated_at = ? WHERE id = ? RETURNING *"
        )
        .bind(&title)
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
    pub async fn create_message(&self, chat_id: String, content: String, role: MessageRole) -> Result<Message> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let message = sqlx::query_as::<_, Message>(
            "INSERT INTO messages (id, chat_id, content, role, created_at) VALUES (?, ?, ?, ?, ?) RETURNING *"
        )
        .bind(&id)
        .bind(&chat_id)
        .bind(&content)
        .bind(&role)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        // Update chat's updated_at timestamp
        sqlx::query("UPDATE chats SET updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(&chat_id)
            .execute(&self.pool)
            .await?;

        Ok(message)
    }

    pub async fn get_messages(&self, chat_id: &str) -> Result<Vec<Message>> {
        let messages = sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC"
        )
        .bind(chat_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(messages)
    }

    pub async fn delete_message(&self, message_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM messages WHERE id = ?")
            .bind(message_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }
}