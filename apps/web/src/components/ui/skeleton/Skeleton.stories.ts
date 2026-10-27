import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { Skeleton } from "@components/ui/skeleton/index.js"

const meta: Meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  args: { loading: true },
  render: (args) => ({
    components: { Skeleton },
    setup: () => ({ args }),
    template: "<Skeleton v-bind='args' width='200px' height='16px' />",
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Wrapped: Story = {
  render: () => ({
    components: { Skeleton },
    template: "<Skeleton loading><p>内容加载完成后直接显示这段文字</p></Skeleton>",
  }),
}
