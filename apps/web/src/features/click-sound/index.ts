import { readonly, shallowRef } from "vue"
import { readFlag, writeFlag } from "@utils/storage.js"

const CLICK_SOUND_KEY = "pig.clickSound"

/** 完成提示音。只在回合结束和设置开关里播放。 */
export type SoundEvent = "done"

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
  return readFlag(CLICK_SOUND_KEY)
}

function persist(value: boolean): void {
  writeFlag(CLICK_SOUND_KEY, value)
}

function load(): void {
  if (loaded) return
  loaded = true
  enabled.value = readEnabled()
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

async function play(_event: SoundEvent): Promise<void> {
  load()

  if (!enabled.value) return
  const audio = await audioReady()

  if (!audio) return
  doneBuffer ??= synthesizeDone(audio)
  const source = audio.createBufferSource()
  source.buffer = doneBuffer
  source.connect(audio.destination)
  source.start()
}

function toggle(): void {
  enabled.value = !enabled.value
  persist(enabled.value)

  if (enabled.value) void play("done")
}

/** 完成提示音开关。打开时试听与回合结束同一段。 */
export function useSound() {
  load()
  return { enabled: readonly(enabled), toggle, play }
}
