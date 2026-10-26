import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { expect, screen, userEvent, waitFor, within } from "storybook/test"
import { AlertDialogTrigger } from "reka-ui"
import { Button } from "@components/ui/button/index.js"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@components/ui/alert-dialog/index.js"

const meta: Meta = {
  title: "UI/AlertDialog",
  component: AlertDialog,
  tags: ["autodocs"],
  render: () => ({
    components: {
      AlertDialog,
      AlertDialogTrigger,
      AlertDialogContent,
      AlertDialogHeader,
      AlertDialogTitle,
      AlertDialogDescription,
      AlertDialogFooter,
      AlertDialogCancel,
      AlertDialogAction,
      Button,
    },
    template:
      "<AlertDialog><AlertDialogTrigger as-child><Button variant='soft'>放弃</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>放弃未保存的更改？</AlertDialogTitle><AlertDialogDescription>此操作只关闭示例，不会删除数据。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction variant='destructive'>放弃</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>",
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Discard: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "放弃" }))

    const dialog = await screen.findByRole("alertdialog")
    await waitFor(() => expect(dialog).toBeVisible())
    await expect(within(dialog).getByText("放弃未保存的更改？")).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole("button", { name: "取消" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  },
}
export const Confirmed: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "放弃" }))

    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "放弃" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  },
}
