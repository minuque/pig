import { computed } from "vue"
import { updatePreferences, userPreferences } from "@client/preferences.js"

export type SoundEvent = "done" | "input"

type SoundSpec = {
  seconds: number
  gain: number
  clicks: readonly (readonly [number, number, number])[]
  tones: readonly (readonly [number, number, number, number])[]
  reflections: readonly [number, number]
}

const SOUNDS: Record<SoundEvent, SoundSpec> = {
  done: {
    seconds: 0.52,
    gain: 0.55,
    clicks: [
      [0.009, 0.18, 0.00052],
      [0.119, 0.21, 0.00085],
    ],
    tones: [[0.145, 349.23, 0.055, 0.1]],
    reflections: [0.024, 0.032],
  },
  input: {
    seconds: 0.62,
    gain: 0.45,
    clicks: [],
    tones: [
      [0.01, 659.25, 0.07, 0.12],
      [0.14, 880, 0.08, 0.18],
    ],
    reflections: [0.024, 0.032],
  },
}
const enabled = computed(() => userPreferences.value.clickSound)
let ctx: AudioContext | null = null
const buffers = new Map<SoundEvent, AudioBuffer>()

function synthesize(audio: AudioContext, spec: SoundSpec): AudioBuffer {
  const rate = audio.sampleRate
  const count = Math.round(rate * spec.seconds)
  const dry = new Float32Array(count)
  const tail = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const t = i / rate

    for (const [center, amplitude, width] of spec.clicks) {
      const p = (t - center) / width

      if (Math.abs(p) < 5) dry[i]! += amplitude * (1 - 2 * p * p) * Math.exp(-p * p)
    }

    for (const [start, frequency, amplitude, decay] of spec.tones) {
      const u = t - start

      if (u < 0) continue
      const env = (1 - Math.exp(-u / 0.009)) * Math.exp(-u / decay)
      const w = 2 * Math.PI * frequency * u
      tail[i]! += amplitude * env * (Math.sin(w) + 0.12 * Math.sin(2 * w))
    }
  }

  const buffer = audio.createBuffer(2, count, rate)
  spec.reflections.forEach((delay, channel) => {
    const data = buffer.getChannelData(channel)
    const offset = Math.round(delay * rate)

    for (let i = 0; i < count; i++) {
      const reflection = i >= offset ? 0.06 * tail[i - offset]! : 0
      const fade = Math.min((count - i) / (0.075 * rate), 1)
      data[i] = (dry[i]! + tail[i]! + reflection) * fade * spec.gain
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
  if (!enabled.value) return
  const audio = await audioReady()

  if (!audio) return
  const buffer = buffers.get(event) ?? synthesize(audio, SOUNDS[event])
  buffers.set(event, buffer)
  const source = audio.createBufferSource()
  source.buffer = buffer
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
