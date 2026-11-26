import { existsSync } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  createSkill,
  deleteSkill,
  isKnownSkillPath,
  listSkills,
  readSkillAsset,
  readSkillFile,
  setSkillEnabled,
} from "../src/pi/skills-config.js"

let temp: string
let home: string
let agentDir: string
let workspace: string
const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE }

beforeEach(async () => {
  temp = await mkdtemp(join(tmpdir(), "pig-skills-"))
  home = join(temp, "home")
  agentDir = join(home, ".pi", "agent")
  workspace = join(temp, "ws")
  await mkdir(join(workspace, ".git"), { recursive: true })
  process.env.HOME = home
  process.env.USERPROFILE = home
})

afterEach(async () => {
  process.env.HOME = saved.HOME
  process.env.USERPROFILE = saved.USERPROFILE
  await rm(temp, { recursive: true, force: true, maxRetries: 5 })
})

async function skill(root: string, name: string, frontmatter = `description: about ${name}`) {
  const file = join(root, "skills", name, "SKILL.md")

  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `---\nname: ${name}\n${frontmatter}\n---\n\n# ${name}\n`)
  return file
}

const names = (items: { name: string }[]) => items.map((item) => item.name).sort()

describe("listSkills", () => {
  it("全局作用域列出 .pi 与 .agents 下的用户 Skill", async () => {
    await skill(agentDir, "alpha")
    await skill(join(home, ".agents"), "beta")
    await skill(join(workspace, ".pi"), "proj")

    const view = await listSkills(agentDir, "global")

    expect(names(view.skills)).toEqual(["alpha", "beta"])
    expect(view.inherited).toEqual([])
    expect(view.roots).toEqual([join(agentDir, "skills"), join(home, ".agents", "skills")])
  })

  it("工作区作用域列出项目 Skill，全局的算继承", async () => {
    await skill(agentDir, "alpha")
    await skill(join(workspace, ".pi"), "proj")
    await skill(join(workspace, ".agents"), "team")

    const view = await listSkills(agentDir, workspace)

    expect(names(view.skills)).toEqual(["proj", "team"])
    expect(names(view.inherited)).toEqual(["alpha"])
    expect(view.roots).toEqual([
      join(workspace, ".pi", "skills"),
      join(workspace, ".agents", "skills"),
    ])
  })

  it("Pi 没加载的 SKILL.md 进 broken 诊断，不进列表", async () => {
    const broken = await skill(agentDir, "draft", "")
    const view = await listSkills(agentDir, "global")

    expect(view.skills).toEqual([])
    expect(view.diagnostics).toEqual([
      expect.objectContaining({ kind: "broken", path: broken, name: "draft" }),
    ])
  })

  it("名字不规范只是警告，Skill 照样列出", async () => {
    await skill(agentDir, "Bad_Name")

    const view = await listSkills(agentDir, "global")

    expect(names(view.skills)).toEqual(["Bad_Name"])
    expect(view.diagnostics).toEqual([])
  })
})

describe("setSkillEnabled", () => {
  it("停用写入 -path 后仍列出且 enabled 为 false，其余设置不变", async () => {
    const file = await skill(agentDir, "alpha")

    await mkdir(agentDir, { recursive: true })
    await writeFile(join(agentDir, "settings.json"), JSON.stringify({ skills: ["~/extra"] }))

    await setSkillEnabled(agentDir, "global", file, false)
    const view = await listSkills(agentDir, "global")
    const settings = JSON.parse(await readFile(join(agentDir, "settings.json"), "utf8"))

    expect(view.skills).toEqual([expect.objectContaining({ name: "alpha", enabled: false })])
    expect(settings.skills).toEqual(["~/extra", `-${file}`])

    await setSkillEnabled(agentDir, "global", file, true)
    const again = JSON.parse(await readFile(join(agentDir, "settings.json"), "utf8"))

    expect(again.skills).toEqual(["~/extra"])
    expect((await listSkills(agentDir, "global")).skills[0]!.enabled).toBe(true)
  })

  it("工作区作用域写进项目 settings.json，用相对 .pi 的路径，换机器 clone 后仍生效", async () => {
    const proj = await skill(join(workspace, ".pi"), "proj")
    const team = await skill(join(workspace, ".agents"), "team")

    await setSkillEnabled(agentDir, workspace, proj, false)
    await setSkillEnabled(agentDir, workspace, team, false)
    const settings = JSON.parse(await readFile(join(workspace, ".pi", "settings.json"), "utf8"))

    expect(settings.skills).toEqual(["-skills/proj/SKILL.md", "-skills/team/SKILL.md"])
    expect((await listSkills(agentDir, workspace)).skills.map((s) => s.enabled)).toEqual([
      false,
      false,
    ])

    await setSkillEnabled(agentDir, workspace, proj, true)
    const again = JSON.parse(await readFile(join(workspace, ".pi", "settings.json"), "utf8"))

    expect(again.skills).toEqual(["-skills/team/SKILL.md"])
  })
})

describe("Skill 文件", () => {
  it("只认扫描结果里的路径和诊断路径", async () => {
    const file = await skill(agentDir, "alpha")
    const broken = await skill(agentDir, "draft", "")

    expect(await isKnownSkillPath(agentDir, "global", file)).toBe(true)
    expect(await isKnownSkillPath(agentDir, "global", broken)).toBe(true)
    expect(await isKnownSkillPath(agentDir, "global", join(agentDir, "settings.json"))).toBe(false)
    expect(
      await isKnownSkillPath(agentDir, "global", join(dirname(file), "..", "..", "auth.json")),
    ).toBe(false)
  })

  it("读取正文并列出附属文件的相对路径", async () => {
    const file = await skill(agentDir, "alpha")

    await mkdir(join(dirname(file), "scripts"), { recursive: true })
    await writeFile(join(dirname(file), "scripts", "run.sh"), "echo")

    const view = await readSkillFile(file)

    expect(view.raw).toContain("name: alpha")
    expect(view.files).toEqual(["scripts/run.sh"])
  })

  it("新建写到作用域的 Pi 目录并生成模板，重名报错", async () => {
    const file = await createSkill(agentDir, workspace, "my-skill", "当需要时使用")

    expect(file).toBe(join(workspace, ".pi", "skills", "my-skill", "SKILL.md"))
    expect(names((await listSkills(agentDir, workspace)).skills)).toEqual(["my-skill"])
    await expect(createSkill(agentDir, workspace, "my-skill", "x")).rejects.toThrow()
    await expect(createSkill(agentDir, workspace, "Bad Name", "x")).rejects.toThrow()
  })

  it("单文件 Skill 只删这个文件，不删所在的 skills 目录", async () => {
    const keep = await skill(agentDir, "alpha")
    const single = join(agentDir, "skills", "review.md")

    await writeFile(single, "---\nname: review\ndescription: 单文件\n---\n")
    expect(await isKnownSkillPath(agentDir, "global", single)).toBe(true)
    expect((await readSkillFile(single)).files).toEqual([])

    await deleteSkill(single)

    expect(existsSync(single)).toBe(false)
    expect(existsSync(keep)).toBe(true)
  })

  it("删除 Skill 所在目录", async () => {
    const file = await skill(agentDir, "alpha")

    await deleteSkill(file)

    expect(existsSync(dirname(file))).toBe(false)
    expect(existsSync(join(agentDir, "skills"))).toBe(true)
  })

  it("readSkillAsset 安全读取附属文件，拦截越界路径与符号链接，区分二进制和超大文件", async () => {
    const file = await skill(agentDir, "alpha")
    const dir = dirname(file)
    const outsideDir = join(temp, "outside-secret")

    await mkdir(join(dir, "scripts"), { recursive: true })
    await mkdir(outsideDir, { recursive: true })
    await writeFile(join(dir, "scripts", "run.sh"), "#!/bin/sh\necho hi\n")
    await writeFile(join(dir, "bin.dat"), Buffer.from([0x01, 0x00, 0x02]))
    await writeFile(join(dir, "huge.txt"), "x".repeat(1024 * 1024 + 1))
    await writeFile(join(outsideDir, "secret.txt"), "top-secret")
    await symlink(
      outsideDir,
      join(dir, "escape"),
      process.platform === "win32" ? "junction" : "dir",
    )

    expect(await readSkillAsset(file, "scripts/run.sh")).toEqual({
      status: 200,
      data: {
        content: "#!/bin/sh\necho hi\n",
        size: Buffer.byteLength("#!/bin/sh\necho hi\n"),
        binary: false,
        tooLarge: false,
      },
    })
    expect(await readSkillAsset(file, "bin.dat")).toEqual({
      status: 200,
      data: { size: 3, binary: true, tooLarge: false },
    })
    expect(await readSkillAsset(file, "huge.txt")).toEqual({
      status: 200,
      data: { size: 1024 * 1024 + 1, binary: false, tooLarge: true },
    })
    expect(await readSkillAsset(file, "")).toEqual({ status: 403 })
    expect(await readSkillAsset(file, "../secret.txt")).toEqual({ status: 403 })
    expect(await readSkillAsset(file, "escape/secret.txt")).toEqual({ status: 403 })
    expect(await readSkillAsset(file, "scripts")).toEqual({ status: 404 })
    expect(await readSkillAsset(file, "missing.txt")).toEqual({ status: 404 })
  })
})
