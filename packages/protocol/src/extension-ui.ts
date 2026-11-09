/** 扩展经 ctx.ui 发来的请求；字段照 pi RPC 的 extension_ui_request，去掉 type。 */
export type ExtensionUiRequest =
  | { id: string; method: "select"; title: string; options: string[]; timeout?: number }
  | { id: string; method: "confirm"; title: string; message: string; timeout?: number }
  | { id: string; method: "input"; title: string; placeholder?: string; timeout?: number }
  | { id: string; method: "editor"; title: string; prefill?: string }
  | { id: string; method: "notify"; message: string; notifyType?: "info" | "warning" | "error" }
  | { id: string; method: "setStatus"; statusKey: string; statusText: string | undefined }
  | {
      id: string
      method: "setWidget"
      widgetKey: string
      widgetLines: string[] | undefined
      widgetPlacement?: "aboveEditor" | "belowEditor"
    }
  | { id: string; method: "setTitle"; title: string }
  | { id: string; method: "set_editor_text"; text: string }

/** 对话框类请求的回答；照 pi RPC 的 extension_ui_response。 */
export type ExtensionUiResponse =
  | { id: string; value: string }
  | { id: string; confirmed: boolean }
  | { id: string; cancelled: true }

export type ExtensionUiDialog = Extract<
  ExtensionUiRequest,
  { method: "select" | "confirm" | "input" | "editor" }
>
