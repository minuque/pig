import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { MagnifierIcon } from "@components/icons/index.js"
import { TextFieldRoot, TextFieldSlot } from "@components/ui/text-field/index.js"

const meta: Meta = {
  title: "UI/TextField",
  component: TextFieldRoot,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["s", "m", "l"] },
    variant: { control: "select", options: ["classic", "surface", "soft"] },
    color: { control: "text" },
  },
  args: { size: "m", variant: "surface" },
  render: (args) => ({
    components: { TextFieldRoot },
    setup: () => ({ args }),
    template: "<TextFieldRoot v-bind='args' placeholder='搜索会话' model-value='' />",
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Classic: Story = { args: { variant: "classic" } }
export const WithSlot: Story = {
  render: () => ({
    components: { TextFieldRoot, TextFieldSlot, MagnifierIcon },
    template:
      "<TextFieldRoot placeholder='搜索'><TextFieldSlot side='left'><MagnifierIcon class='size-icon' /></TextFieldSlot></TextFieldRoot>",
  }),
}
