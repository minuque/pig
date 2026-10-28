import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { ref } from "vue"
import { expect, screen, userEvent, waitFor } from "storybook/test"
import { LightbulbMinimalisticIcon } from "@components/icons/index.js"
import { Button } from "@components/ui/button/index.js"
import { Callout } from "@components/ui/callout/index.js"
import { t } from "@i18n/index.js"

const meta: Meta = {
  title: "UI/Callout",
  component: Callout,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["soft", "surface", "outline"] },
    color: { control: "select", options: ["neutral", "info", "success", "warning", "destructive"] },
    size: { control: "select", options: ["s", "m", "l"] },
  },
  args: { variant: "surface", color: "neutral", size: "m", dismissible: false },
  render: (args) => ({
    components: { Callout, LightbulbMinimalisticIcon },
    setup: () => ({ args }),
    template:
      "<Callout v-bind='args'><template #icon><LightbulbMinimalisticIcon /></template><template #title>{{ $t('demo.callout.title') }}</template>{{ $t('demo.callout.body') }}</Callout>",
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Surface: Story = {}
export const Soft: Story = { args: { variant: "soft", color: "info" } }
export const Outline: Story = { args: { variant: "outline", color: "info" } }
export const Large: Story = { args: { size: "l", color: "info" } }
export const Destructive: Story = { args: { variant: "soft", color: "destructive" } }
export const Dismissible: Story = {
  args: { dismissible: true, color: "warning" },
  render: (args) => ({
    components: { Callout, LightbulbMinimalisticIcon, Button },
    setup: () => ({ args, visible: ref(true) }),
    template:
      "<Callout v-if='visible' v-bind='args' @close='visible = false'><template #icon><LightbulbMinimalisticIcon /></template><template #title>{{ $t('demo.callout.title') }}</template>{{ $t('demo.callout.body') }}</Callout><Button v-else variant='outline' @click='visible = true'>{{ $t('demo.callout.reshow') }}</Button>",
  }),
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: t("common.close") }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: t("demo.callout.reshow") })).toBeVisible(),
    )

    await userEvent.click(screen.getByRole("button", { name: t("demo.callout.reshow") }))
    await waitFor(() => expect(screen.getByText(t("demo.callout.body"))).toBeVisible())
  },
}
