import { describe, expect, it } from "vitest"
import { selectComposerPrompts } from "../src/pi/composer-commands.js"

const prompt = (name: string) => ({ name, description: `${name} 说明` })

describe("selectComposerPrompts", () => {
  it("无冲突时原样返回", () => {
    const prompts = [prompt("ci"), prompt("commit-push")]
    expect(selectComposerPrompts(prompts, new Set())).toEqual(prompts)
  })

  it("丢掉与扩展命令同名的模板：Pi 会先执行扩展命令，模板永远展不开", () => {
    const prompts = [prompt("ci"), prompt("compact"), prompt("fork")]
    const kept = selectComposerPrompts(prompts, new Set(["compact", "fork"]))
    expect(kept.map((item) => item.name)).toEqual(["ci"])
  })

  it("丢掉名字含空白的模板：展开正则用 [^\\s]+ 抓名字，参数会错位", () => {
    const prompts = [prompt("my template"), prompt("ok")]
    expect(selectComposerPrompts(prompts, new Set()).map((item) => item.name)).toEqual(["ok"])
  })

  it("保留 argumentHint 与斜杠名", () => {
    const prompts = [{ name: "a/b", description: "斜杠名", argumentHint: "<x>" }]
    expect(selectComposerPrompts(prompts, new Set())).toEqual(prompts)
  })
})
