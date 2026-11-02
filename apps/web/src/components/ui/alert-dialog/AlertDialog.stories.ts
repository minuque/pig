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
import { t } from "@i18n/index.js"

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
      "<AlertDialog><AlertDialogTrigger as-child><Button variant='soft'>{{ $t('demo.alertDialog.discard') }}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{{ $t('demo.alertDialog.discardTitle') }}</AlertDialogTitle><AlertDialogDescription>{{ $t('demo.alertDialog.discardDescription') }}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{{ $t('common.cancel') }}</AlertDialogCancel><AlertDialogAction variant='destructive'>{{ $t('demo.alertDialog.discard') }}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>",
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Discard: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: t("demo.alertDialog.discard") }))

    const dialog = await screen.findByRole("alertdialog")
    await waitFor(() => expect(dialog).toBeVisible())
    await expect(within(dialog).getByText(t("demo.alertDialog.discardTitle"))).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole("button", { name: t("common.cancel") }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  },
}
export const Confirmed: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: t("demo.alertDialog.discard") }))

    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(
      within(dialog).getByRole("button", { name: t("demo.alertDialog.discard") }),
    )
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  },
}
