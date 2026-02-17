# docs.plus — Light & Dark Theme Specification

> **Version:** 3.0.0
> **Date:** 2026-02-17
> **Owners:** Engineering × UI/UX
> **Depends on:** [Design_System_Global_v2.md](./Design_System_Global_v2.md) (v3.2.0)

---

## 1. Product Context

docs.plus is an **open-source collaborative document editor** — a direct alternative to Google Docs. This heritage shapes every color decision:

- **Canvas white matches Google Docs** — soft white (`#fafbfc`) instead of pure white, reducing eye strain during long editing sessions
- **Primary blue is Google Docs blue** — `#1a73e8`, the same hex Google uses. Familiar, trusted, professional
- **Content-first hierarchy** — the document canvas is the hero; chrome (toolbars, sidebars) stays quiet at `base-200`
- **No elevation shadows** (`--depth: 0`) — borders separate elements, matching Google Docs and Notion's flat design

Three themes: **`docsplus`** (light, default), **`docsplus-dark`** (dark), and **`docsplus-dark-hc`** (dark high-contrast — projector-optimized).

**Current state:**

| Area | Status | Notes |
|------|--------|-------|
| Theme definition (CSS variables) | ✅ Mature | All 3 themes fully defined in `globals.scss` |
| Shape system (radius, border, depth) | ✅ Consistent | Identical between light/dark; HC uses `--border: 2px` |
| Overlay components (dark mode) | ✅ Compliant | Dialog, ContextMenu, HoverMenu, Toast, Tooltip all theme-safe (§7.6, §7.7) |
| Theme toggle (app-wide) | ✅ Complete | Four-state preference (Light / System / Dark / Dark HC) in Settings → Appearance |
| Theme persistence (localStorage) | ✅ Complete | Zustand store with `localStorage` persistence, anti-FOUC inline script |
| Component library (daisyUI classes) | ⚠️ Partial | ~54 TSX files still use hardcoded Tailwind palette or hex colors (reduced — chatroom components, `ProviderSyncStatus`, `FilterBar`, `Tabs`, `ShareModal` migrated to semantic tokens in v1.9.0) |
| SCSS stylesheets | ⚠️ Significant debt | ~108 hex codes in `globals.scss`, ~60+ in partials |

---

## 2. Architecture

### 2.1 How Themes Are Defined

Themes are daisyUI 5 `@plugin` blocks in `packages/webapp/src/styles/globals.scss`:

```
globals.scss (single source of truth)
├── @plugin 'daisyui/theme' { name: 'docsplus'; default: true }          ← light
├── @plugin 'daisyui/theme' { name: 'docsplus-dark'; prefersdark: true } ← dark
├── @plugin 'daisyui/theme' { name: 'docsplus-dark-hc' }                 ← dark high-contrast (projectors)
└── :root { --font-family; --color-docsy; --caret-color }                ← globals
```

DaisyUI resolves these into CSS custom properties on `[data-theme="docsplus"]`, `[data-theme="docsplus-dark"]`, and `[data-theme="docsplus-dark-hc"]`. Tailwind utilities (`bg-base-100`, `text-primary`, `border-base-300`) consume them automatically.

**Important:** The `dark:` variant is mapped to BOTH dark themes via `@custom-variant`:

```scss
@custom-variant dark (&:where(
  [data-theme="docsplus-dark"] *, [data-theme="docsplus-dark"],
  [data-theme="docsplus-dark-hc"] *, [data-theme="docsplus-dark-hc"]
));
```

This means `dark:bg-base-200` applies to both `docsplus-dark` and `docsplus-dark-hc`. The HC theme's own token values take care of the visual difference.

### 2.2 How the Theme Is Applied (Page Router)

```
_document.tsx (SSR)
└── <Html data-theme="docsplus">   ← ✅ Correct
```

The `data-theme` attribute on `<html>` selects the active theme. In Next.js Pages Router, this is set in `_document.tsx` (server-rendered, non-hydrated). There is currently no runtime theme switching in the main app.

### 2.3 Theme Switching (App-Wide — Implemented)

Theme switching is centralized in a Zustand store (`themeStore.ts`) with `localStorage` persistence:

```
themeStore.ts (single source of truth)
├── ThemePreference: 'light' | 'dark' | 'dark-hc' | 'system'
├── ResolvedTheme: 'docsplus' | 'docsplus-dark' | 'docsplus-dark-hc'
├── resolveTheme(preference) → ResolvedTheme
├── applyTheme(theme) → sets data-theme on <html>
└── OS listener → re-resolves when preference is 'system'
```

**Four-state preference model** (see §7.1 for rationale):

| Preference | Stored value | Resolved theme | Behavior |
|------------|-------------|----------------|----------|
| ☀️ Light | `"light"` | `docsplus` | Always light |
| 💻 System | `"system"` | Depends on OS | Follows `prefers-color-scheme` |
| 🌙 Dark | `"dark"` | `docsplus-dark` | Always dark |
| 🎯 Dark HC | `"dark-hc"` | `docsplus-dark-hc` | High contrast dark for projectors |

**Anti-FOUC inline script** in `_document.tsx` runs before React hydration:
```js
// Reads persisted Zustand state from localStorage and applies data-theme immediately
var p = (state.preference) || 'system';
var t = p==='dark-hc' ? 'docsplus-dark-hc'
      : p==='dark'    ? 'docsplus-dark'
      : p==='light'   ? 'docsplus'
      : matchMedia('(prefers-color-scheme:dark)').matches ? 'docsplus-dark' : 'docsplus';
```

Demo pages (`DesignSystemContext`, `ShowcaseLayout`, `design-system-docs/Header`) all delegate to the global `themeStore` — no duplicated state.

---

## 3. Color Palette — Light Theme (`docsplus`)

> `default: true` · `color-scheme: 'light'`

### 3.1 Surface Scale

| Token | Hex | Usage |
|-------|-----|-------|
| `base-100` | `#fafbfc` | Document canvas, cards, modals (soft white — matches Google Docs `#f8f9fa`) |
| `base-200` | `#f7f9fc` | Sidebars, app shell, subtle surfaces |
| `base-300` | `#e5eaf1` | Borders, dividers, inset areas |
| `base-content` | `#0f172a` | Primary text (slate-900) |

### 3.2 Brand & Semantic Colors

| Role | Token | Hex | Content | Purpose |
|------|-------|-----|---------|---------|
| **Primary** | `primary` | `#1a73e8` | `#ffffff` | CTAs, links, brand blue (= Google Docs blue) |
| **Secondary** | `secondary` | `#0f9d7a` | `#06261e` | Presence, collaboration (teal) |
| **Accent** | `accent` | `#eab308` | `#1c1917` | Highlights, bookmarks (gold) |
| **Neutral** | `neutral` | `#334155` | `#f8fafc` | Chrome, icons, secondary UI |

### 3.3 Status Colors

| Role | Token | Hex | Content |
|------|-------|-----|---------|
| **Info** | `info` | `#0284c7` | `#f0f9ff` |
| **Success** | `success` | `#16a34a` | `#052e16` |
| **Warning** | `warning` | `#ea580c` | `#1c1917` |
| **Error** | `error` | `#dc2626` | `#ffffff` |

### 3.4 Shape System

| Token | Value | Use |
|-------|-------|-----|
| `--radius-selector` | `0.5rem` (8px) | Buttons, chips, badges |
| `--radius-field` | `0.5rem` (8px) | Inputs, selects |
| `--radius-box` | `1rem` (16px) | Cards, panels, modals |
| `--border` | `1px` | Default border width |
| `--depth` | `0` | No shadows (borders preferred) |
| `--noise` | `0` | No texture |

### 3.5 Opacity Scale

Tailwind's `/N` alpha modifier is used for all transparency. We standardize on **ten stops** (derived from a codebase audit of ~450 usages) to keep visual hierarchy consistent without proliferation.

#### Background Tints (on semantic colors)

| Stop | Role | Example | Usage count |
|------|------|---------|-------------|
| `/5` | Micro-tint | `bg-primary/5` — barely-there wash | ~6 |
| `/10` | **Standard tint** | `bg-primary/10`, `bg-info/10`, `bg-success/10` | **~48** |
| `/15` | Tint hover | `hover:bg-primary/15` — interactive state on `/10` | ~3 |
| `/20` | Medium wash | `bg-primary/20` (chat bubble owner), `bg-neutral/20` | ~15 |

#### Structural (overlays, focus, dividers)

| Stop | Role | Example | Usage count |
|------|------|---------|-------------|
| `/30` | Focus ring | `ring-primary/30` | ~9 |
| `/40` | Backdrop | `bg-base-content/40` (modal overlay) | ~1 |

#### Text Emphasis (on `base-content`)

| Stop | Role | Example | Usage count |
|------|------|---------|-------------|
| `/40` | Disabled / muted | Disabled labels, inactive icons | ~46 |
| `/50` | Placeholder / tertiary | Placeholder text, section labels | **~87** |
| `/60` | **Secondary text** | Subtitles, icon defaults, timestamps | **~115** |
| `/70` | De-emphasized | Readable but not primary | ~53 |
| `/80` | Strong variant | High emphasis where `base-content` is too heavy | ~10 |

#### Solid Modifiers

| Stop | Role | Example | Usage count |
|------|------|---------|-------------|
| `/90` | Hover on solids | `hover:bg-neutral/90` — darkens a solid fill on hover | ~3 |

**Rules:**
1. **Stick to these stops** — if `/55` seems right, use `/50` or `/60`
2. **Backgrounds use low stops** (`/5` – `/30`) so overlaid text remains readable
3. **Text uses high stops** (`/40` – `/80`) to meet contrast requirements
4. **`/40` is the floor** for any visible text (pairs with `base-content` at ~6:1 on `base-100`)
5. The scale is **theme-agnostic** — alpha values work on theme-aware base colors, so the same class works in both light and dark mode

> **Industry comparison:** Material Design 3 uses three tiers: high emphasis (87%), medium (60%), disabled (38%). Our ten-stop scale is more granular but maps cleanly — MD's *medium* → our `/60`, MD's *disabled* → our `/40`. The extra stops (`/10`–`/30`) serve the tinted-background pattern that Material calls "surface tint," which we express directly as `bg-primary/10` rather than an elevation overlay.

---

## 4. Color Palette — Dark Theme (`docsplus-dark`)

> `prefersdark: true` · `color-scheme: 'dark'`

### 4.1 Surface Scale

| Token | Hex | Usage |
|-------|-----|-------|
| `base-100` | `#0b1220` | Deep blue-black canvas |
| `base-200` | `#0f172a` | Elevated surfaces |
| `base-300` | `#2d3f57` | Borders, dividers (1.75:1 vs canvas — matches GitHub Dark) |
| `base-content` | `#e5e7eb` | Primary text (soft white) |

> **Changed in v3.0:** `base-300` was lifted from `#1e293b` (1.28:1) to `#2d3f57` (1.75:1) to improve border visibility. The previous value was at the bottom of the industry range; the new value matches GitHub Dark's border ratio.

### 4.2 Brand & Semantic Colors

| Role | Token | Hex | Content | Notes |
|------|-------|-----|---------|-------|
| **Primary** | `primary` | `#6ea8ff` | `#0b1220` | Softened for dark backgrounds |
| **Secondary** | `secondary` | `#2fbf9b` | `#071a14` | Calm teal |
| **Accent** | `accent` | `#e3b341` | `#0b1220` | Warm gold |
| **Neutral** | `neutral` | `#8b9bb0` | `#0b1220` | Muted gray-blue |

### 4.3 Status Colors

| Role | Token | Hex | Content |
|------|-------|-----|---------|
| **Info** | `info` | `#38bdf8` | `#07131f` |
| **Success** | `success` | `#22c55e` | `#071a14` |
| **Warning** | `warning` | `#fb7a3a` | `#0b1220` |
| **Error** | `error` | `#ff6b6b` | `#0b1220` |

### 4.4 Shape System

Identical to light — see §3.4. Shape tokens are theme-agnostic by design.

---

## 4B. Color Palette — Dark High Contrast Theme (`docsplus-dark-hc`)

> `prefersdark: false` · `color-scheme: 'dark'`

**Purpose:** Optimized for projection in dim classrooms, low-quality LCD panels, and accessibility needs. Wider surface scale, brighter borders (2.36:1), thicker strokes (`--border: 2px`), brighter semantic colors.

### 4B.1 Surface Scale

| Token | Hex | Ratio vs canvas | Usage |
|-------|-----|----------------|-------|
| `base-100` | `#0f172a` | — | Canvas (slate-900, lifted from regular dark) |
| `base-200` | `#1e293b` | 1.22:1 | Surfaces (slate-800, clear step-up) |
| `base-300` | `#475569` | **2.36:1** | Borders (slate-600 — projector-safe) |
| `base-content` | `#f1f5f9` | **16.30:1** | Text (slate-100, near-white) |

### 4B.2 Brand & Semantic Colors

| Role | Token | Hex | Content | Notes |
|------|-------|-----|---------|-------|
| **Primary** | `primary` | `#7ab4ff` | `#0f172a` | Brighter blue (8.33:1) |
| **Secondary** | `secondary` | `#34d399` | `#071a14` | Emerald-400 (9.29:1) |
| **Accent** | `accent` | `#fbbf24` | `#0f172a` | Amber-400 (10.69:1) |
| **Neutral** | `neutral` | `#94a3b8` | `#0f172a` | Slate-400 (6.96:1) |

### 4B.3 Status Colors

| Role | Token | Hex | Content | Contrast on canvas |
|------|-------|-----|---------|-------------------|
| **Info** | `info` | `#38bdf8` | `#0f172a` | 8.33:1 |
| **Success** | `success` | `#34d399` | `#071a14` | 9.29:1 |
| **Warning** | `warning` | `#fb923c` | `#0f172a` | 7.89:1 |
| **Error** | `error` | `#f87171` | `#0f172a` | 6.45:1 |

### 4B.4 Shape System

| Token | Value | Notes |
|-------|-------|-------|
| `--border` | **`2px`** | Thicker than standard (1px) for projector visibility |
| `--radius-*` | Same as light/dark | Consistent rounding |
| `--depth` | `0` | Same as other themes |

### 4B.5 Projector Washout Simulation

Projectors in dim classrooms lift black levels by ~20-30%. Simulated with canvas washed to `#1f2a3e`:

| Element | HC Dark (screen) | HC Dark (projector sim) |
|---------|-----------------|------------------------|
| Body text on canvas | 16.30:1 ✅ | ~14.0:1 ✅ |
| Border vs canvas | 2.36:1 | ~1.90:1 |
| Primary on canvas | 8.33:1 ✅ | ~7.1:1 ✅ |

For comparison, the regular dark theme's borders drop to 1.17:1 under projector wash — effectively invisible. The HC theme maintains visible structure.

### 4B.6 Industry Comparison

| Theme | Border ratio | Text ratio | `--border` width |
|-------|-------------|------------|-----------------|
| docs.plus Dark | 1.75:1 | 15.12:1 | 1px |
| docs.plus Dark HC | **2.36:1** | **16.30:1** | **2px** |
| GitHub Dark | 1.55:1 | — | 1px |
| VS Code Dark+ | 1.51:1 | — | 1px |
| VS Code HC Dark | ~10:1 (colored borders) | — | 2px |

The HC theme strikes a balance between VS Code Dark+ (subtle) and VS Code HC Dark (aggressive colored borders). It stays within the docs.plus blue-slate design language while significantly improving visibility.

---

## 5. Contrast Ratios (Measured)

All ratios computed with the WCAG 2.x relative luminance algorithm. **These are real measurements, not estimates.**

### 5.1 Core Text — WCAG AA requires ≥ 4.5:1 for normal text

| Pair | Light | Dark | Verdict |
|------|-------|------|---------|
| `base-content` on `base-100` | **17.23:1** | **15.12:1** | ✅ Excellent |
| `base-content/60` on `base-100` | **~6.19:1** | **~5.93:1** | ✅ Pass AA |
| `neutral` on `base-100` | **9.99:1** | — | ✅ Pass AA |

### 5.2 Primary Color — The Google Docs Trade-Off

| Pair | Light | Dark | Verdict |
|------|-------|------|---------|
| `primary` on `base-100` | **4.35:1** | **7.76:1** | ⚠️ Light: see below |
| `primary-content` on `primary` | **4.51:1** | **7.76:1** | ✅ Pass AA |

**Light-mode primary on canvas: 4.35:1 — technically below the 4.5:1 AA threshold for normal text.**

This is a deliberate trade-off, consistent with industry practice:

| App | Primary Blue | Canvas | Contrast | Ships? |
|-----|-------------|--------|----------|--------|
| **Google Docs** | `#1a73e8` | `#ffffff` | 4.51:1 | Yes (borderline) |
| **docs.plus** | `#1a73e8` | `#fafbfc` | 4.35:1 | Yes |
| **Notion** | `#2383e2` | `#ffffff` | 3.88:1 | Yes (fails AA) |
| **GitHub** | `#0969da` | `#ffffff` | 5.19:1 | Yes (compliant) |

**Why we accept 4.35:1:**
1. It's the **same blue as Google Docs** — users expect this color in a doc editor
2. Primary color is used on **buttons** (large text, WCAG AA threshold is 3:1) and **underlined links** (not relying on color alone)
3. Our dark theme compensates with 7.76:1 (excellent)
4. Changing to a darker blue (e.g. `#1671d8` → 4.62:1) would break visual parity with Google Docs

**If strict AA compliance is required for body-sized primary text**, darken to `#166bce` (5.03:1). But this changes the brand identity.

### 5.3 Status Colors — Used as Backgrounds, Not Body Text

| Color | On `base-100` (Light) | Text Use |
|-------|-----------------------|----------|
| `error` (`#dc2626`) | **4.66:1** ✅ | Safe for error messages (passes AA) |
| `info` (`#0284c7`) | **3.95:1** | ✅ Large text / badges only (passes 3:1) |
| `warning` (`#ea580c`) | **3.44:1** | ✅ Large text / badges only (passes 3:1) |
| `success` (`#16a34a`) | **3.18:1** | ✅ Large text / badges only (passes 3:1) |

Status colors are primarily used as **background tints** (`bg-success/10`, `bg-info/10`) where the text is `base-content` (17.23:1 — excellent). They should NOT be used as body text color on the canvas.

### 5.4 Text-on-Status-Background (Content Colors)

| Pair | Contrast | Verdict |
|------|----------|---------|
| `error-content` on `error` | **4.83:1** | ✅ Pass AA |
| `warning-content` on `warning` | **4.91:1** | ✅ Pass AA |
| `success-content` on `success` | **4.52:1** | ✅ Pass AA |
| `info-content` on `info` | **3.84:1** | ⚠️ Passes AA Large only |

> `info-content` (#f0f9ff) on `info` (#0284c7) at 3.84:1 fails AA for small text. Use `#ffffff` for small text on info backgrounds, or use info only for badges/chips (large text).

---

## 6. Design Rationale

### 6.1 Why Soft White (`#fafbfc`) Instead of Pure White?

Pure white (`#ffffff`) maximizes contrast but causes eye strain during extended reading/writing sessions. Google Docs uses `#f8f9fa`, we use `#fafbfc` — both are "paper white" that feels natural under long exposure. The contrast difference is negligible (1.04:1 between them).

### 6.2 Why Deep Blue-Black (`#0b1220`) Instead of Pure Black?

Pure black (`#000000`) on OLED screens causes "black smearing" during scrolling. The deep blue-black is warmer, easier on the eyes, and consistent with the app's blue brand. This is the same approach as VS Code, GitHub Dark, and Slack.

### 6.3 Why Softer Primaries in Dark Mode?

Light-mode primary (`#1a73e8`) appears harsh and neon-like on dark canvas. Dark-mode primary (`#6ea8ff`) is softened to feel "calm" while achieving excellent 7.76:1 contrast. This follows Material Design's guidance on dark theme color adaptation.

### 6.4 Why `--depth: 0`?

docs.plus is a document editor — content is the hero. Elevation shadows add visual noise. We use borders (`border-base-300`) for separation, matching Google Docs and Notion.

### 6.5 Why Not CSS `color-scheme` Alone?

`color-scheme: dark` handles native controls (scrollbars, form elements) but not custom tokens. We need both: `color-scheme` on the `@plugin` block for native elements, and `data-theme` for daisyUI's CSS variables.

### 6.6 Theme Transition Motion

**Decision: Instant swap — no transition animation.**

When the user toggles between light and dark themes, the `data-theme` attribute changes in a single frame. All CSS custom properties update immediately. No cross-fade, no per-property easing.

**Why instant swap:**

| Factor | Reasoning |
|--------|-----------|
| Industry consensus | Google Docs (mobile dark mode), GitHub, Notion, VS Code, Slack — all use instant swap |
| Full-page repaint | Transitioning `background-color` + `color` on every DOM node creates a "swimming" effect that feels broken, not polished |
| Frequency | Users switch themes once per session at most — it's a preference, not an interaction. Animation adds no value |
| Performance | A blanket `transition: color 200ms, background-color 200ms` on `*` fires on **every** hover, focus, and state change, not just theme toggles. It conflicts with component-level transitions and adds layout thrash |

**What NOT to do:**

```css
/* ❌ Don't — this doesn't scope to theme changes and causes side effects everywhere */
* { transition: color 300ms ease, background-color 300ms ease; }
```

> Material Design recommends 300ms ease for "color scheme transitions," but this guidance targets native Android activities where the system can batch the repaint. On the web, CSS transitions on `*` are unscoped and affect all interactions — not just theme toggles. No major web-based productivity app follows this guidance.

**Connection to `prefers-reduced-motion` (§8.3):**

Since the theme toggle is instant, `prefers-reduced-motion` has no bearing on it. However, all *other* motion in the app (hover effects at `75ms`, panel slides at `300ms`, modal opens — per [Design_System_Global_v2.md §8.2](./Design_System_Global_v2.md)) MUST be suppressed under `prefers-reduced-motion: reduce`. If a future design calls for a brief theme cross-fade, it must also respect the reduced-motion query.

**Relationship to Global doc §8.2 animation tiers:**

| Tier | Duration | Applies to |
|------|----------|------------|
| Hover | `75ms` | Button/link hover states |
| UI transition | `150–200ms` | Toggles, dropdowns, tab switches |
| Panel/modal | `300ms` | Bottom sheets, dialogs, sidebars |
| **Theme change** | **0ms (instant)** | `data-theme` attribute swap |

---

## 7. Known Issues & Next Steps

### 7.1 ✅ App-Wide Theme Toggle (Four-State Preference) — Implemented 2026-02-17

**Four-state preference model** — extends the industry standard with a projector-optimized option:

| Preference | Stored value | Resolved theme | Behavior |
|------------|-------------|----------------|----------|
| ☀️ Light | `"light"` | `docsplus` | Always light, ignores OS setting |
| 💻 System | `"system"` | Depends on OS | Follows `prefers-color-scheme` media query |
| 🌙 Dark | `"dark"` | `docsplus-dark` | Always dark, ignores OS setting |
| 🎯 Dark HC | `"dark-hc"` | `docsplus-dark-hc` | High contrast dark for projectors/classrooms |

**Default: `"system"`** — respects the user's OS-level accessibility and comfort settings out of the box.

**Implementation (complete):**

| Component | File | Role |
|-----------|------|------|
| Zustand store | `stores/themeStore.ts` | Persists preference in `localStorage` (key: `docsplus-theme`) |
| Anti-FOUC script | `pages/_document.tsx` | Inline `<script>` reads localStorage before React hydration |
| Settings UI | `settings/components/AppearanceSection.tsx` | Four-option radio card selector |
| OS listener | `themeStore.ts` (bottom) | Re-resolves on `prefers-color-scheme` change when preference is `"system"` |
| Demo pages | `DesignSystemContext`, `ShowcaseLayout`, etc. | Delegate to global `themeStore` — no duplicated state |

> **Why four states, not three?** The HC option serves a specific but important use case: classrooms with projectors. Teachers presenting collaborative docs need borders and structure to remain visible on washed-out projector output. This is the same approach as VS Code (which ships both "Dark+" and "Dark High Contrast").

### 7.2 🔴 Hardcoded Colors in SCSS (~165 violations)

Legacy SCSS predates the theme system. All hardcoded colors break in dark mode.

| Priority | Files | Impact |
|----------|-------|--------|
| P0 | `_dialog.scss`, `_popover.scss`, `_tooltip.scss` | Overlays unusable in dark mode |
| P0 | `_blocks.scss` (editor canvas `$bg-root`) | Editor canvas breaks |
| P1 | `globals.scss` (tippy, hyperlink modals) | Link editing breaks |
| P1 | `_chat_editor.scss` (code blocks) | Chat code blocks break |
| P2 | `styles.scss` (dropdown menus, toolbars) | Secondary UI breaks |
| P3 | `_headings.scss`, `_mobile.scss` | Section breaks, mobile UI |

Remediation: boy-scout rule — fix as files are touched. See Appendix A for the migration lookup table.

### 7.3 ⚠️ Hardcoded Colors in TSX (~54 files)

Components using `bg-white`, `text-gray-*`, `bg-[#hex]` instead of semantic tokens.

```tsx
// ❌ Before
<div className="bg-white text-gray-600 border-gray-200">

// ✅ After
<div className="bg-base-100 text-base-content/60 border-base-300">
```

### 7.4 ⚠️ `:root` Variables Not Theme-Aware

```scss
:root {
  --color-docsy: #2778ff;   /* Always brand blue, even in dark mode */
  --caret-color: #2778ff;   /* Blue caret on dark blue canvas = poor visibility */
}
```

**Fix:** Replace with `caret-color: var(--color-primary)` in `.ProseMirror`, or move values into theme blocks.

### 7.5 ⚠️ PWA `theme-color` Is Static

```tsx
const THEME_COLOR = '#2778ff'  // Always brand blue, regardless of theme
```

**Fix:** Add a second meta tag:
```html
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b1220" />
```

### 7.6 ✅ Overlay Component Dark Mode Compliance (Fixed 2026-02-16)

Multiple overlay/floating components were invisible or poorly visible in dark mode because they lacked borders, used insufficient shadows, or used `base-100` (which matches the dark page background).

**What was fixed:**

| Component | Before (broken) | After (fixed) |
|-----------|----------------|---------------|
| `Dialog.tsx` | No border, `bg-white` | `bg-base-100 border border-base-300 shadow-xl` |
| `TocDesktop.tsx` (ContextMenu) | No border, no shadow | `border border-base-300 rounded-xl shadow-xl p-1.5` |
| `HoverMenu.tsx` | `bg-base-300 shadow-xs`, no border | `bg-base-200 border border-base-300 shadow-md rounded-lg` |
| `ToastNotification.tsx` | `dark:bg-base-100` (= page bg) | `dark:bg-base-200 dark:border-base-300 dark:border` |
| `Loading.tsx` (toast) | `dark:bg-base-100` (= page bg) | `dark:bg-base-200 dark:border-base-300 dark:border` |

**Root cause pattern:** In dark mode, `base-100` (`#0b1220`) is the deep blue-black canvas. Any overlay using `bg-base-100` without a border is effectively invisible against the page. `shadow-xs` and `shadow-sm` are also invisible on dark backgrounds because the dark surface absorbs the shadow.

**Rule (see Design System Global §6.5):** All overlays must use:
- `border border-base-300` — visible separator
- `bg-base-200` for inline overlays (menus, tooltips) or `bg-base-100` for modals/panels
- `shadow-xl` or `shadow-lg` — not `shadow-xs`/`shadow-sm`

### 7.7 ✅ Tooltip System Migrated from DaisyUI to Floating UI (Fixed 2026-02-16)

All DaisyUI CSS tooltips (`tooltip tooltip-top data-tip="..."`) across the project were migrated to the React-based Floating UI `<Tooltip>` component. This was necessary because:

1. **DaisyUI CSS tooltips can't flip/shift** — they overflow viewport edges and get clipped
2. **No portal** — they inherit parent `overflow: hidden` clipping
3. **Not disable-able on touch** — CSS `:hover` fires on tap on mobile, causing sticky tooltips
4. **No controlled state** — can't programmatically open/close

**Migration scope:** ~27 files migrated. Components with high tooltip density (`Button`, `Avatar`) now have built-in `tooltip` props to avoid external wrapping (DRY).

**ProseMirror exception:** Raw DOM elements in ProseMirror plugins (`selectionChatPlugin.ts`, `hoverChatPlugin.ts`) use native `title` attributes instead, as React components can't be rendered in raw DOM manipulation code.

---

## 8. Accessibility

### 8.1 Color Usage Rules

1. **Never rely on color alone** — always pair with text, icons, or patterns (WCAG 1.4.1)
2. **Status colors as backgrounds, not body text** — use `bg-success/10` with `text-base-content`, not `text-success` for paragraph text
3. **Error text is the exception** — `text-error` (4.66:1) passes AA and is the standard for form validation
4. **Links must be underlined or otherwise distinguishable** — `text-primary` alone is not enough if surrounded by `text-base-content` body text

### 8.2 Focus Indicators

All interactive elements must have visible focus rings:

```tsx
// daisyUI buttons handle this automatically
// For custom elements:
className="focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
```

Focus rings must be visible in BOTH themes. `ring-primary/30` adapts automatically because `primary` changes between themes.

### 8.3 Reduced Motion

Respect `prefers-reduced-motion`:

```scss
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Connection to theme switching (§6.6):** The theme toggle is already instant (0ms), so this rule has no effect on it. But all component-level motion (hover `75ms`, panel slides `300ms`, modal opens) is suppressed. If a future design adds a brief cross-fade on theme change, it MUST be gated behind this media query.

---

## 9. File Reference

| File | Role |
|------|------|
| `src/styles/globals.scss` | **Theme definitions** — 3 themes (light, dark, dark-hc) + `@custom-variant dark` mapping |
| `src/stores/themeStore.ts` | **Theme store** — Zustand + localStorage persistence, OS listener |
| `src/pages/_document.tsx` | Anti-FOUC inline script + `data-theme="docsplus"` default |
| `src/components/settings/components/AppearanceSection.tsx` | Four-option theme selector UI |
| `src/styles/styles.scss` | ProseMirror, popover, toolbar (needs migration) |
| `src/styles/_blocks.scss` | Editor canvas (needs migration) |
| `src/styles/_chat_editor.scss` | Chat code blocks (needs migration) |
| `src/styles/components/_toolbar.scss` | ✅ Already uses oklch tokens |
| `src/pages/_app.tsx` | App wrapper |

---

## Appendix A: Migration Reference Card

### Tailwind Classes (TSX Components)

| Hardcoded | → Semantic Token |
|-----------|-----------------|
| `bg-white` | `bg-base-100` |
| `bg-gray-50` / `bg-gray-100` | `bg-base-200` |
| `bg-gray-200` / `bg-gray-300` | `bg-base-300` |
| `text-black` | `text-base-content` |
| `text-gray-500` / `text-gray-600` | `text-base-content/60` |
| `text-gray-400` | `text-base-content/40` |
| `border-gray-200` / `border-gray-300` | `border-base-300` |
| `bg-blue-500` / `bg-blue-600` | `bg-primary` |
| `text-blue-600` | `text-primary` |
| `bg-red-*` | `bg-error` |
| `bg-[#hex]` | Map to nearest semantic token |

### SCSS (oklch Variables)

For SCSS files that can't use Tailwind classes, use daisyUI's oklch variables:

```scss
background-color: oklch(var(--b1));          // base-100
background-color: oklch(var(--b2));          // base-200
border-color: oklch(var(--b3));              // base-300
color: oklch(var(--bc));                     // base-content
color: oklch(var(--bc) / 0.6);              // base-content at 60%
background-color: oklch(var(--p));           // primary
color: oklch(var(--pc));                     // primary-content
background-color: oklch(var(--p) / 0.1);    // primary at 10%
```

### Hex Values in SCSS

| Hardcoded | → Semantic |
|-----------|-----------|
| `#fff` / `white` | `oklch(var(--b1))` |
| `#f8f9fa` / `#fafbfc` | `oklch(var(--b1))` |
| `#f7f9fc` / `#f1f3f5` | `oklch(var(--b2))` |
| `#e5eaf1` / `#e5e7eb` / `#dadce0` / `#ddd` | `oklch(var(--b3))` |
| `#0f172a` / `#0d0d0d` / `black` | `oklch(var(--bc))` |
| `#616161` / `#6b7280` | `oklch(var(--bc) / 0.6)` |
| `#adb5bd` / `#9ca3af` | `oklch(var(--bc) / 0.4)` |
| `#1a73e8` / `#2778ff` | `oklch(var(--p))` |
| `rgba(0,0,0,0.2)` | `oklch(var(--bc) / 0.2)` |
| `#eee` / `#f1f3f4` | `oklch(var(--b2))` |
