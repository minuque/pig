import type { Meta, StoryObj } from "@storybook/vue3-vite"

import SettingsDialog from "@features/settings/components/SettingsDialog.vue"
import { SIDEBAR_SESSIONS } from "@/stories/fixtures/sessions.js"

/** 资源页展示的工作目录，取侧栏样本的主工作区。 */
const CWD = SIDEBAR_SESSIONS[0]?.cwd
const meta = {
  title: "Features/Settings/SettingsDialog",
  component: SettingsDialog,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: {
    open: { control: "boolean" },
    cwd: { control: "text" },
    initialPane: {
      control: "inline-radio",
      options: ["general", "usage", "skills", "extensions"],
    },
  },
  args: { open: true, cwd: CWD, initialPane: "general" },
} satisfies Meta<typeof SettingsDialog>

export default meta

type Story = StoryObj<typeof meta>

/** 通用：外观、强调色、界面、通知四组偏好。 */
export const General: Story = {}
/** 技能页：只有工作目录命中才列出。 */
export const Skills: Story = {
  args: { ...meta.args, initialPane: "skills" },
}
/** 扩展页：与技能页同一份 cwd，空态文案不同。 */
export const Extensions: Story = {
  args: { ...meta.args, initialPane: "extensions" },
}
/** 用量页：暂无数据。 */
export const Usage: Story = {
  args: { ...meta.args, initialPane: "usage" },
}
/** 无目录空态：cwd 不传，资源页提示先添加工作目录。 */
export const NoCwd: Story = {
  args: { ...meta.args, cwd: undefined, initialPane: "skills" },
}
