# Daybreak

AI-powered personal daily briefing and planner — macOS desktop app.

晨起一份 AI 排好的方案,白天可随手记 / 拖拽改时段,夜里反思,长期目标(Telos)持续指引。

## 主要能力

- **早安(Briefing)**:LLM 生成的今日方案 + 拖延提醒 + push back 建议;基于真实 scheduledTime 算"今日可用空档"
- **待办(Todos)**:搜索 / 优先级筛选 / 排序;`⌘K` 走 AI 解析自然语言,`N` 走纯手填表单
- **日历(Calendar)**:月/周双视图;周视图覆盖 0-24 时,默认滚到 7:00,显示当前时刻横线;任务卡片可拖拽改时段或跨天(15 分钟吸附);"AI 排今日"按钮一键重排
- **AI 对话(Chat)**:DeepSeek-R1 流式;**思考过程默认展开**;系统 prompt 自动注入今日 todos + Telos
- **反思(Reflect)**:日/周维度,LLM 生成包含「值得肯定 / 值得反思 / 下一步建议」的反思
- **Telos**:年/季/月长期目标,自动作为 AI 排日 / Chat / 反思的上下文
- **设置(Settings)**:语言切换(中/英)、主题(亮/暗/跟随系统)、LLM provider + key、token 用量统计、数据导出/导入
- **浮窗形态**:260×420 常驻置顶副窗口(可拖动 / 可关闭),跟主 App 共享 SQLite + BroadcastChannel 实时同步
- **MCP 接入**:内置本地 MCP server,Claude Code 等 AI 客户端可直接读写你的任务/目标/复盘/时间日志(见下「接入 AI 助手」)

## 技术栈

- 桌面壳:Tauri 2(Rust + WebView)
- 前端:Vite 5 + React 18 + TypeScript + Tailwind 3
- 状态:Zustand + 持久化 SQLite(`tauri-plugin-sql`)
- 拖拽:@dnd-kit/core
- 动效:framer-motion
- LLM:DeepSeek API(deepseek-chat / deepseek-reasoner);抽象层兼容 Anthropic / OpenAI

## 下载安装(普通用户)

从 [Releases](../../releases) 下载最新 `.dmg`,拖入「应用程序」。

**首次打开**:macOS 会提示"无法验证开发者"(应用未做苹果签名,属正常)。两种方式打开:
- 右键点 Daybreak → 选「打开」→ 再点「打开」
- 或终端执行:`xattr -d com.apple.quarantine /Applications/Daybreak.app`

## 接入 AI 助手(MCP)

Daybreak 内置一个本地 MCP server(仅监听 `127.0.0.1`,不对外网开放),让 Claude Code 等 AI 客户端直接管理你的任务、目标、复盘和时间日志。

**接入步骤**:
1. 打开 Daybreak → **设置** → **「接入 AI 助手」**
2. 复制页面上的接入命令(形如 `claude mcp add --transport http daybreak http://127.0.0.1:42800/mcp --header "Authorization: Bearer <密钥>"`)
3. 粘到终端运行,重启 Claude Code 即可

接入后直接对话即可:"我今天有哪些待办"、"加个任务明天交周报"、"把写方案标记完成"。

> 需保持 Daybreak 运行;密钥首次自动生成并持久化,配一次长期有效。仅本机可连。

## 跑起来

```bash
# 1. 装依赖
npm install

# 2. 装 Rust 工具链(首次)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 3. 配置 DeepSeek API key
cp .env.example .env.local
# 编辑 .env.local 填入 VITE_DEEPSEEK_API_KEY

# 4. 启动 dev
npm run tauri:dev
```

数据库默认位置:`~/Library/Application Support/com.daybreak.desktop/daybreak.db`

## 打包

```bash
npm run tauri:build
# 输出在 src-tauri/target/release/bundle/{macos,dmg}/
```

## License

私有项目,暂未对外开源协议。
