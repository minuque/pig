import type { UseSpeechRecognitionReturn } from "@vueuse/core"
import { onScopeDispose, shallowRef, type Ref } from "vue"

type Recognition = NonNullable<UseSpeechRecognitionReturn["recognition"]>
type RecognitionConstructor = new () => Recognition

/** 单次口述写入草稿，结束后由用户确认发送。 */
export function useVoiceInput(prompt: Ref<string>) {
  const browser:
    | (Window & {
        SpeechRecognition?: RecognitionConstructor
        webkitSpeechRecognition?: RecognitionConstructor
      })
    | undefined = typeof window === "undefined" ? undefined : window
  const Constructor = browser?.SpeechRecognition ?? browser?.webkitSpeechRecognition
  const active = shallowRef(false)
  const message = shallowRef("")
  let current: Recognition | undefined

  function cancel() {
    const recognition = current
    current = undefined
    active.value = false
    recognition?.abort()
  }

  function start() {
    if (active.value) return
    if (!Constructor) {
      message.value = "当前浏览器不支持语音输入，请使用键盘输入。"
      return
    }
    message.value = ""
    const baseline = prompt.value
    try {
      const recognition = new Constructor()
      current = recognition
      recognition.lang = navigator.language
      recognition.continuous = false
      recognition.interimResults = true
      recognition.onresult = (event) => {
        const text = event.results[0]?.[0]?.transcript
        if (current === recognition && text !== undefined) prompt.value = baseline + text
      }
      recognition.onerror = () => {
        if (current !== recognition) return
        message.value = "语音识别不可用，请检查麦克风权限和网络后重试。"
        cancel()
      }
      recognition.onend = () => {
        if (current !== recognition) return
        current = undefined
        active.value = false
      }
      active.value = true
      recognition.start()
    } catch {
      message.value = "无法启动语音识别，请检查麦克风权限后重试。"
      cancel()
    }
  }

  function stop() {
    current?.stop()
  }

  onScopeDispose(cancel)
  return { active, message, start, stop, cancel }
}
