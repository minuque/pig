import { statSync } from "node:fs"
import { SessionManager } from "@earendil-works/pi-coding-agent"

/** 会话文件是否被别处追加：大小没变就没有；变了再比条目数，相等说明是自己写的。同步做，prompt 开始前不让出事件循环。 */
export class ExternalAppendCheck {
  /** 上次核对时的文件大小；首次核对必然解析一次。 */
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
