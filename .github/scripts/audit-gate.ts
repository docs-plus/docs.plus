/**
 * Fails CI on unreviewed vulnerabilities from `bun audit --json`.
 *
 * Run: bun .github/scripts/audit-gate.ts <audit-results.json> [allowlist.json]
 * Threshold via AUDIT_FAIL_ON (critical | high | moderate | low), default critical.
 */
const SEVERITIES = ['critical', 'high', 'moderate', 'low'] as const
type Severity = (typeof SEVERITIES)[number]

interface Advisory {
  id?: number
  url?: string
  title?: string
  severity?: string
  vulnerable_versions?: string
}

interface AllowlistEntry {
  /** Worst severity this entry accepts. Anything above it still fails the gate. */
  severity: Severity
  reason: string
  reviewed: string
}

const [, , resultsPath = 'audit-results.json', allowlistPath = '.github/audit-allowlist.json'] =
  Bun.argv

const readJson = async (path: string): Promise<unknown | null> => {
  const file = Bun.file(path)
  if (!(await file.exists())) return null
  try {
    return await file.json()
  } catch {
    return null
  }
}

const raw = await readJson(resultsPath)

// `bun pm audit` (not a command) prints help text, which parses as nothing. Any
// non-object here means the audit did not run. A gate that cannot see its input must
// fail rather than report zero, because that is how this gate died before.
if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
  console.error(`::error::${resultsPath} is missing or not a JSON object — the audit did not run.`)
  process.exit(1)
}

const report = raw as Record<string, unknown>

// Bun keys the report by package name. A `vulnerabilities` summary object is the
// OLD shape; seeing it means Bun changed the format back and the walk below is
// silently counting nothing.
if ('vulnerabilities' in report) {
  console.error('::error::audit JSON has a `vulnerabilities` key — the output shape changed.')
  process.exit(1)
}

const allowlist = ((await readJson(allowlistPath)) ?? {}) as Record<string, AllowlistEntry>
const ghsaOf = (advisory: Advisory): string =>
  advisory.url?.match(/GHSA-[0-9a-z-]+/i)?.[0] ?? String(advisory.id ?? '')

const active: { pkg: string; ghsa: string; severity: Severity; title: string }[] = []
const accepted: { pkg: string; ghsa: string; severity: string }[] = []
const unclassified: { pkg: string; ghsa: string; severity: string }[] = []

// `in` walks the prototype chain, so a package named `constructor` or `toString`
// would match an empty allowlist and be waved through as reviewed.
const entryFor = (ghsa: string, pkg: string): AllowlistEntry | undefined =>
  (ghsa !== '' && Object.hasOwn(allowlist, ghsa) ? allowlist[ghsa] : undefined) ??
  (Object.hasOwn(allowlist, pkg) ? allowlist[pkg] : undefined)

// An entry accepts only up to the severity it was reviewed at. Without this check a
// package waved through as "high" would silently absorb a future critical. Silent
// absorption would make a package key a permanent waiver rather than a reviewed exception.
const acceptsSeverity = (entry: AllowlistEntry, severity: string): boolean => {
  const ceiling = SEVERITIES.indexOf(String(entry.severity ?? '').toLowerCase() as Severity)
  const found = SEVERITIES.indexOf(severity as Severity)
  return ceiling >= 0 && found >= 0 && found >= ceiling
}

for (const [pkg, value] of Object.entries(report)) {
  if (pkg.startsWith('$')) continue
  for (const advisory of (Array.isArray(value) ? value : [value]) as Advisory[]) {
    if (!advisory || typeof advisory !== 'object') continue
    const severity = String(advisory.severity ?? '').toLowerCase()
    const ghsa = ghsaOf(advisory)
    // A package key accepts every advisory in it. A package key is the only workable form
    // for a dev-only package sitting at several majors at once. In that case a single
    // override would force one version onto consumers that cannot take it.
    const entry = entryFor(ghsa, pkg)
    if (entry && acceptsSeverity(entry, severity)) {
      accepted.push({ pkg, ghsa, severity })
      continue
    }
    if (entry) {
      console.log(
        `::warning::${pkg} is allowlisted at "${entry.severity}" but this advisory is "${severity}" — not accepted`
      )
    }
    // A severity this gate cannot rank is a severity it cannot clear. Dropping it
    // would report zero for an advisory nobody has seen — the exact failure the
    // shape guard above exists to prevent, one level further in.
    if ((SEVERITIES as readonly string[]).includes(severity)) {
      active.push({ pkg, ghsa, severity: severity as Severity, title: advisory.title ?? '' })
    } else {
      unclassified.push({ pkg, ghsa, severity: severity || '(absent)' })
    }
  }
}

const countBy = (severity: Severity) => active.filter((a) => a.severity === severity).length
const counts = Object.fromEntries(SEVERITIES.map((s) => [s, countBy(s)])) as Record<
  Severity,
  number
>

const failOn = (process.env.AUDIT_FAIL_ON ?? 'critical').toLowerCase() as Severity
const threshold = SEVERITIES.indexOf(failOn)
if (threshold < 0) {
  console.error(`::error::AUDIT_FAIL_ON must be one of ${SEVERITIES.join(', ')} (got "${failOn}")`)
  process.exit(1)
}

const blocking = active.filter((a) => SEVERITIES.indexOf(a.severity) <= threshold)

console.log(
  `Summary: ${SEVERITIES.map((s) => `${s}=${counts[s]}`).join(', ')}` +
    `${accepted.length > 0 ? ` (plus ${accepted.length} accepted via allowlist)` : ''}`
)
console.log(`Failing on: ${SEVERITIES.slice(0, threshold + 1).join(', ')}`)

for (const entry of blocking) {
  console.log(`::error::[${entry.severity}] ${entry.pkg} — ${entry.title} (${entry.ghsa})`)
}
for (const entry of active.filter((a) => !blocking.includes(a))) {
  console.log(`::warning::[${entry.severity}] ${entry.pkg} (${entry.ghsa})`)
}

if (unclassified.length > 0) {
  for (const entry of unclassified) {
    console.error(
      `::error::unrankable severity "${entry.severity}" on ${entry.pkg} (${entry.ghsa})`
    )
  }
  console.error(
    `::error::${unclassified.length} advisory(ies) carry a severity this gate cannot rank. ` +
      `Bun's severity vocabulary has changed; update SEVERITIES before trusting a pass.`
  )
  process.exit(1)
}

if (blocking.length > 0) {
  console.error(
    `::error::${blocking.length} unreviewed advisory(ies) at or above "${failOn}". ` +
      `Fix the dependency, or add the GHSA to ${allowlistPath} with a reason.`
  )
  process.exit(1)
}

console.log(`No unreviewed advisories at or above "${failOn}".`)
