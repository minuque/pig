import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { Separator } from "@components/ui/separator/index.js"

const meta: Meta = {
  title: "UI/Separator",
  component: Separator,
  tags: ["autodocs"],
  argTypes: {
    orientation: { control: "select", options: ["horizontal", "vertical"] },
    size: { control: "select", options: ["1", "2", "3", "4"] },
  },
  // rt 的 size 是线的长度：1=16px、2=24px、3=64px、4=100%
  args: { orientation: "horizontal", size: "4" },
  render: (args) => ({
    components: { Separator },
    setup: () => ({ args }),
    template: "<div style='width:240px'><p>上面</p><Separator v-bind='args' /><p>下面</p></div>",
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Short: Story = { args: { size: "1" } }
