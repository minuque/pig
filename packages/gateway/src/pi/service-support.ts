import { join } from "node:path"
import { ModelRuntime } from "@earendil-works/pi-coding-agent"
import type { SessionEntry, SessionHeader } from "@earendil-works/pi-coding-agent"

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

export function serializeEntries(header: SessionHeader, entries: SessionEntry[]): string {
  return [header, ...entries].map((entry) => JSON.stringify(entry)).join("\n") + "\n"
}
