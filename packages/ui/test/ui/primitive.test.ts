import { describe, expect, it } from "vitest"
import { Comment, Fragment, Text, createSSRApp, createVNode, defineComponent, h } from "vue"
import { renderToString } from "vue/server-renderer"
import { AsChildSlot, Polymorphic } from "../../src/ui/primitive/index.js"
import { findSingleVNode } from "../../src/ui/primitive/slot-vnode.js"

describe("findSingleVNode", () => {
  it("跳过注释与空白文本并展开 Fragment 返回首个实节点", () => {
    const leaf = h("span", "ok")
    const found = findSingleVNode([
      createVNode(Comment, null, "ignored"),
      createVNode(Text, null, "   \n "),
      createVNode(Fragment, null, [createVNode(Text, null, " "), leaf]),
    ])

    expect(found).toBe(leaf)
  })

  it("空节点列表或只有占位节点时返回 null", () => {
    expect(findSingleVNode(undefined)).toBeNull()
    expect(findSingleVNode([createVNode(Comment), createVNode(Text, null, "  ")])).toBeNull()
  })
})

describe("Polymorphic", () => {
  it("默认渲染 div 并支持通过 as 切换标签", async () => {
    const defaultHtml = await renderToString(
      createSSRApp(
        defineComponent({
          render: () => h(Polymorphic, { "data-slot": "box" }, () => "hello"),
        }),
      ),
    )
    const sectionHtml = await renderToString(
      createSSRApp(
        defineComponent({
          render: () => h(Polymorphic, { as: "section", "data-slot": "sec" }, () => "body"),
        }),
      ),
    )

    expect(defaultHtml).toBe('<div data-slot="box">hello</div>')
    expect(sectionHtml).toBe('<section data-slot="sec">body</section>')
  })

  it("开启 asChild 时合并属性到唯一子节点且不新增包裹层", async () => {
    const html = await renderToString(
      createSSRApp(
        defineComponent({
          render: () =>
            h(Polymorphic, { asChild: true, "data-variant": "solid", class: "outer" }, () => [
              createVNode(Comment, null, "c"),
              h("a", { href: "#next", class: "inner" }, "Go"),
            ]),
        }),
      ),
    )

    expect(html).toBe('<a href="#next" class="inner outer" data-variant="solid">Go</a>')
  })
})

describe("AsChildSlot", () => {
  it("透传 partProps 并剥离其中的 data-slot 以保留子元素自身插槽名", async () => {
    const html = await renderToString(
      createSSRApp(
        defineComponent({
          render: () =>
            h(
              AsChildSlot,
              {
                partProps: {
                  "data-slot": "toast-close",
                  "data-state": "open",
                  id: "btn-1",
                },
              },
              () => [h("button", { "data-slot": "icon-button", type: "button" }, "X")],
            ),
        }),
      ),
    )

    expect(html).toBe(
      '<button data-slot="icon-button" type="button" data-state="open" id="btn-1">X</button>',
    )
  })
})
