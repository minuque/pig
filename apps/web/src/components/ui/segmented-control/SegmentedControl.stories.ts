import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { SegmentedControl, SegmentedControlItem } from "@components/ui/segmented-control/index.js"

const meta: Meta = {
  title: "UI/SegmentedControl",
  component: SegmentedControl,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["s", "m", "l"] },
    variant: { control: "select", options: ["surface", "classic"] },
    disabled: { control: "boolean" },
  },
  args: { size: "m", variant: "surface", disabled: false, modelValue: "m" },
  render: (args) => ({
    components: { SegmentedControl, SegmentedControlItem },
    setup: () => ({ args }),
    template: `<SegmentedControl v-bind="args">
      <SegmentedControlItem value="s">{{ $t("demo.segmentedControl.small") }}</SegmentedControlItem>
      <SegmentedControlItem value="m">{{ $t("demo.segmentedControl.medium") }}</SegmentedControlItem>
      <SegmentedControlItem value="l">{{ $t("demo.segmentedControl.large") }}</SegmentedControlItem>
    </SegmentedControl>`,
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Classic: Story = { args: { variant: "classic" } }
export const Disabled: Story = { args: { disabled: true } }
