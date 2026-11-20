import { defineAsyncComponent, h, type Component } from "vue"
import CardTuner from "@features/design-lab/components/CardTuner.vue"
import TokenCategory from "@features/design-lab/components/TokenCategory.vue"
import { CATEGORIES } from "@features/design-lab/lib/tokens.js"

export type Label = { zh: string; en: string }

export type NavItem = { path: string; title: Label; view: Component }

export type NavGroup = { id: string; title: Label; items: NavItem[] }

const same = (name: string): Label => ({ zh: name, en: name })
const DEMOS = import.meta.glob<{ default: Component }>("../demos/*Demo.vue")
const LAYOUT: { id: string; title: Label; items: (string | [string, Label])[] }[] = [
  {
    id: "actions",
    title: { zh: "操作", en: "Actions" },
    items: ["Button", "IconButton", "Link", "Kbd"],
  },
  {
    id: "forms",
    title: { zh: "表单", en: "Forms" },
    items: [
      "TextField",
      "Select",
      "Checkbox",
      "Switch",
      "Slider",
      "RadioGroup",
      "Radio",
      "RadioCards",
    ],
  },
  {
    id: "feedback",
    title: { zh: "反馈", en: "Feedback" },
    items: ["Banner", "Badge", "StatusIndicator", "Spinner", "Skeleton", "Tooltip"],
  },
  {
    id: "overlays",
    title: { zh: "弹层", en: "Overlays" },
    items: ["Dialog", "AlertDialog", "CommandPalette", "DropdownMenu", "ContextMenu", "HoverCard"],
  },
  {
    id: "layout",
    title: { zh: "布局", en: "Layout" },
    items: ["Card", "Collapsible", "ScrollArea", "Table", "Tabs"],
  },
  {
    id: "business",
    title: { zh: "业务", en: "Product" },
    items: [
      ["Turn", { zh: "对话一轮", en: "Turn" }],
      ["Prose", { zh: "正文排版", en: "Prose" }],
      ["ToolRun", { zh: "工具组", en: "Tool run" }],
      ["UserMessage", { zh: "用户消息", en: "User message" }],
      ["TurnError", { zh: "轮次提示", en: "Turn notice" }],
      ["SettingsPane", { zh: "设置分区", en: "Settings pane" }],
      ["Provider", { zh: "供应商", en: "Providers" }],
    ],
  },
]
const loaders = new Map(
  Object.entries(DEMOS).map(([path, load]) => [
    path.slice("../demos/".length, -"Demo.vue".length),
    load,
  ]),
)

function demo(name: string, title = same(name)): NavItem[] {
  const load = loaders.get(name)
  const path = name.replace(/(?<=[a-z])(?=[A-Z])/g, "-").toLowerCase()
  return load ? [{ path, title, view: defineAsyncComponent(load) }] : []
}

export const NAV: NavGroup[] = [
  {
    id: "tokens",
    title: { zh: "设计变量", en: "Tokens" },
    items: CATEGORIES.map((category) => ({
      path: `tokens/${category.id}`,
      title: category.title,
      view: () => h(TokenCategory, { category }),
    })),
  },
  {
    id: "tuners",
    title: { zh: "调节", en: "Tuners" },
    items: [{ path: "card-tuner", title: { zh: "卡片", en: "Card" }, view: CardTuner }],
  },
  ...demoGroups(),
]

function demoGroups(): NavGroup[] {
  const listed = new Set(
    LAYOUT.flatMap((group) => group.items.map((item) => (Array.isArray(item) ? item[0] : item))),
  )
  const rest = [...loaders.keys()].filter((name) => !listed.has(name)).sort()
  const groups = LAYOUT.map((group) => ({
    id: group.id,
    title: group.title,
    items: group.items.flatMap((item) => (Array.isArray(item) ? demo(...item) : demo(item))),
  }))
  const other = {
    id: "other",
    title: { zh: "其他", en: "Other" },
    items: rest.flatMap((name) => demo(name)),
  }
  return [...groups, other].filter((group) => group.items.length > 0)
}
