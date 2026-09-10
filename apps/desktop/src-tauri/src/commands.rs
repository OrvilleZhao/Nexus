use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentStatus {
    pub core: bool,
    pub bridge: bool,
    pub memory: bool,
    pub pdp: String,
}

#[tauri::command]
pub fn get_status() -> AgentStatus {
    AgentStatus {
        core: true,
        bridge: true,
        memory: true,
        pdp: "MockPdp".into(),
    }
}

#[tauri::command]
pub fn send_message(session_id: String, content: String) -> String {
    // TODO: integrate with @nexus/sdk when Node.js IPC bridge is ready
    format!(
        "Received {} bytes in session {}",
        content.len(),
        session_id
    )
}

#[tauri::command]
pub fn get_audit_summary(session_id: Option<String>) -> String {
    // TODO: integrate with AuditEngine
    match session_id {
        Some(id) => format!("Audit for session {}: 0 turns, 0 violations", id),
        None => "Audit: 0 sessions, 0 turns, 0 violations".into(),
    }
}
