import { computed } from "vue"
import { updatePreferences, userPreferences } from "@client/preferences.js"

export type SoundEvent = "done" | "input" | "attention"

type SoundSpec = {
  seconds: number
  clicks: readonly (readonly [number, number, number])[]
  tones: readonly (readonly [number, number, number, number])[]
  harmonics: readonly (readonly [number, number, number])[]
  attack: number
  reflection: { delays: readonly [number, number]; gain: number }
  fadeOut: number
}

const GAIN = 0.55
const ROUNDED = {
  harmonics: [
    [1, 1, 1],
    [2, 0.12, 1],
  ],
  attack: 0.009,
  reflection: { delays: [0.024, 0.032], gain: 0.06 },
  fadeOut: 0.075,
} as const
const SOUNDS: Record<SoundEvent, SoundSpec> = {
  done: {
    ...ROUNDED,
    seconds: 0.52,
    clicks: [
      [0.009, 0.18, 0.00052],
      [0.119, 0.21, 0.00085],
    ],
    tones: [[0.145, 349.23, 0.055, 0.1]],
  },
  input: {
    ...ROUNDED,
    seconds: 0.6,
    clicks: [
      [0.009, 0.16, 0.00085],
      [0.179, 0.21, 0.00052],
    ],
    tones: [[0.205, 392, 0.05, 0.12]],
  },
  attention: {
    seconds: 0.65,
    clicks: [
      [0.009, 0.19, 0.00095],
      [0.189, 0.17, 0.00082],
    ],
    tones: [
      [0.225, 349.23, 0.043, 0.085],
      [0.335, 311.13, 0.039, 0.1],
    ],
    harmonics: [
      [1, 1, 1],
      [2, 0.16, 0.6],
    ],
    attack: 0.01,
    reflection: { delays: [0.026, 0.035], gain: 0.045 },
    fadeOut: 0.06,
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
      const rise = 1 - Math.exp(-u / spec.attack)

      for (const [ratio, level, damping] of spec.harmonics)
        tail[i]! +=
          amplitude *
          level *
          rise *
          Math.exp(-u / (decay * damping)) *
          Math.sin(2 * Math.PI * frequency * ratio * u)
    }
  }

  const buffer = audio.createBuffer(2, count, rate)
  spec.reflection.delays.forEach((delay, channel) => {
    const data = buffer.getChannelData(channel)
    const offset = Math.round(delay * rate)

    for (let i = 0; i < count; i++) {
      const reflection = i >= offset ? spec.reflection.gain * tail[i - offset]! : 0
      const fade = Math.min((count - i) / (spec.fadeOut * rate), 1)
      data[i] = (dry[i]! + tail[i]! + reflection) * fade * GAIN
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
  if (!enabled.value || (event === "attention" && !userPreferences.value.notifyError)) return
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
