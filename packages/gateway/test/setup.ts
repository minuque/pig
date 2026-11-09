import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// 测试不读本机 ~/.pi：本机装的扩展、模型与登录会让结果随机器变化
process.env.PI_CODING_AGENT_DIR = mkdtempSync(join(tmpdir(), "pig-gateway-agent-"))
