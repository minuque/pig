import { describe, expect, it } from "vitest"
import { createSSRApp, defineComponent, h, ref } from "vue"
import { renderToString } from "vue/server-renderer"
import { DEFAULT_UI_LABELS, provideUiLabels, useUiLabels } from "../../src/core/config.js"
import { Banner } from "../../src/ui/banner/index.js"

describe("ui config labels", () => {
  it("未提供 Provider 时回退 DEFAULT_UI_LABELS", async () => {
    let observed = ""
    const Consumer = defineComponent({
      setup() {
        const labels = useUiLabels()
        return () => {
          observed = JSON.stringify(labels.value)
          return h("span", labels.value.notifications)
        }
      },
    })
    const html = await renderToString(createSSRApp(Consumer))

    expect(html).toBe("<span>Notifications</span>")
    expect(JSON.parse(observed)).toEqual(DEFAULT_UI_LABELS)
  })

  it("provideUiLabels 支持部分覆盖且响应 getter 变化", async () => {
    const closeLabel = ref("关闭")
    const Probe = defineComponent({
      setup() {
        const labels = useUiLabels()
        return { labels }
      },
      render() {
        return h(Banner, { dismissible: true }, () => this.labels.navigate)
      },
    })
    const Provider = defineComponent({
      setup() {
        const resolved = provideUiLabels(() => ({ close: closeLabel.value }))
        return { resolved }
      },
      render() {
        return h(Probe)
      },
    })
    const html = await renderToString(createSSRApp(Provider))

    expect(html).toContain('aria-label="关闭"')
    expect(html).toContain("Navigate")
    closeLabel.value = "Close Now"

    const secondHtml = await renderToString(createSSRApp(Provider))
    expect(secondHtml).toContain('aria-label="Close Now"')
  })
})
