import {
  dropStalledClaim,
  IMPORTABLE_KINDS,
  type ReceiveOutcome,
  runSharedImport
} from '@components/pages/receive/receiveSharedFile'
import Button from '@components/ui/Button'
import { modalPanelFrameClassName } from '@components/ui/Dialog'
import { GlobalDialog } from '@components/ui/GlobalDialog'
import { DocsPlusIcon, Icons } from '@icons'
import { useAuthStore } from '@stores'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type View =
  | { kind: 'loading' }
  | { kind: 'working'; filename: string }
  | Exclude<ReceiveOutcome, { kind: 'opened' }>

/**
 * With no worker in control, the share POST reaches Next. Send it to the page,
 * which finds no stash and asks for the share again, instead of a bare 405.
 */
export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (req.method === 'POST') {
    return { redirect: { destination: '/receive?retry=1', statusCode: 303 } }
  }
  return { props: {} }
}

const ReceivePage = () => {
  const router = useRouter()
  const authLoading = useAuthStore((state) => state.loading)
  const signedIn = useAuthStore((state) => Boolean(state.session))
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const retryQuery = router.query.retry === '1'
  // One run at a time; StrictMode replays the effect, and a token refresh re-renders.
  const runningRef = useRef(false)

  useEffect(() => {
    if (!router.isReady || authLoading || runningRef.current) return
    runningRef.current = true

    // A throw outside the import try block must not leave the spinner up forever.
    runSharedImport((filename) => setView({ kind: 'working', filename }))
      .then((outcome) => {
        if (outcome.kind !== 'opened') setView(outcome)
      })
      .catch(() => {
        setView({ kind: 'failed', message: 'The import failed. Try again.', canRetry: true })
      })
      .finally(() => {
        runningRef.current = false
      })
  }, [router.isReady, retryQuery, authLoading, signedIn, attempt])

  const retry = () => {
    dropStalledClaim()
    setView({ kind: 'loading' })
    setAttempt((value) => value + 1)
  }

  let content: ReactNode
  if (view.kind === 'empty') {
    content = retryQuery ? (
      <StatusCard
        title="The file didn’t arrive"
        body="docs.plus was not ready to take the file. Open docs.plus once, then share the file again."
      />
    ) : (
      <StatusCard
        title="Nothing to import"
        body={`Share a ${IMPORTABLE_KINDS} file to docs.plus, and it opens here as a new document.`}
      />
    )
  } else if (view.kind === 'signed-out') {
    content = (
      <StatusCard
        title="Sign in to import this file"
        body={`${view.filename} becomes a new document in your account. Sign in, and it opens here.`}>
        <StatusAction onClick={() => openInlineSignInDialog({ returnTo: '/receive' })}>
          Sign in
        </StatusAction>
      </StatusCard>
    )
  } else if (view.kind === 'claimed') {
    content = (
      <StatusCard
        title="This file was already started"
        body="Check your documents before you try again, or you may get a second copy.">
        <StatusAction onClick={retry}>Try again</StatusAction>
      </StatusCard>
    )
  } else if (view.kind === 'failed') {
    content = (
      <StatusCard title="The file wasn’t imported" body={view.message}>
        {view.canRetry ? <StatusAction onClick={retry}>Try again</StatusAction> : null}
      </StatusCard>
    )
  } else {
    content = (
      <div
        className={twMerge(
          modalPanelFrameClassName,
          'flex w-full flex-col items-center gap-3 px-6 py-10'
        )}>
        <span className="loading loading-spinner text-primary" aria-hidden />
        <p className="text-base-content/70 text-sm" role="status">
          {view.kind === 'working' ? `Creating a document from ${view.filename}…` : 'Loading…'}
        </p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Import a file — docs.plus</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-[var(--pad-well)] px-4 py-8">
        <main className="flex w-full max-w-md flex-col items-center motion-safe:animate-[doc-region-in_220ms_ease-out_both]">
          <Link
            href="/"
            className="text-base-content mb-5 inline-flex items-center gap-2 no-underline"
            aria-label="docs.plus home">
            <DocsPlusIcon size={28} />
            <span className="text-lg font-bold tracking-tight">docs.plus</span>
          </Link>
          {content}
        </main>
        <GlobalDialog />
      </div>
    </>
  )
}

function StatusCard({
  title,
  body,
  children
}: {
  title: string
  body: string
  children?: ReactNode
}) {
  return (
    <div
      className={twMerge(
        modalPanelFrameClassName,
        'flex w-full flex-col items-center px-6 py-8 text-center sm:px-8'
      )}>
      <div className="bg-base-200 mb-3 flex size-12 items-center justify-center rounded-full">
        <Icons.fileText size={22} className="text-base-content/40" aria-hidden />
      </div>
      <h1 className="text-base-content text-lg font-semibold">{title}</h1>
      <p className="text-base-content/70 mt-2 text-sm [overflow-wrap:anywhere]">{body}</p>
      {children}
    </div>
  )
}

function StatusAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button
      type="button"
      variant="primary"
      shape="block"
      className="mt-6 min-h-12"
      onClick={onClick}>
      {children}
    </Button>
  )
}

export default ReceivePage
