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
import { isSafeHref } from '../utils/validateURL'

// The gate default, re-exported so callers take it from the decision module
// they already import rather than reaching into `utils/validateURL`.
export { isSafeHref }

/** Discriminated input to {@link URLDecisions.forWrite}. */
export type WriteInput =
  // `text` runs full extraction (returns 0..N).
  | { kind: 'text'; text: string }
  // `href` is an explicit user write — `shouldAutoLink` is NOT applied (returns 0..1).
  | { kind: 'href'; href: string }
  // `match` is a pre-detected linkify match (returns 0..1).
  | { kind: 'match'; match: LinkifyMatchLike }

export type WriteResult = {
  /** Canonical, gated, write-safe href ready to set on the mark. */
  href: string
  /** Source offset; `0` for `href`/`match` inputs. */
  start: number
  end: number
}

export type ReadDecision = {
  /** Passes the full gate (`isSafeHref` + `isAllowedUri`) — required before any `window.open`. */
  navigable: boolean
}

export type WriteOptions = {
  /** Per-call override of the controller's `validate`. */
  validate?: (url: string) => boolean
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

export function createURLDecisions(options: URLDecisionsOptions = {}): URLDecisions {
  const defaultProtocol = options.defaultProtocol ?? DEFAULT_PROTOCOL
  const gate = options.gate ?? isSafeHref

  /** Run the full gate stack used by autolink-flavored writes. */
  const passesAutoGates = (href: string, opts?: WriteOptions): boolean => {
    if (!gate(href)) return false
    const validate = opts?.validate ?? options.validate
    if (validate && !validate(href)) return false
    const veto = options.shouldAutoLink
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
        return [{ href, start: 0, end: input.href.length }]
      }

      if (input.kind === 'match') {
        const href = normalizeLinkifyHref(input.match, defaultProtocol)
        if (!passesAutoGates(href, opts)) return []
        return [{ href, start: 0, end: input.match.value.length }]
      }

      // kind === 'text' — full extraction.
      return findLinks(input.text)
        .filter((link) => link.isLink)
        .map((link) => ({
          href: normalizeLinkifyHref(link, defaultProtocol),
          start: link.start,
          end: link.end
        }))
        .filter((r) => passesAutoGates(r.href, opts))
    },

    forRead(rawHref) {
      const href = typeof rawHref === 'string' ? rawHref : ''
      // Defense-in-depth: a misconfigured `gate` that skips `isSafeHref`
      // still can't make an unsafe href navigable.
      return { navigable: isSafeHref(href) && gate(href) }
    },

    detect(text) {
      return findLinks(text).some((l) => l.isLink)
    }
  }
}
