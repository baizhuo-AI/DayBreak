use tauri::Manager;

/**
 * Daybreak Tauri 入口
 *
 * 装的 plugin:
 * - tauri-plugin-sql (sqlite):前端通过 @tauri-apps/plugin-sql 调 SQLite
 * - tauri-plugin-single-instance:防双开。重复启动时,把焦点切回已有主窗口,
 *   避免两个进程同时写同一个 SQLite 文件触发 BUSY 错。
 *
 * Schema 初始化在前端 src/lib/db.ts(IF NOT EXISTS + PRAGMA 自检列),Rust 端不写迁移。
 */
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 第二次启动时把主窗口拉到前台
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
