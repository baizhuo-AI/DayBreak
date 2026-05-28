use tauri::Manager;

// pub：让 examples/mcp_smoke.rs 等命令行冒烟测试能调用 mcp::start 单独起 server（不开 GUI）。
pub mod mcp;
// CLI Agent 后端（claude/codex/kiro），通过 spawn 本地 CLI 走用户订阅
pub mod cli_agent;

/**
 * Daybreak Tauri 入口
 *
 * 装的 plugin:
 * - tauri-plugin-sql (sqlite):前端通过 @tauri-apps/plugin-sql 调 SQLite
 * - tauri-plugin-single-instance:防双开。重复启动时,把焦点切回已有主窗口,
 *   避免两个进程同时写同一个 SQLite 文件触发 BUSY 错。
 * - tauri-plugin-notification:间歇式时间日志的提醒走 macOS 系统通知
 *   (前端 @tauri-apps/plugin-notification)。
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
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // 内嵌 MCP server：进程内后台任务，连同一个 daybreak.db。
            // - token 持久化在 app config 目录，供鉴权和前端接入页共用
            // - 写操作通过 Tauri 事件 daybreak://data-changed 通知前端刷新
            // - start() 内部自行兜底（连库 / 端口失败只记日志），不会让主应用崩溃
            use tauri::Emitter;
            let config_dir = app
                .path()
                .app_config_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            let db_path = config_dir.join("daybreak.db");
            let token = mcp::load_or_create_token(&config_dir);
            let handle = app.handle().clone();
            let notify: mcp::Notifier = std::sync::Arc::new(move |topic: &str| {
                let _ = handle.emit("daybreak://data-changed", topic.to_string());
            });
            tauri::async_runtime::spawn(mcp::start(db_path, token, notify));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            mcp::connect::mcp_connection_info,
            cli_agent::cli_agent_send,
            cli_agent::cli_agent_detect,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
