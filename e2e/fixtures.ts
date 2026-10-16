import { test as base, expect, type Page } from "@playwright/test"
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

/** 种子 localStorage 定位工作区；reducedMotion 由调用方按需 emulate（bench 要切两档）。 */
export async function seedWorkspace(page: Page, workspaceId: string) {
  await page.addInitScript(
    ({ id }) => {
      localStorage.setItem("pig.localWorkspaces", JSON.stringify([id]))
      localStorage.setItem("pig.lastCwd", id)
      localStorage.setItem("npg-theme", "light")
    },
    { id: workspaceId },
  )
}

/** DataTransfer 只能在页面里造，一次派发一个拖拽事件到 .session-panel。 */
export async function dragOntoPanel(page: Page, type: string, total = 2) {
  await page.locator(".session-panel").evaluate(
    (element, input) => {
      const data = new DataTransfer()

      for (let i = 0; i < input.total; i += 1) {
        const image = i === 1
        const name = image ? "shot.png" : i === 0 ? "note.md" : `f${i}.txt`

        data.items.add(new File(["x"], name, { type: image ? "image/png" : "text/plain" }))
      }

      element.dispatchEvent(new DragEvent(input.type, { bubbles: true, dataTransfer: data }))
    },
    { type, total },
  )
}

export interface E2eGateway {
  readonly origin: string
  readonly entryUrl: string
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
      entryUrl: gateway.authenticatedUrl(`http://127.0.0.1:${port}`),
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
