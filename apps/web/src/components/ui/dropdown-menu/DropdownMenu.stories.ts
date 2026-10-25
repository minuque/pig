import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { expect, screen, userEvent, waitFor } from "storybook/test"
import { Button } from "@components/ui/button/index.js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"

const meta: Meta = {
  title: "UI/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
  render: () => ({
    components: {
      DropdownMenu,
      DropdownMenuTrigger,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuSeparator,
      Button,
    },
    template:
      "<DropdownMenu><DropdownMenuTrigger as-child><Button variant='outline'>操作</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>复制</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant='destructive'>删除</DropdownMenuItem></DropdownMenuContent></DropdownMenu>",
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Actions: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "操作" }))

    const menu = await screen.findByRole("menu")
    await userEvent.click(screen.getByRole("menuitem", { name: "复制" }))
    await waitFor(() => expect(menu).not.toBeInTheDocument())
  },
}
