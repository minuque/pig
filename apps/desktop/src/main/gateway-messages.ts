/** gateway 子进程与主进程之间只走这几种消息。 */
export type ChildMessage =
  | { type: "ready"; port: number; launchToken: string }
  | { type: "failed"; message: string }
  | { type: "select-directory"; id: number }

export type DirectorySelected = { type: "directory-selected"; id: number; path?: string }

export type ParentMessage = DirectorySelected | { type: "stop" }
