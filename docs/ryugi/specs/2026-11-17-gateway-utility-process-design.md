# gateway 搬出 Electron 主进程：设计稿

2026-11-17 在架构评审对话里定稿。标「我定的」的是设计者自定、用户未逐条确认的取舍。

## 1. 目的

桌面版里 gateway 跑在 Electron 主进程（`apps/desktop/src/main/index.ts` 直接 `import("@pig/gateway")` 后 `start()`）。所有 agent 会话、用户装的扩展、SSH、扫会话目录，和窗口管理共用一个事件循环。

- 任何一个扩展卡住事件循环，窗口拖动、缩放、菜单一起卡。
- gateway 里任何未捕获的错误，整个应用一起退出。

把 gateway 放进 Electron 的 `utilityProcess`。主进程只剩窗口、协议、对话框。

这是并行多会话和长任务的前置条件。用户已否决「每个会话一个进程」，这份设计只做「整个 gateway 一个子进程」。

## 2. 范围

| 要做 | 不做 |
|---|---|
| gateway 在 `utilityProcess` 里启动、停止 | 每会话一个进程 |
| 选目录对话框经消息回到主进程 | 子进程崩溃后自动重启 |
| 子进程意外退出时给出明确提示 | 改 `packages/gateway` 的对外接口 |
| 开发态与打包态都能跑 | CLI（`pig` 命令）的启动方式，它本来就是独立进程 |

## 3. 现状

主进程今天对 gateway 做的事，全在 `apps/desktop/src/main/index.ts`：

1. `new Gateway({ platformPort, webRoot, sessionDir, cwd })`，`start()` 得到端口，读 `launchToken`。
2. 拿端口和 token 做三件事：`trustLoopback(token)` 给本机请求补 `Authorization`；开发态把它们传给 Vite 子进程；打包态交给 `handlePigProtocol`。
3. `platformPort.selectDirectory()` 要弹系统对话框，必须有 `BrowserWindow`。
4. 退出时 `gateway.stop()`。
5. 主进程还从 gateway 模块借了 `canonicalizePath`，用来规范化对话框选出的路径。

## 4. 设计

### 4.1 进程与消息

主进程用 `utilityProcess.fork` 起子进程，不再 import gateway。两边只走下面四种消息。（我定的）

| 方向 | 消息 | 含义 |
|---|---|---|
| 子 → 主 | `{ type: "ready", port, launchToken }` | gateway 已监听 |
| 子 → 主 | `{ type: "failed", message }` | 启动失败 |
| 子 → 主 | `{ type: "select-directory", id }` | 请主进程弹选目录对话框 |
| 主 → 子 | `{ type: "directory-selected", id, path? }` | 对话框结果；取消时不带 `path` |
| 主 → 子 | `{ type: "stop" }` | 请求停止；子进程 `gateway.stop()` 后退出 |

- 子进程里的 `DirectoryPort`：`selectDirectory` 发消息等回复，再自己做 `realpath` 和 `canonicalizePath`；`validateDirectory` 完全在子进程里做。主进程只回对话框选出的原始路径，不再碰 `canonicalizePath`。
- `webRoot` 由主进程算好，经 `fork` 的参数传给子进程。`PIG_SESSION_DIR`、`PIG_CWD`、`PI_CODING_AGENT_DIR` 等环境变量照常继承。
- 子进程的 stdout / stderr 转到主进程的控制台。扩展报错今天靠 `console.error` 露出来，不能丢。
- 消息类型放在一个文件里，主、子两边共用。

### 4.2 启动与退出

- 主进程等 `ready` 后，后续流程不变：`trustLoopback`、起 Vite 或 `handlePigProtocol`、建窗口。
- 收到 `failed`，或子进程在 `ready` 前退出：走现有的 `dialog.showErrorBox("无法启动", …)` 再退出。
- `shutdown()`：发 `stop`，等子进程退出，再 `app.quit()`。
- 子进程在运行中意外退出：弹 `dialog.showErrorBox` 说明网关已退出，然后退出应用。（我定的）今天这种情况是整个应用无声消失；自动重启要重新发端口和 token、重载页面，留到以后。

### 4.3 入口文件

- 开发态：照 `apps/desktop/electron-main.mjs` 的做法，加一个 `.mjs` 入口先注册 tsx，再加载子进程的 TypeScript 源码。子进程加载 gateway 源码的方式与今天 `loadGatewayModule` 的开发分支相同。
- 打包态：子进程入口和主进程代码一起由 `tsconfig.main.json` 编译进 `out/main/`，在里面 `import("@pig/gateway")`。`import` 的说明符继续用非字面量，原因见 `index.ts` 现有注释（否则 tsc 会把 gateway 源码拉进 `rootDir`）。

## 5. 先验证的风险

动手铺开前，先用最小入口各验证一次。任何一条不成立就停下报告，不要绕。

1. `utilityProcess` 能加载 ESM 入口，开发态能经 tsx 加载 TypeScript。
2. 打包态子进程能从 asar 里加载 `@pig/gateway` 及其依赖，gateway 还能经 jiti 加载 `@pig/extensions/src/*.ts`。今天这在主进程里是通的；子进程里没验证过。不通时的备选是 `asarUnpack`，先报告再定。
3. 子进程里 `process.env`、临时目录、`~/.pi/agent` 的解析结果与主进程一致。

## 6. 约束

- 只动 `apps/desktop`。`packages/gateway`、`apps/web` 不改。
- 守 `AGENTS.md`；主进程改动必跑 `pnpm test:electron`。
- 不引入新依赖。`utilityProcess` 是 Electron 自带的。
- `e2e/electron/` 与 `e2e/perf/harness.ts` 的桌面模式只经窗口访问 gateway，应当不用改。要改就说明原因。

## 7. 留给执行方

- 文件命名与放在 `src/main/` 的哪里。
- 主进程一侧的封装形态（一个带 `start` / `stop` / 事件的小对象即可）。
- 等 `ready` 与等退出要不要设超时。只在验证中真的遇到挂住时才加。

## 8. 验收

单测（`apps/desktop/test/`，用假的子进程，只测数据路径）：

- 收到 `ready` 后拿到端口和 token。
- 选目录一去一回：取消返回空，选中返回路径。
- `ready` 前退出报启动失败；运行中意外退出触发提示。

真实运行：

- `pnpm test:electron` 通过。
- `pnpm dev:desktop` 起来后，`app.getAppMetrics()` 里能看到一个 Utility 进程，主进程里不再加载 gateway 模块。
- 用 `scripts/release-win.mjs` 打一次包，启动安装目录里的程序：能开会话、能加载内置扩展、能选目录。打包态是主要风险，不能只验开发态。
- 手动杀掉子进程一次，确认弹出提示后应用退出。
- `pnpm test:bench`（桌面模式）各项不比改动前慢 10% 以上。
- `pnpm check:touched` 通过。

## 9. 分工

这件事前后依赖强，不适合并行。

| 顺序 | 执行方 | 范围 |
|---|---|---|
| 1 | 一个执行方 | 第 5 节的三项验证，报告结果 |
| 2 | 同一个执行方 | 第 4 节的实现与单测 |
| 3 | 主会话 | 评审、打包验证、杀进程验证、基准对比、提交 |
