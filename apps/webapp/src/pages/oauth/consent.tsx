import { AppMark, AppTile } from '@components/ui/AppMark'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { modalPanelFrameClassName } from '@components/ui/Dialog'
import { GlobalDialog } from '@components/ui/GlobalDialog'
import { DocsPlusIcon, Icons } from '@icons'
import { useAuthStore } from '@stores'
import type { AuthError, OAuthAuthorizationDetails, OAuthRedirect } from '@supabase/supabase-js'
import { type AppTrust, appTrust } from '@utils/appTrust'
import { displayClientName } from '@utils/displayClientName'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import { supabaseClient } from '@utils/supabase'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { LuFilePlus } from 'react-icons/lu'
import { twMerge } from 'tailwind-merge'

// auth-js puts the id into the request path unencoded, so only path-safe ids pass.
const AUTHORIZATION_ID = /^[A-Za-z0-9_-]{1,128}$/
// Supabase refuses these schemes at registration. Checked again because we call assign().
// A blocklist, not an allowlist: native and MCP clients register custom-scheme redirects.
const BLOCKED_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:', 'file:', 'blob:', 'about:'])

// `openid` alone adds no words. `offline_access` goes in the disconnect line.
const IDENTITY_WORDS: [scope: string, words: string[]][] = [
  ['profile', ['name', 'profile picture']],
  ['email', ['email address']]
]
// Phone sign-up is off, so no account holds a number and `phone` shares nothing.
const SILENT_SCOPES = ['openid', 'offline_access', 'phone']
const HANDLED_SCOPES = new Set([...SILENT_SCOPES, ...IDENTITY_WORDS.map(([scope]) => scope)])
const listFormat = new Intl.ListFormat('en', { type: 'conjunction' })

type View =
  | { kind: 'loading' }
  | { kind: 'details'; details: OAuthAuthorizationDetails }
  | { kind: 'redirecting' }
  | { kind: 'invalid' }
  | { kind: 'unavailable' }

type Decision = 'approve' | 'deny'

function identityLine(scopes: string[]): string | null {
  const words = IDENTITY_WORDS.flatMap(([scope, list]) => (scopes.includes(scope) ? list : []))
  if (words.length) return `See your ${listFormat.format(words)}.`
  return scopes.includes('openid') ? 'Confirm who you are.' : null
}

// No error and no data is a broken answer, so it reads as unavailable.
function errorView(error: AuthError | null): View {
  return error?.status && error.status < 500 ? { kind: 'invalid' } : { kind: 'unavailable' }
}

/** Returns false for a scheme that could run script in this origin. */
function assignRedirect(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  // The parser strips tabs and newlines as the browser does, so `java\tscript:` is caught.
  if (BLOCKED_PROTOCOLS.has(parsed.protocol)) return false
  window.location.assign(parsed.href)
  return true
}

function followRedirect(url: string): View {
  return assignRedirect(url) ? { kind: 'redirecting' } : { kind: 'invalid' }
}

function isRedirect(data: OAuthAuthorizationDetails | OAuthRedirect): data is OAuthRedirect {
  return !('authorization_id' in data)
}

const OAuthConsentPage = () => {
  const router = useRouter()
  const authLoading = useAuthStore((state) => state.loading)
  const session = useAuthStore((state) => state.session)
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [busy, setBusy] = useState<Decision | null>(null)
  // A second details call answers 400, so StrictMode's replayed effect must not send one.
  const requestedRef = useRef(false)

  const rawId = router.query.authorization_id
  const authorizationId = typeof rawId === 'string' && AUTHORIZATION_ID.test(rawId) ? rawId : null
  const signedOut = router.isReady && authorizationId !== null && !authLoading && !session

  useEffect(() => {
    if (!router.isReady) return
    if (!authorizationId) {
      setView({ kind: 'invalid' })
      return
    }
    if (authLoading || !session || requestedRef.current) return
    requestedRef.current = true

    supabaseClient.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (error || !data) {
        setView(errorView(error))
        return
      }
      if (isRedirect(data)) {
        setView(followRedirect(data.redirect_url))
        return
      }
      setView({ kind: 'details', details: data })
    })
  }, [router.isReady, authorizationId, authLoading, session])

  const decide = async (action: Decision) => {
    if (!authorizationId || busy) return
    setBusy(action)
    const oauth = supabaseClient.auth.oauth
    const { data, error } =
      action === 'approve'
        ? await oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
        : await oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true })
    if (error || !data?.redirect_url) {
      setBusy(null)
      setView(errorView(error))
      return
    }
    setView(followRedirect(data.redirect_url))
  }

  let content: ReactNode
  if (signedOut && view.kind === 'loading') {
    content = (
      <StatusCard
        title="Connect an app to docs.plus"
        body="An app wants to use your docs.plus account. Sign in to see which app is asking.">
        <Button
          type="button"
          variant="primary"
          shape="block"
          className="mt-6 min-h-12"
          onClick={() => openInlineSignInDialog({ returnTo: router.asPath })}>
          Sign in
        </Button>
      </StatusCard>
    )
  } else if (view.kind === 'details') {
    content = <ConsentCard details={view.details} busy={busy} onDecide={decide} />
  } else if (view.kind === 'redirecting') {
    content = (
      <StatusCard
        title="Returning you to the app"
        body="You can close this tab if the app has opened.">
        <span className="loading loading-spinner text-primary mt-6" aria-hidden />
      </StatusCard>
    )
  } else if (view.kind === 'invalid') {
    content = (
      <StatusCard
        title="This request has ended"
        body="The link is missing, has expired, or was already used. Go back to the app and connect again."
      />
    )
  } else if (view.kind === 'unavailable') {
    content = (
      <StatusCard
        title="We couldn’t load this request"
        body="docs.plus could not reach the sign-in service. Try again in a moment.">
        <Button
          type="button"
          variant="primary"
          shape="block"
          className="mt-6 min-h-12"
          onClick={() => router.reload()}>
          Try again
        </Button>
      </StatusCard>
    )
  } else {
    content = (
      <div className={twMerge(modalPanelFrameClassName, 'flex w-full justify-center px-6 py-10')}>
        <span className="loading loading-spinner text-primary" aria-label="Loading" />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Connect an app — docs.plus</title>
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
        <Icons.lock size={22} className="text-base-content/40" aria-hidden />
      </div>
      <h1 className="text-base-content text-lg font-semibold">{title}</h1>
      <p className="text-base-content/70 mt-2 text-sm">{body}</p>
      {children}
    </div>
  )
}

// A brand mark only for a verified app; the name alone could be anyone's.
function TrustTile({ trust }: { trust: AppTrust }) {
  if (trust.kind === 'known') return <AppMark app={trust.app} size={24} className="size-12" />
  return (
    <AppTile className="size-12">
      {trust.kind === 'local' ? (
        <Icons.monitor size={22} />
      ) : (
        <Icons.alert size={22} className="text-warning" />
      )}
    </AppTile>
  )
}

// Trust follows the redirect URI. The name is the app's own claim, so it stays in quotes.
function TrustLine({ trust }: { trust: AppTrust }) {
  if (trust.kind === 'known') {
    return (
      <p className="text-base-content/60 mt-6 flex items-center justify-center gap-2 text-xs">
        <Icons.lock size={14} aria-hidden />
        <span>
          Returns you to <span className="text-base-content font-mono">{trust.host}</span>
        </span>
      </p>
    )
  }
  if (trust.kind === 'local') {
    return (
      <p className="text-base-content/70 mt-6 flex items-start gap-2 text-xs">
        <Icons.monitor size={14} className="text-warning mt-0.5 shrink-0" aria-hidden />
        <span>
          Returns you to{' '}
          <span className="text-base-content font-mono break-all">{trust.origin}</span>, an app on
          this computer. Allow it only if you just started it.
        </span>
      </p>
    )
  }
  return (
    <div role="note" className="alert alert-soft alert-warning mt-6 items-start text-sm">
      <Icons.alert size={18} className="text-warning mt-0.5 shrink-0" aria-hidden />
      <span className="text-base-content">
        docs.plus has not checked this app. It will send you to{' '}
        <span className="font-mono break-all">{trust.origin}</span>. Allow it only if you trust it.
      </span>
    </div>
  )
}

function ConsentCard({
  details,
  busy,
  onDecide
}: {
  details: OAuthAuthorizationDetails
  busy: Decision | null
  onDecide: (action: Decision) => void
}) {
  const profile = useAuthStore((state) => state.profile)
  const scopes = details.scope.split(/\s+/).filter(Boolean)
  const trust = appTrust(details.redirect_uri)
  const identity = identityLine(scopes)
  const otherScopes = scopes.filter((scope) => !HANDLED_SCOPES.has(scope))

  return (
    <div className={twMerge(modalPanelFrameClassName, 'flex w-full flex-col px-6 py-8 sm:px-8')}>
      <div className="flex items-center justify-center gap-3">
        <TrustTile trust={trust} />
        <Icons.link size={16} className="text-base-content/50" aria-hidden />
        <AppTile className="size-12">
          <DocsPlusIcon size={24} />
        </AppTile>
      </div>

      <h1 className="text-base-content mt-5 text-center text-lg font-semibold text-balance [overflow-wrap:anywhere]">
        {trust.kind === 'known' ? (
          `Allow ${trust.name} to use your docs.plus account?`
        ) : (
          <>
            Allow “<bdi>{displayClientName(details.client.name)}</bdi>” to use your docs.plus
            account?
          </>
        )}
      </h1>

      <div className="border-base-300 mx-auto mt-3 flex w-fit max-w-full items-center gap-2 rounded-full border py-1 pr-3 pl-1">
        <Avatar face={profile} size="xs" clickable={false} edge="none" />
        <span className="text-base-content/70 truncate text-sm">{details.user.email}</span>
      </div>

      <h2 className="text-base-content/70 mt-6 text-sm font-medium">It will be able to</h2>
      <ul className="mt-3 space-y-3">
        <li className="text-base-content flex items-start gap-3 text-sm">
          <Icons.eye size={18} className="text-base-content/60 mt-0.5 shrink-0" aria-hidden />
          Read the documents you can open, and their chat.
        </li>
        <li className="text-base-content flex items-start gap-3 text-sm">
          <LuFilePlus size={18} className="text-base-content/60 mt-0.5 shrink-0" aria-hidden />
          Create documents. A new document is public, like any docs.plus document.
        </li>
        <li className="text-base-content flex items-start gap-3 text-sm">
          <Icons.pencil size={18} className="text-base-content/60 mt-0.5 shrink-0" aria-hidden />
          Edit and post in chat only in documents you own.
        </li>
        {identity && (
          <li className="text-base-content flex items-start gap-3 text-sm">
            <Icons.user size={18} className="text-base-content/60 mt-0.5 shrink-0" aria-hidden />
            {identity}
          </li>
        )}
        {otherScopes.map((scope) => (
          <li key={scope} className="text-base-content flex items-start gap-3 text-sm">
            <Icons.info size={18} className="text-base-content/60 mt-0.5 shrink-0" aria-hidden />
            <span className="[overflow-wrap:anywhere]">Use the “{scope}” permission.</span>
          </li>
        ))}
      </ul>

      <TrustLine trust={trust} />

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="ghost"
          className="border-base-300 min-h-12 border"
          loading={busy === 'deny'}
          disabled={busy !== null}
          onClick={() => onDecide('deny')}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          className="min-h-12"
          loading={busy === 'approve'}
          disabled={busy !== null}
          onClick={() => onDecide('approve')}>
          Allow
        </Button>
      </div>

      <p className="text-base-content/60 mt-4 text-center text-xs">
        {scopes.includes('offline_access')
          ? 'It stays connected until you disconnect it in '
          : 'You can disconnect it any time in '}
        <Link
          href="/#settings?tab=connected-apps"
          target="_blank"
          rel="noopener noreferrer"
          className="link link-primary">
          Settings › Connected apps
        </Link>
        .
      </p>
    </div>
  )
}

export default OAuthConsentPage
