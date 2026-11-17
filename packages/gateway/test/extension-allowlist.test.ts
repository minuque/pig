import { existsSync } from "node:fs"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createResourceLoader } from "../src/pi/resource-loader.js"

let root: string
let agentDir: string
let cwd: string
let marker: string
let extensionsFile: string
/** 加载时写标记文件并注册一个工具的扩展。 */
const probe = (file: string, tool: string) =>
  `import { writeFileSync } from "node:fs"
export default function (pi) {
  writeFileSync(${JSON.stringify(file)}, "loaded")
  pi.registerTool({ name: "${tool}", label: "${tool}", description: "probe", parameters: { type: "object", properties: {} }, execute: async () => ({ content: [], details: {} }) })
}
`

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pig-ext-allow-"))
  agentDir = join(root, "agent")
  cwd = join(root, "work")
  marker = join(root, "marker")
  extensionsFile = join(root, "extensions.json")
  await mkdir(join(agentDir, "extensions"), { recursive: true })
  await mkdir(join(agentDir, "skills", "probe-skill"), { recursive: true })
  await mkdir(join(agentDir, "prompts"), { recursive: true })
  await mkdir(cwd)
  await writeFile(join(agentDir, "extensions", "probe.ts"), probe(marker, "probe_tool"))
  await writeFile(
    join(agentDir, "skills", "probe-skill", "SKILL.md"),
    "---\nname: probe-skill\ndescription: probe skill\n---\nbody\n",
  )
  await writeFile(join(agentDir, "prompts", "probe-prompt.md"), "probe prompt\n")
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 })
})

async function load() {
  const loader = await createResourceLoader(cwd, { agentDir, extensionsFile })
  return {
    tools: loader.getExtensions().extensions.flatMap((extension) => [...extension.tools.keys()]),
    skills: loader.getSkills().skills.map((skill) => skill.name),
    prompts: loader.getPrompts().prompts.map((prompt) => prompt.name),
  }
}

describe("用户扩展放行清单", () => {
  it("没放行时用户扩展的代码不执行，内置扩展、skills 与 prompt 模板照常", async () => {
    const result = await load()

    expect(existsSync(marker)).toBe(false)
    expect(result.tools).not.toContain("probe_tool")
    expect(result.tools).toContain("subagent")
    expect(result.skills).toContain("probe-skill")
    expect(result.prompts).toContain("probe-prompt")
  })

  it("按路径放行目录下的扩展", async () => {
    await writeFile(
      extensionsFile,
      JSON.stringify({ enabled: [join(agentDir, "extensions", "probe.ts")] }),
    )
    const result = await load()

    expect(existsSync(marker)).toBe(true)
    expect(result.tools).toContain("probe_tool")
    expect(result.tools).toContain("subagent")
    expect(result.skills).toContain("probe-skill")
  })

  it("按 settings.json 的来源字符串放行包来的扩展", async () => {
    const pkg = join(root, "probe-pkg")
    const pkgMarker = join(root, "pkg-marker")
    await mkdir(pkg)
    await writeFile(
      join(pkg, "package.json"),
      JSON.stringify({ name: "probe-pkg", pi: { extensions: ["./index.ts"] } }),
    )
    await writeFile(join(pkg, "index.ts"), probe(pkgMarker, "pkg_tool"))
    await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [pkg] }))

    expect((await load()).tools).not.toContain("pkg_tool")
    expect(existsSync(pkgMarker)).toBe(false)

    await writeFile(extensionsFile, JSON.stringify({ enabled: [pkg] }))
    const result = await load()

    expect(existsSync(pkgMarker)).toBe(true)
    expect(result.tools).toContain("pkg_tool")
    expect(result.tools).not.toContain("probe_tool")
  })

  it("清单解析失败按空处理", async () => {
    await writeFile(extensionsFile, "{ not json")
    const result = await load()

    expect(existsSync(marker)).toBe(false)
    expect(result.tools).toContain("subagent")
  })
})
