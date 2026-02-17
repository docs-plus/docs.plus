# docs.plus Design System (Global)

> **Version:** 3.6.0
> **Last updated:** 2026-02-17
> **Owners:** UI/UX Team

This document defines **how docs.plus should look and behave** — visual foundations, layout patterns, component rules, interaction patterns, and accessibility requirements.

> Engineering-specific topics (tech stack, directory structure, TypeScript patterns, naming conventions) belong in a separate **Frontend Engineering Guidelines** document.

---

## 1. Product UI principles

1. **Content-first** — the editor is the hero; UI stays quiet.
2. **Minimal by default** — fewer borders, fewer colors, fewer "clever" visuals.
3. **Consistent patterns** — no one-off components.
4. **Mobile-first** — it must work on small screens first.
5. **Fast feedback** — short transitions, clear states.
6. **Accessible** — keyboard usable, readable contrast.

---

## 2. Styling rules (non‑negotiable)

### 2.1 — Use daisyUI for visuals

For anything that affects **look and feel** (color, radius, components):

✅ **Use** daisyUI semantic tokens and component classes:
- Colors: `bg-base-*`, `text-base-content`, `text-neutral`, `bg-primary`, `bg-error`, ...
- Components: `btn`, `input`, `badge`, `alert`, `card`, ...
- Radius tokens: `rounded-box`, `rounded-field`, `rounded-selector`

🚫 **Never** use:
- Tailwind palette colors: `slate-*`, `zinc-*`, `stone-*`
- Hardcoded colors: `bg-white`, `text-black`, `bg-[#...]`
- Colored shadows: `shadow-primary/25`, `shadow-slate-900/10`
- Arbitrary radii: `rounded-2xl`, `rounded-xl`, `rounded-lg`
- Dynamic class interpolation: `` bg-${variant} `` (tree-shaken in production — see §12 Pitfall 1)

### 2.2 — Tailwind is allowed for layout only

Tailwind utilities are allowed for:
- Layout: `flex`, `grid`, `items-*`, `justify-*`, `gap-*`, `overflow-*`, `sticky`, `fixed`
- Spacing: `p-*`, `m-*`, `space-y-*`
- Sizing: `w-*`, `max-w-*`, `min-w-*`, `h-*`, `min-h-*`
- Typography scale: `text-sm`, `text-base`, `font-medium`, `leading-*`
- State utilities: `hidden`, `block`, `opacity-*`, `transition-*`, `duration-*`

### 2.3 — Legacy SCSS hardcoded colors (migration in progress)

The following SCSS files contain hardcoded hex/rgba colors that predate the DaisyUI theme system. They **will break in dark mode**. New code MUST use semantic tokens — never add new hardcoded colors. Legacy fixes happen as files are touched (boy-scout rule).

| Priority | File | ~Count | Impact |
|----------|------|--------|--------|
| P0 | `globals.scss` (ProseMirror, tippy, hypermultimedia) | ~80 | Editor + media breaks in dark mode |
| P1 | `styles.scss` (hyperlink popovers, dropdown menus, media toolbar) | ~40 | Popovers + menus break |
| P2 | `mobile.scss`, `desktop.scss` | ~20 | Layout + heading actions break |
| P3 | `chat_editor.scss` | ~15 | Chat code blocks + links break |
| P4 | Component partials (`_dialog.scss`, `_tooltip.scss`, `_popover.scss`, `_heading-actions.scss`) | ~10 | Minor overlays |

> **`:root` CSS vars** (`--color-docsy`, `--bg-docy`, `--caret-color`, `--caret-color-inverse`) are also hardcoded in `globals.scss`. They should map to DaisyUI vars (e.g., `--caret-color: oklch(var(--p))`) or be replaced with Tailwind classes (`caret-primary`).

> **Scrollbar classes** (`.scrollbar-custom`, `.scrollbar-hide`, `.scrollbar-primary`) use `rgba()` values. Use `oklch(var(--bc) / 0.3)` syntax for theme-awareness when migrating.

### 2.4 — All scroll must use ScrollArea

If an element can scroll, it must use the shared `ScrollArea` component:

- `preserveWidth={true}` (default) — prevents layout shift when scrollbar appears
- `hideScrollbar={true}` — scrollbar hidden by default, visible on hover
- `scrollbarSize="thin"` — for subtle scrollbars in side panels

Never create nested scroll regions.

### 2.5 — Sticky headers inside scroll containers

When a header must pin at the top of a scrollable region:

1. **`sticky top-0 z-10`** on the header element
2. **Background token** must match the panel background (`bg-base-200` for sidebars, `bg-base-100` for modals) — prevents items bleeding through
3. **Eliminate container `padding-top`** — if the scroll container (e.g. `ScrollArea`) has SCSS `padding-top`, override it with `!pt-0` and move the spacing to the header's own `pt-*`. Otherwise a gap forms above the sticky header where scrolling items are visible.
4. **`border-b border-base-300`** below the header for a clean separator

```tsx
/* ✅ Correct — header owns the spacing, no scroll-container padding gap */
<ScrollArea className="tiptap__toc h-full w-full !pt-0">
  <TocHeader className="sticky top-0 z-10 bg-base-200 pt-2 border-b border-base-300" />
  <ul>{/* scrollable items */}</ul>
</ScrollArea>

/* ❌ Wrong — padding on scroll container creates a gap above the sticky header */
<ScrollArea className="pt-2">
  <TocHeader className="sticky top-0 z-10 bg-base-200" />
  <ul>{/* items peek through the 8px gap */}</ul>
</ScrollArea>
```

**Exception:** The TipTap editor (`.editorWrapper`) uses native scroll due to complex scroll dependencies (IntersectionObserver for TOC, ProseMirror cursor/selection/drag, performance). Its scrollbar is styled via CSS to match:

```scss
.editorWrapper {
  scrollbar-width: thin;
  scrollbar-color: oklch(var(--b3)) transparent;
}
```

---

## 3. Foundations

### 3.1 Color system (daisyUI themes)

Three themes: **Light** (`docsplus`), **Dark** (`docsplus-dark`, GitHub-inspired), and **Dark HC** (`docsplus-dark-hc`, projector/classroom-optimized).

#### Semantic roles

| Role | Purpose | Use for |
|---|---|---|
| **Primary** | `bg-primary` / `text-primary` | Main CTAs, links (#1a73e8 / #6ea8ff) |
| **Secondary** | `bg-secondary` / `text-secondary` | Presence/collab (#0f9d7a / #2fbf9b) |
| **Accent** | `bg-accent` / `text-accent` | Highlights/bookmarks (#eab308 / #e3b341) |
| **Neutral** | `bg-neutral` / `text-neutral` | Secondary actions, chrome (#334155 / #8b9bb0 / #94a3b8) |
| **Base** | `bg-base-100/200/300` | Surfaces + elevation |
| **Success** | `bg-success` / `text-success` | Confirmation (#16a34a / #22c55e / #34d399) |
| **Warning** | `bg-warning` / `text-warning` | Caution (#ea580c / #fb7a3a / #fb923c) |
| **Error** | `bg-error` / `text-error` | Destructive/errors (#dc2626 / #ff6b6b / #f87171) |
| **Info** | `bg-info` / `text-info` | Informational (#0284c7 / #38bdf8 / #38bdf8) |

> Format: light hex / dark hex / dark-hc hex. Where dark and dark-hc share the same value, only one is shown.

> Warning and Accent should remain distinct to avoid meaning confusion.

#### Surface map

| Surface | Class | Hex (Light) | Notes |
|---|---|---|---|
| App background | `bg-base-200` | `#f7f9fc` | Side panels + shell |
| Primary canvas | `bg-base-100` | `#fafbfc` | Editor area, cards (soft white, not pure white) |
| Inset areas | `bg-base-300` | `#e5eaf1` | Borders, dividers, subtle areas |
| Text | `text-base-content` | `#0f172a` | Main text |
| Muted text | `text-base-content/60` | — | Secondary text, helper text |
| Subtle text | `text-base-content/50` | — | Tertiary text, timestamps, meta |
| Very muted | `text-base-content/40` | — | Placeholder-like, disabled hints |

> Prefer `text-base-content/50` or `/60` over `text-neutral` for muted text — better theme consistency.

> `base-100` uses soft white (`#fafbfc`) instead of pure white to reduce eye strain.

#### Theme initialization lifecycle

1. **SSR** (`_document.tsx`): `data-theme="docsplus"` on `<html>` — sets the initial theme for server-rendered HTML
2. **Anti-FOUC inline script** (`_document.tsx` `<body>` top): reads persisted preference from `localStorage` and applies `data-theme` **before React hydration** — prevents flash
3. **Zustand hydration** (`themeStore.ts`): `onRehydrateStorage` re-resolves and applies the persisted preference on the client
4. **Toggle**: `useThemeStore.getState().setPreference(preference)` — updates store + DOM in one call

**Four-state preference model:**

| Preference | Resolved theme |
|------------|---------------|
| `"light"` | `docsplus` |
| `"system"` | `docsplus` or `docsplus-dark` (depends on OS) |
| `"dark"` | `docsplus-dark` |
| `"dark-hc"` | `docsplus-dark-hc` |

> The `dark:` Tailwind variant maps to both `docsplus-dark` AND `docsplus-dark-hc` via `@custom-variant`. Use `dark:` for any dark-mode-specific overrides — it works for all dark themes automatically.

> See [Theme_Light_Dark.md](./Theme_Light_Dark.md) §2.3 and §4B for full color tables and projector washout analysis.

### 3.2 Radius

| Token | px | Use for |
|-------|----|---------|
| `rounded-box` | 16px | Cards, panels, modals, section containers |
| `rounded-field` | 8px | Inputs, selects, textareas |
| `rounded-selector` | 8px | Buttons, chips, badges |
| `rounded-full` | 50% | Avatars, circular elements |

No arbitrary radii (`rounded-2xl`, `rounded-xl`, `rounded-lg`).

### 3.3 Spacing

Tailwind spacing scale. Preferred increments:
- **2 / 3 / 4**: small gaps
- **4 / 6**: standard padding
- **8 / 10**: large sections

### 3.4 Typography

| Use case | Classes |
|---|---|
| Page title | `text-xl sm:text-2xl font-semibold text-base-content` |
| Section title | `text-base sm:text-lg font-semibold text-base-content` |
| Body | `text-sm sm:text-base text-base-content/80` |
| Helper/meta | `text-xs sm:text-sm text-base-content/60` |
| Links | `text-primary hover:underline` |

Weights: `font-medium` for emphasis, `font-semibold` for headers.

### 3.5 Icons

#### Icon Registry (single source of truth)

All UI icons are accessed through the centralized **`Icons` registry** (`@components/icons/registry.ts`). Components **never** import individual icons from `react-icons/*` directly — they import from `@icons` instead.

```tsx
// ✅ Correct — semantic name from the registry
import { Icons } from '@icons'
<Icons.bold size={16} />
<Icons.notifications size={18} />
<Button startIcon={Icons.history} />

// 🚫 Wrong — direct icon library import
import { LuBold } from 'react-icons/lu'
<LuBold size={16} />
```

**Why a registry?**

1. **Swap once, update everywhere** — changing an icon (e.g., `bookmark` from outline → filled) is a single-line change in `registry.ts`
2. **Consistent naming** — semantic names (`Icons.edit`, `Icons.trash`) vs library names (`LuPencil`, `LuTrash2`) that vary across icon sets
3. **Library decoupling** — the entire codebase is shielded from breaking changes if the underlying icon library changes
4. **Discoverability** — autocomplete `Icons.` shows every available icon in the project

**Registry location:** `packages/webapp/src/components/icons/registry.ts`
**Import alias:** `@icons` (configured in `tsconfig.json` paths)

#### Naming convention

- **camelCase**, describes the **action/concept**, NOT the icon visual
- ✅ `bold`, `image`, `orderedList`, `edit`, `notifications`
- 🚫 `bIcon`, `LuImage`, `numberList`, `pencilIcon`

#### Available icon categories

| Category | Icons |
|----------|-------|
| **Text Formatting** | `bold`, `italic`, `underline`, `strikethrough`, `highlight`, `clearFormatting`, `textColor`, `textFormat` |
| **Lists** | `orderedList`, `bulletList`, `taskList` |
| **Insert / Rich Content** | `link`, `image`, `comment`, `reply`, `thread`, `moreVertical` |
| **Editor Actions** | `undo`, `redo`, `print`, `copy`, `check`, `settings`, `bookmark`, `bookmarkPlus`, `bookmarkMinus`, `bookmarkCheck`, `filter`, `filterX`, `documents`, `search`, `pencil`, `edit`, `penOff`, `fileText`, `fileOpen`, `splitVertical`, `externalLink` |
| **Navigation** | `back`, `menu`, `close`, `history`, `chevronRight`, `chevronDown`, `chevronUp`, `chevronLeft` |
| **Communication** | `share`, `user`, `notifications`, `notificationsOff`, `notificationsActive`, `chatroom` |
| **TOC** | `crosshair`, `foldVertical`, `unfoldVertical`, `trash`, `info`, `gripVertical`, `listTree`, `plus`, `pin`, `pinOff`, `forward` |
| **Status** | `cloud`, `cloudOff` |
| **Code** | `code`, `codeBlock`, `blockquote` |
| **Misc** | `emoji`, `mention`, `send`, `archive`, `eye`, `mail`, `megaphone`, `messagesSquare`, `alert` |
| **Brand** | `discord` |

#### Adding new icons

1. Import the Lucide icon in `registry.ts`
2. Add a semantic entry under the correct category
3. Use it as `Icons.yourNewName` — done

```ts
// registry.ts
import { LuSparkles } from 'react-icons/lu'

export const Icons = {
  // ...existing entries...
  sparkles: LuSparkles,
}
```

#### Library convention

- **All icons use Lucide** (`react-icons/lu`) for visual consistency
- **Brand icons** use Font Awesome (`react-icons/fa`) when no Lucide equivalent exists (e.g., `discord`)
- **Exception:** A handful of legacy files (settings, design-system docs) still import directly from `react-icons/*`. These are being migrated incrementally — new code MUST use the registry. All chatroom components were migrated to the registry in v1.9.0

#### Icon sizing

| Size | px | Usage |
|------|----|-------|
| xs | 14 | Small inline icons, breadcrumb separators |
| sm | 16 | Desktop toolbar buttons, options, minor UI |
| md | 18 | Mobile toolbar buttons, section headings, nav items |
| lg | 20 | Primary actions, panel headers |

**Icon size must match button size context:**

| Button size | Icon size | Context |
|-------------|-----------|---------|
| `btn-sm` (32px) | 16px | Desktop icon-only buttons |
| `btn-md` (40px) | 18px | Mobile icon-only buttons, nav actions |
| `btn-lg` (48px) | 20px | Primary mobile CTAs |

**Icon size by UI context (standardized v1.10.0):**

| Context | Icon size | Examples |
|---------|-----------|----------|
| Desktop toolbar buttons | 16px | Editor toolbar (bold, italic, link, image, etc.) |
| Desktop message composer toolbar | 16px | Composer formatting buttons |
| Hover action buttons (chatroom) | 18px | Emoji, reply, thread, bookmark, more actions |
| Menu items with text labels | 18px | Context menu entries, dropdown actions |
| Composer action buttons | 18px | Emoji picker, mention, send, toggle toolbar |
| TOC sidebar icons | 20px | Chat bubble icon on TOC items |
| Scroll-to-bottom / mobile standalone | 20px | `ScrollToBottomButton`, mobile quick reaction "+" |
| Inline status indicators | 16px | Read status checkmarks, message seen |
| Small inline icons | 14px | Add-reaction "+" on reaction pills |

- Colors: inherit from parent or use `text-base-content/60` for muted
- Every icon-only button MUST have a tooltip (§5.12)
- Use the `size` prop, not `className="size-*"` — the prop ensures consistent rendering across icon libraries

---

## 4. Layout patterns

### 4.1 App shell (Slack/Discord style)

Three main areas: **TOC (left)**, **Editor (center)**, **Chatroom (right)**.

- Panels: `bg-base-200`, `border-base-300`
- Editor canvas: `bg-base-100`
- Borders: `border-base-300` (subtle and consistent)

### 4.2 Editor width

Max width: **56rem**, centered. Panel resizing must not affect editor content width.

### 4.3 Resizable panels (TOC + Chat)

Use the shared `ResizeHandle` component:

- Handle: **6px** hit-area, invisible by default
- Cursor: `col-resize` / `row-resize`
- Visual: `bg-base-300` → `bg-primary/50` on hover/drag
- During drag: disable text selection, set body cursor, disable editor

| Panel | Min | Max | Default | Storage key |
|-------|-----|-----|---------|-------------|
| TOC (vertical) | 240px | 420px | 320px | `docsy:toc-width` |
| Chat (horizontal) | 320px | 1200px (or 85% vh) | 410px | `docsy:chat-height` |

Mobile: TOC and Chat become **drawers** / **overlay sheets** (no split view).

### 4.4 Scrollable regions

Only these areas should scroll: TOC list, Chat messages, Editor canvas. Never nest scroll regions inside them.

---

## 5. Components

### 5.1 Buttons

Variants (daisyUI):
- Primary: `btn btn-primary`
- Secondary: `btn btn-outline btn-neutral`
- Tertiary: `btn btn-ghost`
- Destructive: `btn btn-error`

Sizes: `btn-xs`, `btn-sm`, `btn-md`, `btn-lg`

**Consistency rule:** Button sizes within the same context MUST match. Mixing `btn-sm` with `btn-md` creates visual jank.

| Rule | Example |
|------|---------|
| CTA buttons (Save, Sign Out) use `md` | `<Button variant="primary">Save Changes</Button>` |
| Inline action buttons match input height | Input `md` → button `md` |
| Desktop icon-only buttons use `sm` (32px) | `<Button variant="ghost" size="sm" shape="square">` |
| Mobile icon-only buttons use `md` (40px) | `<Button variant="ghost" size="md" shape="square">` |
| Don't mix sizes within the same row/section | All buttons in a row = same size |

#### Mobile button sizing (non-negotiable)

`btn-sm` (32px) is a **desktop density** size. On mobile, it fails the 44×44px touch-target minimum (§9.2).

| daisyUI size | Height | Touch-safe? | Use on mobile? |
|--------------|--------|-------------|----------------|
| `btn-xs` | 24px | ❌ | Never |
| `btn-sm` | 32px | ❌ | Never for primary actions — desktop only |
| `btn-md` | 40px | ✅ (~44px with padding) | **Default for mobile icon-only buttons** |
| `btn-lg` | 48px | ✅ | Mobile CTAs, bottom-sheet actions |

**Grouped toolbar pattern (mobile):**

```tsx
{/* Container: pill-shaped background, inner gap for hover separation */}
<div className="bg-base-200 rounded-box flex items-center gap-0.5 p-0.5">
  <Button variant="ghost" size="md" shape="square" iconSize={18}
    className="rounded-field text-base-content/60 hover:text-base-content hover:bg-base-300
               focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none"
    startIcon={Icons.history} />
  <Button variant="ghost" size="md" shape="square" iconSize={18}
    className="rounded-field ..." startIcon={Icons.filter} />
  <Button variant="ghost" size="md" shape="square" iconSize={18}
    className="rounded-field ..." startIcon={Icons.close} />
</div>
```

Key tokens: container `rounded-box bg-base-200 p-0.5 gap-0.5`, button `rounded-field` (nested radius hierarchy), `size="md"` + `iconSize={18}`.

### 5.2 Inputs

`input input-bordered` + size (`input-sm`/`md`/`lg`)

Validation states: `input-success`, `input-error`

### 5.3 Dropdowns & Selects

🚫 **NEVER use native `<select>` elements.** Native dropdowns are rendered by the browser/OS with unstyled options — no borders, no shadows, white background. This breaks every theme.

✅ **Always use `Select` or `SearchableSelect`.**

#### Which component to use

| Scenario | Component |
|----------|-----------|
| Simple list (< 15 options), time pickers, enums | `Select` |
| Long list (15+), options with descriptions, timezone/country | `SearchableSelect` |

#### Shared behavior

1. **Mutual exclusion** — Only one dropdown open at a time, app-wide, via `useSelectExclusion` hook (DOM `CustomEvent`). New dropdown components MUST call this hook.
2. **Floating UI** — Auto-flip/shift, rendered via `FloatingPortal` to avoid overflow clipping.
3. **DaisyUI trigger** — `select w-full text-left bg-none pr-3` (see gotcha below).
4. **Keyboard** — ArrowDown/Up navigate, Enter/Space select, Escape/Tab close, Home/End.
5. **ARIA** — `aria-haspopup="listbox"`, `aria-expanded`, `aria-activedescendant`, `role="option"`, `aria-selected`, unique `id`s.
6. **Panel** — `bg-base-100 border-base-300 rounded-box border shadow-lg z-50`.
7. **Options** — `px-3 py-2 text-sm`, hover `bg-base-200`, selected `text-primary font-medium` + `Icons.check`.
8. **Icons** — All icons (`chevronDown`, `check`, `search`) use the `Icons` registry (§3.5) — never raw `Lu*` imports.
9. **ScrollArea** — Dropdown option lists use the shared `ScrollArea` component (§2.4) — never raw `overflow-y-auto`.

> ⚠️ **DaisyUI `select` gotcha:** On a `<button>`, the `select` class adds an arrow via `background-image`. Add `bg-none` to remove it and `pr-3` to fix padding. Both components handle this.

#### Select (simple dropdown)

```tsx
<Select
  label="Email frequency"
  value={frequency}
  onChange={setFrequency}
  options={[
    { value: 'immediate', label: 'Immediately' },
    { value: 'daily', label: 'Daily digest' },
    { value: 'weekly', label: 'Weekly digest' },
  ]}
  placeholder="Select frequency..."
/>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Selected value |
| `onChange` | `(value: string) => void` | — | Change handler |
| `options` | `SelectOption[]` | `[]` | Options array |
| `label` | `string` | — | Label text |
| `labelPosition` | `'above' \| 'floating'` | `'above'` | Label placement |
| `placeholder` | `string` | `"Select…"` | Trigger placeholder |
| `helperText` | `string` | — | Helper text below |
| `size` | `SelectSize` | — | DaisyUI size (`xs`/`sm`/`md`/`lg`/`xl`) |
| `color` | `SelectColor` | — | DaisyUI color variant |
| `error` | `boolean` | `false` | Error state |
| `success` | `boolean` | `false` | Success state |
| `disabled` | `boolean` | `false` | Disabled state |
| `ghost` | `boolean` | `false` | Ghost style |
| `maxHeight` | `number` | `240` | Max dropdown height (px) |
| `className` | `string` | — | Additional trigger class |
| `wrapperClassName` | `string` | — | Additional wrapper class |

```typescript
interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}
```

#### SearchableSelect (dropdown with search)

For dropdowns with many options (e.g., timezone, country). Adds a search input at the top.

```tsx
<SearchableSelect
  label="Timezone"
  value={timezone}
  onChange={setTimezone}
  options={[
    { value: 'Asia/Dubai', label: 'UAE (Asia/Dubai)', description: 'GMT+4', searchText: 'uae dubai' },
    { value: 'America/New_York', label: 'USA Eastern', description: 'GMT-5', searchText: 'usa new york' },
  ]}
  placeholder="Select timezone..."
  searchPlaceholder="Search timezones..."
/>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Selected value (required) |
| `onChange` | `(value: string) => void` | — | Change handler (required) |
| `options` | `SearchableSelectOption[]` | — | Options array (required) |
| `label` | `string` | — | Label text |
| `placeholder` | `string` | `"Select…"` | Trigger placeholder |
| `searchPlaceholder` | `string` | `"Search…"` | Search input placeholder |
| `helperText` | `string` | — | Helper text below |
| `disabled` | `boolean` | `false` | Disabled state |
| `size` | `SelectSize` | — | DaisyUI size variant |
| `maxHeight` | `number` | `200` | Max dropdown list height (px) |
| `emptyMessage` | `string` | `"No options found"` | Empty result text |
| `className` | `string` | — | Additional trigger class |
| `wrapperClassName` | `string` | — | Additional wrapper class |

```typescript
interface SearchableSelectOption {
  value: string        // Stored/returned value
  label: string        // Primary display text
  description?: string // Secondary text (shown smaller, muted)
  searchText?: string  // Custom searchable text (for aliases)
}
```

#### Dropdown styling reference

| Element | Classes |
|---------|---------|
| Trigger | `select w-full text-left bg-none pr-3 flex items-center justify-between` |
| Trigger active | `select-primary` |
| Trigger disabled | `select-disabled cursor-not-allowed` |
| Chevron | `Icons.chevronDown` 16px, `rotate-180` when open, `duration-200` |
| Panel | `bg-base-100 border-base-300 rounded-box border shadow-lg z-50` |
| Option list | `ScrollArea` with `maxHeight` prop — never raw `overflow-y-auto` |
| Option | `px-3 py-2 text-sm transition-colors` |
| Option highlighted | `bg-base-200` |
| Option selected | `text-primary font-medium` + `Icons.check` 16px |
| Option disabled | `text-base-content/30 cursor-not-allowed` |
| Search input | `bg-base-200 rounded-md text-sm` |
| Empty state | `text-base-content/50 text-sm text-center` |

### 5.4 Badges

- `badge badge-neutral`
- `badge badge-primary`
- `badge badge-error` (unread counts — red for visibility)

### 5.5 Toasts

Use the shared toast module (not `react-hot-toast` directly):
- Messages: **5–10 words**
- Success: ~4s, Error: ~5s
- Loading: persistent until dismissed

### 5.6 Empty states

```tsx
import { Icons } from '@icons'

<div className="flex flex-col items-center justify-center space-y-3 py-8">
  <div className="bg-base-200 flex size-12 items-center justify-center rounded-full">
    <Icons.archive size={24} className="text-base-content/40" />
  </div>
  <div className="text-center">
    <p className="text-base-content/60 font-medium">Your inbox is empty!</p>
    <p className="text-base-content/40 text-sm">New items will appear here.</p>
  </div>
</div>
```

### 5.7 Skeleton loaders

Use daisyUI's `skeleton` class. Create **panel-specific** skeletons that match actual content — never use generic spinners.

```tsx
// ✅ Panel-specific skeleton
const BookmarkModal = dynamic(() => import('./BookmarkModal'), {
  loading: () => <BookmarkPanelSkeleton />
})

// ❌ Generic spinner
const BookmarkModal = dynamic(() => import('./BookmarkModal'), {
  loading: () => <Loading />
})
```

**Skeleton item pattern:**

```tsx
<div className="rounded-box border-base-300 bg-base-100 flex w-full items-start gap-3 border p-3">
  <div className="skeleton size-10 shrink-0 rounded-full" />
  <div className="min-w-0 flex-1">
    <div className="skeleton h-4 w-32 rounded" />
    <div className="skeleton mt-2 h-10 w-full rounded-lg" />
    <div className="mt-2 flex items-center gap-2">
      <div className="skeleton h-3 w-20 rounded" />
    </div>
  </div>
</div>
```

**Panel skeleton pattern:**

```tsx
export const PanelSkeleton = ({ count = 3 }) => (
  <div className="bg-base-100 flex w-full flex-col">
    <div className="border-base-300 flex items-center justify-between border-b px-4 py-3">
      <div className="skeleton h-6 w-24 rounded" />
      <div className="skeleton h-7 w-7 rounded" />
    </div>
    <div className="border-base-300 flex gap-2 border-b px-4 py-2">
      <div className="skeleton h-8 w-20 rounded-lg" />
      <div className="skeleton h-8 w-24 rounded-lg" />
    </div>
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonItem key={i} />
      ))}
    </div>
  </div>
)
```

### 5.8 Infinite scroll

Use IntersectionObserver with a sentinel element:

```tsx
const useInfiniteScroll = () => {
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect()
    if (!node || !hasMore || isLoadingMore) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore()
        }
      },
      { rootMargin: '100px', threshold: 0.1 }
    )
    observerRef.current.observe(node)
  }, [hasMore, isLoadingMore, loadMore])

  return { sentinelRef, isLoadingMore, hasMore }
}
```

**Render pattern:**

```tsx
<ScrollArea className="max-h-96 min-h-48 p-3">
  {isLoading && items.length === 0 && <Skeleton count={4} />}
  <EmptyState show={!isLoading && items.length === 0} />

  {items.length > 0 && (
    <div className="flex flex-col gap-2">
      {items.map((item) => <Item key={item.id} {...item} />)}

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-3">
          {isLoadingMore && <div className="loading loading-spinner loading-sm text-primary" />}
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <p className="text-base-content/40 py-3 text-center text-xs">No more items</p>
      )}
    </div>
  )}
</ScrollArea>
```

### 5.9 List items

For list items (notifications, bookmarks, messages):

```tsx
<div className="rounded-box border-base-300 bg-base-100 hover:bg-base-200 flex w-full items-start gap-3 border p-3 transition-colors">
  <Avatar size="sm" className="shrink-0" />
  <div className="min-w-0 flex-1">
    <div className="flex items-center justify-between">
      <span className="text-base-content font-medium">{name}</span>
      <Button variant="ghost" size="sm" />
    </div>
    <p className="bg-base-200 text-base-content/70 mt-2 rounded-lg p-2.5 text-sm">{content}</p>
    <div className="mt-2 flex items-center justify-between">
      <span className="text-base-content/50 text-xs">{timeAgo}</span>
      <div className="flex gap-1">{/* Action buttons */}</div>
    </div>
  </div>
</div>
```

Key tokens: container `rounded-box border-base-300 border p-3`, hover `hover:bg-base-200`, avatar `shrink-0`, content `min-w-0 flex-1`, name `font-medium`, timestamp `text-base-content/50 text-xs`.

### 5.10 Chat bubbles (mobile)

Mobile chat uses DaisyUI's `chat` component with owner/other differentiation:

| Variant | Style |
|---------|-------|
| Owner message | `chat-bubble bg-primary/20 before:hidden` |
| Other's message | Default `chat-bubble` (DaisyUI theme-aware) |
| Non-group-start (continuation) | `ml-9 before:hidden` (hide tail, indent to align with avatar) |
| System notification | `badge bg-info/10 border-none` |

**Owner bubble rationale:** `bg-primary/20` instead of a hardcoded color ensures the bubble adapts to both light and dark themes. The `before:hidden` removes the DaisyUI chat-bubble tail for a cleaner look on mobile.

### 5.11 Channel access states

| State | Component | Style |
|---|---|---|
| Sign in required | Button with `LuLogIn`* | `variant="primary"` |
| Join channel | Button with `LuUserPlus`* | `variant="primary"` |
| Private channel | Info pill | `bg-base-200 text-base-content/60` + `LuLock`* |
| Direct message | Info pill | `bg-base-200 text-base-content/60` + `Icons.thread` |
| Mute toggle | Button | `variant="ghost"` + `Icons.notifications`/`Icons.notificationsOff` |

> \* These icons (`LuLogIn`, `LuUserPlus`, `LuLock`) are still direct imports pending migration to the registry. Add to `registry.ts` as `logIn`, `userPlus`, `lock` when those files are touched.

Container: `border-base-300 bg-base-100 border-t p-3`

### 5.12 Tooltips

Tooltips provide contextual labels on hover for icon-only buttons and abbreviated UI elements.

**Library:** `@floating-ui/react` (same as Popover, Select, HoverMenu)

🚫 **NEVER use DaisyUI CSS tooltips** (`tooltip tooltip-top data-tip="..."`). They are CSS-only, can't flip/shift, can't portal, and can't be disabled on touch devices.

✅ **Always use the `Tooltip` component** from `@components/ui/Tooltip`, or use the built-in `tooltip` prop on `Button` and `Avatar`.

#### Which pattern to use

| Scenario | Pattern |
|----------|---------|
| Button with tooltip | `<Button tooltip="Bold" tooltipPlacement="bottom">` |
| Avatar with tooltip | `<Avatar tooltip="Profile" tooltipPosition="bottom" />` |
| Any other element | `<Tooltip title="Label"><span>...</span></Tooltip>` |
| Raw DOM (ProseMirror plugins) | Native `title` attribute (no React available) |

#### Tooltip props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `ReactNode` | — | Tooltip content (required) |
| `children` | `ReactNode` | — | Trigger element — must accept ref |
| `placement` | `Placement` | `'top'` | Floating UI placement |
| `showDelay` | `number` | `200` | Delay before showing (ms) |
| `hideDelay` | `number` | `0` | Delay before hiding (ms) |
| `className` | `string` | `''` | Extra class on the tooltip bubble |
| `open` | `boolean` | — | Controlled open state |
| `onOpenChange` | `(open: boolean) => void` | — | Controlled callback |

#### Styling

```
bg-neutral text-neutral-content rounded px-2 py-1 font-mono text-xs z-50
```

Arrow: `bg-neutral` rotated square, positioned with Floating UI `arrow` middleware.

#### Touch-only device handling

The `Tooltip` component automatically detects touch-only devices via `window.matchMedia('(hover: hover)')` and skips rendering the tooltip entirely. No per-component opt-out needed.

#### Rules

1. **Keep tooltips to 1–3 words** — "Bold", "Add Reaction", "Reply in thread"
2. **Never put interactive content in tooltips** — use Popover for that
3. **Every icon-only button MUST have a tooltip** — accessibility requirement
4. **Tooltip placement follows spatial context** — toolbar buttons use `bottom`, sidebar items use `right`

---

## 6. Overlays

### 6.1 Modals and dialogs

**Styling tokens:**

| Token | Value | Why |
|-------|-------|-----|
| Surface | `bg-base-100` | Never `bg-white` — breaks dark mode for every modal (§12 Pitfall 2) |
| Overlay | `bg-base-content/40` | Never `bg-slate-*` or `bg-black/40` |
| Radius | `rounded-box` | Semantic token (§3.2) |
| Shadow | `shadow-xl` | No colored shadows |
| Overflow | `overflow-hidden` | Children handle their own scroll |

**UX rules (non-negotiable):**

| Rule | How |
|------|-----|
| **Close button always visible** | `CloseButton` in top-right on both desktop and mobile. Don't rely on overlay click or Escape alone. |
| **No nested scroll containers** | `overflow-hidden` on `ModalContent`. One `ScrollArea` inside. |
| **ModalContent is flex** | `flex max-h-[90vh] flex-col overflow-hidden`. Children use `flex-1 min-h-0`, never `h-full` (which requires explicit parent height, not `max-height`). See §12 Pitfall 5. |
| **Modal height** | Mobile: `flex-1 min-h-0`. Desktop: `md:h-[min(85vh,800px)]`. Never `h-[100dvh]` inside `max-h-[90vh]`. |
| **Wire `onClose`** | If declared, it MUST be connected. An unused `onClose` aliased as `_onClose` is a UX bug. |

#### ⚠️ Mobile back-button — known gap

Per-component `pushState`/`popstate` is **not safe** in this codebase:

1. **React StrictMode** — double-mounts cause `history.go(-1)` cleanup to race with the remounted listener
2. **Next.js Pages Router** — owns `popstate`; injected entries pollute its stack
3. **Inline `onClose` props** — new references per render re-fire `useEffect`

**Current approach:** Close (X) button + overlay click + Escape key.

**Future solution:** A centralized `ModalRouter` / `OverlayManager` with a single `popstate` listener, coordinating with `router.beforePopState` and managing a stack of open overlays. NOT per-component.

### 6.2 Bottom sheets (mobile)

**Library:** `react-modal-sheet`

On mobile, panels that are split-view on desktop (TOC, Chatroom, Notifications, Filters) become **bottom sheets**.

#### Z-index layering

| Layer | z-index | Sheet type |
|-------|---------|------------|
| Primary sheet | `z-10` | Chatroom, Notifications, Filters |
| Overlay sheet | `z-40` | Emoji picker (sits above primary sheet) |
| Floating UI | `z-50` | Dialogs, portals, dropdowns |

#### Sheet switching

Use `switchSheet()` from `useBottomSheet` — it queues the new sheet to open **after** the current one finishes its close animation. Never open two sheets simultaneously.

```tsx
// ✅ Correct — waits for close animation
switchSheet('emojiPicker', { chatRoomState: { headingId } })

// 🚫 Wrong — race condition
closeSheet()
openSheet('emojiPicker', data)
```

#### Sheet vs Dialog

| Need | Use |
|------|-----|
| Content panel (messages, list, feed) | Bottom sheet |
| Inline edit with keyboard (title rename, input) | Dialog via `openDialog()` |
| Emoji picker from composer | `switchSheet('emojiPicker')` |
| Emoji picker from reaction menu | Overlay `<Sheet>` inside `ChatContainerMobile` |

**Why dialogs for keyboard inputs:** On iOS, bottom sheets fight with the virtual keyboard for viewport space. Dialogs with `align="top"` position above the keyboard naturally.

#### Sheet state machine

The sheet store tracks animation lifecycle: `closed → opening → open → closing → closed`. The `switchSheet` method queues a pending sheet that auto-opens when `closing → closed` completes.

### 6.3 Popover panels (Toolbar dropdowns)

Toolbar popovers (Notifications, Bookmarks, Filter, Settings):

**Container:**
```
className="rounded-box border-base-300 bg-base-100 z-50 w-[28rem] overflow-hidden border p-0 shadow-xl"
```

**Structure:**
```
┌─────────────────────────────────────┐
│ Header (border-b px-4 py-3)         │
│   Title (h2)              [Actions] │
├─────────────────────────────────────┤
│ Tabs (border-b px-4 py-2) [optional]│
│   [Tab1] [Tab2] [Tab3]              │
├─────────────────────────────────────┤
│ Content (ScrollArea, p-3/4)         │
│   - Skeleton (loading)              │
│   - Empty state                     │
│   - List items                      │
│   - Infinite scroll sentinel        │
├─────────────────────────────────────┤
│ Footer (border-t px-4 py-3)         │
│   [Secondary]     [Primary Action]  │
└─────────────────────────────────────┘
```

**Header:**
```tsx
<div className="border-base-300 border-b px-4 py-3">
  <div className="flex items-center justify-between">
    <h2 className="text-base-content text-lg font-semibold">Title</h2>
    <div className="flex items-center gap-1">
      <CloseButton onClick={handleClose} size="sm" />
    </div>
  </div>
</div>
```

**Tabs (custom buttons, not daisyUI radio tabs):**
```tsx
<div className="border-base-300 flex gap-1 border-b px-4 py-2">
  {tabs.map((tab) => (
    <button
      key={tab.label}
      onClick={() => setActiveTab(tab.label)}
      className={`rounded-selector px-3 py-1.5 text-sm font-medium transition-colors ${
        activeTab === tab.label
          ? 'bg-primary text-primary-content'
          : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
      }`}>
      {tab.label}
      {tab.count > 0 && <span className="ml-1.5">({tab.count})</span>}
    </button>
  ))}
</div>
```

**Footer:**
```tsx
<div className="border-base-300 bg-base-200/50 flex items-center gap-3 border-t px-4 py-3">
  <Button variant="neutral" btnStyle="outline" className="flex-1">Cancel</Button>
  <Button variant="primary" className="flex-[2]">Apply</Button>
</div>
```

### 6.4 Tooltips (floating overlay)

Tooltips are rendered via `FloatingPortal` at `<body>` level. See §5.12 for component API.

**Technical requirements:**

| Requirement | Value | Why |
|-------------|-------|-----|
| Strategy | `strategy: 'fixed'` | Absolute positioning in a portal can extend document bounds → scrollbar flicker → `autoUpdate` feedback loop. Fixed positions relative to viewport — no overflow possible. |
| Middleware | `offset(8)`, `flip()`, `shift()`, `arrow()` | 8px gap, auto-flip on viewport edges, shift to stay visible, arrow indicator |
| Interaction | `useHover` from Floating UI | Never reinvent hover with manual `useState` + `setTimeout` — see §12 Pitfall 11 |
| Portal | `FloatingPortal` | Avoids `overflow: hidden` clipping from parent containers |
| z-index | `z-50` | Same as all Floating UI overlays (§6.2 Z-index layering) |
| Touch devices | Auto-disabled | `window.matchMedia('(hover: hover)')` — see §5.12 |

### 6.5 Dark mode overlay compliance (non-negotiable)

All overlay/floating components MUST include these tokens for dark mode visibility. In dark mode, `base-100` is the page background — an overlay without a border or shadow is invisible.

| Token | Classes | Why |
|-------|---------|-----|
| Border | `border border-base-300` | Separates overlay from dark background |
| Background | `bg-base-100` or `bg-base-200` | `bg-base-100` for modals/panels, `bg-base-200` for inline menus |
| Shadow | `shadow-xl` or `shadow-lg` | `shadow-xs`/`shadow-sm` are invisible on dark backgrounds |

**Components that must comply:**

| Component | Required classes |
|-----------|----------------|
| Dialog / Modal | `bg-base-100 border border-base-300 shadow-xl` |
| Context Menu | `bg-base-100 border border-base-300 shadow-xl rounded-xl` |
| HoverMenu | `bg-base-200 border border-base-300 shadow-md rounded-lg` |
| Toast | `dark:bg-base-200 dark:border-base-300 dark:border` |
| Popover panels | `bg-base-100 border border-base-300 shadow-xl` |
| Tooltip | `bg-neutral text-neutral-content` (always visible — uses `neutral` token) |

> ✅ Fixed 2026-02-16: Dialog, ContextMenu, HoverMenu, Toast all updated to include borders and elevated backgrounds for dark mode.

---

## 7. Settings / Forms panels

### 7.1 Section card pattern

```tsx
import { Icons } from '@icons'

<section className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
  <h2 className="text-base-content mb-3 flex items-center gap-2 text-base font-semibold">
    <Icons.user size={18} className="text-base-content/70" />
    Section Title
  </h2>
  {/* Section content */}
</section>
```

| Token | Value | Usage |
|-------|-------|-------|
| Card bg | `bg-base-100` | Not `bg-white` |
| Card radius | `rounded-box` | Not arbitrary |
| Card elevation | `shadow-sm` | Preferred over border for sections |
| Card padding | `p-4 sm:p-6` | Responsive |
| Heading | `<h2>` with `mb-3` | Section titles |
| Heading icon | 18px, `text-base-content/70` | Optional |
| Section spacing | `space-y-4` | Between sections |

### 7.2 Form control pattern

Use DaisyUI's form structure:

```tsx
{/* ✅ Correct */}
<div className="form-control w-full">
  <label htmlFor={id} className="label">
    <span className="label-text text-base-content">Label</span>
  </label>
  <TextInput id={id} value={value} onChange={onChange} />
  <p className="label text-xs text-base-content/50">Helper text</p>
</div>

{/* 🚫 Wrong — hand-rolled labels */}
<div className="w-full">
  <label className="text-base-content mb-1 block text-sm font-medium">Label</label>
  <input ... />
</div>
```

Why: DaisyUI's `form-control`, `label`, and `label-text` classes respect theme tokens and maintain consistent spacing.

### 7.3 Heading hierarchy

| Level | Usage |
|-------|-------|
| `<h1>` | Page title (one per page) |
| `<h2>` | Section titles within a panel |
| `<h3>` | Sidebar group labels, sub-sections (`text-xs text-base-content/50 font-semibold uppercase tracking-wider`) |

> Common mistake: Using `<p>` for group labels. Use `<h3>`.

---

## 8. Interaction patterns

### 8.1 Form validation

- Validate on blur (not on every key press)
- Clear errors as soon as input becomes valid
- Always use `aria-invalid` and `aria-describedby`

### 8.2 Animations

- Hover: `duration-75`
- UI transitions: `duration-150` / `duration-200`
- Panels/modals: `duration-300`

Avoid always-running animations (CPU + distraction).

---

## 9. Responsive behavior

### 9.1 Mobile-first

- Base styles target mobile
- Desktop enhancements via `sm:`, `md:`, `lg:`

Mobile layout: TOC → slide-over, Chat → slide-over, Editor → full screen.

### 9.2 Touch targets

Minimum **44×44px** for tap areas (`min-h-[44px]` on buttons, nav items, links).

**DaisyUI size → touch-target mapping:**

| daisyUI size | Rendered height | Meets 44px? | Mobile usage |
|--------------|-----------------|-------------|--------------|
| `btn-xs` | 24px | ❌ | Never |
| `btn-sm` | 32px | ❌ | Desktop-only density |
| `btn-md` | 40px | ✅ (with container padding) | **Icon-only toolbar buttons** |
| `btn-lg` | 48px | ✅ | Primary CTAs, bottom actions |

> **Rule:** Any `btn-sm` in a mobile-visible component is a touch-target violation. Use `btn-md` minimum. See §5.1 "Mobile button sizing" for the full pattern.

**Grouped buttons:** When buttons are adjacent (e.g. toolbar), wrap in `bg-base-200 rounded-box p-0.5 gap-0.5` — the 2px padding + gap prevent hover states from merging and give each button breathing room.

### 9.3 Platform-specific UX (iOS / Android / Desktop)

Use `usePlatformDetection` from `@hooks/usePlatformDetection`. **Never assume browser APIs are universally available — degrade gracefully with actionable guidance.**

| Detection | Hook property |
|-----------|--------------|
| iOS device (iPhone + iPad) | `platform === 'ios'` |
| Running as installed PWA | `isPWAInstalled` |
| iOS supports web push (16.4+) | `iosSupportsWebPush` |
| Should show PWA install prompt | `shouldShowIOSInstallPrompt()` |
| Can actually receive push | `canReceivePush()` |

**Pattern: Platform-aware feature gating**

When a feature requires PWA (e.g., push notifications on iOS), do NOT disable a toggle with "not supported." Replace with an **actionable notice**:

```tsx
const { platform, isPWAInstalled, iosSupportsWebPush } = usePlatformDetection()
const isIOSBrowser = platform === 'ios' && !isPWAInstalled

{isIOSBrowser ? (
  <IOSPWANotice iosSupportsWebPush={iosSupportsWebPush} />
) : (
  <NormalFeatureToggle />
)}
```

The notice must:
1. **Explain WHY** — "On iOS, push notifications require the app on your home screen"
2. **Show HOW** — CTA triggers `showPWAInstallPrompt()` (reuses existing flow, DRY)
3. **Handle edge cases** — iOS < 16.4 gets "Update to iOS 16.4 or later"

> Existing infrastructure: `usePlatformDetection`, `showPWAInstallPrompt()`, `PWAInstallPrompt`. Never duplicate.

---

## 10. Accessibility

- Keyboard navigation for all interactive controls
- Visible focus states (don't remove outline without replacement)
- `aria-label` on icon-only buttons
- Correct heading order (`h1 → h2 → h3`, no skipping)
- Form fields must have labels (visible or `aria-label`)
- Don't rely on color alone (icons + text)

---

## 11. Review checklist

Before merging UI changes:

**Theming** — No `slate-*`/`zinc-*`/`white`/`black`, semantic colors only, dark mode safe (§2.1)

**Tokens** — Radius from §3.2 only, icons via `Icons` registry from §3.5 (never raw `Lu*`/`Md*` imports), spacing from §3.3

**Components** — No native `<select>` (§5.3), no one-off styling, buttons same-sized in context (§5.1), forms use `form-control` (§7.2), headings follow hierarchy (§7.3)

**Layout** — `ScrollArea` for scroll (§2.3), no nested scroll, no conflicting display classes (`md:block md:flex`)

**Overlays** — Close button visible, `ModalContent` is flex, no `h-[100dvh]` inside `max-h-[90vh]` (§6.1), dark mode compliant borders/shadows (§6.5)

**Tooltips** — Uses `Tooltip` component or built-in `tooltip` prop (§5.12), no DaisyUI CSS tooltips, no manual hover management (§12 Pitfall 11), icon-only buttons have tooltips

**Floating UI** — Uses built-in interaction hooks (`useHover`/`useClick`), `strategy: 'fixed'` for portals (§12 Pitfall 12), `cloneElement` strips `ref` from child props (§12 Pitfall 13)

**UX** — Panel-specific skeletons (§5.7), infinite scroll (§5.8), 44px touch targets (§9.2), platform-gated features have actionable notices (§9.3)

**Code** — No `bg-${variant}` interpolation (§12 Pitfall 1), no unused props, no `any` types, no Hungarian notation, no native `<button>` where `<Button>` component should be used

**Accessibility** — `aria-label` on icon buttons, `role="navigation"`, keyboard nav, heading order, labeled form fields (§10)

---

## 12. Common pitfalls

Real mistakes from production. Each one caused a bug or UI inconsistency.

### 🚫 Pitfall 1 — Dynamic Tailwind interpolation

`` bg-${variant}/10 `` works in dev but is **tree-shaken in production**. Use static class mappings. (§2.1)

```tsx
// ❌ className={`bg-${variant}/10 hover:bg-${variant}/20 text-${variant}`}

// ✅ Static mapping — all classes visible to Tailwind scanner
const STYLES = {
  accent: { bg: 'bg-accent/10', hover: 'hover:bg-accent/20', text: 'text-accent' },
  info:   { bg: 'bg-info/10',   hover: 'hover:bg-info/20',   text: 'text-info' },
}
```

Or simplify the design so dynamic variants aren't needed.

### 🚫 Pitfall 2 — Hardcoded colors in shared components (✅ Fixed 2026-02-12)

`Dialog.tsx` used `bg-white`, `bg-slate-900/40`, `shadow-slate-900/10` → broke dark mode for **every** modal. Always audit the full component tree. Use semantic tokens: `bg-base-100`, `bg-base-content/40`, `shadow-xl`. (§2.1, §6.1)

> ✅ Fixed: `Dialog.tsx` now uses `bg-base-100`, `bg-base-content/40`, `rounded-box`, `shadow-xl`, `flex flex-col overflow-hidden`.

### 🚫 Pitfall 3 — Conflicting CSS display classes

`md:block md:flex` — both set `display`, last one wins (fragile). Use one per breakpoint: `hidden md:flex`.

### 🚫 Pitfall 4 — Multiple dropdowns open simultaneously

Users could open overlapping `Select`/`SearchableSelect` panels. Fixed via `useSelectExclusion` hook — new dropdown components MUST call it. (§5.3)

```tsx
const id = useId()
useSelectExclusion(id, isOpen, useCallback(() => setIsOpen(false), []))
```

### 🚫 Pitfall 5 — `h-full` inside `max-height` parent (scroll breaks)

`h-full` requires explicit parent `height` (not `max-height`). Inside modals, use `flex-1 min-h-0` instead. (§6.1)

```tsx
// ❌ h-full can't resolve → scroll breaks silently
<ModalContent className="max-h-[90vh] overflow-hidden">
  <div className="h-full flex flex-col">
    <ScrollArea className="flex-1" />
  </div>
</ModalContent>

// ✅ Flex parent → flex-1 child
<ModalContent className="flex max-h-[90vh] flex-col overflow-hidden">
  <div className="flex min-h-0 flex-1 flex-col">
    <ScrollArea className="flex-1" />
  </div>
</ModalContent>
```

### 🚫 Pitfall 6 — Per-component `pushState`/`popstate`

Races with React StrictMode + Next.js router. Never manage history from components. (§6.1)

### 🚫 Pitfall 7 — Disabled toggle with "not supported"

Users don't know *why* or *what to do*. Replace with platform-aware actionable notice. (§9.3)

### 🚫 Pitfall 8 — Unused props in interfaces

Dead `onClose`, `onBack` = UX bugs. If a prop exists, wire it or remove it. (§6.1)

### 🚫 Pitfall 9 — Compound component nesting > 3 levels

Dot-notation deeper than 3 levels (e.g., `Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators.EditedBadge`) hurts discoverability and makes refactoring brittle. Max depth: **3 levels**. Beyond that, use flat named exports.

```tsx
// ❌ 6 levels deep — no IDE can autocomplete this
<Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators.EditedBadge />

// ✅ Flat — discoverable, refactorable
<MessageCard.EditedBadge />
// or just:
<EditedBadge />
```

### 🚫 Pitfall 10 — Polling for readiness instead of reacting

Using `retryWithBackoff` / `setInterval` to wait for an editor or sheet to be ready is imperative. Prefer reactive patterns (effects that respond to state changes):

```tsx
// ❌ Polling
retryWithBackoff(() => {
  const { editorInstance } = useChatStore.getState().chatRoom
  if (editorInstance) { editorInstance.insertContent(emoji); return true }
  return false
}, { maxAttempts: 6 })

// ✅ Reactive
useEffect(() => {
  if (sheetState === 'open' && pendingEmoji && editorInstance) {
    editorInstance.chain().focus().insertContent(pendingEmoji).run()
    clearPendingEmoji()
  }
}, [sheetState, pendingEmoji, editorInstance])
```

### 🚫 Pitfall 11 — Manual hover management in Floating UI (✅ Fixed 2026-02-16)

Reinventing hover with `useState(isHovering)` + `setTimeout` timers + custom `onMouseEnter`/`onMouseLeave` **bypasses Floating UI's interaction system**. The manual `onOpenChange` never synced with `useFloating`'s internal state — so `useDismiss`, `whileElementsMounted`, and position calculation were all disconnected.

```tsx
// ❌ Manual — disconnected from Floating UI
const [isHovering, setIsHovering] = useState(false)
const showTimer = useRef<NodeJS.Timeout>()
getReferenceProps({
  onMouseEnter: () => { showTimer.current = setTimeout(() => setIsHovering(true), 200) },
  onMouseLeave: () => { clearTimeout(showTimer.current); setIsHovering(false) }
})

// ✅ Built-in — fully integrated with useFloating
const hover = useHover(context, { delay: { open: 200, close: 0 }, move: false })
const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss, role])
```

Every Floating UI component in this project (`Popover`, `Select`, `HoverMenu`, `Tooltip`) now uses the built-in interaction hooks. (§6.4)

### 🚫 Pitfall 12 — `strategy: 'absolute'` in FloatingPortal (✅ Fixed 2026-02-16)

When a floating element renders in a `FloatingPortal` (at `<body>` level) with `strategy: 'absolute'`, its coordinates are relative to the document. If the element appears near the bottom edge, absolute coordinates extend the `<body>` → scrollbar appears → viewport resizes → `autoUpdate` fires → repositions → scrollbar disappears → **infinite scroll/glitch feedback loop**.

```tsx
// ❌ Causes scroll glitch in portals
useFloating({ /* strategy defaults to 'absolute' */ })

// ✅ Fixed — no document overflow possible
useFloating({ strategy: 'fixed' })
```

Use `strategy: 'fixed'` for all portalled tooltips. (§6.4)

### 🚫 Pitfall 13 — React 19 `ref`-as-prop breaking `cloneElement` (✅ Fixed 2026-02-16)

In React 19, `ref` is a **regular prop** in `element.props.ref`, not a separate `element.ref` field. Any `cloneElement` that spreads `...child.props` **silently overwrites** a merged ref:

```tsx
// ❌ In React 19, child.props.ref overwrites our mergedRef
cloneElement(child, {
  ref: mergedRef,        // set first...
  ...child.props         // ...overwritten by child.props.ref!
})

// ✅ Strip ref from child props, place merged ref LAST
const { ref: _, ...propsWithoutRef } = child.props ?? {}
cloneElement(child, getReferenceProps({
  ...propsWithoutRef,
  ref: mergedRef         // MUST come last
}))
```

**Also read child ref from both locations** for React 18+19 compatibility:

```tsx
const childRef = isValidElement(children)
  ? (children as any).props?.ref ?? (children as any).ref ?? null
  : null
const mergedRef = useMergeRefs([refs.setReference, childRef])
```

Affected components: `Tooltip.tsx`, `Popover.tsx` (`PopoverTrigger asChild`).

---

## 13. Component inventory

### Icons

| Export | Location | Purpose |
|---|---|---|
| `Icons` | `@icons` (`@components/icons/registry.ts`) | Centralized icon registry — single source of truth. All ~75 UI icons accessible via `Icons.name`. See §3.5 |
| `IconName` | `@icons` | TypeScript union type of all registered icon names (for type-safe icon props) |

### Shared UI

| Component | Location | Purpose |
|---|---|---|
| `Button` | `@components/ui/Button` | Buttons with variants, sizes, icons. Built-in `tooltip` + `tooltipPlacement` props |
| `TextInput` | `@components/ui/TextInput` | Text inputs with labels, validation |
| `Tooltip` | `@components/ui/Tooltip` | Floating UI tooltip (hover, `strategy: 'fixed'`, portal, touch-disabled) |
| `Popover` | `@components/ui/Popover` | Floating UI click popover (`PopoverTrigger`, `PopoverContent`, `PopoverClose`) |
| `HoverMenu` | `@components/ui/HoverMenu` | Floating UI hover menu (`HoverMenuTrigger`, `HoverMenuContent`, `HoverMenuItem`) |
| `Select` | `@components/ui/Select` | Custom dropdown (Floating UI + keyboard nav) |
| `SearchableSelect` | `@components/ui/SearchableSelect` | Dropdown with search |
| `ScrollArea` | `@components/ui/ScrollArea` | Styled scrollable containers |
| `ResizeHandle` | `@components/ui/ResizeHandle` | Panel resize handles |
| `Avatar` | `@components/ui/Avatar` | User avatars. Built-in `tooltip` + `tooltipPosition` props |
| `Tabs` | `@components/ui/Tabs` | Tab navigation |
| `CopyButton` | `@components/ui/CopyButton` | Copy-to-clipboard (supports `square` + `circle` shapes for icon-only buttons) |
| `CloseButton` | `@components/ui/CloseButton` | Close/dismiss (`Icons.close`) |
| `UnreadBadge` | `@components/ui/UnreadBadge` | Notification count badges |
| `Toggle` | `@components/ui/Toggle` | Toggle switches |
| `GlobalDialog` | `@components/ui/GlobalDialog` | Renders the global dialog from `dialogStore` |
| `Modal` / `ModalContent` | `@components/ui/Dialog` | Floating UI modal with `align` prop |

### Editor Toolbar

| Component | Location | Purpose |
|---|---|---|
| `EditorToolbar` | `@components/TipTap/toolbar/EditorToolbar` | Main desktop editor toolbar (formatting, media, settings) |
| `StyleSelect` | `@components/TipTap/toolbar/StyleSelect` | Block style dropdown (paragraph, headings) — uses global `Select` |
| `ToolbarButton` | `@components/TipTap/toolbar/ToolbarButton` | Generic toolbar button with tooltip + active state |

### Panels

| Component | Location | Purpose |
|---|---|---|
| `NotificationPanel` | `@components/notificationPanel/desktop` | Notification list with tabs |
| `BookmarkPanel` | `@components/bookmarkPanel/desktop` | Bookmark list with tabs |
| `NotificationPanelSkeleton` | `@components/notificationPanel/components` | Loading skeleton |
| `BookmarkPanelSkeleton` | `@components/bookmarkPanel/components` | Loading skeleton |
| `FilterPanelSkeleton` | `@components/TipTap/toolbar` | Loading skeleton |
| `GearPanelSkeleton` | `@components/TipTap/toolbar` | Loading skeleton |

### Settings panel

| Component | Location | Purpose |
|---|---|---|
| `SettingsPanel` | `@components/settings/SettingsPanel` | Shell (sidebar + content router) |
| `ProfileSection` | `@components/settings/components/ProfileSection` | Profile, bio, social links |
| `DocumentsSection` | `@components/settings/components/DocumentsSection` | Document list |
| `SecuritySection` | `@components/settings/components/SecuritySection` | Email management |
| `NotificationsSection` | `@components/settings/components/NotificationsSection` | Push + email prefs, iOS PWA notice |
| `SocialLinks` | `@components/settings/components/SocialLinks` | Social link management |

### Hooks

| Hook | Location | Purpose |
|---|---|---|
| `useInfiniteNotifications` | `@components/notificationPanel/hooks` | Infinite scroll for notifications |
| `useInfiniteBookmarks` | `@components/bookmarkPanel/hooks` | Infinite scroll for bookmarks |
| `useSelectExclusion` | `@components/ui/hooks/useSelectExclusion` | Dropdown mutual exclusion |
| `usePlatformDetection` | `@hooks/usePlatformDetection` | iOS/Android/desktop, PWA, push support |
| `usePWAInstall` | `@components/pwa/PWAInstallPrompt` | PWA install prompt |
| `useProfileUpdate` | `@components/settings/hooks/useProfileUpdate` | Profile save logic |
| `useSignOut` | `@components/settings/hooks/useSignOut` | Sign out logic |
| `useUsernameValidation` | `@components/settings/hooks/useUsernameValidation` | Username validation |
| `useBottomSheet` | `@hooks/useBottomSheet` | Simplified bottom sheet API (`openSheet`, `closeSheet`, `switchSheet`) |
| `useUpdateDocMetadata` | `@hooks/useUpdateDocMetadata` | React Query mutation for document metadata |

### Stores (Zustand)

| Store | Location | Purpose |
|---|---|---|
| `sheetStore` | `@stores/sheetStore` | Bottom sheet state machine (`SheetType`, `switchSheet`, overlay detection) |
| `dialogStore` | `@stores/dialogStore` | Global dialog state (`openDialog`, `closeDialog`, `DialogConfig`) |
| `chatStore` | `@stores/chatStore` | Chat room state (editor instance, emoji picker, message focus) |

---

## 14. Notes for maintainers

Adding a new pattern:

1. Check the component inventory (§13) first
2. Extend existing components before creating new ones
3. Document the pattern in this file
4. Keep examples small and theme-safe
