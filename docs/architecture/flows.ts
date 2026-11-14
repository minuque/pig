/** 关键数据流：手写的语义，每步 ref 指向真实代码，pnpm check 校验它仍然存在。 */

export interface FlowStep {
  from: string
  to: string
  text: string
  /** 仓库相对路径，可带 #导出名 或 #导出名.成员。 */
  ref?: string
}

export interface Flow {
  id: string
  title: string
  channel: "ws" | "http" | "local"
  steps: FlowStep[]
}

export const flows: Flow[] = [
  {
    id: "startup",
    title: "启动与连接",
    channel: "ws",
    steps: [
      {
        from: "CLI / Desktop",
        to: "Gateway",
        text: "只监听 127.0.0.1；CLI 默认 8787，Desktop 由系统分配端口",
        ref: "packages/gateway/src/server/host.ts#Gateway",
      },
      {
        from: "Desktop",
        to: "Browser",
        text: "开发窗口加载 Vite；打包后主进程托管 pig://app 并注入 Gateway 地址",
        ref: "apps/desktop/src/main/protocol.ts#handlePigProtocol",
      },
      {
        from: "Browser",
        to: "Gateway",
        text: "WebSocket 连接 /api/v1/pi",
        ref: "apps/web/src/client/transport.ts#webSocketUrl",
      },
      {
        from: "Gateway",
        to: "Gateway",
        text: "升级前校验本机通行证，通过后交给协议端",
        ref: "packages/gateway/src/server/websocket.ts#ProtocolServer.upgrade",
      },
      {
        from: "Gateway",
        to: "Browser",
        text: "hello 返回 ServerSnapshot：会话列表与模型",
        ref: "packages/gateway/src/server/websocket.ts#ProtocolServer.serverSnapshot",
      },
    ],
  },
  {
    id: "auth",
    title: "本机通行证",
    channel: "http",
    steps: [
      {
        from: "CLI / Desktop",
        to: "Browser",
        text: "把一次性 launch token 拼进地址；桌面壳给本机请求补 Authorization",
        ref: "packages/gateway/src/auth/browser-session.ts#BrowserSession.authenticatedUrl",
      },
      {
        from: "Browser",
        to: "Gateway",
        text: "GET /?token=… 换 HttpOnly cookie，303 跳回干净地址",
        ref: "packages/gateway/src/auth/browser-session.ts#BrowserSession.authorizeIndex",
      },
      {
        from: "Gateway",
        to: "Gateway",
        text: "非回环 host、跨站来源 403，缺通行证 401；静态页、平台 API、WS 升级都过这道门",
        ref: "packages/gateway/src/auth/browser-session.ts#BrowserSession.rejection",
      },
    ],
  },
  {
    id: "open-session",
    title: "打开或创建会话",
    channel: "ws",
    steps: [
      {
        from: "Router",
        to: "session",
        text: "路由带 sessionId 打开已有会话，欢迎页带 cwd 创建",
        ref: "apps/web/src/features/session/hooks/use-session.ts#useSessionLifecycle",
      },
      {
        from: "session",
        to: "Gateway",
        text: "GET platform/transcript 取历史轻量形态，不阻塞连接",
        ref: "apps/web/src/features/session/hooks/use-session-history.ts#useSessionHistory",
      },
      {
        from: "session",
        to: "Gateway",
        text: "WS 命令 attach_session / create_session",
        ref: "apps/web/src/client/gateway-client.ts#GatewayClient.requestSession",
      },
      {
        from: "Gateway",
        to: "Pi",
        text: "按 JSONL 打开或新建 AgentSession",
        ref: "packages/gateway/src/pi/service.ts#PiHostService.openSession",
      },
      {
        from: "Gateway",
        to: "session",
        text: "SessionSnapshot 只带元数据与当前窗口，正文另走 HTTP",
        ref: "packages/gateway/src/pi/session-runtime.ts#PiHostSession.snapshot",
      },
    ],
  },
  {
    id: "prompt",
    title: "发送 Prompt 与流式回显",
    channel: "ws",
    steps: [
      {
        from: "Composer",
        to: "session",
        text: "先放乐观的用户条目，清空草稿",
        ref: "apps/web/src/features/composer/hooks/use-session-composer.ts#useSessionComposer",
      },
      {
        from: "session",
        to: "Gateway",
        text: "WS 命令 prompt",
        ref: "apps/web/src/client/gateway-session.ts#GatewaySession.submit",
      },
      {
        from: "Gateway",
        to: "Pi",
        text: "非 idle 或并发操作直接拒绝；空闲时交给 AgentSession 跑 turn 与工具",
        ref: "packages/gateway/src/pi/session-runtime.ts#PiHostSession.prompt",
      },
      {
        from: "Pi",
        to: "Gateway",
        text: "message_* 与 tool_execution_* 事件投影成 progress；同一消息的连续 delta 只发最后一版",
        ref: "packages/gateway/src/pi/transcript.ts#TranscriptProjection.progress",
      },
      {
        from: "Gateway",
        to: "session",
        text: "session_progress 事件；message_end 后延迟一拍发权威快照收敛流式状态",
        ref: "packages/gateway/src/pi/session-runtime.ts#PiHostSession",
      },
    ],
  },
  {
    id: "abort",
    title: "中止活动 Turn",
    channel: "ws",
    steps: [
      {
        from: "Composer",
        to: "session",
        text: "活动 Turn 时发送钮变停止",
        ref: "apps/web/src/features/session/hooks/use-session.ts#useSessionLifecycle",
      },
      {
        from: "session",
        to: "Gateway",
        text: "WS 命令 abort，不等当前 delta",
        ref: "apps/web/src/client/gateway-session.ts#GatewaySession.abort",
      },
      {
        from: "Gateway",
        to: "Pi",
        text: "中止始终安全，不做 idle 检查，重复中止无副作用",
        ref: "packages/gateway/src/pi/session-runtime.ts#PiHostSession.abort",
      },
    ],
  },
  {
    id: "model",
    title: "换模型与 thinking",
    channel: "ws",
    steps: [
      {
        from: "Composer",
        to: "session",
        text: "空闲时选模型或切档位；在途时不让快照回写覆盖",
        ref: "apps/web/src/features/composer/hooks/use-session-composer.ts#useSessionComposer",
      },
      {
        from: "session",
        to: "Gateway",
        text: "WS 命令 set_model / set_thinking_level",
        ref: "apps/web/src/client/gateway-session.ts#GatewaySession.setModel",
      },
      {
        from: "Gateway",
        to: "Pi",
        text: "互斥且须 idle，冲突操作直接拒绝",
        ref: "packages/gateway/src/pi/session-runtime.ts#PiHostSession.setModel",
      },
    ],
  },
  {
    id: "context-usage",
    title: "上下文占用",
    channel: "http",
    steps: [
      {
        from: "session",
        to: "Gateway",
        text: "快照 revision 变化后 GET platform/context-usage",
        ref: "apps/web/src/features/session/hooks/use-live-subscriptions.ts#useLiveSubscriptions",
      },
      {
        from: "Gateway",
        to: "Pi",
        text: "读活动 AgentSession 估算；未打开的会话返回 null",
        ref: "packages/gateway/src/pi/service.ts#PiHostService.contextUsage",
      },
    ],
  },
  {
    id: "session-files",
    title: "目录与会话文件操作",
    channel: "http",
    steps: [
      {
        from: "session-nav",
        to: "Gateway",
        text: "选目录、改名、删除走平台 HTTP",
        ref: "apps/web/src/features/session-nav/hooks/use-workspace-nav.ts#useWorkspaceNav",
      },
      {
        from: "Gateway",
        to: "Disk",
        text: "Electron 对话框选目录；SessionManager 改 JSONL",
        ref: "packages/gateway/src/pi/service.ts#PiHostService.renameSession",
      },
      {
        from: "session-nav",
        to: "Gateway",
        text: "刷新会话列表与侧栏卡片",
        ref: "apps/web/src/client/platform.ts#listSessionCards",
      },
    ],
  },
  {
    id: "warm-workspace",
    title: "工作区预热",
    channel: "http",
    steps: [
      {
        from: "Workbench",
        to: "Gateway",
        text: "欢迎页选中目录后 POST platform/warm-workspace",
        ref: "apps/web/src/client/platform.ts#warmWorkspace",
      },
      {
        from: "Gateway",
        to: "Pi",
        text: "按 canonical cwd 准备一份已 reload 的 loader，建会话时复用",
        ref: "packages/gateway/src/pi/service.ts#PiHostService.prepareWorkspace",
      },
    ],
  },
]
