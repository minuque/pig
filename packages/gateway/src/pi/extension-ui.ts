import { randomUUID } from "node:crypto"
import type { ExtensionUIContext, Theme } from "@earendil-works/pi-coding-agent"
import type { ExtensionUiDialog, ExtensionUiRequest, ExtensionUiResponse } from "@pig/protocol"

/** pi 把当前主题挂在这个全局键上；RPC 模式的 ctx.ui.theme 也读它。 */
const THEME_KEY = Symbol.for("@earendil-works/pi-coding-agent:theme")

type Pending = { request: ExtensionUiDialog; resolve: (response: ExtensionUiResponse) => void }

type DialogOptions = { signal?: AbortSignal; timeout?: number }

/**
 * 扩展的 ctx.ui 在 web 上的实现，能力边界照 pi RPC 模式：对话框等客户端作答，
 * 通知类单向发出，终端专属能力（custom、footer、编辑器组件等）降级为空操作。
 */
export class ExtensionUiBridge {
  private readonly pending = new Map<string, Pending>()

  constructor(private readonly send: (request: ExtensionUiRequest) => void) {}

  /** 还在等回答的对话框；客户端重连或新挂上时补发。 */
  dialogs(): ExtensionUiDialog[] {
    return [...this.pending.values()].map((entry) => entry.request)
  }

  respond(response: ExtensionUiResponse) {
    this.pending.get(response.id)?.resolve(response)
  }

  /** 会话释放：所有未答的对话框按取消处理，扩展拿到默认值。 */
  cancelAll() {
    for (const [id, entry] of this.pending) entry.resolve({ id, cancelled: true })
  }

  readonly context: ExtensionUIContext = {
    select: (title, options, opts) =>
      this.dialog(opts, undefined, { method: "select", title, options, ...timeout(opts) }, (r) =>
        "value" in r ? r.value : undefined,
      ),
    confirm: (title, message, opts) =>
      this.dialog(opts, false, { method: "confirm", title, message, ...timeout(opts) }, (r) =>
        "confirmed" in r ? r.confirmed : false,
      ),
    input: (title, placeholder, opts) =>
      this.dialog(
        opts,
        undefined,
        { method: "input", title, ...(placeholder ? { placeholder } : {}), ...timeout(opts) },
        (r) => ("value" in r ? r.value : undefined),
      ),
    editor: (title, prefill) =>
      this.dialog(
        undefined,
        undefined,
        { method: "editor", title, ...(prefill ? { prefill } : {}) },
        (r) => ("value" in r ? r.value : undefined),
      ),
    notify: (message, type) =>
      this.emit({ method: "notify", message, ...(type ? { notifyType: type } : {}) }),
    setStatus: (key, text) => this.emit({ method: "setStatus", statusKey: key, statusText: text }),
    setWidget: (key: string, content: unknown, options?: { placement?: string }) => {
      // 只支持文本行；组件工厂需要终端，按 RPC 模式忽略
      if (content !== undefined && !Array.isArray(content)) return
      const placement = options?.placement
      this.emit({
        method: "setWidget",
        widgetKey: key,
        widgetLines: content as string[] | undefined,
        ...(placement === "aboveEditor" || placement === "belowEditor"
          ? { widgetPlacement: placement }
          : {}),
      })
    },
    setTitle: (title) => this.emit({ method: "setTitle", title }),
    setEditorText: (text) => this.emit({ method: "set_editor_text", text }),
    pasteToEditor: (text) => this.emit({ method: "set_editor_text", text }),
    getEditorText: () => "",
    onTerminalInput: () => () => {},
    setWorkingMessage: () => {},
    setWorkingVisible: () => {},
    setWorkingIndicator: () => {},
    setHiddenThinkingLabel: () => {},
    setFooter: () => {},
    setHeader: () => {},
    custom: async () => undefined as never,
    addAutocompleteProvider: () => {},
    setEditorComponent: () => {},
    getEditorComponent: () => undefined,
    get theme() {
      return Reflect.get(globalThis, THEME_KEY) as Theme
    },
    getAllThemes: () => [],
    getTheme: () => undefined,
    setTheme: () => ({ success: false, error: "Theme switching is not supported in pig" }),
    getToolsExpanded: () => false,
    setToolsExpanded: () => {},
  } as ExtensionUIContext

  private emit(request: DistributiveOmit<ExtensionUiRequest, "id">) {
    this.send({ id: randomUUID(), ...request } as ExtensionUiRequest)
  }

  private dialog<T>(
    opts: DialogOptions | undefined,
    fallback: T,
    request: DistributiveOmit<ExtensionUiDialog, "id">,
    parse: (response: ExtensionUiResponse) => T,
  ): Promise<T> {
    if (opts?.signal?.aborted) return Promise.resolve(fallback)
    const id = randomUUID()
    return new Promise<T>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const finish = (value: T) => {
        clearTimeout(timer)
        opts?.signal?.removeEventListener("abort", onAbort)
        this.pending.delete(id)
        resolve(value)
      }
      const onAbort = () => finish(fallback)
      opts?.signal?.addEventListener("abort", onAbort, { once: true })

      if (opts?.timeout) timer = setTimeout(() => finish(fallback), opts.timeout)
      const full = { id, ...request } as ExtensionUiDialog
      this.pending.set(id, {
        request: full,
        resolve: (response) => finish("cancelled" in response ? fallback : parse(response)),
      })
      this.send(full)
    })
  }
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

function timeout(opts: DialogOptions | undefined) {
  return opts?.timeout ? { timeout: opts.timeout } : {}
}
