import type { Decorator, Meta, StoryObj } from "@storybook/vue3-vite"

import WorkbenchStory from "@/stories/WorkbenchStory.vue"
import { withExpandedSidebar, withMemoryRouter } from "@/stories/decorators.js"
import { SCOPE_OPTIONS, type WorkbenchControls } from "@/stories/fixtures/workbench.js"

/** 故事壳里所有交互都是本地状态，这里只留 controls 与渲染映射。 */
type WorkbenchArgs = WorkbenchControls

/** 宽度跟着预览面板走，视口预设管尺寸；写死宽会在面板更宽时留白。 */
const withWorkbenchFrame: Decorator = (_story) => ({
  template: `<div style="width:100%;height:100vh;overflow:hidden"><story /></div>`,
})
const meta = {
  title: "Features/Shell/Workbench",
  tags: ["autodocs"],
  decorators: [withWorkbenchFrame, withExpandedSidebar, withMemoryRouter],
  parameters: {
    layout: "fullscreen",
    viewport: {
      defaultViewport: "workbench",
      viewports: {
        workbench: { name: "整页 1280×800", styles: { width: "1280px", height: "800px" } },
      },
    },
  },
  argTypes: {
    sidebarGrouping: { control: "select", options: ["date", "cwd"] },
    sidebarScope: {
      control: "select",
      options: SCOPE_OPTIONS,
      labels: { "": "全部项目" },
    },
    sidebarSearch: { control: "boolean" },
    transcriptSample: { control: "select", options: ["short", "long", "streaming", "error"] },
    transcriptLoadingOlder: { control: "boolean" },
    sessionState: { control: "select", options: ["session", "idle"] },
    dropActive: { control: "boolean" },
    showContentHandles: { control: "boolean" },
    scrollToLatestVisible: { control: "boolean" },
    pageError: { control: "boolean" },
    toast: { control: "boolean" },
    composerText: { control: "text" },
    composerRunning: { control: "boolean" },
    composerUsage: { control: "boolean" },
    composerQueue: { control: "boolean" },
    settingsOpen: { control: "boolean" },
    settingsPane: { control: "select", options: ["general", "skills", "extensions", "usage"] },
    dark: { control: "boolean" },
  },
  args: {
    sidebarGrouping: "date",
    sidebarScope: "",
    sidebarSearch: false,
    transcriptSample: "long",
    transcriptLoadingOlder: false,
    sessionState: "session",
    dropActive: false,
    showContentHandles: true,
    scrollToLatestVisible: false,
    pageError: false,
    toast: false,
    composerText: "",
    composerRunning: false,
    composerUsage: true,
    composerQueue: false,
    settingsOpen: false,
    settingsPane: "general",
    dark: false,
  },
  render: (args) => ({
    components: { WorkbenchStory },
    setup: () => ({ args }),
    template: `<WorkbenchStory v-bind="args" />`,
  }),
} satisfies Meta<WorkbenchArgs>

export default meta

type Story = StoryObj<typeof meta>

/** 整页默认：日期分组侧栏 + 长会话正文 + 贴底输入卡 + 顶部工作台栏与宽度手柄。 */
export const Page: Story = {}
/** 整页暗色：与 Page 同一份状态，只换配色。 */
export const PageDark: Story = { args: { dark: true } }
/** 空会话首屏：正文区换成 Hero，输入卡抬到 dock 位。 */
export const PageIdle: Story = { args: { sessionState: "idle" } }
