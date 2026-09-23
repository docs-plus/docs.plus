import Button from '@components/ui/Button'
import { modalPanelFrameClassName } from '@components/ui/Dialog'
import { GlobalDialog } from '@components/ui/GlobalDialog'
import { DocsPlusIcon, Icons } from '@icons'
import { useAuthStore } from '@stores'
import type { AuthError, OAuthAuthorizationDetails, OAuthRedirect } from '@supabase/supabase-js'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import { supabaseClient } from '@utils/supabase'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

// auth-js puts the id into the request path unencoded, so only path-safe ids pass.
const AUTHORIZATION_ID = /^[A-Za-z0-9_-]{1,128}$/
const CLIENT_NAME_MAX = 80
// A redirect URI that does not parse is shown cut, never whole.
const REDIRECT_TEXT_MAX = 80
// Supabase refuses these schemes at registration. Checked again because we call assign().
// A blocklist, not an allowlist: native and MCP clients register custom-scheme redirects.
const BLOCKED_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:', 'file:', 'blob:', 'about:'])

const SCOPE_WORDS: Record<string, string> = {
  openid: 'Confirm who you are',
  email: 'See your email address',
  profile: 'See your name and profile picture',
  phone: 'See your phone number',
  offline_access: 'Stay connected while you are away'
}

type View =
  | { kind: 'loading' }
  | { kind: 'details'; details: OAuthAuthorizationDetails }
  | { kind: 'redirecting' }
  | { kind: 'invalid' }
  | { kind: 'unavailable' }

type Decision = 'approve' | 'deny'

// Directional overrides can make a self-chosen name read as another app.
function displayClientName(name: string): string {
  const clean = name.replace(/[\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu, '').trim()
  if (!clean) return 'Unnamed app'
  return clean.length > CLIENT_NAME_MAX ? `${clean.slice(0, CLIENT_NAME_MAX)}…` : clean
}

function redirectOrigin(uri: string): string {
  try {
    const url = new URL(uri)
    return url.origin !== 'null' ? url.origin : `${url.protocol}//${url.host}`
  } catch {
    return uri.slice(0, REDIRECT_TEXT_MAX)
  }
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

function ConsentCard({
  details,
  busy,
  onDecide
}: {
  details: OAuthAuthorizationDetails
  busy: Decision | null
  onDecide: (action: Decision) => void
}) {
  const scopes = details.scope.split(/\s+/).filter(Boolean)

  return (
    <div className={twMerge(modalPanelFrameClassName, 'flex w-full flex-col px-6 py-8 sm:px-8')}>
      <h1 className="text-base-content text-center text-lg font-semibold">
        Allow this app to use your docs.plus account?
      </h1>

      <section
        aria-label="Unverified app"
        className="border-warning/30 bg-warning/10 rounded-box mt-5 border p-4">
        <div className="flex items-center gap-2">
          <Icons.alert size={16} className="text-warning shrink-0" aria-hidden />
          <p className="text-base-content text-xs font-medium tracking-wide uppercase">
            Unverified app
          </p>
        </div>
        <p className="text-base-content mt-2 font-semibold [overflow-wrap:anywhere]">
          <bdi>{displayClientName(details.client.name)}</bdi>
        </p>
        <p className="text-base-content/70 mt-1 text-xs">
          Sends you back to{' '}
          <span className="text-base-content font-mono break-all">
            {redirectOrigin(details.redirect_uri)}
          </span>
        </p>
        <p className="text-base-content/70 mt-3 text-xs">
          Any app can register itself. docs.plus has not checked this one. Continue only if you
          started this from an app you trust.
        </p>
      </section>

      <h2 className="text-base-content mt-5 text-sm font-semibold">
        If you allow it, the app can:
      </h2>
      <ul className="text-base-content/80 mt-2 list-disc space-y-1 pl-5 text-sm">
        <li>Read documents you can open, and edit or post in documents you own.</li>
        {scopes.map((scope) => (
          <li key={scope}>{SCOPE_WORDS[scope] ?? `Use the “${scope}” permission`}</li>
        ))}
      </ul>

      <p className="text-base-content/70 mt-4 text-xs">
        To stop access, sign out of docs.plus. That ends every session, this app’s too. A token the
        app already holds can work for up to one hour.
      </p>
      <p className="text-base-content/60 mt-3 text-xs break-all">
        Signed in as <span className="text-base-content font-medium">{details.user.email}</span>
      </p>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
        <Button
          type="button"
          variant="ghost"
          className="min-h-12 flex-1"
          loading={busy === 'deny'}
          disabled={busy !== null}
          onClick={() => onDecide('deny')}>
          Deny
        </Button>
        <Button
          type="button"
          variant="primary"
          className="min-h-12 flex-1"
          loading={busy === 'approve'}
          disabled={busy !== null}
          onClick={() => onDecide('approve')}>
          Approve
        </Button>
      </div>
    </div>
  )
}

export default OAuthConsentPage
