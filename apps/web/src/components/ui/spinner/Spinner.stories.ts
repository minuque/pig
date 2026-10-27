import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { Spinner } from "@components/ui/spinner/index.js"

const meta = {
  title: "UI/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  argTypes: {
    /** 期望像素，就近落到 rt 的三档：1=12px、2=16px、3=20px */
    size: { control: "number" },
  },
  args: { size: 16 },
} satisfies Meta<typeof Spinner>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
/** 三档对照：12 / 16 / 20，超出就落到最大档。 */
export const Sizes: Story = {
  render: () => ({
    components: { Spinner },
    template:
      "<div class='flex items-center gap-md'><Spinner :size='12' /><Spinner :size='16' /><Spinner :size='24' /></div>",
  }),
}
