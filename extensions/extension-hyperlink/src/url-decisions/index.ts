// Single source of truth for every URL decision the extension makes.
// Composes the `utils/*` primitives (detect / normalize / gate) into
// `forWrite` (every write boundary) and `forRead` (every navigation
// surface) so drift becomes a compile error.

import { findLinks } from '../utils/findLinks'
import {
  DEFAULT_PROTOCOL,
  type LinkifyMatchLike,
  normalizeHref,
  normalizeLinkifyHref
} from '../utils/normalizeHref'
import { getSpecialUrlInfo, type SpecialUrlInfo } from '../utils/specialUrls'
import { DANGEROUS_SCHEME_RE, isSafeHref, validateURL } from '../utils/validateURL'

// Re-exported for ergonomic single-import consumption.
export { DANGEROUS_SCHEME_RE, isSafeHref, normalizeHref, validateURL }
export type { LinkifyMatchLike, SpecialUrlInfo }

// ===== Public types =====

/** Discriminated input to {@link URLDecisions.forWrite}. */
export type WriteInput =
  // `text` runs full extraction (returns 0..N).
  | { kind: 'text'; text: string }
  // `href` is an explicit user write — `shouldAutoLink` is NOT applied (returns 0..1).
  | { kind: 'href'; href: string }
  // `match` is a pre-detected linkify match (returns 0..1).
  | { kind: 'match'; match: LinkifyMatchLike }

export type WriteResultType = 'url' | 'email' | 'phone' | 'special'

export type WriteResult = {
  /** Canonical, gated, write-safe href ready to set on the mark. */
  href: string
  /** Raw source value (`text.slice(start, end)`). */
  value: string
  /** Source offset; `0` for `href`/`match` inputs. */
  start: number
  end: number
  type: WriteResultType
  /** Catalog match, or `null` for plain web URLs. */
  special: SpecialUrlInfo | null
}

export type ReadDecision = {
  /** Passes {@link isSafeHref} — safe to render. */
  safe: boolean
  /** Passes the full gate (`isSafeHref` + `isAllowedUri`) — required before any `window.open`. */
  navigable: boolean
  /** Echoed input, coerced to string. */
  href: string
  /** Catalog match; `null` when unsafe. */
  special: SpecialUrlInfo | null
}

export type WriteOptions = {
  /** Per-call override of the controller's `validate`. */
  validate?: (url: string) => boolean
  /** Per-call override of `shouldAutoLink`. Ignored for `kind: 'href'`. */
  shouldAutoLink?: (uri: string) => boolean
}

export type URLDecisionsOptions = {
  /** Bare-domain promotion target (e.g. `https`). */
  defaultProtocol?: string
  /** Composed safety + policy gate. Defaults to {@link isSafeHref}; compose via {@link composeGate}. */
  gate?: (href: string | null | undefined) => href is string
  validate?: (url: string) => boolean
  shouldAutoLink?: (uri: string) => boolean
}

export interface URLDecisions {
  /** Resolve a write candidate to its canonical, gated href(s). Returns `[]` when nothing passes. */
  forWrite(input: WriteInput, opts?: WriteOptions): WriteResult[]
  /** Read-side gate for render + navigation. */
  forRead(href: string | null | undefined): ReadDecision
  /**
   * Pure shape check — skips the gate stack on purpose so autolink's
   * "is the existing link still link-shaped?" cleanup pass can't be
   * weaponised by a tightened `isAllowedUri` policy.
   */
  detect(text: string): boolean
}

// ===== Gate composition =====

/** Context passed to a user-supplied `isAllowedUri` policy hook. Mirrors `@tiptap/extension-link`. */
export type IsAllowedUriContext<P = unknown> = {
  defaultValidate: (uri: string) => boolean
  protocols: Array<P>
  defaultProtocol: string
}

export type ComposeGateOptions<P = unknown> = {
  isAllowedUri?: (uri: string, ctx: IsAllowedUriContext<P>) => boolean
  protocols?: ReadonlyArray<P>
  defaultProtocol?: string
}

/**
 * Compose {@link isSafeHref} with a user-supplied `isAllowedUri` hook.
 * Wired at every write boundary so the safety floor (no dangerous
 * schemes) is impossible to bypass.
 */
export function composeGate<P = unknown>(
  opts: ComposeGateOptions<P> = {}
): (href: string | null | undefined) => href is string {
  const defaultProtocol = opts.defaultProtocol ?? DEFAULT_PROTOCOL
  const protocols = opts.protocols ?? []
  const userPolicy = opts.isAllowedUri
  return (href): href is string => {
    if (!isSafeHref(href)) return false
    if (!userPolicy) return true
    // Cast to mutable for `@tiptap/extension-link` parity — gate never mutates.
    return userPolicy(href, {
      defaultValidate: isSafeHref,
      protocols: protocols as Array<P>,
      defaultProtocol
    })
  }
}

// ===== Implementation =====

const STANDARD_WEB_SCHEME_RE = /^(https?|ftps?):/i

// `special` is hoisted by the caller so `getSpecialUrlInfo` runs once per write.
const classifyMatch = (
  match: LinkifyMatchLike,
  href: string,
  special: SpecialUrlInfo | null
): WriteResultType => {
  if (match.type === 'email') return 'email'
  if (match.type === 'phone') return 'phone'
  if (special && !STANDARD_WEB_SCHEME_RE.test(href)) return 'special'
  return 'url'
}

const classifyHref = (href: string, special: SpecialUrlInfo | null): WriteResultType => {
  if (/^mailto:/i.test(href)) return 'email'
  if (/^(tel|telprompt|sms|facetime|facetime-audio):/i.test(href)) return 'phone'
  if (special && !STANDARD_WEB_SCHEME_RE.test(href)) return 'special'
  return 'url'
}

export function createURLDecisions(options: URLDecisionsOptions = {}): URLDecisions {
  const defaultProtocol = options.defaultProtocol ?? DEFAULT_PROTOCOL
  const gate = options.gate ?? isSafeHref

  /** Run the full gate stack used by autolink-flavored writes. */
  const passesAutoGates = (href: string, opts?: WriteOptions): boolean => {
    if (!gate(href)) return false
    const validate = opts?.validate ?? options.validate
    if (validate && !validate(href)) return false
    const veto = opts?.shouldAutoLink ?? options.shouldAutoLink
    if (veto && !veto(href)) return false
    return true
  }

  return {
    forWrite(input, opts) {
      if (input.kind === 'href') {
        const trimmed = input.href.trim()
        if (!trimmed) return []
        const href = normalizeHref(trimmed, defaultProtocol)
        // Explicit-href path: full gate stack MINUS `shouldAutoLink` —
        // explicit writes are user intent, not autolink.
        if (!gate(href)) return []
        const validate = opts?.validate ?? options.validate
        if (validate && !validate(href)) return []
        const special = getSpecialUrlInfo(href)
        return [
          {
            href,
            value: input.href,
            start: 0,
            end: input.href.length,
            type: classifyHref(href, special),
            special
          }
        ]
      }

      if (input.kind === 'match') {
        const { match } = input
        const href = normalizeLinkifyHref(match, defaultProtocol)
        if (!passesAutoGates(href, opts)) return []
        const special = getSpecialUrlInfo(href)
        return [
          {
            href,
            value: match.value,
            start: 0,
            end: match.value.length,
            type: classifyMatch(match, href, special),
            special
          }
        ]
      }

      // kind === 'text' — full extraction.
      return findLinks(input.text)
        .filter((link) => link.isLink)
        .map((link) => {
          const href = normalizeLinkifyHref(link, defaultProtocol)
          const special = getSpecialUrlInfo(href)
          return {
            href,
            value: link.value,
            start: link.start,
            end: link.end,
            type: classifyMatch(link, href, special),
            special
          }
        })
        .filter((r) => passesAutoGates(r.href, opts))
    },

    forRead(rawHref) {
      const href = typeof rawHref === 'string' ? rawHref : ''
      const safe = isSafeHref(href)
      // Defense-in-depth: a misconfigured `gate` that skips `isSafeHref`
      // still can't make an unsafe href "navigable". When `safe` is
      // false we short-circuit — both the gate and the special-info
      // lookup are wasted work on an unrenderable href.
      if (!safe) return { safe: false, navigable: false, href, special: null }
      return {
        safe: true,
        navigable: gate(href),
        href,
        special: getSpecialUrlInfo(href)
      }
    },

    detect(text) {
      return findLinks(text).some((l) => l.isLink)
    }
  }
}
