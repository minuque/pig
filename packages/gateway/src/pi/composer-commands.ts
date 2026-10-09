/**
 * 输入卡 / 菜单的候选：技能与 prompt 模板。
 * 模板必须能被 Pi 的 expandPromptTemplate 展开，否则菜单里选中就是陷阱。
 */
export interface ComposerCommand {
  name: string
  description: string
  /** 模板用法提示，如 "<issue-number>"。 */
  argumentHint?: string
}

/** Pi 的展开正则用 [^\s]+ 抓名字，含空白就截断，参数会错位。 */
const INVOKABLE_TEMPLATE_NAME = /^\S+$/

/** 取菜单里可用的模板：名字可展开，且不被同名扩展命令截胡。 */
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
