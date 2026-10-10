# Owner UI/UX Direction

This is durable owner context for AI and maintainers. Apply it only when work touches user-facing UI/UX. It is a directional compass, not a mandate to redesign working screens. Repository-local design systems, product rules, architecture, tests, accessibility requirements, and safety constraints remain authoritative.

## Direction

- Prefer an Apple-inspired feel: calm, clear, premium, and information-first.
- Use strong typography, generous spacing, restrained color, subtle surfaces, obvious hierarchy, progressive disclosure, and minimal visual noise.
- Prefer small, local, reversible improvements. Reuse existing components and styles. Improve typography and spacing before structural rewrites.
- Keep one clear primary action where practical, use human-readable language, and preserve coherent desktop/mobile information hierarchy.

## Safety

- Preserve working behavior, domain rules, data/evidence integrity, accessibility, compatibility, tests, and established architecture.
- Correctness and reliability outrank visual polish.
- Do not broadly rewrite stable UI or code solely for visual consistency.
- Avoid unnecessary DOM, data, or business-logic changes, excessive blur/glass effects/animation, or hiding important information.
- Do not clean up stable, understandable, tested code merely because it looks old.
- If the desired appearance requires significant structural change or creates meaningful breakage risk, treat it as a separate proposal and obtain approval before implementation.

Priority: correctness > domain/data integrity > reliability > usability > visual polish.

If this repository has no user-facing UI, this guidance is dormant and requires no action.
