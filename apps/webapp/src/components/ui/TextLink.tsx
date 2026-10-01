import Link from 'next/link'
import type { ReactNode } from 'react'

/** A path starting with `/` is a client-side route; `mailto:` and `https:` stay plain anchors. */
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  const className =
    'rounded-field font-medium text-[var(--primary-ink)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  )
}
