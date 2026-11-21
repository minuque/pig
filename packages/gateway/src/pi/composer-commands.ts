import type { ComposerCommand } from "@pig/protocol"

// 外部：Pi 的展开正则用 [^\s]+ 抓名字，含空白就截断，参数会错位；prompt() 先跑扩展命令并直接返回，同名模板永远到不了展开那一步
const INVOKABLE_TEMPLATE_NAME = /^\S+$/

export function selectComposerPrompts(
  prompts: readonly ComposerCommand[],
  reservedNames: ReadonlySet<string>,
): ComposerCommand[] {
  return prompts.filter(
    (prompt) => !reservedNames.has(prompt.name) && INVOKABLE_TEMPLATE_NAME.test(prompt.name),
  )
}
