import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { expect, fireEvent, screen, userEvent, waitFor } from "storybook/test"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@components/ui/context-menu/index.js"
import { t } from "@i18n/index.js"

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
      "<ContextMenu><ContextMenuTrigger><div class='rounded-md border border-border p-md text-muted-foreground' style='inline-size:12rem'>{{ $t('demo.contextMenu.area') }}</div></ContextMenuTrigger><ContextMenuContent><ContextMenuItem>{{ $t('demo.contextMenu.copy') }}</ContextMenuItem><ContextMenuSeparator /><ContextMenuItem variant='destructive'>{{ $t('demo.contextMenu.delete') }}</ContextMenuItem></ContextMenuContent></ContextMenu>",
  }),
} satisfies Meta<typeof ContextMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Actions: Story = {
  play: async ({ canvas }) => {
    await fireEvent.contextMenu(canvas.getByText(t("demo.contextMenu.area")))

    const menu = await screen.findByRole("menu")
    await userEvent.click(screen.getByRole("menuitem", { name: t("demo.contextMenu.copy") }))
    await waitFor(() => expect(menu).not.toBeInTheDocument())
  },
}
