import type { Meta, StoryObj } from "@storybook/vue3-vite"

import { expect, screen, userEvent, waitFor } from "storybook/test"
import { Button } from "@components/ui/button/index.js"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { t } from "@i18n/index.js"

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
      "<DropdownMenu><DropdownMenuTrigger as-child><Button variant='outline'>{{ $t('demo.dropdownMenu.trigger') }}</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>{{ $t('demo.dropdownMenu.copy') }}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant='destructive'>{{ $t('demo.dropdownMenu.delete') }}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>",
  }),
}

export default meta

type Story = StoryObj<typeof meta>

export const Actions: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: t("demo.dropdownMenu.trigger") }))

    const menu = await screen.findByRole("menu")
    await userEvent.click(screen.getByRole("menuitem", { name: t("demo.dropdownMenu.copy") }))
    await waitFor(() => expect(menu).not.toBeInTheDocument())
  },
}
/** 覆盖 rt 菜单的全部部件：标签、分组、勾选项、单选项、子菜单、快捷键提示。 */
export const Rich: Story = {
  render: () => ({
    components: {
      DropdownMenu,
      DropdownMenuTrigger,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuSeparator,
      DropdownMenuLabel,
      DropdownMenuGroup,
      DropdownMenuCheckboxItem,
      DropdownMenuRadioGroup,
      DropdownMenuRadioItem,
      DropdownMenuSub,
      DropdownMenuSubTrigger,
      DropdownMenuSubContent,
      Button,
    },
    data: () => ({ wrap: true, density: "normal", theme: "system" }),
    template: `<DropdownMenu>
      <DropdownMenuTrigger as-child><Button variant="outline">{{ $t("demo.dropdownMenu.more") }}</Button></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{{ $t("demo.dropdownMenu.edit") }}</DropdownMenuLabel>
        <DropdownMenuItem shortcut="Ctrl+C">{{ $t("demo.dropdownMenu.copy") }}</DropdownMenuItem>
        <DropdownMenuItem shortcut="Ctrl+X">{{ $t("demo.dropdownMenu.cut") }}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem v-model="wrap">{{ $t("demo.dropdownMenu.autoWrap") }}</DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{{ $t("demo.dropdownMenu.density") }}</DropdownMenuLabel>
          <DropdownMenuRadioGroup v-model="density">
            <DropdownMenuRadioItem value="compact">{{ $t("demo.dropdownMenu.compact") }}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="normal">{{ $t("demo.dropdownMenu.normal") }}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="loose">{{ $t("demo.dropdownMenu.loose") }}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{{ $t("demo.dropdownMenu.appearance") }}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup v-model="theme">
              <DropdownMenuRadioItem value="system">{{ $t("demo.dropdownMenu.system") }}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="light">{{ $t("demo.dropdownMenu.light") }}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">{{ $t("demo.dropdownMenu.dark") }}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" shortcut="Del">{{ $t("demo.dropdownMenu.delete") }}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>`,
  }),
  play: async ({ canvas }) => {
    const trigger = () => canvas.getByRole("button", { name: t("demo.dropdownMenu.more") })

    await userEvent.click(trigger())
    await screen.findByRole("menu")
    await userEvent.click(
      screen.getByRole("menuitemcheckbox", { name: t("demo.dropdownMenu.autoWrap") }),
    )

    // 勾选项点完菜单就关，子菜单要重新打开才够得着
    await userEvent.click(trigger())
    await screen.findByRole("menu")
    await userEvent.hover(screen.getByRole("menuitem", { name: t("demo.dropdownMenu.appearance") }))
    await screen.findByText(t("demo.dropdownMenu.system"))
  },
}
