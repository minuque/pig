# 首版 Gateway + Vue SPA + Pi SDK：事实核验

> 事实与建议分开；版本基线：本机 `@earendil-works/pi-coding-agent` 0.82.1。

## 1. npm package、构建与启动

**事实**

- npm `bin` 是“命令名 → 包内本地文件”的映射；全局安装时 npm 会链接可执行文件，并在 Windows 生成 `.cmd` 启动文件；作为依赖安装时可由 `npm exec`/脚本使用。[npm package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#bin)
- `files` 控制发布包包含的文件/目录；因此 SPA 的 `dist` 静态资源若要随 Gateway 发布，必须被 `files` 覆盖（或由另一个明确的包提供）。[npm package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#files)
- `workspaces` 是 npm 的本地多包管理：安装时把工作区自动链接到顶层 `node_modules`，并可按 workspace 执行脚本；这是开发/仓库安装关系，不是运行时可依赖的发布资产。[npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/)
- lifecycle 有 `pre`/主脚本/`post`；`prepare` 在 workspace 中并发运行，依赖顺序需显式设计或使用 `--foreground-scripts`。[npm scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/)
- `npm run` 默认在 POSIX 用 `/bin/sh`、Windows 用 `cmd.exe`；脚本还会加入 `node_modules/.bin`。[npm run-script](https://docs.npmjs.com/cli/v11/commands/npm-run-script/)
- 本机 Pi 包：`type: module`、`bin.pi=dist/cli.js`、`exports` 仅开放 `.` 与 `./rpc-entry`，`files` 包含 `dist/docs/examples` 等，`prepublishOnly` 为 clean/build/shrinkwrap，`engines.node` 为 `>=22.19.0`。因此“Node 22.16+”不能直接宣称兼容当前 Pi 0.82.1；应把实际最低版抬到 22.19，或锁定另一个 Pi 版本。Pi Windows 还要求可用 bash，检查自定义 `shellPath`、Git Bash、PATH 上的 bash（依次）。[Pi package.json（官方仓库）](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/package.json)；[Pi Windows](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/windows.md)

**首版建议**：运行时只依赖 Node API/已安装包，不依赖 Unix `chmod`、`cp`、`rm` 或 workspace 相对路径；构建阶段用 Node 脚本或跨平台工具。Gateway CLI、SPA 资源和 SDK 核心的发布边界应在 `package.json` 的 `bin`、`exports`、`files` 中明确列出。

## 2. 数据、缓存、状态、日志目录

**事实**

- Node 22 `node:os` 内置的是 `homedir()` 与 `tmpdir()` 等 OS 工具，没有 app-data/cache/state/log 目录解析器；目录策略必须由应用读取平台环境/规范后自行拼接。[Node 22 os](https://nodejs.org/docs/latest-v22.x/api/os.html)
- Linux/Freedesktop XDG：
  - 数据：`$XDG_DATA_HOME`，默认 `~/.local/share`；配置：`$XDG_CONFIG_HOME`，默认 `~/.config`；持久状态：`$XDG_STATE_HOME`，默认 `~/.local/state`。
  - 缓存：`$XDG_CACHE_HOME`，默认 `~/.cache`；运行时对象：`$XDG_RUNTIME_DIR`，无默认值，须为用户独占 `0700`、登录生命周期内存在且重启/完全注销后不保留。
  - 规范明确状态可包含 logs/history；没有独立的 XDG “logs”变量。[XDG Base Directory Specification 0.8](https://specifications.freedesktop.org/basedir-spec/latest/)
- macOS：Apple 的用户域使用 `~/Library` 保存 app-specific 资源；Application Support 适合应用支持/配置/内部数据，Caches 是可被系统删除、必须可重建的缓存；临时数据放 `tmp`。该页没有 Node 可直接调用的跨平台目录 API，也没有把“状态/日志”抽象成 XDG 式变量。[Apple File System Programming Guide](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/FileSystemOverview/FileSystemOverview.html)
- Windows Known Folders：`FOLDERID_LocalAppData` 默认 `%USERPROFILE%\AppData\Local`（非漫游的用户应用数据），`FOLDERID_RoamingAppData` 默认 `%USERPROFILE%\AppData\Roaming`，`FOLDERID_ProgramData` 默认 `%SystemDrive%\ProgramData`（所有用户）。原生取路径的权威接口是 `SHGetKnownFolderPath`。[Known Folder IDs](https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid)；[SHGetKnownFolderPath](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/nf-shlobj_core-shgetknownfolderpath)

**首版建议**：抽象 `data/config/state/cache/logs/runtime` 五类目录；Linux 遵守 XDG，Windows 以 LocalAppData 为默认数据/缓存/日志根（仅需漫游的配置才用 RoamingAppData），macOS 以 `~/Library/Application Support/<app>`、`~/Library/Caches/<app>`，日志路径作为产品约定而非 Node 能力。保留环境变量/显式目录覆盖，避免把 Pi 的 `~/.pi` 误当成系统规范。

## 3. Pi 默认位置与 SDK 入口

**事实**

- Pi 默认 agent 目录是 `~/.pi/agent`；源码 `getAgentDir()` 使用 `PI_CODING_AGENT_DIR` 覆盖，否则 `os.homedir()/.pi/agent`。它不自动映射 XDG、Windows Known Folder 或 macOS `Library`。[Pi config 源码](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/config.ts)
- 默认文件：`settings.json`、`models.json`、`auth.json`、`models-store.json`、`sessions/`、`pi-debug.log`；认证文件当前以用户独占 `0600` 写入。[Pi SDK](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/sdk.md)；[Pi providers](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/providers.md)
- 默认持久 session：`~/.pi/agent/sessions/--<cwd>--/<timestamp>_<uuid>.jsonl`；`SessionManager.inMemory()` 不落盘。session 是 JSONL 树，`AgentSession.sessionFile` 可读。[Pi sessions](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/sessions.md)；[session format](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/session-format.md)
- 模型选择顺序：继续旧 session 时先恢复 session 模型；否则使用 settings 默认值；再退回第一个可用模型。认证优先级为 runtime override、`auth.json`、环境变量、`models.json` 自定义 provider。[Pi SDK](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/sdk.md)
- 可配置入口：`createAgentSession({ cwd, agentDir, modelRuntime, sessionManager, settingsManager, resourceLoader })`；`ModelRuntime.create({ authPath, modelsPath })` 可改认证/模型文件，`InMemoryCredentialStore` 可不落盘；`SessionManager.create/open/continueRecent/inMemory` 控制 session；`SettingsManager.create/inMemory` 控制设置。[Pi SDK](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/sdk.md)

**首版建议**：Gateway 若要把所有用户数据收拢到自己的平台目录，应显式传 `agentDir`、`ModelRuntime`、`SettingsManager`、`SessionManager`；不要依赖进程环境下的 Pi 默认路径。保留 Pi session JSONL 原格式，或通过 `SessionManager`/导入导出处理，避免自建第二份会话真相。

## 4. HTTP 优雅关闭、信号与 Windows

**事实**

- `server.close()` 停止接受新连接，并关闭不在发送/等待响应的连接；回调在服务器关闭后执行。Node 19+ 已会先清理 idle keep-alive 连接。[Node 22 HTTP](https://nodejs.org/docs/latest-v22.x/api/http.html#serverclosecallback)
- `closeAllConnections()` 会强制关闭包括活动请求的连接，不处理升级成 WebSocket/HTTP2 的 socket；Node 文档建议和 `close()` 同用时在其之后调用，以避免竞态。[Node 22 HTTP](https://nodejs.org/docs/latest-v22.x/api/http.html#servercloseallconnections)
- POSIX 上 SIGINT/SIGTERM 有默认退出行为；安装 listener 会移除默认退出，故 handler 必须自行完成关闭。Windows 不支持真正的 signals：SIGTERM 可监听但不受支持；Ctrl+C 是 SIGINT，Ctrl+Break 是 SIGBREAK；窗口关闭产生 SIGHUP，Windows 约 10 秒后仍会无条件终止。[Node 22 process](https://nodejs.org/docs/latest-v22.x/api/process.html#signal-events)

**首版建议**：进入 closing 状态并停止接收新请求 → 等活动请求/流结束 → `server.close()` → 超时后才 `closeAllConnections()` → `AgentSession.abort()/dispose()`、`SettingsManager.flush()`、日志 flush → 设置 `process.exitCode`。注册 POSIX `SIGINT`/`SIGTERM`，Windows 额外处理 `SIGBREAK`；不要把 `SIGHUP` 当作可靠的 Windows 清理窗口。

## 5. 未来 sidecar 的 package/build seam

**事实**

- Pi SDK 文档明确：同进程 SDK 适合类型安全、直接访问 agent state；RPC 适合进程隔离和语言无关客户端。[Pi SDK/RPC](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/sdk.md)；[Pi RPC](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/rpc.md)
- npm 的 `bin`、`exports`、`files` 分别定义启动入口、可导入接口、发布资产；workspace 只保证仓库安装时的本地链接。[npm package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)；[npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/)

**首版建议**：保持 `gateway-core`（无 HTTP/进程假设）→ `gateway-http`（同进程适配器）→ `gateway-cli`（唯一 `bin`）→ `spa-dist`（明确被 `files` 包含）的 seam；所有持久化、Pi SDK 和协议入口通过显式接口注入。未来 sidecar 只替换 `gateway-http` 为子进程/RPC transport，不让核心代码读取 workspace 相对路径、隐式 cwd、TTY 或 inherited process state。