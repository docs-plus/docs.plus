import type { ReactNode } from 'react'

import { FILTER_TERM_PILL_CLASS } from '../filterTermPill'

/** Every term of a filter link, in order. The list wraps and never scrolls on its own. */
export function FilterTermPills({ terms }: { terms: string[] }): ReactNode {
  return (
    // `role="list"`: Safari with VoiceOver drops list semantics from a `list-none` list.
    <ul role="list" className="flex list-none flex-wrap gap-1.5">
      {terms.map((term, index) => (
        <li key={`${index}-${term}`} className={FILTER_TERM_PILL_CLASS}>
          {term}
        </li>
      ))}
    </ul>
  )
}
