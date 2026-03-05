use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::{Mutex, oneshot};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum PermissionLevel {
    Safe,
    Moderate,
    Dangerous,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PermissionRequest {
    pub id: String,
    pub operation: String,
    pub description: String,
    pub level: PermissionLevel,
    pub details: HashMap<String, String>,
    pub chat_id: Option<String>,
}

pub struct PendingPermission {
    pub sender: oneshot::Sender<bool>,
}

#[derive(Clone)]
pub struct PermissionManager {
    pending: Arc<Mutex<HashMap<String, PendingPermission>>>,
    // Cache of approved permissions per chat: chat_id -> Set<operation_name>
    approved_cache: Arc<Mutex<HashMap<String, HashSet<String>>>>,
}

impl PermissionManager {
    pub fn new() -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
            approved_cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn request_permission(&self, request: PermissionRequest) -> Result<bool, String> {
        println!("[RUST PermMgr] request_permission called for ID: {}, operation: {}, level: {:?}",
                 request.id, request.operation, request.level);

        // If it's a safe operation, auto-approve
        if request.level == PermissionLevel::Safe {
            println!("[RUST PermMgr] Auto-approving Safe operation");
            return Ok(true);
        }

        // Check if this permission was already granted for this chat
        if let Some(ref chat_id) = request.chat_id {
            let cache = self.approved_cache.lock().await;
            if let Some(approved_ops) = cache.get(chat_id) {
                if approved_ops.contains(&request.operation) {
                    println!("[RUST PermMgr] Permission already granted for this chat, auto-approving");
                    return Ok(true);
                }
            }
        }

        let id = request.id.clone();
        let operation = request.operation.clone();
        let chat_id = request.chat_id.clone();
        let (tx, rx) = oneshot::channel();

        println!("[RUST PermMgr] Creating oneshot channel and storing pending request");

        // Store the pending request
        {
            let mut pending = self.pending.lock().await;
            pending.insert(id.clone(), PendingPermission {
                sender: tx,
            });
            println!("[RUST PermMgr] Pending request stored, total pending: {}", pending.len());
        }

        println!("[RUST PermMgr] Waiting for user response via channel...");

        // Wait for response with timeout
        match tokio::time::timeout(std::time::Duration::from_secs(300), rx).await {
            Ok(Ok(approved)) => {
                println!("[RUST PermMgr] Received response via channel: {}", approved);

                // If approved and chat_id exists, cache the permission
                if approved {
                    if let Some(chat_id) = chat_id {
                        let mut cache = self.approved_cache.lock().await;
                        cache.entry(chat_id)
                            .or_insert_with(HashSet::new)
                            .insert(operation);
                        println!("[RUST PermMgr] Permission cached for future use");
                    }
                }

                // Clean up
                let mut pending = self.pending.lock().await;
                pending.remove(&id);
                Ok(approved)
            }
            Ok(Err(_)) => {
                println!("[RUST PermMgr] Channel closed without response");
                // Channel closed without response
                let mut pending = self.pending.lock().await;
                pending.remove(&id);
                Err("Permission request cancelled".to_string())
            }
            Err(_) => {
                println!("[RUST PermMgr] Timeout waiting for response");
                // Timeout
                let mut pending = self.pending.lock().await;
                pending.remove(&id);
                Err("Permission request timed out".to_string())
            }
        }
    }

    pub async fn respond_to_permission(&self, request_id: String, approved: bool) -> Result<(), String> {
        let mut pending = self.pending.lock().await;

        if let Some(pending_request) = pending.remove(&request_id) {
            pending_request.sender.send(approved)
                .map_err(|_| "Failed to send permission response".to_string())?;
            Ok(())
        } else {
            Err("Permission request not found".to_string())
        }
    }

    /// Clear all cached permissions for a specific chat
    pub async fn clear_chat_permissions(&self, chat_id: String) -> Result<(), String> {
        let mut cache = self.approved_cache.lock().await;
        cache.remove(&chat_id);
        println!("[RUST PermMgr] Cleared all permissions for chat: {}", chat_id);
        Ok(())
    }

    /// Clear a specific permission for a chat
    pub async fn clear_permission(&self, chat_id: String, operation: String) -> Result<(), String> {
        let mut cache = self.approved_cache.lock().await;
        if let Some(permissions) = cache.get_mut(&chat_id) {
            permissions.remove(&operation);
            println!("[RUST PermMgr] Cleared permission '{}' for chat: {}", operation, chat_id);
        }
        Ok(())
    }

    /// Get all cached permissions for a chat
    pub async fn get_chat_permissions(&self, chat_id: String) -> Vec<String> {
        let cache = self.approved_cache.lock().await;
        cache.get(&chat_id)
            .map(|set| set.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Check if a permission is cached for a chat
    pub async fn is_permission_cached(&self, chat_id: Option<String>, operation: String) -> bool {
        if let Some(chat_id) = chat_id {
            let cache = self.approved_cache.lock().await;
            if let Some(approved_ops) = cache.get(&chat_id) {
                return approved_ops.contains(&operation);
            }
        }
        false
    }
}

pub fn create_permission_request(
    operation: &str,
    description: String,
    level: PermissionLevel,
    details: HashMap<String, String>,
    chat_id: Option<String>,
) -> PermissionRequest {
    PermissionRequest {
        id: Uuid::new_v4().to_string(),
        operation: operation.to_string(),
        description,
        level,
        details,
        chat_id,
    }
}
