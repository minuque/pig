import { readonly, shallowRef } from "vue"

const CLICK_SOUND_KEY = "pig.clickSound"
const MASTER = 0.32

type Cue = "press" | "release" | "page" | "pulse"

/** 音效入口：发送、停止、切换会话、新建会话、打开搜索、轮次结束。 */
export type SoundEvent = "send" | "stop" | "switch" | "create" | "search" | "done"

const CUES: Record<Exclude<SoundEvent, "done">, Cue> = {
  send: "pulse",
  stop: "release",
  switch: "page",
  create: "pulse",
  search: "press",
}

type Filter = { type: BiquadFilterType; frequency: number; Q?: number }

/** 轮次完成提示音：两声圆润轻击接 F4 短尾音。 */
const DONE = {
  seconds: 0.52,
  gain: 0.55,
  // [中心 s, 幅度, 宽度 s]
  clicks: [
    [0.009, 0.18, 0.00052],
    [0.119, 0.21, 0.00085],
  ],
  // [起点 s, 频率 Hz, 幅度, 衰减 s]
  tones: [[0.145, 349.23, 0.055, 0.1]],
  reflections: [0.024, 0.032],
} as const
const enabled = shallowRef(true)
let loaded = false
let ctx: AudioContext | null = null
let doneBuffer: AudioBuffer | null = null

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

/** 逐采样合成立体声：干声 + 两路小反射，尾部 75ms 线性淡出。 */
function synthesizeDone(audio: AudioContext): AudioBuffer {
  const rate = audio.sampleRate
  const count = Math.round(rate * DONE.seconds)
  const dry = new Float32Array(count)
  const tail = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const t = i / rate

    for (const [center, amplitude, width] of DONE.clicks) {
      const p = (t - center) / width

      if (Math.abs(p) < 5) dry[i]! += amplitude * (1 - 2 * p * p) * Math.exp(-p * p)
    }

    for (const [start, frequency, amplitude, decay] of DONE.tones) {
      const u = t - start

      if (u < 0) continue
      const env = (1 - Math.exp(-u / 0.009)) * Math.exp(-u / decay)
      const w = 2 * Math.PI * frequency * u
      tail[i]! += amplitude * env * (Math.sin(w) + 0.12 * Math.sin(2 * w))
    }
  }

  const buffer = audio.createBuffer(2, count, rate)
  DONE.reflections.forEach((delay, channel) => {
    const data = buffer.getChannelData(channel)
    const offset = Math.round(delay * rate)

    for (let i = 0; i < count; i++) {
      const reflection = i >= offset ? 0.06 * tail[i - offset]! : 0
      const fade = Math.min((count - i) / (0.075 * rate), 1)
      data[i] = (dry[i]! + tail[i]! + reflection) * fade * DONE.gain
    }
  })
  return buffer
}

async function audioReady(): Promise<AudioContext | null> {
  if (typeof AudioContext === "undefined") return null
  ctx ??= new AudioContext()

  if (ctx.state === "suspended") await ctx.resume()
  return ctx.state === "running" ? ctx : null
}

async function play(event: SoundEvent): Promise<void> {
  load()

  if (!enabled.value) return
  const audio = await audioReady()

  if (!audio) return

  if (event !== "done") {
    emit(audio, CUES[event])
    return
  }

  doneBuffer ??= synthesizeDone(audio)
  const source = audio.createBufferSource()
  source.buffer = doneBuffer
  source.connect(audio.destination)
  source.start()
}

function toggle(): void {
  enabled.value = !enabled.value
  persist(enabled.value)

  if (enabled.value) void play("send")
}

/** 按事件播放合成短音；开关持久化在 localStorage。 */
export function useSound() {
  load()
  return { enabled: readonly(enabled), toggle, play }
}
