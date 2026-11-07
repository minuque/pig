import { defineAsyncComponent, type Component } from "vue"

/** 导航文案随界面语种切换；组件名两种语言相同。 */
export type Label = { zh: string; en: string }

export type NavItem = { id: string; title: Label; view: Component }

export type NavGroup = { id: string; title: Label; items: NavItem[] }

const same = (name: string): Label => ({ zh: name, en: name })
/** 组件示例按文件名自动收集：demos/ 里加一个 XxxDemo.vue 就多一页。 */
const DEMOS = import.meta.glob<{ default: Component }>("../demos/*Demo.vue")
/** 一级分组与组内顺序；没登记的示例落到「其他」，不会丢。 */
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
      "Switch",
      "Slider",
      "SegmentedControl",
      "RadioGroup",
      "Radio",
      "RadioCards",
    ],
  },
  {
    id: "feedback",
    title: { zh: "反馈", en: "Feedback" },
    items: ["Callout", "Badge", "Spinner", "Skeleton", "Tooltip"],
  },
  {
    id: "overlays",
    title: { zh: "弹层", en: "Overlays" },
    items: ["Dialog", "AlertDialog", "DropdownMenu", "ContextMenu", "HoverCard"],
  },
  { id: "layout", title: { zh: "布局", en: "Layout" }, items: ["Card", "Table", "Tabs"] },
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
  return load ? [{ id: name, title, view: defineAsyncComponent(load) }] : []
}

export function demoGroups(): NavGroup[] {
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
