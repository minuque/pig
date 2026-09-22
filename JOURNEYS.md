# 核心旅程

pig 把用户动作接到 Pi 的 Session，再把 Snapshot / Transcript 投到工作台。

两条总线：

- WebSocket（官方协议）：连接、Session 列表、创建/打开、Prompt / Abort、改 Model / Thinking。权威状态是 `ServerSnapshot` 和 `SessionSnapshot`。
- HTTP `/api/v1/platform/*`（Thin Host）：选目录、侧栏卡片、历史 Transcript、上下文占用、重命名、删除。不进 Agent Domain。

```mermaid
flowchart TB
  UI[Vue UI]
  RS[RemoteSession]
  PC[PiClient]
  HTTP[platform HTTP]
  GW[Gateway]
  PS[PiServer]
  SDK[SessionManager / AgentSession]

  UI --> RS
  UI --> HTTP
  RS --> PC
  PC -->|WebSocket| GW
  HTTP --> GW
  GW --> PS
  PS --> SDK
```

## 启动进工作台

e2e 对应 `01-startup` → `02-session-inbox`。

```mermaid
flowchart TB
  Open["打开带启动凭证的本机页"] --> Cookie["换成浏览器通行证"]
  Cookie --> WS["PiClient.connect WebSocket"]
  WS --> Snap["ServerSnapshot: sessions + models"]
  Snap --> Init["按路由 openSession"]
  Init --> Gate{"成功?"}
  Gate -->|是| Inbox["侧栏会话列表 + 欢迎页"]
  Gate -->|否| Err["/error"]
```

启动门和 Logo 动画并行。超时 8s 进 `/error`。Gateway 只绑 127.0.0.1。浏览器用一次性启动凭证换成通行证，之后的接口和 WebSocket 都要带上它。

## 选工作目录

Working Directory 限定 Session 范围。列表和 `lastCwd` 只活在浏览器。

```mermaid
flowchart TB
  Click["侧栏 / 欢迎页 添加目录"] --> Sel["POST /api/v1/platform/select-directory"]
  Sel --> Port{"系统选目录 or 手输路径"}
  Port --> Canon["canonicalizePath"]
  Canon --> LS["pig.localWorkspaces + pig.lastCwd"]
  LS --> Groups["侧栏按 cwd 分组"]
```

会话列表来自 Pi。目录筛选来自本地偏好。两边按 canonical path 对齐。

## 欢迎页开新会话

路由 `/`，无 `sessionId`。这是主创建路径。

```mermaid
flowchart TB
  Idle["工作台 / ：Hero + 底栏 Composer"] --> Guard{"有 cwd + preset + 非空 Prompt?"}
  Guard --> Create["RemoteSession.create cwd/model/thinking"]
  Create --> Route["router.push /sessions/:id"]
  Route --> Open["同步 RemoteSession"]
  Open --> Prompt["submit 第一条 Prompt"]
  Prompt --> Turn["phase: idle → turn"]
  Turn --> TL["Transcript 出现 User Message"]
```

侧栏「新会话」只回到 `/`，不立刻建 Session。Session 在第一条 Prompt 时才创建。

## 打开已有会话

```mermaid
flowchart TB
  Click["点侧栏 Session"] --> Route["/sessions/:sessionId"]
  Route --> Hist["GET platform/transcript"]
  Route --> Open["RemoteSession.open"]
  Open --> Snap["SessionSnapshot 不含全文"]
  Hist --> Merge["已加载窗口 + live progress"]
  Snap --> Merge
  Merge --> View{"transcript?"}
  View -->|空且 idle| Idle["Hero + 底栏 Composer"]
  View -->|有内容| Timeline["TranscriptView + 底栏 Composer"]
  View -->|历史未到且 Remote 未齐| Loading["SessionLoading"]
```

切 Session 会串行替换 lease。连点只落地最后一个 id。历史 HTTP 与 RemoteSession.open 并行：同一 Session 已 ready 或在飞不重复拉，revision 变化才再拉。未连接时 initialize 仍拉磁盘历史。打开只拉最后一轮；之后已加载窗口只增不缩，最新页接到尾巴，不整页替换。live progress 按 id 覆盖当前回合。空 snapshot 不冲掉已拉到的历史。hasMore 跟窗口第一条走，上翻再 prepend。

## 一轮工作

```mermaid
flowchart TB
  Idle["phase idle"] --> Send["Composer 发送"]
  Send --> Opt["乐观 User Message"]
  Opt --> Submit["RemoteSession.submit"]
  Submit --> Agent["AgentSession.prompt"]
  Agent --> Prog["Snapshot + Transcript 流式投影"]
  Prog --> Rows["User / Assistant / Tool Call"]
  Rows --> End{"结束?"}
  End -->|idle| Ready["发送钮回来"]
  End -->|turn/retry/compaction| AbortBtn["发送钮变停止"]
  AbortBtn --> Abort["RemoteSession.abort"]
  Abort --> Idle
```

当前 UI 不做 Steering。运行中只能 Abort。协议里 `submit` 在 `turn` 时是 steer，Web 不走这条。

空闲时可改 Model / Thinking：`preset` → `setModel` / `setThinking`。不新建 Session，已有 Transcript 不变。

## 侧栏管理 Session

```mermaid
flowchart TB
  List["ServerSnapshot.sessions"] --> Cards["GET session-cards"]
  Cards --> Rows["按更新时间或项目分组"]
  Rows --> Rename["POST rename-session"]
  Rows --> Delete["POST delete-session"]
  Rename --> Refresh["listSessions + cards"]
  Delete --> Home{"删的是当前?"}
  Home -->|是| Slash["回 /"]
  Home -->|否| Refresh
```

Session Name 是显示标签，不是身份。Delete Session 永久删除 Pi Session 和 Transcript。

辅助读路径：向上翻更早 Transcript、看 context usage。失败不挡主流程。

## 工作台状态

```mermaid
flowchart TB
  Start[启动等待态] --> Welcome["/ Hero + 底栏输入"]
  Start --> Error["/error"]
  Welcome -->|第一条 Prompt| Session["/sessions/:id"]
  Welcome -->|点已有 Session| Session
  Session --> Loading[附加中]
  Loading --> Idle[Hero + 底栏输入]
  Loading --> Talk[时间线 + 底栏输入]
  Idle -->|Prompt| Talk
  Talk -->|新会话按钮| Welcome
  Talk -->|删除当前| Welcome
```

e2e 走到欢迎页和输入卡可用就停，不发真实 Turn。主题和窄屏抽屉是壳层，不进这条数据流。

协议有、当前 UI 没有：Steering、手动 Compaction、图片进协议、fork/clone。附件只停在输入卡。
