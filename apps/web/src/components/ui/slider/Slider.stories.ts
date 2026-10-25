import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { Slider } from "@components/ui/slider/index.js"

const meta = {
  title: "UI/Slider",
  component: Slider,
  tags: ["autodocs"],
  args: { modelValue: [40], min: 0, max: 100, disabled: false },
  render: (args) => ({
    components: { Slider },
    setup: () => ({ args }),
    template: "<Slider v-bind='args' aria-label='示例滑杆' />",
  }),
} satisfies Meta<typeof Slider>

export default meta

type Story = StoryObj<typeof meta>

export const Value: Story = {}
export const Disabled: Story = { args: { disabled: true } }
