// @license ISC — Lucide icons
import { Star, type LucideProps } from "@lucide/vue"
import { h, type FunctionalComponent } from "vue"

export { default as RunningPigGlyph } from "@components/icons/RunningPigGlyph.vue"

export { default as LanguageIcon } from "@components/icons/LanguageIcon.vue"

export {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowDownIcon,
  ArrowDownLeftIcon,
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  BellIcon,
  BlocksIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
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
  NotepadTextIcon,
  GlobeIcon,
  GripVerticalIcon,
  InfoIcon,
  KeyRoundIcon,
  LinkIcon,
  LoaderIcon,
  Maximize2Icon,
  Minimize2Icon,
  MessageCirclePlusIcon,
  MessageSquareIcon,
  MinusIcon,
  MoonIcon,
  PaletteIcon,
  PanelLeftIcon,
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
  TriangleAlertIcon,
  Undo2Icon,
  UserIcon,
  XIcon,
} from "@lucide/vue"

const filled =
  (icon: FunctionalComponent<LucideProps>): FunctionalComponent<LucideProps> =>
  (_, { attrs }) =>
    h(icon, { ...attrs, fill: "currentColor" })
export const StarFilledIcon = filled(Star)
