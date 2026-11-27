const RAIL_DOCKED_MIN = 1112

export type RailMode = "docked" | "popover"

export function railModeOf(width: number): RailMode {
  return width >= RAIL_DOCKED_MIN ? "docked" : "popover"
}
