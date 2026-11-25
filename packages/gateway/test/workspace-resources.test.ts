import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createEventBus } from "@earendil-works/pi-coding-agent"
import { afterEach, describe, expect, it } from "vitest"

import { WorkspaceResources } from "../src/pi/workspace-resources.js"

let temp: string | undefined
let resources: WorkspaceResources | undefined

afterEach(async () => {
  await resources?.dispose()
  resources = undefined

  if (temp) await rm(temp, { recursive: true, force: true, maxRetries: 5 })
  temp = undefined
})

async function setup() {
  temp = await mkdtemp(join(tmpdir(), "pig-resources-"))
  const agentDir = join(temp, "agent")
  const workspace = join(temp, "ws")

  await mkdir(agentDir, { recursive: true })
  await mkdir(workspace, { recursive: true })
  resources = new WorkspaceResources({ agentDir, disabled: false }, createEventBus())
  return { agentDir, workspace, resources }
}

async function writeSkill(root: string, name: string) {
  const dir = join(root, "skills", name)

  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: test ${name}\n---\n`)
}

function skillNames(loader: { getSkills(): { skills: { name: string }[] } } | undefined) {
  return loader?.getSkills().skills.map((skill) => skill.name) ?? []
}

describe("WorkspaceResources.invalidate", () => {
  it("配置改动后清掉预热，下一次 take 读到新 Skill", async () => {
    const { agentDir, workspace, resources } = await setup()

    resources.prepare(workspace)
    await resources.peek(workspace)
    await writeSkill(agentDir, "fresh-skill")

    resources.invalidate()

    expect(skillNames(await resources.take(workspace))).toContain("fresh-skill")
  })

  it("只清指定工作区，其他工作区的预热保留", async () => {
    const { workspace, resources } = await setup()
    const other = join(temp!, "other")

    await mkdir(other)
    resources.prepare(workspace)
    resources.prepare(other)
    const kept = await resources.peek(other)

    resources.invalidate(workspace)

    expect(await resources.peek(workspace)).toBeUndefined()
    expect(await resources.peek(other)).toBe(kept)
  })
})
