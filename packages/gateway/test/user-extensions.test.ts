import { existsSync } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createResourceLoader } from "../src/pi/resource-loader.js"

let root: string
let agentDir: string
let cwd: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pig-user-ext-"))
  agentDir = join(root, "agent")
  cwd = join(root, "work")
  await mkdir(join(agentDir, "extensions"), { recursive: true })
  await mkdir(join(agentDir, "skills", "probe-skill"), { recursive: true })
  await mkdir(join(cwd, ".pi"), { recursive: true })
  await writeFile(
    join(agentDir, "skills", "probe-skill", "SKILL.md"),
    "---\nname: probe-skill\ndescription: probe skill\n---\nbody\n",
  )
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 })
})

describe("用户扩展一律不加载", () => {
  it("本机与仓库目录里的扩展都不执行，内置扩展与 skills 照常", async () => {
    const marker = join(root, "marker")
    const probe = `import { writeFileSync } from "node:fs"\nexport default function () { writeFileSync(${JSON.stringify(marker)}, "loaded") }\n`
    await mkdir(join(cwd, ".pi", "extensions"), { recursive: true })
    await writeFile(join(agentDir, "extensions", "probe.ts"), probe)
    await writeFile(join(cwd, ".pi", "extensions", "repo-probe.ts"), probe)
    const loader = await createResourceLoader(cwd, { agentDir })

    expect(existsSync(marker)).toBe(false)
    expect(loader.getExtensions().extensions.flatMap((e) => [...e.tools.keys()])).toEqual(
      expect.arrayContaining(["subagent", "read_session"]),
    )
    expect(loader.getSkills().skills.map((skill) => skill.name)).toContain("probe-skill")
  })

  it("仓库里直接放的 skills 与提示模板照常加载", async () => {
    await mkdir(join(cwd, ".pi", "skills", "repo-skill"), { recursive: true })
    await mkdir(join(cwd, ".pi", "prompts"), { recursive: true })
    await writeFile(
      join(cwd, ".pi", "skills", "repo-skill", "SKILL.md"),
      "---\nname: repo-skill\ndescription: repo skill\n---\nbody\n",
    )
    await writeFile(join(cwd, ".pi", "prompts", "repo-prompt.md"), "repo prompt\n")
    const loader = await createResourceLoader(cwd, { agentDir })

    expect(loader.getSkills().skills.map((skill) => skill.name)).toContain("repo-skill")
    expect(loader.getPrompts().prompts.map((prompt) => prompt.name)).toContain("repo-prompt")
  })

  it("本机与仓库设置里列的包都不去安装", async () => {
    const installMarker = join(root, "install-marker")
    const fakeNpm = join(root, "fake-npm.mjs")
    await writeFile(
      fakeNpm,
      `import { writeFileSync } from "node:fs"
const args = process.argv.slice(2)
if (args.includes("install")) writeFileSync(${JSON.stringify(installMarker)}, args.join(" "))
else if (args.includes("root")) console.log(${JSON.stringify(join(root, "npm-global"))})
`,
    )
    const npmCommand = [process.execPath, fakeNpm]
    const globalRaw = `\uFEFF${JSON.stringify({ npmCommand, defaultThinkingLevel: "high", packages: ["npm:pig-missing-global"] })}`
    const projectRaw = JSON.stringify({ npmCommand, packages: ["npm:pig-missing-project"] })
    await writeFile(join(agentDir, "settings.json"), globalRaw)
    await writeFile(join(cwd, ".pi", "settings.json"), projectRaw)
    const loader = await createResourceLoader(cwd, { agentDir })

    expect(existsSync(installMarker)).toBe(false)
    expect(loader.getSkills().skills.map((skill) => skill.name)).toContain("probe-skill")
    await expect(readFile(join(agentDir, "settings.json"), "utf-8")).resolves.toBe(globalRaw)
    await expect(readFile(join(cwd, ".pi", "settings.json"), "utf-8")).resolves.toBe(projectRaw)
  })
})
