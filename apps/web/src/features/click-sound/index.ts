import { computed } from "vue"
import { updatePreferences, userPreferences } from "@client/preferences.js"

export type SoundEvent = "done"

const DONE = {
  seconds: 0.52,
  gain: 0.55,
  clicks: [
    [0.009, 0.18, 0.00052],
    [0.119, 0.21, 0.00085],
  ],
  tones: [[0.145, 349.23, 0.055, 0.1]],
  reflections: [0.024, 0.032],
} as const
const enabled = computed(() => userPreferences.value.clickSound)
let ctx: AudioContext | null = null
let doneBuffer: AudioBuffer | null = null

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
  updatePreferences({ clickSound: !enabled.value })

  if (enabled.value) void play("done")
}

export function useSound() {
  return { enabled, toggle, play }
}
