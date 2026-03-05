use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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
}

pub struct PendingPermission {
    pub request: PermissionRequest,
    pub sender: oneshot::Sender<bool>,
}

#[derive(Clone)]
pub struct PermissionManager {
    pending: Arc<Mutex<HashMap<String, PendingPermission>>>,
}

impl PermissionManager {
    pub fn new() -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn request_permission(&self, request: PermissionRequest) -> Result<bool, String> {
        // If it's a safe operation, auto-approve
        if request.level == PermissionLevel::Safe {
            return Ok(true);
        }

        let id = request.id.clone();
        let (tx, rx) = oneshot::channel();

        // Store the pending request
        {
            let mut pending = self.pending.lock().await;
            pending.insert(id.clone(), PendingPermission {
                request,
                sender: tx,
            });
        }

        // Wait for response with timeout
        match tokio::time::timeout(std::time::Duration::from_secs(300), rx).await {
            Ok(Ok(approved)) => {
                // Clean up
                let mut pending = self.pending.lock().await;
                pending.remove(&id);
                Ok(approved)
            }
            Ok(Err(_)) => {
                // Channel closed without response
                let mut pending = self.pending.lock().await;
                pending.remove(&id);
                Err("Permission request cancelled".to_string())
            }
            Err(_) => {
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

    pub async fn cancel_permission(&self, request_id: String) -> Result<(), String> {
        let mut pending = self.pending.lock().await;

        if pending.remove(&request_id).is_some() {
            Ok(())
        } else {
            Err("Permission request not found".to_string())
        }
    }
}

pub fn create_permission_request(
    operation: &str,
    description: String,
    level: PermissionLevel,
    details: HashMap<String, String>,
) -> PermissionRequest {
    PermissionRequest {
        id: Uuid::new_v4().to_string(),
        operation: operation.to_string(),
        description,
        level,
        details,
    }
}
