/** 事件绑定只允许一个表达式。多条语句经 Prettier 丢分号后，Vue 模板编译失败。 */

export default {
  meta: {
    type: "problem",
    docs: { description: "事件绑定只允许一条语句" },
    schema: [],
    messages: { multiple: "事件绑定只允许一条语句，多条逻辑移到方法里。" },
  },
  create(context) {
    const source = context.sourceCode.parserServices?.defineTemplateBodyVisitor

    if (!source) return {}
    return source({
      VOnExpression(node) {
        if (node.body.length > 1) context.report({ node, messageId: "multiple" })
      },
    })
  },
}
