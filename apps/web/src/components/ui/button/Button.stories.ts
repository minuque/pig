import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { SettingsIcon } from "@components/icons/index.js"
import { Button } from "@components/ui/button/index.js"

const meta: Meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["default", "destructive", "outline"] },
    size: { control: "select", options: ["default", "icon", "icon-2xs", "icon-sm"] },
  },
  args: { variant: "default", size: "default" },
  render: (args) => ({
    components: { Button, SettingsIcon },
    setup: () => ({ args }),
    template:
      "<Button v-bind='args'><SettingsIcon v-if=\"args.size !== 'default'\" />{{ args.size === 'default' ? '保存' : '' }}</Button>",
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Outline: Story = { args: { variant: "outline" } }
export const Destructive: Story = { args: { variant: "destructive" } }
export const Disabled: Story = {
  render: () => ({ components: { Button }, template: "<Button disabled>保存</Button>" }),
}
export const Icon: Story = {
  args: { size: "icon" },
  render: (args) => ({
    components: { Button, SettingsIcon },
    setup: () => ({ args }),
    template: "<Button v-bind='args' aria-label='设置'><SettingsIcon /></Button>",
  }),
}
