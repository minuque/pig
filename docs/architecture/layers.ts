/** 依赖看板的分层：从上到下排，下层引用上层算违规；pnpm arch 校验每个模块都归了层。 */

export interface Layer {
  name: string
  note: string
  /** 包内分组，相对包的 src；"" 指 src 根目录。包之间那一档直接写包目录。 */
  dirs: string[]
}

/** 键是包目录；"" 是包之间。只有一个分组的包不用写。 */
export const layers: Record<string, Layer[]> = {
  "": [
    { name: "应用", note: "界面与桌面壳", dirs: ["apps/web", "apps/desktop"] },
    { name: "服务", note: "网关与扩展", dirs: ["packages/gateway", "packages/extensions"] },
    { name: "底座", note: "协议与环境", dirs: ["packages/protocol", "packages/environment"] },
  ],
  "apps/web": [
    { name: "入口", note: "启动与路由", dirs: ["", "router", "shell"] },
    {
      name: "页面",
      note: "拼装功能",
      dirs: [
        "features/session-workbench",
        "features/session-nav",
        "features/session-rail",
        "features/file-pane",
        "features/extension-ui",
        "features/design-lab",
      ],
    },
    {
      name: "功能",
      note: "业务逻辑",
      dirs: [
        "features/split-view",
        "features/composer",
        "features/transcript-view",
        "features/settings",
        "features/preview",
        "features/remote-workspace",
        "features/startup",
        "features/theme",
        "features/click-sound",
      ],
    },
    { name: "状态", note: "会话状态，不引用别的功能", dirs: ["features/session"] },
    { name: "组件", note: "通用 UI", dirs: ["components/layout", "components/ui", "components/icons"] },
    { name: "底座", note: "谁都能用", dirs: ["client", "types", "i18n", "utils"] },
  ],
  "apps/desktop": [
    { name: "入口", note: "开发启动脚本", dirs: [""] },
    { name: "主进程", note: "窗口与协议", dirs: ["main"] },
  ],
  "packages/gateway": [
    { name: "入口", note: "CLI 与导出", dirs: [""] },
    { name: "服务", note: "HTTP 与 WebSocket", dirs: ["server"] },
    { name: "运行时", note: "Pi Agent 会话", dirs: ["pi"] },
    { name: "底座", note: "登录态与系统对接", dirs: ["auth", "system"] },
  ],
  "packages/extensions": [
    { name: "扩展", note: "对外能力", dirs: ["subagent", "turn-timing", "file-mentions"] },
    { name: "底座", note: "被其他扩展复用", dirs: ["tasks", "remote-workspace"] },
  ],
}
