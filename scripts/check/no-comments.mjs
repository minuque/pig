import stylelint from "stylelint"

const ALLOWED = [
  /^\s*prettier-ignore\b/,
  /^\s*(eslint|eslint-disable|eslint-enable|eslint-disable-line|eslint-disable-next-line|global|globals)\b/,
  /^\s*stylelint-(disable|enable)/,
  /^\s*@ts-(expect-error|ignore|nocheck|check)\b/,
  /^\/\s*<reference\b/,
  /SPDX-License-Identifier|@license\b|Copyright\s+(\(c\)|©)/i,
  /^\s*\*?\s*外部：/,
  /https?:\/\/\S*(\/issues\/|\/pull\/|\/discussions\/|rfc-editor\.org|datatracker\.ietf\.org|\/rfcs?\/|crbug\.com|bugzilla\.)/i,
]
const MESSAGE =
  "删掉注释：只放行许可证、外部约束（以「外部：」开头）、prettier-ignore、有理由的 lint 抑制、公开契约文档和 issue/RFC 链接。见 /delete-comment。"

export function isAllowedComment(text) {
  return ALLOWED.some((pattern) => pattern.test(text))
}

const eslintRule = {
  meta: {
    type: "suggestion",
    docs: { description: "禁止注释，放行名单见 scripts/check/no-comments.mjs" },
    schema: [
      {
        type: "object",
        properties: { contractDocs: { type: "boolean" } },
        additionalProperties: false,
      },
    ],
    messages: { comment: MESSAGE },
  },
  create(context) {
    const contractDocs = context.options[0]?.contractDocs === true
    const source = context.sourceCode

    function isContractDoc(comment) {
      return contractDocs && comment.type === "Block" && comment.value.startsWith("*")
    }

    function check(comment) {
      if (comment.type === "Shebang" || isAllowedComment(comment.value) || isContractDoc(comment))
        return
      context.report({ loc: comment.loc, messageId: "comment" })
    }

    return {
      Program(program) {
        for (const comment of source.getAllComments()) check(comment)

        for (const comment of program.templateBody?.comments ?? []) check(comment)
      },
    }
  },
}
export const eslintPlugin = { rules: { "no-comments": eslintRule } }
const ruleName = "pig/no-comments"
const messages = stylelint.utils.ruleMessages(ruleName, { comment: MESSAGE })
const SECTION_HEADER = /^\s*(=+|-+)\s/
const stylelintRule = (enabled, options) => (root, result) => {
  if (!enabled) return
  root.walkComments((comment) => {
    if (isAllowedComment(comment.text)) return

    if (options?.sectionHeaders && SECTION_HEADER.test(comment.text)) return
    stylelint.utils.report({ ruleName, result, node: comment, message: messages.comment })
  })
}

stylelintRule.ruleName = ruleName

stylelintRule.messages = messages

export const stylelintPlugin = stylelint.createPlugin(ruleName, stylelintRule)
