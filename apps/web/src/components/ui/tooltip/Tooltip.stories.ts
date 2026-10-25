import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { Button } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"

const meta: Meta = {
  title: "UI/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  render: () => ({
    components: { Tooltip, TooltipTrigger, TooltipContent, Button },
    template:
      "<Tooltip><TooltipTrigger as-child><Button variant='outline'>悬停</Button></TooltipTrigger><TooltipContent>示例说明</TooltipContent></Tooltip>",
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Hint: Story = {}
