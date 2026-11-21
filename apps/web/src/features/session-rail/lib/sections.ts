import { RAIL_SECTIONS } from "@client/preferences.js"

export { RAIL_SECTIONS }

export type RailSectionId = (typeof RAIL_SECTIONS)[number]

export interface RailLayout {
  closed: RailSectionId[]
  hidden: RailSectionId[]
}
