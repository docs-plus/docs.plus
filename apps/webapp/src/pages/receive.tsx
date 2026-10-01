import { HomepageLink, PageCard } from '@components/PageCard'
import {
  dropStalledClaim,
  IMPORTABLE_KINDS,
  type ReceiveOutcome,
  runSharedImport
} from '@components/pages/receive/receiveSharedFile'
import Button from '@components/ui/Button'
import { GlobalDialog } from '@components/ui/GlobalDialog'
import { useAuthStore } from '@stores'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { type ReactNode, useEffect, useRef, useState } from 'react'

type CardContent = { title: string; body?: string; content?: ReactNode }

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

  let card: CardContent
  if (view.kind === 'empty') {
    card = retryQuery
      ? {
          title: 'The file didn’t arrive',
          body: 'docs.plus was not ready to take the file. Open docs.plus once, then share the file again.'
        }
      : {
          title: 'Nothing to import',
          body: `Share a ${IMPORTABLE_KINDS} file to docs.plus, and it opens here as a new document.`
        }
  } else if (view.kind === 'signed-out') {
    card = {
      title: 'Sign in to import this file',
      body: `${view.filename} becomes a new document in your account. Sign in, and it opens here.`,
      content: (
        <StatusAction onClick={() => openInlineSignInDialog({ returnTo: '/receive' })}>
          Sign in
        </StatusAction>
      )
    }
  } else if (view.kind === 'claimed') {
    card = {
      title: 'This file was already started',
      body: 'Check your documents before you try again, or you may get a second copy.',
      content: <StatusAction onClick={retry}>Try again</StatusAction>
    }
  } else if (view.kind === 'failed') {
    card = {
      title: 'The file wasn’t imported',
      body: view.message,
      content: view.canRetry ? <StatusAction onClick={retry}>Try again</StatusAction> : null
    }
  } else {
    card = {
      title: 'Import a file',
      content: (
        <p role="status" className="text-base-content/70 flex items-center gap-2 text-sm">
          <span className="loading loading-spinner loading-sm shrink-0" aria-hidden />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {view.kind === 'working' ? `Creating a document from ${view.filename}…` : 'Loading…'}
          </span>
        </p>
      )
    }
  }

  return (
    <>
      <Head>
        <title>Import a file — docs.plus</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageCard
        title={card.title}
        description={card.body && <span className="[overflow-wrap:anywhere]">{card.body}</span>}
        actions={<HomepageLink />}>
        {card.content}
      </PageCard>
      <GlobalDialog />
    </>
  )
}

function StatusAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="primary" shape="block" onClick={onClick}>
      {children}
    </Button>
  )
}

export default ReceivePage
