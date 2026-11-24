import { describe, expect, it } from "vitest"
import { createSSRApp, defineComponent, h, type Component } from "vue"
import { renderToString } from "vue/server-renderer"
import { Badge } from "../../src/ui/badge/index.js"
import { Banner } from "../../src/ui/banner/index.js"
import { Button, IconButton } from "../../src/ui/button/index.js"
import { Card, CardList, CardRow } from "../../src/ui/card/index.js"
import { Spinner } from "../../src/ui/spinner/index.js"
import { StatusIndicator } from "../../src/ui/status-indicator/index.js"
import { TextFieldRoot } from "../../src/ui/text-field/index.js"

async function renderComponent(
  component: Component,
  props?: Record<string, unknown>,
  slots?: Record<string, () => unknown>,
): Promise<string> {
  const app = createSSRApp(
    defineComponent({
      render: () => h(component, props, slots),
    }),
  )
  return renderToString(app)
}

describe("UI component contracts", () => {
  it("Button 与 IconButton 输出统一属性与加载态 Spinner 档位", async () => {
    const btnHtml = await renderComponent(
      Button,
      { variant: "secondary", size: "s", color: "danger", radius: "full" },
      { default: () => "删除" },
    )

    expect(btnHtml).toContain('data-slot="button"')
    expect(btnHtml).toContain('data-variant="secondary"')
    expect(btnHtml).toContain('data-size="s"')
    expect(btnHtml).toContain('data-tone="danger"')
    expect(btnHtml).toContain('data-radius="full"')

    const smallLoading = await renderComponent(
      Button,
      { size: "s", loading: true },
      { default: () => "保存" },
    )
    const largeLoading = await renderComponent(
      IconButton,
      { size: "l", variant: "ghost", color: "neutral", loading: true, "aria-label": "加载" },
      { default: () => h("span", "i") },
    )

    expect(smallLoading).toContain('data-slot="button-spinner"')
    expect(smallLoading).toContain('data-slot="spinner"')
    expect(smallLoading).toMatch(/data-slot="spinner"[^>]*data-size="s"/)
    expect(largeLoading).toContain("data-icon-button")
    expect(largeLoading).toContain('data-slot="button-label"')
    expect(largeLoading).toMatch(/data-slot="spinner"[^>]*data-size="m"/)
  })

  it("Badge 透传尺寸、变体、标识色与圆角", async () => {
    const html = await renderComponent(
      Badge,
      { size: "m", variant: "outline", color: "indigo", radius: "large" },
      { default: () => "PIG" },
    )

    expect(html).toContain('data-slot="badge"')
    expect(html).toContain('data-size="m"')
    expect(html).toContain('data-variant="outline"')
    expect(html).toContain('data-tone="indigo"')
    expect(html).toContain('data-radius="large"')
  })

  it("Banner 使用统一的 danger 色调并在无 Provider 时回退默认关闭标签", async () => {
    const html = await renderComponent(
      Banner,
      { color: "danger", variant: "surface", size: "s", dismissible: true },
      {
        icon: () => h("span", "!"),
        title: () => "错误标题",
        default: () => "错误详情",
      },
    )

    expect(html).toContain('data-slot="banner"')
    expect(html).toContain('data-tone="danger"')
    expect(html).toContain('data-variant="surface"')
    expect(html).toContain('data-size="s"')
    expect(html).toContain('data-slot="banner-icon"')
    expect(html).toContain('data-slot="banner-title"')
    expect(html).toContain('data-slot="banner-body"')
    expect(html).toContain('data-slot="banner-action"')
    expect(html).toContain('aria-label="Close"')
  })

  it("Spinner 按 Size 档位渲染 8 片叶轮", async () => {
    for (const size of ["s", "m", "l"] as const) {
      const html = await renderComponent(Spinner, { size, label: "加载中" })

      expect(html).toContain('data-slot="spinner"')
      expect(html).toContain(`data-size="${size}"`)
      expect(html).toContain('role="status"')
      expect(html).toContain('aria-label="加载中"')
      expect(html.match(/data-slot="spinner-leaf"/g)).toHaveLength(8)
    }
  })

  it("StatusIndicator 映射状态色调并区分 dot 与 icon 外观", async () => {
    const dotHtml = await renderComponent(StatusIndicator, {
      status: "error",
      appearance: "dot",
      pulse: true,
      label: "失败",
    })
    const runHtml = await renderComponent(StatusIndicator, {
      status: "running",
      appearance: "icon",
      ariaLabel: "运行中",
    })
    const idleHtml = await renderComponent(StatusIndicator, {
      status: "idle",
      appearance: "icon",
    })

    expect(dotHtml).toContain('data-slot="status-indicator"')
    expect(dotHtml).toContain('data-tone="danger"')
    expect(dotHtml).toContain('data-slot="status-dot"')
    expect(dotHtml).toContain("status-pulse")
    expect(dotHtml).toContain('data-slot="status-label"')

    expect(runHtml).toContain('data-tone="info"')
    expect(runHtml).toContain('role="status"')
    expect(runHtml).toContain('aria-label="运行中"')
    expect(runHtml).toContain('data-slot="status-spinner"')

    expect(idleHtml).toContain('data-slot="status-glyph"')
    expect(idleHtml).not.toContain("data-tone=")
  })

  it("Card / CardList / CardRow 与 TextFieldRoot 维持插槽与状态契约", async () => {
    const cardHtml = await renderComponent(
      Card,
      { variant: "ghost", size: "l" },
      {
        default: () =>
          h(CardList, null, () => [
            h(CardRow, { bleed: true, interactive: true }, () => "Row 1"),
            h(CardRow, null, () => "Row 2"),
          ]),
      },
    )
    const fieldHtml = await renderComponent(TextFieldRoot, {
      size: "s",
      invalid: true,
      radius: "medium",
      modelValue: "abc",
    })

    expect(cardHtml).toContain('data-slot="card"')
    expect(cardHtml).toContain("data-card-list")
    expect(cardHtml).toContain('data-slot="card-row"')
    expect(cardHtml).toContain("data-bleed")
    expect(cardHtml).toContain("data-interactive")

    expect(fieldHtml).toContain('data-slot="text-field-root"')
    expect(fieldHtml).toContain('data-size="s"')
    expect(fieldHtml).toContain('data-radius="medium"')
    expect(fieldHtml).toContain("data-invalid")
    expect(fieldHtml).toContain('data-slot="text-field-input"')
    expect(fieldHtml).toContain('aria-invalid="true"')
  })
})
