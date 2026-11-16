// 图标注册表：Lucide（ISC），星标实心态用同一图标填 currentColor
import { Star, type LucideProps } from "@lucide/vue"
import { h, type FunctionalComponent } from "vue"

export { default as RunningPigGlyph } from "@components/icons/RunningPigGlyph.vue"

export { default as LanguageIcon } from "@components/icons/LanguageIcon.vue"

export {
  ArrowDownIcon,
  ArrowDownLeftIcon,
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  ArrowUpIcon,
  BellIcon,
  BlocksIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleCheckIcon,
  Columns2Icon,
  CircleDashedIcon,
  CircleExclamationPointIcon,
  CircleQuestionMarkIcon,
  CloudIcon,
  CopyIcon,
  EyeIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  FoldersIcon,
  ListFilterIcon,
  GlobeIcon,
  GripVerticalIcon,
  KeyRoundIcon,
  LinkIcon,
  LoaderIcon,
  Maximize2Icon,
  MessageCirclePlusIcon,
  MessageSquareIcon,
  MinusIcon,
  MoonIcon,
  PaletteIcon,
  PanelLeftCloseIcon,
  PanelRightIcon,
  PanelRightOpenIcon,
  PaperclipIcon,
  PenIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  RotateCcwClockIcon,
  RotateCcwIcon,
  SearchIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  SquareCodeIcon,
  SquareIcon,
  StarIcon,
  SunIcon,
  TrashIcon,
  Undo2Icon,
  UserIcon,
  XIcon,
} from "@lucide/vue"

const filled =
  (icon: FunctionalComponent<LucideProps>): FunctionalComponent<LucideProps> =>
  (_, { attrs }) =>
    h(icon, { ...attrs, fill: "currentColor" })
export const StarFilledIcon = filled(Star)
