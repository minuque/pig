import { join } from "node:path"
import { ModelRuntime } from "@earendil-works/pi-coding-agent"
import type { SessionEntry, SessionHeader } from "@earendil-works/pi-coding-agent"

/** 默认 ModelRuntime：凭据与模型读配置目录（缺省 ~/.pi/agent）；不做网络刷新，避免启动时拉取模型目录。 */
export function createDefaultRuntime(
  agentDir: string | undefined,
): Promise<Awaited<ReturnType<typeof ModelRuntime.create>>> {
  return ModelRuntime.create({
    allowModelNetwork: false,
    ...(agentDir
      ? { authPath: join(agentDir, "auth.json"), modelsPath: join(agentDir, "models.json") }
      : {}),
  })
}

/** 与仓库既有做法一致：header + 条目逐行 JSON 落盘。 */
export function serializeEntries(header: SessionHeader, entries: SessionEntry[]): string {
  return [header, ...entries].map((entry) => JSON.stringify(entry)).join("\n") + "\n"
}
