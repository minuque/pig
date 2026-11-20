import type { ComposerCommand } from "@pig/protocol"

const INVOKABLE_TEMPLATE_NAME = /^\S+$/

export function selectComposerPrompts(
  prompts: readonly ComposerCommand[],
  reservedNames: ReadonlySet<string>,
): ComposerCommand[] {
  return prompts.filter(
    (prompt) =>
      // Pi 的 prompt() 先跑扩展命令并直接返回，同名模板永远到不了展开那一步
      !reservedNames.has(prompt.name) && INVOKABLE_TEMPLATE_NAME.test(prompt.name),
  )
}
