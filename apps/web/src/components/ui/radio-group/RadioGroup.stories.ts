import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { RadioGroup, RadioGroupItem } from "@components/ui/radio-group/index.js"

const meta: Meta = {
  title: "UI/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["1", "2", "3"] },
    variant: { control: "select", options: ["classic", "surface", "soft"] },
    color: { control: "text" },
    highContrast: { control: "boolean" },
  },
  args: { size: "2", variant: "surface", highContrast: false, modelValue: "a" },
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
