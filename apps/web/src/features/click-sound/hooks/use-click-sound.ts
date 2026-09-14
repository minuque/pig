import { onMounted, onUnmounted, readonly, shallowRef } from "vue"

const CLICK_SOUND_KEY = "pig.clickSound"

const MASTER = 0.32

const INTERACTIVE =
  "button, a[href], input:not([type='hidden']), select, textarea, summary, [role='button'], [role='checkbox'], [role='menuitem'], [role='menuitemcheckbox'], [role='menuitemradio'], [role='option'], [role='radio'], [role='switch'], [role='tab']"

const DISMISS = /close|dismiss|remove|delete|collapse|cancel|clear|关闭|删除|取消|清除|折叠/i

const PRIMARY = /send|save|submit|create|add|upgrade|发送|保存|提交|添加|新建|创建/i

type Cue = "press" | "tick" | "release" | "page" | "pulse"

type Filter = { type: BiquadFilterType; frequency: number; Q?: number }

const enabled = shallowRef(true)

let loaded = false

let binds = 0

let ctx: AudioContext | null = null

function readEnabled(): boolean {
  try {
    return localStorage.getItem(CLICK_SOUND_KEY) !== "off"
  } catch {
    return true
  }
}

function persist(value: boolean): void {
  try {
    localStorage.setItem(CLICK_SOUND_KEY, value ? "on" : "off")
  } catch {
    /* 隐私模式写不进存储时仍用内存开关 */
  }
}

function load(): void {
  if (loaded) return
  loaded = true
  enabled.value = readEnabled()
}

function envelope(ctx: AudioContext, peak: number, attack: number, decay: number): GainNode {
  const gain = ctx.createGain()
  const now = ctx.currentTime
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(peak * MASTER, now + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay)

  return gain
}

function plug(
  ctx: AudioContext,
  node: AudioNode,
  gain: GainNode,
  filter: Filter | undefined,
): void {
  if (!filter) {
    node.connect(gain).connect(ctx.destination)

    return
  }

  const next = ctx.createBiquadFilter()
  next.type = filter.type
  next.frequency.value = filter.frequency

  if (filter.Q != null) next.Q.value = filter.Q
  node.connect(next).connect(gain).connect(ctx.destination)
}

function tone(
  ctx: AudioContext,
  type: OscillatorType,
  frequency: number | { start: number; end: number },
  attack: number,
  decay: number,
  peak: number,
  filter?: Filter,
): void {
  const osc = ctx.createOscillator()
  const now = ctx.currentTime
  osc.type = type

  if (typeof frequency === "number") osc.frequency.value = frequency
  else {
    osc.frequency.setValueAtTime(frequency.start, now)
    osc.frequency.exponentialRampToValueAtTime(frequency.end, now + attack + decay)
  }

  const gain = envelope(ctx, peak, attack, decay)
  plug(ctx, osc, gain, filter)
  osc.start(now)
  osc.stop(now + attack + decay + 0.02)
}

function noise(
  ctx: AudioContext,
  duration: number,
  attack: number,
  decay: number,
  peak: number,
  filter: Filter,
): void {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = envelope(ctx, peak, attack, decay)
  plug(ctx, source, gain, filter)
  source.start()
  source.stop(ctx.currentTime + duration)
}

function emit(audio: AudioContext, cue: Cue): void {
  switch (cue) {
    case "press":
      noise(audio, 0.02, 0.0003, 0.009, 0.13, { type: "highpass", frequency: 2400 })
      tone(audio, "sine", 680, 0.0006, 0.03, 0.24)

      return
    case "tick":
      tone(audio, "square", 2100, 0.0004, 0.028, 0.24, {
        type: "bandpass",
        frequency: 2600,
        Q: 1.6,
      })

      return
    case "release":
      noise(audio, 0.06, 0.001, 0.055, 0.32, { type: "lowpass", frequency: 1600, Q: 0.9 })

      return
    case "page":
      tone(audio, "sine", { start: 430, end: 640 }, 0.002, 0.14, 0.4)

      return
    case "pulse":
      tone(audio, "sine", 330, 0.002, 0.17, 0.5, { type: "lowpass", frequency: 2200 })
  }
}

async function play(cue: Cue): Promise<void> {
  if (typeof AudioContext === "undefined") return
  ctx ??= new AudioContext()

  if (ctx.state === "suspended") await ctx.resume()

  if (ctx.state !== "running") return
  emit(ctx, cue)
}

function cueFor(element: Element): Cue {
  const override = element.getAttribute("data-sound")

  if (
    override === "press" ||
    override === "tick" ||
    override === "release" ||
    override === "page" ||
    override === "pulse"
  ) {
    return override
  }

  const label = `${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("title") ?? ""} ${element.textContent ?? ""}`

  if (DISMISS.test(label)) return "release"

  if (
    element.matches(
      "input[type='checkbox'], input[type='radio'], select, [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [aria-pressed]",
    )
  ) {
    return "tick"
  }

  if (element.matches("a[href]")) return "page"

  if (PRIMARY.test(label)) return "pulse"

  if (element.matches("input, textarea")) return "tick"

  return "press"
}

function onClick(event: MouseEvent): void {
  if (!enabled.value || !event.isTrusted) return

  if (!(event.target instanceof Element)) return
  const control = event.target.closest(INTERACTIVE)

  if (!control || control.closest("[data-sound-silent]")) return

  if (control.matches(":disabled, [aria-disabled='true']")) return
  void play(cueFor(control))
}

function bind(): void {
  if (binds === 0) document.addEventListener("click", onClick, true)
  binds += 1
}

function unbind(): void {
  binds = Math.max(0, binds - 1)

  if (binds === 0) document.removeEventListener("click", onClick, true)
}

function toggle(): void {
  enabled.value = !enabled.value
  persist(enabled.value)

  if (enabled.value) void play("pulse")
}

/** 全页捕获点击并合成短音；开关持久化在 localStorage。 */
export function useClickSound() {
  load()
  onMounted(bind)
  onUnmounted(unbind)

  return { enabled: readonly(enabled), toggle }
}
