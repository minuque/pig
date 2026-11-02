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
import { t } from "@i18n/index.js"

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
      <DialogTrigger as-child><Button variant="outline">{{ $t("demo.dialog.rename") }}</Button></DialogTrigger>
      <DialogContent :size="args.size" :max-width="args.maxWidth">
        <DialogTitle>{{ $t("demo.dialog.rename") }}</DialogTitle>
        <DialogDescription>{{ $t("demo.dialog.renameDescription") }}</DialogDescription>
        <TextFieldRoot :model-value="$t('demo.dialog.draft')" :aria-label="$t('demo.dialog.name')" />
      </DialogContent>
    </Dialog>`,
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Rename: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: t("demo.dialog.rename") }))

    const dialog = await screen.findByRole("dialog")
    await expect(dialog).toHaveTextContent(t("demo.dialog.rename"))
    await expect(dialog).toHaveTextContent(t("demo.dialog.renameDescription"))
    await expect(screen.getByLabelText(t("demo.dialog.name"))).toHaveValue(t("demo.dialog.draft"))

    await userEvent.click(screen.getByRole("button", { name: t("common.close") }))
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
          <DialogTitle>{{ $t("demo.dialog.sizeTitle", { size }) }}</DialogTitle>
          <DialogDescription>{{ $t("demo.dialog.sizeDescription") }}</DialogDescription>
        </DialogContent>
      </Dialog>
    </div>`,
  }),
}
