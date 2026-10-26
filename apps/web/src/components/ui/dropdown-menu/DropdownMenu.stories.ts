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
    data: () => ({ wrap: true, density: "默认", theme: "跟随系统" }),
    template: `<DropdownMenu>
      <DropdownMenuTrigger as-child><Button variant="outline">更多</Button></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>编辑</DropdownMenuLabel>
        <DropdownMenuItem shortcut="Ctrl+C">复制</DropdownMenuItem>
        <DropdownMenuItem shortcut="Ctrl+X">剪切</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem v-model="wrap">自动换行</DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>密度</DropdownMenuLabel>
          <DropdownMenuRadioGroup v-model="density">
            <DropdownMenuRadioItem value="紧凑">紧凑</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="默认">默认</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="宽松">宽松</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>外观</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup v-model="theme">
              <DropdownMenuRadioItem value="跟随系统">跟随系统</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="浅色">浅色</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="深色">深色</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" shortcut="Del">删除</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>`,
  }),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "更多" }))
    await screen.findByRole("menu")
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "自动换行" }))
    await userEvent.hover(screen.getByRole("menuitem", { name: "外观" }))
    await screen.findByText("跟随系统")
  },
}
