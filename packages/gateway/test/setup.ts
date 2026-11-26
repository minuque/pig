import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const KEY = Symbol.for("pig.gateway.test.agentDir")
const globalState = globalThis as Record<symbol, string | undefined>

if (!globalState[KEY]) {
  const agentDir = mkdtempSync(join(tmpdir(), "pig-gateway-agent-"))

  globalState[KEY] = agentDir
  process.env.PI_CODING_AGENT_DIR = agentDir
  process.once("exit", () => {
    try {
      rmSync(agentDir, { recursive: true, force: true })
    } catch {}
  })
}
