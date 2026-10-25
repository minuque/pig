import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { expect, screen, userEvent, waitFor } from "storybook/test"
import { Button } from "@components/ui/button/index.js"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@components/ui/dialog/index.js"

const meta: Meta = {
  title: "UI/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  render: () => ({
    components: { Dialog, DialogTrigger, DialogContent, DialogTitle, Button },
    template:
      "<Dialog><DialogTrigger as-child><Button variant='outline'>重命名</Button></DialogTrigger><DialogContent><DialogTitle>重命名</DialogTitle><input class='w-full rounded-md border border-border bg-card px-2 py-1 text-foreground' type='text' value='草稿' aria-label='名称' /></DialogContent></Dialog>",
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Rename: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "重命名" }))

    const dialog = await screen.findByRole("dialog")
    await expect(dialog).toHaveTextContent("重命名")
    await expect(screen.getByLabelText("名称")).toHaveValue("草稿")

    await userEvent.click(screen.getByRole("button", { name: "关闭" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  },
}
