import type { Tone } from "../../core/types.js"

export { default as Banner } from "./Banner.vue"

export type BannerVariant = "soft" | "surface" | "outline"

export type BannerColor = Exclude<Tone, "accent">
