import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { RadioGroup, RadioGroupItem } from "@components/ui/radio-group/index.js"

const meta: Meta = {
  title: "UI/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["s", "m", "l"] },
    variant: { control: "select", options: ["classic", "surface", "soft"] },
    color: { control: "text" },
    highContrast: { control: "boolean" },
  },
  args: { size: "m", variant: "surface", highContrast: false, modelValue: "a" },
  render: (args) => ({
    components: { RadioGroup, RadioGroupItem },
    setup: () => ({ args }),
    template: `<RadioGroup v-bind="args" class="flex flex-col gap-sm">
      <RadioGroupItem value="a">苹果</RadioGroupItem>
      <RadioGroupItem value="b">香蕉</RadioGroupItem>
      <RadioGroupItem value="c">樱桃</RadioGroupItem>
    </RadioGroup>`,
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Classic: Story = { args: { variant: "classic" } }
export const HighContrast: Story = { args: { highContrast: true } }
/** 三档尺寸：标签文字与圆点一起缩放（rt 的文字尺寸跟着组走）。 */
export const Sizes: Story = {
  render: () => ({
    components: { RadioGroup, RadioGroupItem },
    template: `<div class="flex flex-col gap-md">
      <RadioGroup v-for="size in ['s', 'm', 'l']" :key="size" :size="size" model-value="a">
        <RadioGroupItem value="a">尺寸 {{ size }}</RadioGroupItem>
        <RadioGroupItem value="b">第二项</RadioGroupItem>
      </RadioGroup>
    </div>`,
  }),
}
