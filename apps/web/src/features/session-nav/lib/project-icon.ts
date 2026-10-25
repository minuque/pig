import type { Component } from "vue"
import { FolderIcon } from "@components/icons/index.js"
import { readJson } from "@utils/storage.js"
import { findAccent, type AccentId } from "@features/theme/lib/accents.js"
import { CodeSquareIcon } from "@solar-icons/vue/linear/code-square"
import { MonitorIcon } from "@solar-icons/vue/linear/monitor"
import { StarsMinimalisticIcon } from "@solar-icons/vue/linear/stars-minimalistic"
import { Book2Icon } from "@solar-icons/vue/linear/book-2"
import { GlobeIcon } from "@solar-icons/vue/linear/globe"
import { DatabaseIcon } from "@solar-icons/vue/linear/database"
import { BotIcon } from "@solar-icons/vue/linear/bot"
import { PhoneIcon } from "@solar-icons/vue/linear/phone"
import { RocketIcon } from "@solar-icons/vue/linear/rocket"
import { TestTubeIcon } from "@solar-icons/vue/linear/test-tube"
import { ShieldIcon } from "@solar-icons/vue/linear/shield"
import { GameboyIcon } from "@solar-icons/vue/linear/gameboy"
import { MusicNoteIcon } from "@solar-icons/vue/linear/music-note"
import { GalleryIcon } from "@solar-icons/vue/linear/gallery"
import { GitBranchIcon } from "@solar-icons/vue/linear/git-branch"
import { ToolboxIcon } from "@solar-icons/vue/linear/toolbox"
import { BoxIcon } from "@solar-icons/vue/linear/box"
import { StarIcon } from "@solar-icons/vue/linear/star"
import { HeartIcon } from "@solar-icons/vue/linear/heart"
import { LeafIcon } from "@solar-icons/vue/linear/leaf"
import { BoltIcon } from "@solar-icons/vue/linear/bolt"

export type ProjIconKind = "icon" | "emoji" | "monogram"

export interface ProjIcon {
  kind: ProjIconKind
  value: string
  color: AccentId
}

export function projIconHex(color: AccentId, mode: "light" | "dark"): string {
  const scale = mode === "dark" ? findAccent(color).dark : findAccent(color).light
  return scale.step9
}

const ICON_COMPONENTS: Record<string, Component> = {
  code: CodeSquareIcon,
  terminal: MonitorIcon,
  globe: GlobeIcon,
  database: DatabaseIcon,
  robot: BotIcon,
  stars: StarsMinimalisticIcon,
  phone: PhoneIcon,
  monitor: MonitorIcon,
  rocket: RocketIcon,
  book: Book2Icon,
  flask: TestTubeIcon,
  shield: ShieldIcon,
  game: GameboyIcon,
  music: MusicNoteIcon,
  image: GalleryIcon,
  git: GitBranchIcon,
  wrench: ToolboxIcon,
  box: BoxIcon,
  star: StarIcon,
  heart: HeartIcon,
  leaf: LeafIcon,
  bolt: BoltIcon,
}

export function loadProjIcons(): Record<string, ProjIcon> {
  return readJson<Record<string, ProjIcon>>("pig.projIcons") ?? {}
}

/** 项目自定义图标：icon 名换组件，emoji/monogram 由调用方直接渲染 value。 */
export function projectIconComponent(custom: ProjIcon | undefined): Component {
  if (custom?.kind === "icon" && ICON_COMPONENTS[custom.value]) {
    return ICON_COMPONENTS[custom.value]!
  }

  return FolderIcon
}
