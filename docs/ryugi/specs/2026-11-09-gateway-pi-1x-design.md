# pig gateway 重构与 pi 1.x 升级：设计

三轮讨论已收敛，这是最终设计，按它落地。已于 2026-11-09 批准。讨论原文：`.ryugi/artifacts/document/gateway-pi-1x-architecture/doc.xml`。

> 这不是一次版本号升级。pi 1.x 删掉了 gateway 和 web 现在依赖的整套远程会话接口（`PiServer`、`PiClient`、`RemoteSession`、协议里的 `TranscriptItem` 等）。第 ① 步要同时换掉 gateway 的协议层和 web 的连接层。

## 1. 为什么做

pig 是 pi 的图形外壳。pi 怎么跑、扩展怎么写，都要跟上游一致；pig 只做平台接入、渲染和本地安全。这样上游每次发版，pig 改映射层就能跟上。

接下来要加三类能力：内置扩展（先做 subagent）、远程机器上的 workspace、以后的离线长任务。它们都必须走 pi 的扩展机制，不打补丁。现在的 gateway 建在 pi-server 0.84 上，这套接口在 1.x 已经删除，正好借升级把结构理顺。

同时解决三个体验问题：启动时侧边栏全量加载会话；长会话切换因 mermaid 等富文本不顺；打开会话只给最近 3 轮，上翻要等。

## 2. 目标与边界

| 类别 | 内容 |
|---|---|
| 目标 | 升级到 pi-coding-agent 1.5.0；gateway 用自定薄协议；扩展宿主和扩展 UI 打通；subagent 跑通跑顺；远程 workspace 可用；三个性能痛点在 bench 上有可量化的改善。 |
| 非目标 | rewind、web-search 扩展；离线长任务和 pi-durable 接入；多客户端同时操作一个会话；远程运行 gateway。 |
| 反目标（不能做） | patch 或 fork pi；给扩展开 pig 私有 API；web 里写领域规则；为离线长任务提前写代码。 |

## 3. 约束

- 仓库规则照 `AGENTS.md`：功能代码文件不超过 500 行；导入用别名；已有依赖能表达就复用；依赖缺陷不打补丁；单测只测产品假设和数据路径。
- 依赖锁精确版本；安装时禁用生命周期脚本；升级前读 changelog。
- 每步完成跑 `pnpm fix:touched` → `pnpm check:touched`；涉及耗时、滚动、流式的步骤跑 `pnpm test:bench`；主进程改动跑 `pnpm test:electron`。
- UI 守 `apps/web/DESIGN.md` 的七条规则；样式只用 `tokens.css` 的 token。

## 4. 决定

- 升级到 pi 最新版（你定的）。
- 新能力全部写成 pi 扩展，不 patch pi，不 fork（你定的）。
- 兼容用户本地已装的 pi 扩展和 pi 包（你定的）。
- web 只做渲染和输入，领域规则不进 web（你定的，与仓库现有约定一致）。
- Electron 外壳保留（既有决定）。
- 内置扩展第一批只做 subagent，把它跑通跑顺；rewind、web-search 往后放（你定的）。
- gateway 进程内跑 pi-coding-agent 1.5 SDK；弃用 pi-server / pi-protocol / pi-client 0.84，自定一层薄 WebSocket 协议，命令和事件名照 pi RPC（你定的）。
- 内置扩展做成独立 pi 包 `packages/extensions`，只用公开 Extension API，pi TUI 里也能装（你定的）。
- 扩展 UI 只做 pi RPC 子集：对话框、通知、状态栏、文本 widget；`custom()` 降级（你定的）。
- 远程的含义：workspace 在别的机器上，一个客户端同时用多个环境的 workspace（你定的，细节见第 2 轮 Q1）。
- gateway 负责把 pi 事件投影成界面条目，web 只渲染（按推荐）。
- 分步落地：①升级 + 换协议，行为不变 ②扩展宿主和扩展 UI ③subagent ④多环境 ⑤durable 试验（按推荐）。
- 协议用 JSON 文本帧，不用 CBOR（我的决定：瓶颈不在编码，JSON 能在 devtools 里直接看）。
- 性能验收以现有 `pnpm test:bench` 为准，先跑一次基线，再定每步的达标线（我的决定）。
- 远程 workspace：agent 和会话文件留在本地，用扩展把 read/write/edit/bash 转发到远程机器（你定的，与我的推荐不同）。
- 侧边栏：gateway 维护轻量会话索引，启动只取最近 N 条，滚动或展开再取（按推荐）。
- 长会话历史：一次给全部条目的轻量形态，web 虚拟列表，富文本进入视口才渲染，gateway 缓存投影（按推荐）。
- 会话切换：web 保留最近几个会话的视图和已渲染富文本，设数量上限（按推荐）。
- subagent 在同一进程里用 SDK 开子会话（按推荐）。
- subagent 显示照 cc-wrapper：右上角加一个摘要面板，显示环境、context、task；子任务在 task 里列出（你定的）。对应 cc-wrapper 的 session rail（`source-session-rail*.jsx`），画面在后面单独出图。
- subagent 的工具跟主会话走同一个环境：主会话在远程 workspace，子会话的工具也转发到远程（我的决定）。
- 离线长任务：这次只保证协议和 agent 所在位置无关，以后可以把 gateway 搬到远程机器，不提前写代码（按推荐）。
- SSH：用 ssh2 为每台机器保持一条长连接，命令走 exec，文件走 SFTP；认证照 `~/.ssh/config` 和密钥（按推荐）。
- 新增「环境」包 `packages/environment`（本地 / SSH），扩展的工具转发和 gateway 的平台功能共用（按推荐）。
- 远程项目的 AGENTS.md 和 skills 生效；项目级扩展不加载（按推荐）。
- 环境列表 = `~/.ssh/config` 主机 + pig 保存的环境（按推荐）。
- 远程 workspace 的会话存本地，键为 `ssh://主机/路径`，侧边栏按「环境 / 目录」分组（按推荐）。

### 评审后补充的决定（你定的）

- 协议直接用 pi 导出的 RPC 类型；流式只发增量；重连一律补完整快照；会话索引先放内存；长列表先用 `content-visibility`；第 ① 步拆成 ①a 换底座、①b 做性能。
- 远程初期保持 agent 在本地，先跑通这个场景，后面再上远程 gateway。
- 新增第 ⓪ 步清理测试，只保留影响产品形态的用例（含 e2e）。

### 你提到的痛点

- 侧边栏启动时全量加载所有会话，拖慢启动。
- transcript 渲染 mermaid 等富文本，长会话之间切换不够顺。
- 为了首屏快，打开会话只给最近 3 轮，往上翻才补。我查了：gateway 其实每次都把整个会话文件解析并投影一遍，再切出 3 轮，只省了传输和渲染，没省读盘和解析。

## 5. 升级 pi 1.5 会碰到什么

| 变化 | 影响到 pig 的地方 |
|---|---|
| `pi-server` 1.x 改成面向 pi-durable 的 Chord 服务路由，删除 `PiServer` / `PiServerService` / `PiSessionRuntime` | `packages/gateway/src/server/host.ts`、`pi/service.ts`、`pi/session-runtime.ts` 全部重写；移除 `pi-server` 依赖 |
| `pi-protocol` / `pi-client` 1.x 只剩不透明信封，不再定义会话快照和 transcript 条目 | web 的 `client/pi-client.ts`、`client/transport.ts`、`types/common-type.ts` 重写；两个包都移除 |
| `pi-coding-agent` 不再导出 `./client`（`RemoteSession`） | `features/session-workbench`、`features/session-nav` 改用 pig 自己的会话客户端 |
| `SessionEntry` 新增 `context_edit`；`before_agent_start` 改为按 `messageType` 区分；会话在启动 run 时就算忙 | transcript 投影要处理新条目；忙闲判断照新语义 |
| Azure 供应商从 `azure-openai-responses` 改名为 `azure` | 供应商设置页的名称映射 |
| 工具参数校验改用 `pi-schema` | 自写扩展的参数只用纯 JSON Schema 能表达的写法 |
| SDK 会话默认不加载 CLI 内置的 codemode、tool_search、MCP 扩展 | gateway 显式加进 `extensionFactories` 并调用 `bindExtensions()`，行为才和 TUI 一致 |

## 6. 总体结构

flowchart LR
subgraph Client["apps/web（Electron 或浏览器）"]
UI["渲染层：transcript / 侧边栏 / 摘要面板 / 扩展对话框"]
SC["会话客户端：一条 WS，按会话收发"]
end
subgraph GW["packages/gateway（本机进程）"]
P["协议层：JSON over WebSocket"]
H["会话宿主：AgentSession 生命周期"]
PR["投影 + 缓存：pi 条目 → 界面条目"]
IX["会话索引：只读文件头和 mtime"]
PL["平台功能：目录、文件搜索、@ 提及、附件"]
EU["扩展 UI 桥：ctx.ui → 协议"]
end
subgraph PI["pi-coding-agent 1.5 SDK"]
AS["AgentSession"]
EX["扩展：用户本地 + @pig/extensions + codemode/MCP"]
end
ENV["packages/environment：本地 / SSH"]
R[("远程机器")]
UI --- SC
SC <-->|"命令 / 事件 / 扩展 UI"| P
P --> H --> AS
AS --> EX
AS -->|事件| PR --> P
IX --> P
PL --> ENV
EX -->|"remote-workspace 转发工具"| ENV
EU --> P
ENV -->|"ssh2 长连接"| R

| 包 / 目录 | 负责 | 不负责 |
|---|---|---|
| `packages/protocol`（新，只含类型） | web 与 gateway 之间的消息类型和界面条目类型 | 任何运行时代码 |
| `packages/gateway` | 协议、会话宿主、投影与缓存、会话索引、平台功能、扩展 UI 桥、本地鉴权 | agent 逻辑、工具实现 |
| `packages/environment`（新） | 本地和 SSH 两种环境：执行命令、读写文件、列目录、搜索；SSH 连接池；读 `~/.ssh/config` | pi 相关的任何东西 |
| `packages/extensions`（新，pi 包） | `remote-workspace` 与 `subagent` 两个扩展；只用公开 Extension API | pig 私有接口 |
| `apps/web` | 连接、渲染、输入、虚拟列表、富文本缓存 | 投影规则、会话规则 |

## 7. 协议

- 一条 WebSocket，JSON 文本帧，沿用现有的本机鉴权（`auth/browser-session.ts`）。
- 三类消息：请求 / 响应（带 `id`）、服务端事件、扩展 UI 请求 / 应答。会话级消息带 `sessionId`。
- 会话命令和扩展 UI 直接用 pi 导出的类型：`RpcCommand`、`RpcResponse`、`RpcExtensionUIRequest` / `RpcExtensionUIResponse`，不自己照写。`packages/protocol` 只定义三样：外层路由信封（带 `sessionId`）、pig 自己的服务（会话索引、环境、文件搜索等）、界面条目类型。上游加命令，pig 跟着拿到类型。
- 流式输出只发新增的文字（追加增量），消息结束时再发一次完整条目。不再每 16 毫秒重发整条消息：那样消息越长每帧越大，总量随长度平方增长。
- 服务级请求：会话索引分页、环境列表、目录与文件搜索、附件、模型和供应商。现有 `/api/v1/platform/*` HTTP 接口里，上传附件这类二进制传输保留 HTTP，其余并入协议。
- 断线重连后，客户端重新订阅，gateway 一律补发该会话的完整快照（有投影缓存，代价很低）。不做按版本号补发增量，省掉每会话的历史缓冲和它的边界情况。
- 协议不假设 agent 在本机。以后把 gateway 放到远程机器上跑，客户端不用改。

## 8. 性能设计

1. **会话索引**：gateway 在内存里建会话索引：每个会话文件只读文件头和第一条用户消息，记下名称、摘要、mtime 和大小；mtime 变了才重读。卡片上的结果、模型这类要读完整分支的字段，侧边栏显示到它时才算。侧边栏首屏取最近 N 条（我定 N=50），滚动或展开某个 workspace 时再分页取。只有 bench 显示冷启动仍慢，才把索引存成文件。

2. **投影缓存**：每个打开过的会话，缓存它的界面条目和读到的文件偏移。会话文件只会追加，所以下次打开从偏移处继续解析，不重读全文；文件变短或 mtime 回退时整份重建。缓存按 LRU 限数量（我定 20 个会话）。

3. **轻量条目 + 按需细节**：打开会话时一次发全部条目的轻量形态：正文、思考摘要、工具名和参数摘要、状态。工具的大块输出、图片、diff 只发引用，展开时再按 id 取。去掉现在的「最近 3 轮 + 上翻补」。

4. **长列表：先原生，后虚拟**：先给每个 transcript 条目加 CSS `content-visibility: auto` 和预估高度：屏幕外的条目不排版、不绘制，零依赖，也不影响 Ctrl+F、跨条目选中和流式贴底。bench 仍不达标，再上虚拟列表。

5. **富文本延迟渲染 + 缓存**：mermaid、代码高亮、数学公式进入视口才渲染；渲染结果按「内容哈希 + 当前主题」缓存，切换会话和来回滚动都不重复渲染。

6. **保留最近会话视图**：web 保留最近 3 个会话的视图（我定的数），切回时恢复滚动位置，不重建。

验收：第 ⓪ 步跑出 bench 基线。每一步的达标线是「不比上一步差」；①b 要在冷启动到侧边栏可用、长会话首屏、会话切换三项上比 ①a 快。没有对应场景的，在 `e2e/perf` 里补。

## 9. 扩展宿主与扩展 UI

- 扩展来源：用户本地（`~/.pi/agent/extensions`、settings 里的 pi 包）、项目级（受 pi 的 project trust 控制）、`@pig/extensions`、以及和 CLI 一样的 codemode / tool_search / MCP。
- project trust 照 pi 的规则：读 `~/.pi/agent/trust.json` 和 `defaultProjectTrust`；需要问时通过扩展 UI 弹确认框（我的决定）。
- 扩展 UI 只实现 pi RPC 子集：`select`、`confirm`、`input`、`editor` 弹框；`notify` 走 toast；`setStatus`、`setWidget`（文本）进摘要面板；`setTitle` 改窗口标题；`set_editor_text` 写入输入框。`ctx.mode` 报 `"rpc"`，`custom()` 等终端专属能力按 RPC 模式降级。
- 弹框和 toast 用仓库已有的 Reka + Radix Themes 基础件，不自写。
- 扩展的启用和禁用照 pi 自己的 settings（packages、extensions 配置），pig 设置页只是读写同一份文件（我的决定）。

## 10. subagent 扩展

- 形态照 pi 官方 subagent 示例：一个 `subagent` 工具，支持单个、并行、串联三种调用；agent 定义读 `~/.pi/agent/agents/*.md` 和项目 `.pi/agents/*.md`，格式与示例相同。
- 子任务在同一进程里用 `createAgentSession` 开子会话，复用模型运行时和认证。子会话的工具跟主会话走同一个环境。
- 子会话持久化为独立会话文件，用 pi 会话头里已有的 `parentSession` 字段关联主会话，不自定义字段；点开时能读完整过程，侧边栏默认不列出（我的决定）。
- 并行上限照示例：一次最多 8 个任务，同时跑 4 个（我的决定）。中止主会话时，所有子会话一起中止。
- 工具结果的 `details` 放结构化数据（每个子任务的名字、状态、最后几步、用量、子会话 id），web 按它画卡片。TUI 渲染器照写，供 pi TUI 用。
- 界面：照 cc-wrapper 的 session rail（`G:\AICode\cc-wrapper\app\src\source-session-rail*.jsx`），在右上角加摘要面板，三块：环境、context、task。task 块列出子任务和状态；点开某个子任务，在侧栏只读显示它的完整子会话。主会话里只留一张紧凑的子任务卡片。

> 摘要面板的画面还没出图。做第 ③ 步前先出一版图，和 cc-wrapper 对齐后再写代码。

## 11. 远程 workspace

> 初期 agent 留在本地，先把「本地 agent + 远程工具」这个场景跑通（你定的）。之后再上「远程机器跑精简 gateway」：本地桌面端经 SSH 拉起它，协议不变；届时 cwd 占位、skills 同步、AGENTS.md 注入这几层绕路可以去掉。所以这几层要写在 `remote-workspace` 扩展和 `packages/environment` 里，不渗进 gateway 核心，方便以后整块替换。

- **环境**：`packages/environment` 定义一个接口（执行命令、读写文件、stat、列目录、搜索），有本地和 SSH 两种实现。SSH 用 `ssh2`，每台机器一条长连接，命令走 exec，文件走 SFTP，断线自动重连。认证读 `~/.ssh/config`、密钥和 ssh-agent。
- **环境列表**：`~/.ssh/config` 里的主机，加上 pig 保存在 `~/.pig/environments.json` 里的环境（主机 + 默认目录）。
- **工具转发**：`remote-workspace` 扩展在会话绑定远程环境时，用 pi 的 `createBashTool` / `createReadTool` / `createEditTool` / `createWriteTool` 加自定义 operations 替换内置工具，底层调用环境包。在 pi TUI 里用启动参数指定远程（如 `--ssh 主机:/路径`），与官方 `ssh.ts` 示例的用法一致。
- **会话怎么记住环境**：会话的 cwd 必须是一个真实存在的本地目录（pi 会按 cwd 读写本地文件）。远程绑定写进会话文件里（扩展自定义条目），重开会话时扩展读回它并恢复转发。具体用哪个本地目录做 cwd 留给实现者，要求是同一远程 workspace 的会话落到同一个目录、互不冲突。
- **远程项目资源**：远程的 AGENTS.md 由扩展经环境读出，在 `before_agent_start` 里注入系统提示；远程 skills 同步到本地缓存目录，经 `resources_discover` 返回。远程项目级扩展不加载。
- **会话存储**：存在本地会话目录。workspace 键为 `ssh://主机/路径`，侧边栏按「环境 / 目录」分组。
- **平台功能**：目录选择、文件搜索、@ 提及在远程 workspace 下走环境包。非图片附件上传到远程临时目录，再把远程路径写进提示（我的决定）。

## 12. 分步落地

7. **清理测试（第 ⓪ 步）**：按第 13 节的规则清理现有测试，只留会影响产品形态的用例（含 e2e）。先清理，第 ① 步就不用为将被删的用例改写。验收：删除清单写进提交说明；剩下的用例全过；跑一次 `pnpm test:bench` 记下基线。

8. **①a 升级 + 换协议，行为不变**：升到 pi-coding-agent 1.5.0，移除 pi-server / pi-protocol / pi-client；建 `packages/protocol`；重写 gateway 协议层和会话宿主；重写 web 连接层。界面行为与现在完全一致，包括保留「最近 3 轮 + 上翻补」。验收：第 ⓪ 步留下的 e2e 一行不改全过；bench 不比基线差。

9. **①b 性能改造**：流式只发增量；内存会话索引；投影缓存；历史一次给全的轻量条目；`content-visibility`；富文本延迟渲染与缓存；保留最近会话视图。验收：`e2e/history-page.spec.ts` 按新行为改写；bench 在冷启动到侧边栏可用、长会话首屏、会话切换三项上比 ①a 快。

10. **扩展宿主 + 扩展 UI**：加载本地扩展、codemode / MCP；接扩展 UI 桥；project trust 弹框；设置页能看到并启停扩展。验收：用 pi 官方示例里的 `confirm-destructive`、`notify`、`model-status` 扩展，在 pig 里行为与 TUI 一致；补 e2e。

11. **subagent + 摘要面板**：先出摘要面板的图并确认；再建 `packages/extensions`，写 subagent；web 加摘要面板、子任务卡片和子会话只读视图。验收：单个、并行、串联三种调用在 pig 和 pi TUI 里都能跑；中止能传到子会话；补 e2e。

12. **远程 workspace**：建 `packages/environment` 和 `remote-workspace` 扩展；环境列表和侧边栏分组；平台功能走环境。验收：对一台 SSH 主机完成新建会话、多轮工具调用、重开会话、subagent 在远程跑；远程 AGENTS.md 和 skills 生效。

13. **durable 试验（不在这次范围）**：只在前四步完成后，单独立项评估。

## 13. 测试规则

只保留「破坏它，用户会察觉或数据会错」的用例。新增和清理都按这一条判断，拿不准就删。

| 留 | 删 |
|---|---|
| e2e 里的用户旅程：建会话、一轮对话、排队与 steer、切换会话、历史、附件、模型与供应商、扩展弹框、subagent、远程会话 | 同一旅程的重复覆盖：多个 spec 测同一条路径，只留最完整的一个 |
| 数据路径：投影把 pi 条目变成界面条目是否正确（工具配对、压缩、分支、`context_edit`）、会话索引的排序与分组、协议的请求和事件对得上 | 内部机制：缓存命中、合帧、节流时长、虚拟滚动、mock 的调用次数 |
| 本地安全：鉴权、目录白名单 | 样式值、DOM 结构、类名、组件快照 |
| 打包、发布、启动链路 | 只验证某个函数返回值、与产品行为无关的单测 |

- 现状：gateway 单测 21 个文件、约 3200 行；web 单测 25 个、约 4500 行；e2e 21 个、约 1600 行；desktop 5 个；scripts 3 个。
- 建在旧 `PiServer` 接口上的 gateway 单测在第 ⓪ 步直接删，第 ① 步按新协议只补数据路径用例。
- bench（`e2e/perf`）不算测试膨胀，保留，它是性能验收的依据。
- 每一步新增用例时，在提交说明里写清它守的是哪条产品假设。

## 14. 留给实现者

- 协议每条消息的字段、界面条目的具体结构（以现有 `TranscriptProjection` 的输出为起点）。
- gateway 内部目录怎么分，只要守 500 行上限和 `docs/directory-structure.md` 的边界，并在完成后更新该文档。
- 如果 `content-visibility` 不够、要上虚拟列表：先看已有依赖能否胜任；要新增，优先 `@tanstack/vue-virtual`（reka-ui 已间接依赖它），锁精确版本。
- 远程会话用的本地 cwd 目录规则；SSH 断线重连的退避参数。
- 会话索引和环境列表的存放位置照现有 `authorized-workspaces.json` 的规则：指定了会话目录就放它旁边，否则放 `~/.pig/`（我的决定）。
- `ssh2` 安装时禁用生命周期脚本，会跳过可选的原生加速模块，走纯 JS 实现；这是预期行为，不需要补（我的决定）。
- LRU、首屏条数、保留视图数这些数字，可按 bench 结果调整。

## 15. 风险

- pi 的若干 1.x 包标着实验性。本设计只依赖 `pi-coding-agent` 的 SDK 和 Extension API，这是 pi 自己 TUI 也在用的稳定面。
- 远程工具每次调用仍有一次网络往返。长连接能省掉握手，但高延迟链路上 agent 会明显变慢。
- 进程内 subagent 崩溃会影响宿主。扩展要兜住子会话的异常，不让它冒到主会话。
- agent 在本地，合上电脑远程任务就停。离线长任务要等后续把 gateway 放到远程，或接 durable。

## 16. 本次用到的产物

- 文档 `document/gateway-pi-1x-architecture`（即本文，`.ryugi/artifacts/document/gateway-pi-1x-architecture/doc.xml`）：三轮问答，结论全部在第 4 节。
