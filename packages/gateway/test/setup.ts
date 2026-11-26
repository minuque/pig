import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const agentDir = mkdtempSync(join(tmpdir(), "pig-gateway-agent-"))

process.env.PI_CODING_AGENT_DIR = agentDir

process.once("exit", () => {
  try {
    rmSync(agentDir, { recursive: true, force: true })
  } catch {}
})
