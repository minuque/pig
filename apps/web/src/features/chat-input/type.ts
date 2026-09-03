export interface ContextUsageSegment {
  id:
    | "systemPrompt"
    | "memory"
    | "skills"
    | "tools"
    | "toolResults"
    | "conversation"
    | "other"
    | "idle"
  label: string
  tokens: number
  color: string
  previewable: boolean
}

export interface ContextUsage {
  used: number
  window: number
  percent: number
  segments: ContextUsageSegment[]
}
