import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { expect, screen, userEvent, waitFor } from "storybook/test"
import { Button } from "@components/ui/button/index.js"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@components/ui/dialog/index.js"
import { TextFieldRoot } from "@components/ui/text-field/index.js"

const meta: Meta = {
  title: "UI/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["1", "2", "3", "4"] },
    maxWidth: { control: "text" },
  },
  args: { size: "3", maxWidth: "600px" },
  render: (args) => ({
    components: {
      Dialog,
      DialogTrigger,
      DialogContent,
      DialogTitle,
      DialogDescription,
      Button,
      TextFieldRoot,
    },
    setup: () => ({ args }),
    template: `<Dialog>
      <DialogTrigger as-child><Button variant="outline">重命名</Button></DialogTrigger>
      <DialogContent :size="args.size" :max-width="args.maxWidth">
        <DialogTitle>重命名</DialogTitle>
        <DialogDescription>改名只影响本机的会话标题，不动磁盘上的内容。</DialogDescription>
        <TextFieldRoot model-value="草稿" aria-label="名称" />
      </DialogContent>
    </Dialog>`,
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Rename: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "重命名" }))

    const dialog = await screen.findByRole("dialog")
    await expect(dialog).toHaveTextContent("重命名")
    await expect(dialog).toHaveTextContent("不动磁盘上的内容")
    await expect(screen.getByLabelText("名称")).toHaveValue("草稿")

    await userEvent.click(screen.getByRole("button", { name: "关闭" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  },
}
/** rt 的四档宽度：1 最窄、4 最宽；maxWidth 是上界。 */
export const Sizes: Story = {
  render: () => ({
    components: { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, Button },
    template: `<div class="flex items-center gap-md">
      <Dialog v-for="size in ['1', '2', '3', '4']" :key="size">
        <DialogTrigger as-child><Button variant="soft">size {{ size }}</Button></DialogTrigger>
        <DialogContent :size="size">
          <DialogTitle>尺寸 {{ size }}</DialogTitle>
          <DialogDescription>面板宽度按 rt 的四档。</DialogDescription>
        </DialogContent>
      </Dialog>
    </div>`,
  }),
}
