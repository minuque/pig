import { test as base, expect } from "@playwright/test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import Gateway from "../packages/gateway/src/index.js"
import type { DirectoryPort } from "../packages/gateway/src/directory.js"
import { prebuildComplexSession } from "./prebuild-session.js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const webRoot = join(root, "apps/web/dist")

/** 与 web canonicalizeWorkspacePath 对齐，供 localStorage 种子。 */
export function canonicalizeWorkspacePath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/, "")
  return /^[a-zA-Z]:/.test(normalized) ? normalized.toLowerCase() : normalized
}

export interface E2eGateway {
  readonly origin: string
  readonly workspaceDir: string
  readonly workspaceId: string
}

type TestFixtures = { gateway: E2eGateway; complexGateway: E2eGateway }

async function withGateway(
  seed: (sessionDir: string, workspaceDir: string) => void,
  use: (gateway: E2eGateway) => Promise<void>,
) {
  const temp = await mkdtemp(join(tmpdir(), "pig-e2e-"))
  const workspaceDir = join(temp, "workspace")
  const sessionDir = join(temp, "sessions")
  await mkdir(workspaceDir)
  await mkdir(sessionDir)
  await writeFile(join(workspaceDir, ".keep"), "")
  seed(sessionDir, workspaceDir)

  const workspaceId = canonicalizeWorkspacePath(workspaceDir)
  const platformPort: DirectoryPort = {
    async selectDirectory() {
      return workspaceDir
    },
    async validateDirectory(path) {
      return path
    },
  }
  const gateway = new Gateway({
    webRoot,
    sessionDir,
    cwd: workspaceDir,
    platformPort,
    port: 0,
  })
  const port = await gateway.start()

  try {
    await use({
      origin: `http://127.0.0.1:${port}`,
      workspaceDir,
      workspaceId,
    })
  } finally {
    await gateway.stop()
    await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}

export const test = base.extend<TestFixtures>({
  gateway: [
    async ({}, use) => {
      await withGateway(() => undefined, use)
    },
    { scope: "test" },
  ],
  complexGateway: [
    async ({}, use) => {
      await withGateway((sessionDir, workspaceDir) => {
        const built = prebuildComplexSession(sessionDir, workspaceDir)
        console.log(`预构建会话 ${built.id}${built.forked ? "（fork 本机历史）" : "（合成样本）"}`)
      }, use)
    },
    { scope: "test" },
  ],
})

export { expect }
