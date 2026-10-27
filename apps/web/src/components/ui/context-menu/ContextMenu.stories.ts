import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { expect, fireEvent, screen, userEvent, waitFor } from "storybook/test"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@components/ui/context-menu/index.js"

const meta = {
  title: "UI/ContextMenu",
  component: ContextMenu,
  tags: ["autodocs"],
  render: () => ({
    components: {
      ContextMenu,
      ContextMenuTrigger,
      ContextMenuContent,
      ContextMenuItem,
      ContextMenuSeparator,
    },
    template:
      "<ContextMenu><ContextMenuTrigger><div class='rounded-md border border-border p-md text-muted-foreground' style='inline-size:12rem'>右键此区域</div></ContextMenuTrigger><ContextMenuContent><ContextMenuItem>复制</ContextMenuItem><ContextMenuSeparator /><ContextMenuItem variant='destructive'>删除</ContextMenuItem></ContextMenuContent></ContextMenu>",
  }),
} satisfies Meta<typeof ContextMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Actions: Story = {
  play: async ({ canvas }) => {
    await fireEvent.contextMenu(canvas.getByText("右键此区域"))

    const menu = await screen.findByRole("menu")
    await userEvent.click(screen.getByRole("menuitem", { name: "复制" }))
    await waitFor(() => expect(menu).not.toBeInTheDocument())
  },
}
