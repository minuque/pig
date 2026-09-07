import { afterEach, describe, expect, it, vi } from "vitest"
import { effectScope, ref } from "vue"
import { shouldSubmitOnKeydown } from "@features/composer/components/PromptEditor.vue"
import { useVoiceInput } from "@features/composer/hooks/use-voice-input.js"

class Recognition {
  static instances: Recognition[] = []
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
  abort = vi.fn()

  constructor() {
    Recognition.instances.push(this)
  }

  result(text: string) {
    this.onresult?.({ results: [[{ transcript: text }]] })
  }
}

const scopes: ReturnType<typeof effectScope>[] = []

function setup() {
  vi.stubGlobal("window", { SpeechRecognition: Recognition })
  const prompt = ref("")
  const scope = effectScope()
  scopes.push(scope)
  const voice = scope.run(() => useVoiceInput(prompt))
  if (!voice) throw new Error("语音作用域未创建")
  return { prompt, voice, scope }
}

function latestRecognition() {
  const recognition = Recognition.instances.at(-1)
  if (!recognition) throw new Error("识别器未创建")
  return recognition
}

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
  Recognition.instances = []
  vi.unstubAllGlobals()
})

describe("一轮工作 → 输入草稿后确认发送", () => {
  it("失败路径：输入卡事件表达式语法错误时，实际组件编译必须失败", async () => {
    await expect(import("@features/composer/index.vue")).resolves.toHaveProperty("default")
  })

  it("Enter 发送；失败路径：中文候选确认和 Shift+Enter 不发送", () => {
    expect(shouldSubmitOnKeydown({ key: "Enter", shiftKey: false, isComposing: false })).toBe(true)
    expect(shouldSubmitOnKeydown({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false)
    expect(shouldSubmitOnKeydown({ key: "Enter", shiftKey: true, isComposing: false })).toBe(false)
  })

  it("口述临时结果原位更新，停止后保留最终草稿，不自动发送", () => {
    const { prompt, voice } = setup()
    voice.start()
    const recognition = latestRecognition()
    recognition.result("帮我")
    recognition.result("帮我读取文件")
    expect(prompt.value).toBe("帮我读取文件")
    voice.stop()
    expect(recognition.stop).toHaveBeenCalledOnce()
    expect(voice.active.value).toBe(true)
    recognition.result("帮我读取文件。")
    recognition.onend?.()
    expect(prompt.value).toBe("帮我读取文件。")
    expect(voice.active.value).toBe(false)
  })

  it("失败路径：切会话、重新口述或卸载后，旧识别回调不得覆盖新草稿", () => {
    const { prompt, voice, scope } = setup()
    voice.start()
    const previous = latestRecognition()
    voice.cancel()
    expect(previous.abort).toHaveBeenCalledOnce()
    prompt.value = "新草稿"
    voice.start()
    const current = latestRecognition()
    previous.result("迟到结果")
    previous.onend?.()
    expect(prompt.value).toBe("新草稿")
    expect(voice.active.value).toBe(true)
    scope.stop()
    current.result("卸载后的结果")
    expect(prompt.value).toBe("新草稿")
    expect(current.abort).toHaveBeenCalledOnce()
  })

  it("失败路径：识别报错或浏览器不支持时保留草稿并给出提示", () => {
    const { prompt, voice } = setup()
    prompt.value = "已有草稿"
    voice.start()
    latestRecognition().onerror?.()
    expect(voice.active.value).toBe(false)
    expect(voice.message.value).toContain("麦克风权限")
    expect(prompt.value).toBe("已有草稿")
    vi.stubGlobal("window", {})
    const scope = effectScope()
    scopes.push(scope)
    scope.run(() => {
      const unsupported = useVoiceInput(prompt)
      unsupported.start()
      expect(unsupported.message.value).toContain("不支持")
      expect(unsupported.active.value).toBe(false)
      expect(prompt.value).toBe("已有草稿")
    })
  })
})
