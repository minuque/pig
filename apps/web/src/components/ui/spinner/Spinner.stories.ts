import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { Spinner } from "@components/ui/spinner/index.js"

const meta = {
  title: "UI/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  args: { size: 16 },
} satisfies Meta<typeof Spinner>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Large: Story = { args: { size: 32 } }
