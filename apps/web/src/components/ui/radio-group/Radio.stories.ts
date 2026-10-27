import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { Radio } from "@components/ui/radio-group/index.js"

const meta: Meta = {
  title: "UI/Radio",
  component: Radio,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["s", "m", "l"] },
    color: { control: "text" },
  },
  args: { size: "m", value: "solo", name: "solo-demo" },
  render: (args) => ({
    components: { Radio },
    setup: () => ({ args }),
    template: "<Radio v-bind='args' aria-label='单独的单选' />",
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Checked: Story = { args: { checked: true } }
