import { readJson, writeJson, type PrefStorage } from "@utils/storage.js"

export const RAIL_SECTIONS = ["environment", "context", "tasks"] as const

export type RailSectionId = (typeof RAIL_SECTIONS)[number]

export interface RailLayout {
  closed: RailSectionId[]
  hidden: RailSectionId[]
}

const KEY = "pig.rail.layout"
const known = (value: unknown): value is RailSectionId =>
  RAIL_SECTIONS.includes(value as RailSectionId)
const pick = (list: unknown) => (Array.isArray(list) ? [...new Set(list.filter(known))] : [])

export function readRailLayout(storage?: PrefStorage): RailLayout {
  const raw = readJson<Partial<RailLayout>>(KEY, storage)
  return { closed: pick(raw?.closed), hidden: pick(raw?.hidden) }
}

export function writeRailLayout(layout: RailLayout, storage?: PrefStorage) {
  writeJson(KEY, layout, storage)
}
