import { BrandLockup } from '@components/pages/home/BrandLockup'
import {
  HOME_OG_IMAGE,
  HOME_OG_IMAGE_ALT,
  HOME_SITE_URL
} from '@components/pages/home/homeMetadata'
import { SkipLink } from '@components/pages/home/SkipLink'
import { TextLink } from '@components/ui/TextLink'
import Head from 'next/head'
import type { ReactNode } from 'react'

import { LEGAL_UPDATED, PRIVACY_PATH, TERMS_PATH } from './legalMetadata'

interface LegalPageProps {
  title: string
  description: string
  path: string
  children: ReactNode
}

export function LegalPage({ title, description, path, children }: LegalPageProps) {
  const canonicalUrl = `${HOME_SITE_URL}${path}`
  const documentTitle = `${title} — docs.plus`

  return (
    <>
      <Head>
        <title>{documentTitle}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={documentTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={HOME_OG_IMAGE} />
        <meta property="og:image:alt" content={HOME_OG_IMAGE_ALT} />
        <meta name="twitter:title" content={documentTitle} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={HOME_OG_IMAGE} />
        <meta name="twitter:image:alt" content={HOME_OG_IMAGE_ALT} />
      </Head>

      <div className="bg-base-200 min-h-dvh">
        <SkipLink targetId="legal-main" />

        <header className="flex items-center px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:py-4">
          <BrandLockup href="/" />
        </header>

        <main id="legal-main" className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
          <article className="rounded-box bg-base-100 border-base-300 border p-6 sm:p-10">
            <p className="text-base-content/60 text-sm">Last updated {LEGAL_UPDATED}</p>
            <h1 className="text-base-content mt-2 text-2xl font-bold sm:text-3xl">{title}</h1>
            <div className="mt-8 space-y-8">{children}</div>
          </article>
        </main>

        <footer className="text-base-content/60 flex flex-wrap items-center justify-center gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm">
          <TextLink href="/">Home</TextLink>
          <TextLink href={PRIVACY_PATH}>Privacy</TextLink>
          <TextLink href={TERMS_PATH}>Terms</TextLink>
        </footer>
      </div>
    </>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base-content text-lg font-semibold">{title}</h2>
      <div className="text-base-content space-y-3 text-sm leading-relaxed sm:text-base">
        {children}
      </div>
    </section>
  )
}
