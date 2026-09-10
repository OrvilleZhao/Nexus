mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::send_message,
            commands::get_audit_summary,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
