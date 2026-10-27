import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { SettingsIcon } from "@components/icons/index.js"
import { Button, IconButton } from "@components/ui/button/index.js"

const meta: Meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["classic", "solid", "soft", "surface", "outline", "ghost"],
    },
    size: { control: "select", options: ["s", "m", "l"] },
    color: { control: "text" },
    highContrast: { control: "boolean" },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  args: { variant: "solid", size: "m", highContrast: false, loading: false, disabled: false },
  render: (args) => ({
    components: { Button },
    setup: () => ({ args }),
    template: "<Button v-bind='args'>保存</Button>",
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Soft: Story = { args: { variant: "soft" } }
export const Surface: Story = { args: { variant: "surface" } }
export const Outline: Story = { args: { variant: "outline" } }
export const Ghost: Story = { args: { variant: "ghost" } }
export const HighContrast: Story = { args: { variant: "solid", highContrast: true } }
export const Loading: Story = { args: { loading: true } }
export const Disabled: Story = { args: { disabled: true } }
export const Sizes: Story = {
  render: () => ({
    components: { Button },
    template:
      "<div class='flex items-center gap-sm'><Button size='s'>小</Button><Button size='m'>中</Button><Button size='l'>大</Button></div>",
  }),
}
export const Icon: Story = {
  render: () => ({
    components: { IconButton, SettingsIcon },
    template: "<IconButton aria-label='设置'><SettingsIcon /></IconButton>",
  }),
}
