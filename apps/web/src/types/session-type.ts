export interface SessionCard {
  id: string
  messageCount: number
  model?: { provider: string; id: string }
}
