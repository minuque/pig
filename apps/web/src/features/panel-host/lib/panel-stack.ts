export type PanelKind = "files" | "tasks"

export const PANEL_MIN_HEIGHT = 200

export function openPanel(list: readonly PanelKind[], kind: PanelKind): PanelKind[] {
  return list.includes(kind) ? [...list] : [...list, kind]
}

export function closePanel(list: readonly PanelKind[], kind: PanelKind): PanelKind[] {
  return list.filter((item) => item !== kind)
}

export function visiblePanels(list: readonly PanelKind[], height: number): PanelKind[] {
  const room = Math.max(1, Math.floor(height / PANEL_MIN_HEIGHT))
  return list.slice(-room)
}
