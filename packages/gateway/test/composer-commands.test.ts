import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createSyntheticSourceInfo, type PromptTemplate } from "@earendil-works/pi-coding-agent"
import { describe, expect, it } from "vitest"
import { selectComposerPrompts } from "../src/pi/composer-commands.js"

const prompt = (name: string) => ({ name, description: `${name} 说明` })

// SDK 的导出表不放行深路径，展开函数只能按文件 URL 取
async function piExpand(): Promise<(text: string, templates: PromptTemplate[]) => string> {
  const entry = import.meta.resolve("@earendil-works/pi-coding-agent")
  const url = pathToFileURL(join(dirname(fileURLToPath(entry)), "core/prompt-templates.js")).href
  return (await import(url)).expandPromptTemplate as (
    text: string,
    templates: PromptTemplate[],
  ) => string
}

const template = (name: string): PromptTemplate => ({
  name,
  description: "",
  content: "正文 $@",
  sourceInfo: createSyntheticSourceInfo(`inline:${name}`, { source: "inline" }),
  filePath: `<inline:${name}>`,
})

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

  it("丢掉名字含空白的模板：Pi 的展开正则只认首个空白前的名字", async () => {
    const expand = await piExpand()
    expect(expand("/my template a b", [template("my template")])).toBe("/my template a b")
    expect(expand("/plain a b", [template("plain")])).toBe("正文 a b")

    const prompts = [prompt("my template"), prompt("plain")]
    expect(selectComposerPrompts(prompts, new Set()).map((item) => item.name)).toEqual(["plain"])
  })

  it("保留 argumentHint 与斜杠名", () => {
    const prompts = [{ name: "a/b", description: "斜杠名", argumentHint: "<x>" }]
    expect(selectComposerPrompts(prompts, new Set())).toEqual(prompts)
  })
})
