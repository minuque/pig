import { statSync } from "node:fs"
import { SessionManager } from "@earendil-works/pi-coding-agent"

export class ExternalAppendCheck {
  private size: number | undefined

  constructor(private readonly manager: SessionManager) {}

  appended(): boolean {
    const path = this.manager.getSessionFile()

    if (!path) return false
    const { size } = statSync(path)

    if (size === this.size) return false

    if (SessionManager.open(path).getEntries().length !== this.manager.getEntries().length)
      return true
    this.size = size
    return false
  }
}
