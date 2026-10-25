import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { Switch } from "@components/ui/switch/index.js"

const meta = {
  title: "UI/Switch",
  component: Switch,
  tags: ["autodocs"],
  args: { modelValue: true, disabled: false },
  render: (args) => ({
    components: { Switch },
    setup: () => ({ args }),
    template: "<Switch v-bind='args' aria-label='示例开关' />",
  }),
} satisfies Meta<typeof Switch>

export default meta

type Story = StoryObj<typeof meta>

export const On: Story = {}
export const Off: Story = { args: { modelValue: false } }
export const Disabled: Story = { args: { disabled: true } }
