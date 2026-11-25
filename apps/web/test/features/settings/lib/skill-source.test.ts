import { describe, expect, it } from "vitest"

import { checkSkillSource, deleteTarget, skillBody } from "@features/settings/lib/skill-source.js"

describe("SKILL.md 检查", () => {
  it("缺 frontmatter 或 description 时 Pi 不加载，挡住保存", () => {
    expect(checkSkillSource("# 只有正文").error).toBe("frontmatter")
    expect(checkSkillSource("---\nname: a\n---\n\nbody").error).toBe("description")
  })

  it("name 缺省或不规范只是警告，可以保存", () => {
    expect(checkSkillSource("---\ndescription: x\n---\n")).toEqual({ warning: true })
    expect(checkSkillSource("---\nname: Bad_Name\ndescription: x\n---\n")).toEqual({
      warning: true,
    })
    expect(checkSkillSource("---\nname: good-one\ndescription: >\n  多行\n---\n")).toEqual({})
  })

  it("预览只渲染 frontmatter 之后的正文", () => {
    expect(skillBody("---\nname: a\ndescription: b\n---\n\n# 标题\n")).toBe("# 标题\n")
  })
})

describe("删除目标", () => {
  it("目录式 Skill 删整个目录，单文件 Skill 只删文件；都按所在根目录判断是否标准位置", () => {
    const roots = [String.raw`C:\agent\skills`]

    expect(deleteTarget(String.raw`C:\agent\skills\alpha\SKILL.md`, roots)).toEqual({
      path: String.raw`C:\agent\skills\alpha`,
      standard: true,
    })
    expect(deleteTarget(String.raw`C:\agent\skills\review.md`, roots)).toEqual({
      path: String.raw`C:\agent\skills\review.md`,
      standard: true,
    })
    expect(deleteTarget("D:/shared/alpha/SKILL.md", roots).standard).toBe(false)
  })
})
