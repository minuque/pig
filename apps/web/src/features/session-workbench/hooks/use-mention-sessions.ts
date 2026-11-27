import type { Ref } from "vue"
import type { MentionSession } from "@features/composer/type.js"
import { sessionTitle } from "@features/session/index.js"
import { useNav } from "@features/session-nav/index.js"
import { workspaceName } from "@features/session-nav/lib/format.js"
import { filterSessionsForSearch } from "@features/session-nav/lib/session-list.js"

export function useMentionSessions(currentId: Readonly<Ref<string | undefined>>) {
  const { listedSessions } = useNav()

  return (query: string): MentionSession[] =>
    filterSessionsForSearch(listedSessions.value, query)
      .filter((session) => session.id !== currentId.value)
      .map((session) => ({
        id: session.id,
        title: sessionTitle(session),
        project: session.cwd ? workspaceName(session.cwd) : undefined,
      }))
}
