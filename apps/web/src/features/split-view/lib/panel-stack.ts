/** 面板列里的一种面板：files 是文件面板，tasks 是摘要卡点开的详情。 */
export type PanelKind = "files" | "tasks"

/** 每个面板最矮的高度。 */
export const PANEL_MIN_HEIGHT = 200

export function openPanel(list: readonly PanelKind[], kind: PanelKind): PanelKind[] {
  return list.includes(kind) ? [...list] : [...list, kind]
}

export function closePanel(list: readonly PanelKind[], kind: PanelKind): PanelKind[] {
  return list.filter((item) => item !== kind)
}

/** 放得下的面板：高度不够时从最早打开的开始收起，最后打开的那个始终留着。 */
export function visiblePanels(list: readonly PanelKind[], height: number): PanelKind[] {
  const room = Math.max(1, Math.floor(height / PANEL_MIN_HEIGHT))
  return list.slice(-room)
}
