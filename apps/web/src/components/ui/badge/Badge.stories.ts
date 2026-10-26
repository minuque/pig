import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { Badge } from "@components/ui/badge/index.js"

const meta: Meta = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["1", "2", "3"] },
    variant: { control: "select", options: ["solid", "soft", "surface", "outline"] },
    color: { control: "text" },
    highContrast: { control: "boolean" },
  },
  args: { size: "1", variant: "soft", highContrast: false },
  render: (args) => ({
    components: { Badge },
    setup: () => ({ args }),
    template: "<Badge v-bind='args'>新</Badge>",
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Solid: Story = { args: { variant: "solid" } }
export const Outline: Story = { args: { variant: "outline" } }
