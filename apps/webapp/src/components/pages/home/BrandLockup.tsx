import { DocsPlusIcon } from '@icons'
import Link from 'next/link'

/** Home is already the destination, so it passes no `href` and gets a plain block. */
export function BrandLockup({ href }: { href?: string }) {
  const lockup = (
    <>
      <DocsPlusIcon size={28} className="sm:size-10" />
      <span className="text-base-content mt-1 text-lg font-bold sm:text-2xl">docs.plus</span>
    </>
  )

  if (!href) return <div className="flex items-center gap-2">{lockup}</div>

  return (
    <Link href={href} className="flex items-center gap-2" aria-label="docs.plus home">
      {lockup}
    </Link>
  )
}
