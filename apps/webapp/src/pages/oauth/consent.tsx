import { HomepageLink, PageCard, PageCardIdentity, PageCardIdentityRow } from '@components/PageCard'
import { AppMark, AppTile } from '@components/ui/AppMark'
import { Avatar } from '@components/ui/Avatar'
import Button, { quietActionClassName } from '@components/ui/Button'
import { DialogActions } from '@components/ui/Dialog'
import { GlobalDialog } from '@components/ui/GlobalDialog'
import { Icons } from '@icons'
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
      <PageCard
        title="Connect an app to docs.plus"
        description="An app wants to use your docs.plus account. Sign in to see which app is asking."
        actions={<HomepageLink />}>
        <Button
          type="button"
          variant="primary"
          shape="block"
          onClick={() => openInlineSignInDialog({ returnTo: router.asPath })}>
          Sign in
        </Button>
      </PageCard>
    )
  } else if (view.kind === 'details') {
    content = <ConsentCard details={view.details} busy={busy} onDecide={decide} />
  } else if (view.kind === 'redirecting') {
    content = (
      <PageCard
        title="Returning you to the app"
        description="You can close this tab if the app has opened."
        actions={<HomepageLink />}>
        <span className="loading loading-spinner loading-sm text-base-content/70" aria-hidden />
      </PageCard>
    )
  } else if (view.kind === 'invalid') {
    content = (
      <PageCard
        title="This request has ended"
        description="The link is missing, has expired, or was already used. Go back to the app and connect again."
        actions={<HomepageLink />}
      />
    )
  } else if (view.kind === 'unavailable') {
    content = (
      <PageCard
        title="We couldn’t load this request"
        description="docs.plus could not reach the sign-in service. Try again in a moment."
        actions={<HomepageLink />}>
        <Button type="button" variant="primary" shape="block" onClick={() => router.reload()}>
          Try again
        </Button>
      </PageCard>
    )
  } else {
    content = (
      <PageCard title="Connect an app to docs.plus" actions={<HomepageLink />}>
        <p role="status" className="text-base-content/70 flex items-center gap-2 text-sm">
          <span className="loading loading-spinner loading-sm" aria-hidden />
          Loading…
        </p>
      </PageCard>
    )
  }

  return (
    <>
      <Head>
        <title>Connect an app — docs.plus</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      {content}
      <GlobalDialog />
    </>
  )
}

// A brand mark only for a verified app; the name alone could be anyone's.
function TrustTile({ trust }: { trust: AppTrust }) {
  if (trust.kind === 'known') return <AppMark app={trust.app} size={22} className="size-10" />
  return (
    <AppTile className="size-10">
      {trust.kind === 'local' ? (
        <Icons.monitor size={20} />
      ) : (
        <Icons.alert size={20} className="text-warning" />
      )}
    </AppTile>
  )
}

// Trust follows the redirect URI. The name is the app's own claim, so it stays in quotes.
function TrustMeta({ trust }: { trust: AppTrust }) {
  if (trust.kind === 'known') {
    return (
      <>
        <Icons.lock size={13} className="mr-1 inline align-[-2px]" aria-hidden />
        Returns you to <b className="text-base-content font-semibold">{trust.host}</b>
      </>
    )
  }
  if (trust.kind === 'local') {
    return (
      <>
        <Icons.monitor size={13} className="text-warning mr-1 inline align-[-2px]" aria-hidden />
        Returns you to <b className="text-base-content font-semibold">{trust.origin}</b>, an app on
        this computer. Allow it only if you just started it.
      </>
    )
  }
  return null
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
  const appName =
    trust.kind === 'known' ? (
      trust.name
    ) : (
      <>
        “<bdi>{displayClientName(details.client.name)}</bdi>”
      </>
    )

  return (
    <PageCard
      title={
        <span className="[overflow-wrap:anywhere]">
          Allow {appName} to use your docs.plus account?
        </span>
      }
      meta={
        <>
          {scopes.includes('offline_access')
            ? 'It stays connected until you disconnect it in '
            : 'You can disconnect it any time in '}
          <Link
            href="/#settings?tab=connected-apps"
            target="_blank"
            rel="noopener noreferrer"
            className={quietActionClassName}>
            Settings › Connected apps
          </Link>
          .
        </>
      }>
      <PageCardIdentity>
        <PageCardIdentityRow
          leading={<TrustTile trust={trust} />}
          name={appName}
          meta={trust.kind === 'unknown' ? undefined : <TrustMeta trust={trust} />}
        />
        <PageCardIdentityRow
          leading={<Avatar face={profile} size="md" clickable={false} edge="none" />}
          meta={details.user.email}
        />
      </PageCardIdentity>

      {trust.kind === 'unknown' && (
        <div role="note" className="alert alert-soft alert-warning items-start px-3 py-2 text-sm">
          <Icons.alert size={16} className="text-warning mt-0.5 shrink-0" aria-hidden />
          <span className="text-base-content min-w-0">
            <b className="font-semibold">Unverified app.</b> docs.plus has not checked this app. It
            returns you to <b className="font-semibold [overflow-wrap:anywhere]">{trust.origin}</b>.
            Allow it only if you trust it.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-meta text-base-content font-semibold">It will be able to</h2>
        <ul className="flex flex-col gap-3">
          <ScopeRow icon={<Icons.eye size={16} />}>
            Read the documents you can open, and their chat.
          </ScopeRow>
          <ScopeRow icon={<LuFilePlus size={16} />}>
            Create documents. A new document is public, like any docs.plus document.
          </ScopeRow>
          <ScopeRow icon={<Icons.pencil size={16} />}>
            Edit and post in chat only in documents you own.
          </ScopeRow>
          {identity && <ScopeRow icon={<Icons.user size={16} />}>{identity}</ScopeRow>}
          {otherScopes.map((scope) => (
            <ScopeRow key={scope} icon={<Icons.info size={16} />}>
              <span className="[overflow-wrap:anywhere]">Use the “{scope}” permission.</span>
            </ScopeRow>
          ))}
        </ul>
      </div>

      <DialogActions>
        <Button
          type="button"
          variant="cancel"
          loading={busy === 'deny'}
          disabled={busy !== null}
          onClick={() => onDecide('deny')}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          loading={busy === 'approve'}
          disabled={busy !== null}
          onClick={() => onDecide('approve')}>
          Allow
        </Button>
      </DialogActions>
    </PageCard>
  )
}

function ScopeRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="text-base-content flex items-start gap-3 text-sm">
      <span className="text-base-content/70 mt-0.5 shrink-0" aria-hidden>
        {icon}
      </span>
      {children}
    </li>
  )
}

export default OAuthConsentPage
