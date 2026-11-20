export type ChildMessage =
  | { type: "ready"; port: number; launchToken: string }
  | { type: "failed"; message: string }
  | { type: "select-directory"; id: number }

export type DirectoryReply =
  | { type: "directory-selected"; id: number; path?: string }
  | { type: "directory-failed"; id: number }

export type ParentMessage = DirectoryReply | { type: "stop" }
