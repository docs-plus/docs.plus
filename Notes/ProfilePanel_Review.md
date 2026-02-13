# SettingsPanel — Design System & UX Review

> **Date:** 2026-02-12
> **Last Updated:** 2026-02-13 (mobile sidebar scroll fix + EditFAB CSS fix)
> **Reviewers:** UI/UX Team, Front-End Engineering, PM
> **Scope:** `packages/webapp/src/components/settings/` (all files)
> **Reference:** `Design_System_Global_v2.md` v3.1.0
> **Status:** ✅ **PHASES 1–5 COMPLETE + all post-implementation fixes** — All implementation work finished

---

## Executive Summary

The SettingsPanel (formerly ProfilePanel) is a modal-based settings hub rendered inside the app's `Modal`/`ModalContent` dialog. It features a sidebar-to-content master/detail layout with 4 tabs: Profile, Documents, Security, and Notifications.

**Overall assessment:** ~~The component has solid architectural foundations (dynamic imports, clear separation of concerns, responsive intent) but has **43 design system violations**, **several responsive/mobile UX gaps**, and **code quality issues** that need attention before it meets production standards.~~ **All 43 design system violations, mobile UX gaps, and code quality issues have been resolved across Phases 1–4.** The module has been fully renamed, restructured, and brought to production-ready standards.

**Current file structure** (`packages/webapp/src/components/settings/`):

| File | Lines | Role |
|------|-------|------|
| `SettingsPanel.tsx` | 345 | Shell: sidebar + content router |
| `components/ProfileSection.tsx` | 318 | Profile picture, name, bio, social links |
| `components/DocumentsSection.tsx` | 262 | Document list with search + pagination |
| `components/SecuritySection.tsx` | 100 | Email management |
| `components/NotificationsSection.tsx` | 661 | Push + email notification preferences (incl. iOS PWA notice) |
| `components/SocialLinks.tsx` | 268 | Social link management |
| `constants.ts` | 92 | Social media domain/icon mapping |
| `types.ts` | 48 | Link types + notification preferences |
| `hooks/useProfileUpdate.ts` | 59 | Profile save logic |
| `hooks/useSignOut.ts` | 22 | Sign out logic |
| `hooks/useUsernameValidation.ts` | — | Username validation |
| `index.ts` | 9 | Barrel exports |

**Usage contexts:**
- `HomePage.tsx` → Avatar click → Modal (size `4xl`) — imports `SettingsPanel`
- `ToolbarDesktop.tsx` → Folder icon → Modal (size `4xl`) — imports `SettingsPanel`
- `PadTitle.tsx` → Profile button → Modal (size `5xl`/`md`) — imports `SettingsPanel`
- `MobilePadTitle.tsx` → Profile button → Modal (size `4xl`/`md`) — imports `SettingsPanel`

---

## 1. Design System Violations

### 1.1 Hardcoded Colors (🚫 Rule 1 — Use daisyUI for visuals)

| File | Line | Violation | Fix |
|------|------|-----------|-----|
| `ProfilePanel.tsx` | 149 | `ring-white` on Avatar | `ring-base-100` |
| `ProfileContent.tsx` | 216 | `bg-black/40` overlay | Acceptable (image overlay) — no change needed |
| `ProfileContent.tsx` | 220 | `text-white` on spinner | Acceptable (over dark overlay) — no change needed |
| `ProfileContent.tsx` | 222 | `text-white` on camera icon | Acceptable (over dark overlay) — no change needed |

**Upstream issue — `Dialog.tsx`** (affects ALL modals):

| File | Line | Violation | Fix |
|------|------|-----------|-----|
| `Dialog.tsx` | 107 | `bg-slate-900/40` overlay | `bg-neutral/40` or `bg-base-content/40` |
| `Dialog.tsx` | 112 | `bg-white` modal surface | `bg-base-100` |
| `Dialog.tsx` | 112 | `shadow-slate-900/10` | `shadow-xl` (remove color) |
| `Dialog.tsx` | 112 | `rounded-2xl` | `rounded-box` |

> ⚠️ **The Dialog.tsx issues are critical** — they break dark mode for every modal in the app, not just ProfilePanel.

### 1.2 Arbitrary Radius Tokens (🚫 Rule 2 — No arbitrary radii)

The design system specifies: `rounded-box` (16px, panels/cards), `rounded-field` (8px, inputs), `rounded-selector` (8px, buttons/chips).

**Violation count by file:**

| File | `rounded-2xl` | `rounded-xl` | `rounded-lg` | Total |
|------|:---:|:---:|:---:|:---:|
| `ProfilePanel.tsx` | 1 | 2 | 3 | 6 |
| `ProfileContent.tsx` | 4 | — | — | 4 |
| `SecurityContent.tsx` | 1 | 1 | — | 2 |
| `NotificationsContent.tsx` | 3 | 1 | — | 4 |
| `SocialLinks.tsx` | — | 2 | 1 | 3 |
| `DocumentsContent.tsx` | — | 1 | — | 1 |
| **Total** | **9** | **7** | **4** | **20** |

**Fix mapping:**
- `rounded-2xl` on `<section>` cards → `rounded-box`
- `rounded-xl` on action items, links, notices → `rounded-box`
- `rounded-lg` on user info header, icon containers → `rounded-field`
- Skeleton `rounded-2xl` → `rounded-box`
- Skeleton `rounded-lg` → `rounded-field`

### 1.3 Icon Consistency (🚫 Review checklist — Icons must be Lucide `Lu*`)

**Material Design icons (`Md*`) found — 13 unique icons across 4 files:**

| File | Md* Icons | Lucide Replacement |
|------|-----------|-------------------|
| `ProfileContent.tsx` | `MdCameraAlt` | `LuCamera` |
| `SecurityContent.tsx` | `MdSecurity`, `MdInfo` | `LuShield`, `LuInfo` |
| `NotificationsContent.tsx` | `MdNotifications`, `MdSchedule`, `MdEmail` | `LuBell`, `LuClock`, `LuMail` |
| `SocialLinks.tsx` | `MdAdd`, `MdDelete`, `MdEmail`, `MdLink`, `MdOpenInNew`, `MdPhone` | `LuPlus`, `LuTrash2`, `LuMail`, `LuLink`, `LuExternalLink`, `LuPhone` |

**Other non-Lucide icons:**

| File | Icon | Source | Replacement |
|------|------|--------|------------|
| `ProfilePanel.tsx` | `FaGithub` | Font Awesome | `LuGithub` |
| `ProfileContent.tsx` | `CgSpinner` | CG icons | daisyUI `loading loading-spinner` class |

> **Exception:** `constants.ts` uses `Fa*` and `Si*` icons for social media brand icons. This is acceptable — brand icons have no Lucide equivalent and should remain as-is.

### 1.4 Dynamic Class Names (Tailwind purge issue)

```tsx
// ProfilePanel.tsx line 207 — BROKEN for Tailwind tree-shaking
className={`group bg-${action.variant}/10 hover:bg-${action.variant}/20 ...`}
// Also line 209
className={`text-${action.variant}`}
```

These dynamic class interpolations (`bg-${action.variant}/10`) **will not be included in the production CSS bundle** because Tailwind cannot statically analyze them. They work only if some other file coincidentally uses the same classes.

**Fix:** Use a static mapping object:
```tsx
const VARIANT_STYLES = {
  accent: { bg: 'bg-accent/10', bgHover: 'hover:bg-accent/20', text: 'text-accent' },
  info: { bg: 'bg-info/10', bgHover: 'hover:bg-info/20', text: 'text-info' },
  error: { bg: 'bg-error/10', bgHover: 'hover:bg-error/20', text: 'text-error' }
}
```

---

## 2. Responsive / Mobile Issues

### 2.1 Nested Scroll Containers (🔴 Critical) — ✅ Fixed

**Problem:** The `Dialog.tsx` modal wrapper applied `max-h-[90vh] overflow-y-auto` on the modal container. Inside, `ProfilePanel.tsx` had its own `ScrollArea` for both the sidebar and the content area. This created **nested scrollable regions**, causing double scrollbars and broken scroll on mobile.

**Fix (applied):** Three-part fix:
1. `Dialog.tsx` → `overflow-hidden` + `flex flex-col` on ModalContent (children handle scroll; flex layout enables `flex-1` height propagation)
2. `SettingsPanel.tsx` root → `flex-1 min-h-0` (fills available flex space instead of broken `h-full`/`h-[100dvh]`)
3. `SettingsPanel.tsx` `<aside>` → `flex-1 min-h-0` on mobile (was `shrink-0` which prevented the aside from respecting the modal's `max-h-[90vh]` constraint, causing the ScrollArea inside to never activate and the Sign Out button to be clipped off-screen). Desktop retains `md:flex-none md:shrink-0` for fixed sidebar width. **(Added 2026-02-13)**

### 2.2 CSS Display Conflict on Sidebar

```tsx
// ProfilePanel.tsx line 136-138
className={`... ${showContent ? 'hidden md:block md:flex' : 'flex'}`}
```

`md:block` and `md:flex` are **conflicting display properties**. Since `md:flex` appears after `md:block` in the Tailwind class list, `md:flex` wins, but this is fragile and confusing.

**Fix:** Remove `md:block`, just use `hidden md:flex`.

### 2.3 No Close/Dismiss Button (🔴 UX Critical)

The ProfilePanel has no visible close button. Users must:
- Click outside the modal (not obvious on mobile)
- Press Escape (desktop only)

**There is no way to close the modal from inside the ProfilePanel on mobile** unless the user figures out to tap the overlay area. The `onClose` prop is declared but literally unused (`_onClose`).

**Fix:** Add a close button to the sidebar header (mobile) or both views. Wire up the `onClose` prop.

### 2.4 Mobile Height Handling — ✅ Fixed

**Problem:** `h-[100dvh]` inside `max-h-[90vh]` modal — conflicting constraints. Content was clipped with no scroll.

**Fix (applied):** SettingsPanel root uses `flex-1 min-h-0 flex-col overflow-hidden` on mobile (fills the flex parent), and `md:h-[min(85vh,800px)] md:flex-none md:flex-row` on desktop. CSS `height: 100%` was removed entirely — the flex-based approach doesn't depend on explicit parent height, resolving the core CSS spec limitation that caused the scroll bug.

### 2.5 No Transition Animations on Tab Switch (Mobile)

On mobile, switching tabs is a hard CSS toggle (`hidden`/`flex`). There's no slide or fade animation, making the transition feel jarring compared to native mobile UX patterns.

**Trade-off:** Adding animations increases complexity. Consider at minimum a CSS transition or a simple fade.

### 2.6 Sticky Save Button Behavior (ProfileContent)

```tsx
// ProfileContent.tsx line 314
className="sticky bottom-0 -mx-4 ... sm:-mx-6 ..."
```

The `sticky bottom-0` on the Save button depends on the nearest scroll ancestor. Since `ProfileContent` is rendered inside `ScrollArea`, the sticky behavior may not work as expected because ScrollArea creates its own scroll context.

**Fix:** Verify sticky works within ScrollArea's viewport. If not, move the Save button outside the ScrollArea.

---

## 3. Code Quality Issues

### 3.1 Unused `onClose` Prop

```tsx
// ProfilePanel.tsx line 102
const ProfilePanel = ({ defaultTab = 'profile', onClose: _onClose }: ProfilePanelProps) => {
```

The `onClose` prop is:
- Declared in the interface
- Destructured and aliased to `_onClose` (signaling "unused")
- Never called anywhere in the component
- **Passed by 3 callers** (`HomePage.tsx`, `ToolbarDesktop.tsx`, `MobilePadTitle.tsx`)

This is dead code. It should be wired to a close button or removed from the interface.

### 3.2 Generic Skeleton for All Tabs

All 4 tabs use the same `ContentSkeleton`:
```tsx
const ProfileContent = dynamic(() => import('./ProfileContent'), {
  loading: () => <ContentSkeleton />   // Same for all 4
})
```

Per the design system: *"Use panel-specific skeleton loaders instead of generic spinners."* Each tab has different structure (Profile: avatar + form, Documents: table, Security: single form, Notifications: toggle rows). A single skeleton doesn't match any of them accurately.

### 3.3 Tab State Loss on Switch

The `renderContent()` function mounts/unmounts components on tab switch. If a user is editing Profile, switches to Security, then back — all unsaved Profile changes are **lost** because the component remounts.

**Trade-off:** Keeping all tabs mounted (with `display: none/block`) preserves state but increases DOM size. An alternative is to lift form state to a shared context or URL params.

### 3.4 `any` Type in DocumentsContent

```tsx
// DocumentsContent.tsx line 161
{data?.docs.map((doc: any) => (
```

`any` bypasses TypeScript safety. Should define a `Document` interface.

### 3.5 React Query v3 Syntax

```tsx
// DocumentsContent.tsx line 31-34
const { isLoading, isError, data } = useQuery(
  ['documents', currentPage, searchQuery],
  fetchDocuments
)
```

This uses React Query v3 array key syntax. If the project is on v4/v5, this should use the object syntax (`{ queryKey, queryFn }`).

### 3.6 `Promise.allSettled` Pattern in Avatar Upload

```tsx
// ProfileContent.tsx lines 99-102
const [uploadResult, dbResult] = await Promise.allSettled([
  uploadFileToStorage(...),
  updateAvatarInDB(...)
])
```

Running upload and DB update in parallel means if the upload fails, the DB might still be updated with a URL that doesn't exist. These should be sequential: upload first, then update DB on success.

---

## 4. Accessibility Issues

| Issue | File | Line | Fix |
|-------|------|------|-----|
| No `aria-label` on avatar upload button | `ProfileContent.tsx` | 203 | Add `aria-label="Upload profile picture"` |
| No `role` or `aria` on sidebar nav | `ProfilePanel.tsx` | 160 | Add `role="navigation"` and `aria-label="Settings"` |
| Avatar overlay has no alt text for screen readers | `ProfileContent.tsx` | 215-224 | Add `aria-hidden="true"` to overlay |
| Heading hierarchy: uses `<h2>` and `<h3>` inconsistently | Multiple | — | Standardize: `<h2>` for section titles only |
| `<p>` used for "SETTINGS" and "OPEN SOURCE" section labels | `ProfilePanel.tsx` | 161, 195 | Use `<h3>` or aria for grouping |
| File input has no label | `ProfileContent.tsx` | 226 | Add `aria-label` to hidden file input |
| Tab navigation only via mouse click | `ProfilePanel.tsx` | — | Add keyboard nav (arrow keys between tabs) |

---

## 5. UI/UX Assessment

### 5.1 Sidebar Space Allocation

The sidebar dedicates ~40% of vertical space to GitHub/Open Source actions (3 action cards + "View on GitHub" link). This pushes core Settings navigation above the fold only on larger screens.

**Recommendation:** Move GitHub actions below a collapsible section or to a footer area. Prioritize the Settings navigation + Sign Out.

### 5.2 Sign Out Placement — ✅ Addressed (2026-02-13)

Sign out is pinned at the bottom of the sidebar with `mt-auto shrink-0`, which is good on desktop. Previously on mobile, the `<aside>` had `shrink-0` which prevented the sidebar from being height-constrained within the modal, causing the ScrollArea to never activate and the Sign Out button to be pushed off-screen.

**Fix (applied):** The `<aside>` now uses `flex-1 min-h-0` on mobile (with `md:flex-none md:shrink-0` for desktop). This allows the sidebar to be properly constrained by the modal's `max-h-[90vh]`, the ScrollArea activates for overflow content, and the Sign Out button is always visible at the bottom via `mt-auto`.

### 5.3 Avatar Ring in Dark Mode

```tsx
className="shrink-0 shadow-sm ring-2 ring-white"
```

`ring-white` will look wrong on dark themes where the background isn't white. Should be `ring-base-100` to match the surrounding surface.

### 5.4 Empty State Inconsistency

`SocialLinks.tsx` uses a custom empty state:
```tsx
<div className="border-base-300 ... border-2 border-dashed ...">
  <MdLink size={20} ... />
  <p className="text-base-content text-xs font-medium">No links added yet</p>
  <p className="text-base-content/50 ...">Add your social profiles above</p>
</div>
```

Per design system empty state pattern:
- Icon container should be `bg-base-200 size-12 rounded-full`
- Title: `text-base-content/60 font-medium`
- Description: `text-base-content/40 text-sm`
- Icon size: `24` not `20`

### 5.5 Documents Table on Small Screens

The documents table hides "Last Modified" on mobile (`hidden sm:table-cell`), which is good. But the table itself (`table-zebra`) may feel cramped on small screens within the modal. Consider a card-based list layout on mobile instead of a table.

---

## 6. Summary of Required Changes

### Priority 1 — Critical (Dark Mode / Crashes)

| # | Issue | Files |
|---|-------|-------|
| 1 | Fix `Dialog.tsx` hardcoded `bg-white`, `bg-slate-*`, `shadow-slate-*` | `Dialog.tsx` |
| 2 | Fix `ring-white` → `ring-base-100` on Avatar | `ProfilePanel.tsx` |
| 3 | Fix dynamic class names (`bg-${variant}`) for Tailwind purge | `ProfilePanel.tsx` |
| 4 | Fix nested scroll containers (Dialog + ScrollArea) | `Dialog.tsx`, `ProfilePanel.tsx` |
| 5 | Add close button, wire `onClose` prop | `ProfilePanel.tsx` |

### Priority 2 — Design System Compliance

| # | Issue | Files |
|---|-------|-------|
| 6 | Replace all `rounded-2xl/xl/lg` → semantic tokens | All 6 content files |
| 7 | Replace `Md*` icons → `Lu*` Lucide icons | 4 files (13 icons) |
| 8 | Replace `FaGithub` → `LuGithub` | `ProfilePanel.tsx` |
| 9 | Replace `CgSpinner` → daisyUI `loading` class | `ProfileContent.tsx` |
| 10 | Fix CSS display conflict `md:block md:flex` | `ProfilePanel.tsx` |

### Priority 3 — UX Improvements

| # | Issue | Files |
|---|-------|-------|
| 11 | Add tab-specific skeleton loaders | `ProfilePanel.tsx` + new skeletons |
| 12 | Add mobile transition animation for tab switch | `ProfilePanel.tsx` |
| 13 | Fix mobile height (`h-[100dvh]` inside `90vh` modal) | `ProfilePanel.tsx` |
| 14 | Fix sticky Save button within ScrollArea | `ProfileContent.tsx` |
| 15 | Rearrange sidebar: reduce GitHub section footprint | `ProfilePanel.tsx` |

### Priority 4 — Code Quality

| # | Issue | Files |
|---|-------|-------|
| 16 | Remove or use `onClose` prop | `ProfilePanel.tsx` |
| 17 | Type `doc: any` properly | `DocumentsContent.tsx` |
| 18 | Fix `Promise.allSettled` avatar upload race condition | `ProfileContent.tsx` |
| 19 | Consider preserving tab state across switches | `ProfilePanel.tsx` |
| 20 | Add accessibility attributes (`aria-label`, heading hierarchy) | Multiple |

---

## 7. Trade-Off Analysis: Code vs. UI/UX

| Decision | Code Impact | UX Impact | Recommendation |
|----------|-------------|-----------|----------------|
| Generic vs. tab-specific skeletons | More components to maintain | Smoother perceived loading | ✅ Add specific skeletons |
| Mount/unmount vs. keep-all-tabs-mounted | Simpler code (current) | State loss on switch | ⚖️ Acceptable for now; lift form state if users report issues |
| CSS toggle vs. animated transitions | Zero extra JS (current) | Jarring mobile experience | ✅ Add subtle CSS transition |
| Sidebar GitHub actions prominence | Easy to maintain (static data) | Distracts from core settings | ✅ Deprioritize (collapse or move to footer) |
| Avatar upload parallel vs. sequential | Faster (current) but race condition risk | Silent failures | ✅ Make sequential |
| `onClose` wiring | Minor code change | Major mobile UX fix | ✅ Must fix |
| Dynamic Tailwind classes | "Clever" code (less duplication) | Zero UX impact | ✅ Fix for correctness (broken CSS) |

---

## 8. SettingsPanel Redesign Specification

> **Status:** ✅ IMPLEMENTATION COMPLETE (Phases 1–4)
> **Date:** 2026-02-12
> **Authors:** Head of UI/UX, PM, Front-End Engineering Lead, Supabase Team
> **Reference:** `Design_System_Global_v2.md` v3.0.0

### 8.1 Current State Analysis (from production screenshots)

**Desktop (4 tabs reviewed):**

| Issue | Severity | Screenshot Evidence |
|-------|----------|-------------------|
| No close/dismiss button on modal | 🔴 Critical | All 4 desktop views — users trapped on mobile |
| Sidebar wastes ~40% of vertical space on GitHub actions | 🟡 Medium | All desktop views — 3 colored cards + "View on GitHub" push nav out of view |
| Security tab: ~70% empty white space | 🟡 Medium | Security tab — only email section + notice, massive empty area |
| Inconsistent section card borders | 🟠 Low | Profile vs Documents — dashed vs solid, different border styles |
| Avatar `ring-white` breaks dark mode | 🔴 Critical | Profile tab sidebar — white ring around avatar |
| Documents table shows "Unknown" for all owners | 🟡 Data | Documents tab — Supabase join may be missing or RLS issue |
| "Save Changes" button is full-width primary at bottom | 🟢 Good | Profile tab — visible and clear CTA |
| Pagination uses blue highlight for current page | 🟢 Good | Documents tab — standard pattern |

**Mobile (5 views reviewed):**

| Issue | Severity | Screenshot Evidence |
|-------|----------|-------------------|
| No close/back button on sidebar view | 🔴 Critical | Mobile sidebar — user cannot dismiss modal |
| Massive empty space below Sign Out on sidebar | 🟡 Medium | Mobile sidebar — bottom 30% is completely empty |
| Sidebar scrollbar track visible (raw browser scrollbar) | 🟡 Medium | Mobile sidebar — should use ScrollArea |
| Back arrow + title header works well | 🟢 Good | All mobile content views — clear navigation pattern |
| Security tab: ~60% empty space | 🟡 Medium | Mobile security — sparse content |
| "Save Changes" button at bottom edge (may be clipped) | 🟠 Low | Mobile profile — barely visible at fold |
| Content views feel like full-screen sheets | 🟢 Good | Mobile content — correct pattern |
| Documents hides "Last Modified" column | 🟢 Good | Mobile documents — responsive table |

### 8.2 Industry Benchmarks

Before redesigning, we studied these production-grade settings panels:

| Product | Desktop Pattern | Mobile Pattern | Key Takeaway |
|---------|----------------|----------------|--------------|
| **GitHub** | Full-page sidebar + content | Same layout (responsive) | Sidebar stays visible, compact nav |
| **Notion** | Modal, sidebar + content | Full-screen sheet | Close (X) button always visible |
| **Linear** | Modal, sidebar + content | Full-screen, stacked views | Smooth transitions, minimal chrome |
| **Slack** | Full-page, sidebar + content | Full-screen, drill-down | Sign out near profile, not buried |
| **Figma** | Modal, tabs across top | Full-screen sheet | Tab headers, not sidebar on mobile |

**Consensus patterns we MUST follow:**
1. ✅ Close button always visible (top-right or header)
2. ✅ Mobile: full-screen sheet with back navigation
3. ✅ Sidebar: navigation-first, minimal promotional content
4. ✅ Content: scrollable independently from sidebar
5. ✅ Empty states: centered with icon + description
6. ✅ Sticky action buttons (Save) at content bottom
7. ✅ Smooth transitions between views (mobile)

### 8.3 Redesign: Layout Architecture

#### Desktop (≥768px / `md:` breakpoint)

```
┌──────────────────────────────────────────────────────────┐
│                    Modal (max-w-4xl)                      │
│  ┌───────────────┬──────────────────────────────────────┐ │
│  │   SIDEBAR     │         CONTENT AREA                 │ │
│  │   (280px)     │         (flex-1)                     │ │
│  │               │                                    [X]│ │
│  │  ┌─────────┐  │  ┌────────────────────────────────┐  │ │
│  │  │ Avatar  │  │  │                                │  │ │
│  │  │ Name    │  │  │  Content scrolls here          │  │ │
│  │  │ Email   │  │  │  (ScrollArea)                  │  │ │
│  │  └─────────┘  │  │                                │  │ │
│  │               │  │                                │  │ │
│  │  SETTINGS     │  │                                │  │ │
│  │  ○ Profile    │  │                                │  │ │
│  │  ● Documents  │  │                                │  │ │
│  │  ○ Security   │  │                                │  │ │
│  │  ○ Notifs     │  │                                │  │ │
│  │               │  │                                │  │ │
│  │  ─────────    │  │                                │  │ │
│  │  SUPPORT      │  │                                │  │ │
│  │  ☆ GitHub     │  │                                │  │ │
│  │  💡 Feature   │  │                                │  │ │
│  │  🐛 Issue     │  ├────────────────────────────────┤  │ │
│  │               │  │ [Sticky Footer: Save button]   │  │ │
│  │  [Sign Out]   │  └────────────────────────────────┘  │ │
│  └───────────────┴──────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Key desktop changes from current:**
1. **Close button (X)** in top-right of content area header
2. **Sidebar compacted**: GitHub/support as simple text links (not cards)
3. **Sign Out** pinned to sidebar bottom (current — keep)
4. **Content area** has its own header row with tab title
5. **Sticky Save** pinned at bottom of content ScrollArea, NOT inside scroll content

#### Mobile (<768px)

**View 1: Sidebar (Navigation)**

```
┌──────────────────────────────┐
│  [X Close]     Settings      │  ← Header with close button
│──────────────────────────────│
│                              │
│  ┌──────────┐                │
│  │ Avatar   │  Name          │
│  └──────────┘  email@...     │
│                              │
│──────────────────────────────│
│                              │
│  Profile                  >  │
│  Documents                >  │
│  Security                 >  │
│  Notifications            >  │
│                              │
│──────────────────────────────│
│  ☆ Star on GitHub            │
│  💡 Request a Feature        │
│  🐛 Report an Issue          │
│──────────────────────────────│
│                              │
│  [Sign Out]                  │
│                              │
└──────────────────────────────┘
```

**View 2: Content (drill-down)**

```
┌──────────────────────────────┐
│  [← Back]     Profile        │  ← Back navigates to sidebar
│──────────────────────────────│
│                              │
│  ┌──────────────────────────┐│
│  │  Profile Picture section ││
│  └──────────────────────────┘│
│  ┌──────────────────────────┐│
│  │  Account Information     ││
│  └──────────────────────────┘│
│  ┌──────────────────────────┐│
│  │  Social Links            ││
│  └──────────────────────────┘│
│                              │
│  ┌──────────────────────────┐│
│  │  [Save Changes]          ││  ← Sticky at bottom
│  └──────────────────────────┘│
└──────────────────────────────┘
```

**Key mobile changes from current:**
1. **Close button (X)** on sidebar view header — users can dismiss
2. **Back arrow** on content views — consistent with current (keep)
3. **Full-screen modal** — use `size="full"` on mobile instead of `4xl`
4. **Sign Out** visible without scrolling past promotional content
5. **Support links** compressed to simple text rows (not colored cards)
6. **Fade/slide transition** between sidebar ↔ content views

### 8.4 Redesign: Component Token Mapping

Every visual property must map to a design system token. No hardcoded values.

#### Sidebar

| Element | Current | Redesign |
|---------|---------|----------|
| Container bg | `bg-base-200` | `bg-base-200` (keep) |
| User info header bg | `bg-base-200` with `rounded-lg` | `bg-base-200 rounded-box` |
| Avatar ring | `ring-white` | `ring-base-100` |
| Nav item active | `variant="primary"` | `variant="primary"` (keep) |
| Nav item inactive | `text-base-content hover:bg-base-200` | Keep |
| Section label | `<p>` with `text-[10px]` | `<h3>` with `text-xs text-base-content/50 font-semibold uppercase tracking-wider` |
| Divider | `divider` class | `border-base-300 border-t` (simpler) |
| Support links | Colored cards (`bg-${variant}/10`) | Simple text rows: `text-base-content/70 hover:text-base-content` |
| Sign Out button | Bottom-pinned button | Keep, but add `mt-auto` for proper pinning |

#### Content Area

| Element | Current | Redesign |
|---------|---------|----------|
| Container bg | `bg-base-100` | `bg-base-100` (keep) |
| Content header | None | `border-base-300 border-b px-6 py-4` with title + CloseButton |
| Section cards | `rounded-2xl border-base-300 border` | `rounded-box border-base-300 border` |
| Section titles | `<h2> font-semibold` | `text-base font-semibold text-base-content` |
| Section descriptions | Various | `text-sm text-base-content/60` |
| Inputs | `rounded-xl` | `rounded-field` via daisyUI `input input-bordered` |
| Buttons | Mixed | Follow design system button variants |
| Save button container | `sticky bottom-0` (inside ScrollArea) | Separate `div` outside ScrollArea, `border-base-300 border-t bg-base-100 px-6 py-4` |
| Icons | `Md*`, `Fa*`, `Cg*` | `Lu*` only (except brand icons in constants.ts) |

#### Dialog.tsx (upstream fix — affects ALL modals)

| Property | Current | Redesign |
|----------|---------|----------|
| Overlay | `bg-slate-900/40` | `bg-base-content/40` |
| Surface | `bg-white` | `bg-base-100` |
| Shadow | `shadow-xl shadow-slate-900/10` | `shadow-xl` |
| Radius | `rounded-2xl` | `rounded-box` |
| Overflow | `max-h-[90vh] overflow-y-auto` | `max-h-[90vh] overflow-hidden` (children handle scroll) |
| Layout | Block (default) | `flex flex-col` — enables `flex-1` children to fill available height correctly (CSS `height: 100%` requires explicit parent height; `flex-1` does not) |

### 8.5 Redesign: File-by-File Implementation Plan

#### Phase 1 — Foundation (Dialog + ProfilePanel shell)

| # | File | Changes | Est. Lines Changed |
|---|------|---------|-------------------|
| 1.1 | `Dialog.tsx` | Fix hardcoded colors, overflow, radius | ~5 lines |
| 1.2 | `ProfilePanel.tsx` | Redesign shell: add close button, wire `onClose`, fix sidebar layout, compress support section, fix display conflict, fix mobile height, add content header, move scroll handling | ~80 lines |
| 1.3 | `CloseButton.tsx` | Replace `MdClose` → `LuX` | ~1 line |

#### Phase 2 — Content Tabs (Design System Compliance)

| # | File | Changes | Est. Lines Changed |
|---|------|---------|-------------------|
| 2.1 | `ProfileContent.tsx` | Replace `MdCameraAlt` → `LuCamera`, replace `CgSpinner` → daisyUI `loading`, fix all `rounded-2xl` → `rounded-box`, fix avatar upload to sequential, fix sticky Save button | ~25 lines |
| 2.2 | `DocumentsContent.tsx` | Fix `rounded-xl` → `rounded-box`, type `doc: any` properly, update React Query syntax if v4+ | ~10 lines |
| 2.3 | `SecurityContent.tsx` | Replace `MdSecurity` → `LuShield`, `MdInfo` → `LuInfo`, fix `rounded-2xl/xl` → `rounded-box` | ~8 lines |
| 2.4 | `NotificationsContent.tsx` | Replace `MdNotifications` → `LuBell`, `MdSchedule` → `LuClock`, `MdEmail` → `LuMail`, fix `rounded-2xl/xl` → `rounded-box` | ~12 lines |
| 2.5 | `SocialLinks.tsx` | Replace 6 `Md*` icons → `Lu*` equivalents, fix `rounded-xl/lg` → `rounded-box/field`, fix empty state to match design system pattern | ~15 lines |

#### Phase 3 — UX Polish

| # | File | Changes | Est. Lines Changed |
|---|------|---------|-------------------|
| 3.1 | `ProfilePanel.tsx` | Add tab-specific skeleton loaders (inline, not separate files — KISS), add CSS fade transition for mobile tab switch | ~40 lines |
| 3.2 | `ProfilePanel.tsx` | Add `role="navigation"`, `aria-label`, heading hierarchy fixes | ~10 lines |
| 3.3 | `ProfileContent.tsx` | Add `aria-label` to avatar upload, file input | ~3 lines |
| 3.4 | `ProfilePanel.tsx` | Variant styles static mapping (Tailwind purge fix) | ~10 lines |

### 8.6 Supabase Team Notes

**Schema context** (`public.users` table):

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | NO | PK, from auth.users |
| `username` | text | NO | Unique |
| `email` | text | NO | From auth |
| `full_name` | text | YES | Display name |
| `display_name` | text | YES | Alternate display |
| `avatar_url` | text | YES | Storage URL |
| `avatar_updated_at` | timestamptz | YES | Cache-busting |
| `profile_data` | jsonb | NO | Social links, about, etc. |
| `status` | enum | NO | User status |
| `online_at` | timestamptz | YES | Last seen |
| `created_at` | timestamptz | NO | Registration |
| `updated_at` | timestamptz | NO | Last profile update |

**Documents "Unknown" owner issue:**
The Documents tab shows "Unknown" for all document owners. This is likely because:
1. The documents query doesn't JOIN with the `users` table, OR
2. The RLS policy doesn't allow reading other users' info for ownership display

**Recommendation:** Verify the documents API endpoint includes owner data, or add a lightweight `owner_name` field to the response.

**Avatar upload race condition:**
The current `Promise.allSettled` uploads the file and updates the DB row simultaneously. If the storage upload fails, the DB will have a stale/invalid `avatar_url`.

**Fix:** Sequential upload — storage first, then DB update on success. Use `avatar_updated_at` for cache-busting.

### 8.7 DRY / KISS / SOLID Compliance Review

| Principle | Before | After (✅ Implemented) |
|-----------|--------|------------------------|
| **DRY** | ❌ `ContentSkeleton` duplicated for all 4 tabs; variant styles repeated via dynamic strings; `SOCIAL_MEDIA_DOMAINS` duplicated `SOCIAL_MEDIA_ICONS` keys; dead `onBack` prop in all 4 content components | ✅ Tab-specific inline skeletons; support links as static text rows; `SOCIAL_MEDIA_DOMAINS` derived from `Object.keys(SOCIAL_MEDIA_ICONS)`; `onBack` removed from all components |
| **KISS** | ❌ `h-[100dvh]` inside `max-h-[90vh]` modal = conflicting constraints; `md:block md:flex` = conflicting display; dynamic Tailwind classes that silently fail | ✅ `h-full` mobile, `md:h-[min(85vh,800px)]` desktop; `hidden md:flex`; static support link rendering |
| **SRP** | ⚖️ `useProfileUpdate.ts` mixed store access patterns + `@ts-ignore` | ✅ `useProfileUpdate.ts` cleaned: destructured `display_name` out of payload, removed `@ts-ignore`, uses `user` from hook scope |
| **OCP** | ❌ Adding a new tab edits 3 places: `SETTINGS_TABS`, `renderContent()`, dynamic import | ⚖️ Acceptable for 4 tabs. Over-abstracting violates KISS. |
| **LSP** | ✅ N/A | ✅ N/A |
| **ISP** | ❌ `onClose` declared but unused; `onBack` declared but unused in all 4 content components | ✅ `onClose` wired to close/back buttons + history cleanup; `onBack` removed entirely |
| **DIP** | ⚖️ Dynamic imports (good decoupling) | ✅ Kept. `GITHUB_REPO_URL` moved to `src/config/` |

### 8.8 Production Readiness Checklist

| Requirement | Status | Action |
|-------------|--------|--------|
| Dark mode works | ✅ Done | `Dialog.tsx`: `bg-base-content/40`, `bg-base-100`, `rounded-box` |
| Mobile dismissible | ✅ Done | Close (X) on sidebar header + desktop content header |
| Tailwind classes in production CSS | ✅ Done | Dynamic cards replaced with static text links |
| Accessibility | ✅ Done | `role="navigation"`, `aria-label`, semantic headings, file input labels |
| Performance | ✅ Done | Dynamic imports + tab-specific skeleton loaders |
| Error handling | ✅ Done | Sequential avatar upload (storage → DB) |
| Type safety | ✅ Done | `Document` interface in DocumentsSection, React Query v4 object syntax |
| Design system compliance | ✅ Done | All `rounded-box`/`rounded-field`, all `Lu*` icons, semantic colors |
| Scroll behavior | ✅ Done | `Dialog.tsx` → `overflow-hidden` + `flex flex-col`; `SettingsPanel` root uses `flex-1 min-h-0`; `<aside>` uses `flex-1 min-h-0` on mobile for proper scroll containment (2026-02-13 fix) |
| Mobile UX | ✅ Done | `flex-1 min-h-0` on mobile root + aside, tab-specific skeletons, sign-out always visible, ScrollArea activates properly |
| Mobile back-button | ⛔ Removed | Was implemented, caused immediate-close bug due to React StrictMode + Next.js router conflicts. Removed — see §11 |

### 8.9 Execution Order & Dependencies

```
Phase 1 (Foundation) ✅ ──────────────────────────
  1.1 Dialog.tsx ──────✅ ─┐
                           ├──→ Phase 2 (Content Tabs) ✅ ──────────
  1.2 SettingsPanel ───✅ ─┘     2.1 ProfileSection ──✅ ─┐
  1.3 CloseButton ─────✅        2.2 DocumentsSection ✅ ─├──→ Phase 3 (Polish) ✅
  1.4 History/Back ────⛔ Reverted  2.3 SecuritySection ─✅ ─│     3.1 Skeletons ✅
                                 2.4 NotificationsSection ✅    3.2 Accessibility ✅
                                 2.5 SocialLinks ────✅ ─┘     3.3 Aria labels ✅
                                 2.6 Remove onBack ──✅        3.4 Variant styles ✅
                                 2.7 SOCIAL_MEDIA ───✅        3.5 Move types ✅
                                 2.9 useProfileUpdate ✅

Phase 4 (Rename & Restructure) ✅
  profile/ → settings/ ────────✅
  ProfilePanel → SettingsPanel ─✅
  *Content → *Section ──────────✅
  Hungarian notation removed ───✅
  Constants renamed ────────────✅
  Callers updated ──────────────✅
  components/ folder created ───✅
```

**Actual changes:** ~400+ lines across 15 files (net: ~340 lines after history removal)
**Total files touched:** 15 (callers + settings module + Dialog.tsx + CloseButton.tsx + config)
**Actual effort:** Phases 1–4 completed in one session; post-implementation fixes (history revert + scroll fix) in follow-up session

### 8.10 What We Did NOT Do (Scope Boundaries — honored)

These items were explicitly excluded per KISS and remain out of scope:

| Out of Scope | Reason | Still Applies? |
|-------------|--------|:--------------:|
| Tab state preservation across switches | Acceptable trade-off; users rarely switch mid-edit | ✅ Yes |
| Card-based documents list on mobile | Current responsive table works fine | ✅ Yes |
| Animated sidebar ↔ content transition | CSS `animate-in fade-in` is sufficient; no framer-motion | ✅ Yes |
| Collapsible support section | Simple text links are enough; collapse adds complexity | ✅ Yes |
| Tab-specific skeleton as separate files | Inline within SettingsPanel is DRYer | ✅ Yes |
| New "About" or "Bio" rich text editor | Simple textarea is sufficient for v1 | ✅ Yes |
| Password change UI in Security tab | Supabase handles auth flows | ✅ Yes |
| ~~Full app-wide history management for all modals~~ | ~~Only SettingsPanel implements `pushState`/`popstate`~~ → **Removed entirely.** Per-component `pushState` is fundamentally racy with React StrictMode + Next.js router. Requires an app-wide `ModalRouter` (see §11, §14) | ✅ Yes |
| `useAvatarUpload` hook extraction | Only 2 callers in same file — extract if reuse arises | ✅ Yes |
| `<SettingsSection>` wrapper component | Repeated pattern, but consistent styling. Nice-to-have (§14) | ✅ Yes |

---

## 9. Principles Compliance Deep Review

> **Reviewer:** Head of Engineering + Head of UI/UX
> **Scope:** The entire document (Sections 1–8) + codebase reality

### 9.1 KISS — Keep It Simple, Stupid

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | No unnecessary abstractions | ✅ Done | Redesign adds 0 new abstractions, `components/` folder only organizes existing files |
| 2 | Simple height strategy | ✅ Done | Was: `h-[100dvh]` inside `max-h-[90vh]` → Now: `flex-1 min-h-0` mobile (flex-based), `md:h-[min(85vh,800px)]` desktop. Dialog.tsx now uses `flex flex-col` for proper height propagation. |
| 3 | Simple display classes | ✅ Done | Was: `md:block md:flex` → Now: `hidden md:flex` |
| 4 | Static class mapping vs dynamic interpolation | ✅ Done | Dynamic cards replaced entirely with static text links — simpler than `VARIANT_STYLES` map |
| 5 | Inline skeletons vs separate skeleton files | ✅ Done | 4 inline skeletons in `SettingsPanel.tsx`, no extra files |
| 6 | CSS transitions vs framer-motion | ✅ Done | `animate-in fade-in` (Tailwind) — no library |
| 7 | Sequential upload vs allSettled | ✅ Done | `await upload(); await updateDB()` — simpler mental model |
| 8 | `SOCIAL_MEDIA_DOMAINS` redundancy | ✅ Done | Now `Object.keys(SOCIAL_MEDIA_ICONS)` — single source of truth |
| 9 | `renderPaginationButtons()` in DocumentsSection | 🟡 Deferred | 60-line pagination builder — works correctly, flagged for future cleanup (§14) |

### 9.2 DRY — Don't Repeat Yourself

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | Single skeleton for 4 tabs | ✅ Done | Each tab gets its own inline skeleton matching its content shape |
| 2 | Support link variant duplication | ✅ Done | Dynamic `bg-${variant}` cards replaced with simple text links — no variant mapping needed |
| 3 | `onBack` dead prop in all 4 content components | ✅ Done | Removed from all section components — back navigation handled by shell |
| 4 | Section card wrapper repeated 6× | 🟡 Deferred | Pattern `<section className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">` still repeated. A `<SettingsSection>` wrapper would be DRYer (§14) |
| 5 | Duplicate `react-icons/md` imports | ✅ Done | All files now import from `react-icons/lu` only |
| 6 | `SOCIAL_MEDIA_DOMAINS` duplicates ICONS keys | ✅ Done | Now `Object.keys(SOCIAL_MEDIA_ICONS)` |
| 7 | `updateAvatarInDB` inline in `ProfileSection.tsx` | 🟡 Deferred | Acceptable — only 2 callers in same file. Extract to hook if needed elsewhere (§14) |

### 9.3 SOLID Principles

| Principle | Check | Status | Notes |
|-----------|-------|--------|-------|
| **S** — Single Responsibility | `ProfileSection.tsx` handles avatar upload/remove + form fields + social links | 🟡 Acceptable | Avatar logic kept inline (2 callers, same file). `useProfileUpdate` hook cleaned — no `@ts-ignore`, no `delete` mutation. |
| **S** — SRP | `useProfileUpdate.ts` — store access patterns | ✅ Done | Uses `user` from hook scope. `display_name` excluded via destructuring. No `@ts-ignore`. |
| **O** — Open/Closed | Adding a new tab requires edits in 3 places: `SETTINGS_TABS`, `renderContent()`, and dynamic import | 🟡 Acceptable | For 4 tabs, a registry would be over-engineering. |
| **L** — Liskov | Section components have no required props | ✅ Done | All tabs are substitutable with zero-prop interfaces. |
| **I** — Interface Segregation | `onClose` in `SettingsPanel` | ✅ Done | Wired to close button, back button, and history cleanup. Interface matches behavior. |
| **I** — ISP | `onBack` in content components | ✅ Done | Removed from all 4 section files. Navigation is the shell's responsibility. |
| **D** — Dependency Inversion | Content tabs import from `@stores`, `@api`, `supabaseClient` | 🟡 Acceptable | Industry norm for React hooks. `GITHUB_REPO_URL` moved to `src/config/`. |

### 9.4 YAGNI — You Ain't Gonna Need It

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | `onBack` prop in content components | ✅ Done | Removed from all 4 section components. |
| 2 | `LinkMetadata.themeColor` and `socialBanner` fields in `types.ts` | 🟡 Deferred | Part of API response contract. Not displayed but typed. Flagged in §14. |
| 3 | `display_name` field in `ProfileData` | ✅ Done | `useProfileUpdate` now uses `const { display_name: _displayName, ...profilePayload } = currentProfile` — clean exclusion, no mutation. |
| 4 | Quiet hours UI in `NotificationsSection` | 🟡 Deferred | UI renders quiet hours. Backend support unverified. Flagged in §14. |

### 9.5 UI/UX Principles Check

| Principle | Check | Status | Notes |
|-----------|-------|--------|-------|
| **Consistency** | Icons: all `Lu*` | ✅ Done | All `Md*` replaced. Brand icons in `constants.ts` exempt. |
| **Consistency** | Border radius: `rounded-box` / `rounded-field` only | ✅ Done | All arbitrary radii replaced with semantic tokens |
| **Consistency** | Section card styling | 🟡 Deferred | Pattern repeated but consistent. `<SettingsSection>` wrapper in §14. |
| **Feedback** | Avatar upload has spinner overlay | ✅ Good | Using daisyUI `loading loading-spinner` |
| **Guidance** | iOS Safari push limitation explained with actionable CTA | ✅ Done | `IOSPWANotice` component: iOS ≥ 16.4 → "Add to Home Screen" CTA; iOS < 16.4 → "Update iOS" notice |
| **Feedback** | Username validation shows error/success states | ✅ Good | |
| **Feedback** | Save button shows loading state | ✅ Good | |
| **Visibility of System Status** | Close button always visible | ✅ Done | Mobile sidebar header + desktop content header |
| **Error Prevention** | Avatar upload validates >256KB client-side | ✅ Good | |
| **Recognition over Recall** | Active tab highlighted in sidebar | ✅ Good | |
| **Aesthetic & Minimalist Design** | GitHub section compact | ✅ Done | 3 colored cards → simple text links |
| **Flexibility & Efficiency** | Keyboard focus management | ✅ Good | Buttons are focusable, `aria-label` on all actions |
| **Help Users Recover from Errors** | Email change shows toast | ✅ OK | |
| **Mobile-first** | Proper mobile height handling | ✅ Done | `h-full` fills modal container; `md:h-[min(85vh,800px)]` desktop |
| **Touch Targets** | 44px min-height on nav buttons | ✅ Done | `min-h-[44px]` on all `SETTINGS_TABS` buttons |
| **Hick's Law** | 4 settings tabs | ✅ Good | |
| **Fitts's Law** | Full-width Save button | ✅ Good | |
| **Gestalt — Proximity** | Related items grouped in sections | ✅ Good | |
| **Gestalt — Similarity** | Consistent card styling across tabs | ✅ Good | All sections use `rounded-box` token |
| **Back-button contract** | Mobile back → previous view, not previous page | ⛔ Removed | `pushState`/`popstate` caused race conditions (see §11). Deferred to app-wide solution (§14). |

---

## 10. Naming Convention Audit

### 10.1 Current Naming vs. Codebase Standard

The project has an established naming convention visible from `notificationPanel/`, `bookmarkPanel/`, and `toc/` modules:

**Codebase standard (from other modules):**

```
feature-module/
├── components/           # Shared sub-components
│   ├── FeatureHeader.tsx
│   ├── FeatureItem.tsx
│   ├── FeaturePanelSkeleton.tsx
│   ├── EmptyFeatureState.tsx
│   └── FeatureSkeleton.tsx
├── desktop/              # Desktop-specific entry
│   └── FeaturePanel.tsx
├── mobile/               # Mobile-specific entry (if different)
│   └── FeatureModal.tsx
├── hooks/                # Feature-specific hooks
│   ├── useFeatureAction.ts
│   └── useInfiniteFeature.ts
├── helpers.ts            # Pure utility functions
├── types.ts              # Feature types
└── index.ts              # Barrel exports
```

**Profile module (current) — deviations from standard:**

| Current | Codebase Standard | Issue |
|---------|-------------------|-------|
| `ProfilePanel.tsx` (root) | `desktop/SettingsPanel.tsx` | No `desktop/` folder; no `mobile/` folder |
| `ProfileContent.tsx` (root) | `components/ProfileSection.tsx` | Tab content at root, not in `components/` |
| `DocumentsContent.tsx` | `components/DocumentsSection.tsx` | `*Content` naming not used elsewhere |
| `SecurityContent.tsx` | `components/SecuritySection.tsx` | Same |
| `NotificationsContent.tsx` | `components/NotificationsSection.tsx` | Same |
| `SocialLinks.tsx` (root) | `components/SocialLinks.tsx` | Sub-component at root |
| No `components/` folder | `components/` folder | Missing directory layer |
| No `mobile/` folder | `mobile/SettingsModal.tsx` | No mobile-specific entry point |
| `constants.ts` (root) | `constants.ts` (root) | ✅ Matches |
| `types.ts` (root) | `types.ts` (root) | ✅ Matches |
| `hooks/` (folder) | `hooks/` (folder) | ✅ Matches |

### 10.2 Naming Inconsistencies

#### Component Names

| Current Name | Problem | Proposed Name | Reason |
|-------------|---------|---------------|--------|
| `ProfilePanel` | Naming collision — "Profile" means the Profile tab AND the whole panel | `SettingsPanel` | This is a Settings panel with 4 tabs, not just a "Profile" panel. Other modules use `[Feature]Panel` for the top-level component. |
| `ProfileContent` | "Content" suffix not used in codebase | `ProfileSection` | Other modules use semantic names (`NotificationItem`, `BookmarkHeader`). "Section" communicates that this is a tab section of the SettingsPanel. |
| `DocumentsContent` | Same | `DocumentsSection` | Consistency |
| `SecurityContent` | Same | `SecuritySection` | Consistency |
| `NotificationsContent` | Same | `NotificationsSection` | Consistency |
| `ContentSkeleton` | Generic name; no specificity | `SettingsSkeleton` (shared) or `ProfileSkeleton`, `DocumentsSkeleton`, etc. (tab-specific) | Per design system: "panel-specific skeleton loaders" |

#### Hook Names

| Current | Problem | Proposed | Reason |
|---------|---------|----------|--------|
| `useProfileUpdate` | Fine | Keep | Clear intent |
| `useSignOut` | Fine | Keep | Clear intent |
| `useUsernameValidation` | Fine | Keep | Clear intent |
| ❌ Missing | Avatar upload/remove logic is inline in `ProfileContent` | `useAvatarUpload` | SRP — extract side-effect logic from render component |

#### Type Names

| Current | Problem | Proposed | Reason |
|---------|---------|----------|--------|
| `ELinkType` | Hungarian notation (`E` prefix) is not used elsewhere in codebase | `LinkType` | Codebase uses plain names: `TabType`, `Profile`, `ProfileData` |
| `ILinkMetadata` | Hungarian notation (`I` prefix) | `LinkMetadata` | Same reason. TypeScript interfaces don't need `I` prefix (this isn't C#) |
| `ILinkItem` | Hungarian notation (`I` prefix) | `LinkItem` | Same. Note: `@types/domain.ts` already defines `LinkItem` — check if it's the same. |
| `ProfilePanelProps` | Would become `SettingsPanelProps` if we rename the component | `SettingsPanelProps` | Follow component rename |
| `ProfileContentProps` → all 4 `*ContentProps` | All have `{ onBack?: () => void }` which is dead code | Remove entirely or keep as `{}` | YAGNI — remove the dead prop |
| `TabType` | Fine | Keep | Clear |
| `ToggleRowProps` (inside NotificationsContent) | Internal type — fine | Keep | Local scope |
| `NotificationPreferences` (inside NotificationsContent) | Should be shared type, not inline | Move to `types.ts` | Used in API calls, should be typed properly |

#### Constant Names

| Current | Problem | Proposed | Reason |
|---------|---------|----------|--------|
| `MENU_ITEMS` | Generic; doesn't say what menu | `SETTINGS_TABS` or `SETTINGS_NAV_ITEMS` | Specificity |
| `GITHUB_ACTIONS` | Fine | `SUPPORT_LINKS` | More accurate — these are support/open-source links, not GitHub Actions (CI/CD) |
| `GITHUB_REPO_URL` | Fine | Keep | Clear |
| `SOCIAL_MEDIA_ICONS` | Fine | Keep | Clear |
| `SOCIAL_MEDIA_DOMAINS` | Redundant (DRY violation) | **Delete** — derive from `Object.keys(SOCIAL_MEDIA_ICONS)` | KISS + DRY |
| `ITEMS_PER_PAGE` | Generic; scoped to DocumentsContent so it's OK | Keep | Local scope |
| `USERNAME_DEBOUNCE_MS` | Fine | Keep | Clear |
| `VARIANT_STYLES` (new) | Fine | Keep | From the fix plan |

### 10.3 Directory Structure — ✅ Implemented

**Before:**
```
profile/
├── constants.ts
├── DocumentsContent.tsx
├── hooks/
│   ├── useProfileUpdate.ts
│   ├── useSignOut.ts
│   └── useUsernameValidation.ts
├── index.ts
├── NotificationsContent.tsx
├── ProfileContent.tsx
├── ProfilePanel.tsx
├── SecurityContent.tsx
├── SocialLinks.tsx
└── types.ts
```

**After (current — implemented):**
```
settings/                          ✅ Renamed from "profile"
├── components/                    ✅ Sub-components grouped
│   ├── ProfileSection.tsx         ✅ Renamed from ProfileContent
│   ├── DocumentsSection.tsx       ✅ Renamed from DocumentsContent
│   ├── SecuritySection.tsx        ✅ Renamed from SecurityContent
│   ├── NotificationsSection.tsx   ✅ Renamed from NotificationsContent
│   └── SocialLinks.tsx            ✅ Moved from root
├── hooks/
│   ├── useProfileUpdate.ts        ✅ @ts-ignore removed, cleaned
│   ├── useSignOut.ts
│   └── useUsernameValidation.ts
├── constants.ts                   ✅ SOCIAL_MEDIA_DOMAINS derived from ICONS keys
├── types.ts                       ✅ Hungarian notation removed, NotificationPreferences added
├── SettingsPanel.tsx              ✅ Renamed from ProfilePanel, full rewrite
└── index.ts                       ✅ Updated exports
```

> **Note:** `SettingsSkeleton.tsx` was not created as a separate file — skeletons are inline in `SettingsPanel.tsx` (KISS). `useAvatarUpload.ts` was not extracted — `updateAvatarInDB` has only 2 callers in `ProfileSection.tsx` (§14).

### 10.4 Rename Impact Analysis — ✅ Completed

**All imports updated:**

| File | Old Import | New Import | Status |
|------|-----------|------------|--------|
| `HomePage.tsx` | `import ProfilePanel from '@components/profile/ProfilePanel'` | `const SettingsPanel = dynamic(() => import('@components/settings/SettingsPanel'))` | ✅ |
| `ToolbarDesktop.tsx` | `import ProfilePanel from '@components/profile/ProfilePanel'` | `const SettingsPanel = dynamic(() => import('@components/settings/SettingsPanel'))` | ✅ |
| `PadTitle.tsx` | `import ProfilePanel from '@components/profile/ProfilePanel'` | `import SettingsPanel from '@components/settings/SettingsPanel'` | ✅ |
| `MobilePadTitle.tsx` | `import ProfilePanel from '@components/profile/ProfilePanel'` | `import SettingsPanel from '@components/settings/SettingsPanel'` | ✅ |
| `UserProfileDialog.tsx` | `@components/profile/types`, `@components/profile/constants` | `@components/settings/types`, `@components/settings/constants` | ✅ |
| `index.ts` (barrel) | Old exports | Updated exports with new names | ✅ |

**Risk:** Zero — all callers updated and verified. Old `profile/` directory deleted.

### 10.5 Abstraction Layer Review

The codebase follows a clear 4-layer abstraction:

```
Layer 1: Pages          → pages/index.tsx (routing only)
Layer 2: Page Components → components/pages/home/HomePage.tsx (composition)
Layer 3: Feature Modules → components/profile/ (domain logic + UI)
Layer 4: UI Primitives   → components/ui/ (Button, TextInput, Avatar, etc.)
```

**Profile module violations of layer boundaries:**

| Violation | File | Layer Breach | Fix |
|-----------|------|-------------|-----|
| Direct `supabaseClient` import in UI component | `ProfileContent.tsx` line 10 | Layer 3 (feature) calling Layer 5 (data) directly in render file | Move to hook: `useAvatarUpload` |
| Direct `axios.get` in UI component | `DocumentsContent.tsx` line 23 | Layer 3 calling HTTP directly | Should use a service/API function from `@api` |
| `fetch('/api/fetchMetadata')` in UI component | `SocialLinks.tsx` line 110 | Layer 3 calling API directly | Should be in `@api` or a hook |
| `useAuthStore.getState()` (imperative) inside `useCallback` | `useProfileUpdate.ts` line 27 | Mixing hook selector + imperative access | Use the selector pattern consistently |
| `window.location.assign` for navigation | `DocumentsContent.tsx` line 52 | Direct DOM API instead of Next.js router | Use `useRouter().push()` |
| `window.location.assign` for sign out redirect | `useSignOut.ts` line 14 | Same | Acceptable for full-page reload on sign out (clears state), but should be documented |

### 10.6 Decision: Rename Completed ✅

**Original recommendation was to phase the rename into a separate PR.** In practice, all 4 phases were completed in a single session because:
1. The rename was mechanical (file moves + find/replace)
2. No logic changes were needed alongside the rename
3. Doing it atomically avoided stale TODO comments and import confusion

**Result:** `profile/` → `settings/`, all callers updated, old directory deleted. Zero runtime behavior changes.

---

## 11. Browser History / Back-Button UX (⛔ Removed — overengineering)

> **Identified:** Final cohesiveness review
> **Original Severity:** 🔴 Critical — expected mobile navigation behavior
> **Status:** ⛔ **REMOVED** — implemented, tested, reverted due to fundamental incompatibilities
> **Affects:** All mobile users, PWA users, Android hardware back button
> **Post-mortem date:** 2026-02-12

### 11.1 The Original Problem

The SettingsPanel had zero browser history integration. On mobile, pressing Back navigated to the previous page instead of closing the modal or returning to the sidebar view.

### 11.2 What We Implemented (and Reverted)

A `pushState`/`popstate` integration was added (~60 lines) that:
- Pushed `{ modal: 'settings' }` on mount
- Pushed `{ modal: 'settings', tab }` on tab navigation
- Listened for `popstate` to close modal or return to sidebar
- Tracked history depth via `useRef` for cleanup on unmount/close

### 11.3 Why It Failed — Three Compounding Issues

| Issue | Root Cause | Effect |
|-------|-----------|--------|
| **React StrictMode** | `reactStrictMode: true` in `next.config.js` double-mounts components in development. Cleanup of mount 1 calls `history.go(-1)` (async), remount pushes new state, then the stale `popstate` fires against the new listener → `onClose()` → **panel closes immediately** | 🔴 Panel opens and closes instantly on mobile |
| **Next.js Pages Router** | Next.js has its own internal `popstate` listener. Injected history entries (`{modal: 'settings'}`) pollute its stack — it doesn't recognize them and can trigger unexpected route reconciliation | 🟠 Unpredictable navigation side effects |
| **Unstable `onClose` reference** | All callers pass `onClose` as an inline arrow (`() => setOpen(false)`), creating a new reference every render. With `onClose` in the `useEffect` dep array, every parent re-render re-ran the effect: cleanup → `history.go(-1)` → re-run → `pushState` → stale popstate fires → modal closes | 🔴 Identical immediate-close symptom |

**Key insight:** `history.go(-N)` is **asynchronous** — the `popstate` event fires on a future tick, after React has already re-mounted and re-attached listeners. This timing gap is fundamentally unfixable within a `useEffect` cleanup.

### 11.4 The Fix — Remove Entirely (KISS)

The entire `pushState`/`popstate` block was removed. The SettingsPanel now uses simple React state:

```tsx
const handleTabChange = useCallback((tab: TabType) => {
  setActiveTab(tab)
  setShowContent(true)
}, [])

const handleBack = useCallback(() => {
  setShowContent(false)
}, [])

const handleClose = useCallback(() => {
  onClose?.()
}, [onClose])
```

**Result:** -63 lines, zero race conditions, panel works reliably on all platforms.

### 11.5 Industry Benchmarks (revisited)

| Product | How They Handle Modal Back-Button |
|---------|----------------------------------|
| **GitHub** | Does NOT use `pushState` for settings modal — Escape/X to close |
| **Notion** | Uses their own router abstraction (not raw `pushState`) |
| **Linear** | Uses URL-based routing for settings (full page, not modal) |
| **Slack** | Electron app — no browser Back button concern |

**Revised consensus:** Apps that intercept Back for modals either use a **dedicated router layer** (not raw `pushState` inside `useEffect`) or **don't intercept at all** (relying on X/Escape/overlay click).

### 11.6 Decision: Out of Scope (Non-blocking)

Proper mobile back-button integration for modals requires an **app-wide approach**:
1. A centralized `ModalRouter` or `OverlayManager` that coordinates `pushState`/`popstate` across all modals
2. Integration with Next.js router events (`router.beforePopState`)
3. A single `popstate` listener (not per-component)

This is a **cross-cutting concern** that should be addressed holistically, not bolted onto individual components. It has been moved to **Section 14 (Technical Debt)** as a future improvement.

### 11.7 Lessons Learned

| Lesson | Principle |
|--------|-----------|
| `history.go(-N)` is async — cleanup in `useEffect` is a race condition | **KISS** — avoid async side effects in cleanup |
| React StrictMode double-mounts make `pushState` in `useEffect` fundamentally racy | **KISS** — don't fight the framework |
| Next.js Pages Router owns `popstate` — don't compete with it | **SOLID (SRP)** — one owner per event |
| Inline arrow `onClose` props cause `useEffect` re-runs | **DRY** — stabilize callback refs or use `useRef` |
| Per-component history management doesn't scale | **SOLID (OCP)** — solve at the right abstraction level |

---

## 12. Implementation Completion Report

All findings from Sections 1–11 have been implemented. Below is the final status of each phase:

### Phase 1 — Critical Fixes ✅ COMPLETE

| # | Task | Status | Files Changed |
|---|------|--------|---------------|
| 1.1 | `Dialog.tsx` — `bg-base-content/40`, `bg-base-100`, `rounded-box`, `overflow-hidden` | ✅ | `Dialog.tsx` |
| 1.2 | `SettingsPanel.tsx` — close button (X), `onClose` wired, sidebar compacted, mobile height `flex-1 min-h-0`, display conflict fixed | ✅ | `SettingsPanel.tsx` |
| 1.3 | `CloseButton.tsx` — `MdClose` → `LuX` | ✅ | `CloseButton.tsx` |
| 1.4 | Browser history — `pushState`/`popstate` for mobile back-button | ⛔ Reverted | `SettingsPanel.tsx` — caused immediate-close bug (see §11) |
| 1.5 | `Dialog.tsx` — add `flex flex-col` to ModalContent for proper height propagation | ✅ | `Dialog.tsx` |
| 1.6 | `SettingsPanel.tsx` — fix scroll: `h-full` → `flex-1 min-h-0 overflow-hidden` | ✅ | `SettingsPanel.tsx` |

### Phase 2 — Content Tabs ✅ COMPLETE

| # | Task | Status | Files Changed |
|---|------|--------|---------------|
| 2.1 | `ProfileSection.tsx` — `LuCamera`, `loading loading-spinner`, `rounded-box`, sequential avatar upload, `aria-label` | ✅ | `ProfileSection.tsx` |
| 2.2 | `DocumentsSection.tsx` — `rounded-box`, `Document` interface, React Query v4 object syntax | ✅ | `DocumentsSection.tsx` |
| 2.3 | `SecuritySection.tsx` — `LuShield`, `LuInfo`, `rounded-box` | ✅ | `SecuritySection.tsx` |
| 2.4 | `NotificationsSection.tsx` — `LuBell`, `LuClock`, `LuMail`, `rounded-box` | ✅ | `NotificationsSection.tsx` |
| 2.5 | `SocialLinks.tsx` — 6 `Lu*` icons, `rounded-box`/`rounded-field`, empty state updated | ✅ | `SocialLinks.tsx` |
| 2.6 | Remove dead `onBack` prop from all 4 section components | ✅ | All 4 section files |
| 2.7 | `SOCIAL_MEDIA_DOMAINS` derived from `Object.keys(SOCIAL_MEDIA_ICONS)` | ✅ | `constants.ts` |
| 2.8 | Extract `updateAvatarInDB` to hook | ⏭️ Deferred | Function kept inline in `ProfileSection.tsx` — acceptable for SRP at this scope (only 2 callers in same file) |
| 2.9 | `useProfileUpdate.ts` — removed `@ts-ignore`, cleaned `getState()`, destructured `display_name` | ✅ | `useProfileUpdate.ts` |

### Phase 3 — UX Polish ✅ COMPLETE

| # | Task | Status | Files Changed |
|---|------|--------|---------------|
| 3.1 | Tab-specific inline skeleton loaders (`ProfileSkeleton`, `DocumentsSkeleton`, `SecuritySkeleton`, `NotificationsSkeleton`) | ✅ | `SettingsPanel.tsx` |
| 3.2 | `role="navigation"`, `aria-label`, semantic `<h3>` headings, `<nav>` elements | ✅ | `SettingsPanel.tsx` |
| 3.3 | `aria-label` on avatar upload button + hidden file input, `aria-hidden` on overlay | ✅ | `ProfileSection.tsx` |
| 3.4 | Dynamic `bg-${variant}` classes eliminated — support section now uses static text links | ✅ | `SettingsPanel.tsx` |
| 3.5 | `NotificationPreferences` + `EmailBounceInfo` types moved to `types.ts` | ✅ | `types.ts`, `NotificationsSection.tsx` |
| 3.6 | TODO comments for Phase 4 | ✅ → Superseded | Phase 4 was completed, so TODO comments are no longer needed |

### Phase 4 — Rename & Restructure ✅ COMPLETE

| Task | Status | Details |
|------|--------|---------|
| `profile/` → `settings/` | ✅ | Directory renamed, old directory deleted |
| `ProfilePanel` → `SettingsPanel` | ✅ | Component + file renamed |
| `*Content` → `*Section` | ✅ | All 4 content files renamed |
| Hungarian notation removed | ✅ | `ELinkType` → `LinkType`, `ILinkMetadata` → `LinkMetadata`, `ILinkItem` → `LinkItem` |
| `MENU_ITEMS` → `SETTINGS_TABS` | ✅ | Renamed in `SettingsPanel.tsx` |
| `GITHUB_ACTIONS` → `SUPPORT_LINKS` | ✅ | Renamed in `SettingsPanel.tsx` |
| Sub-components → `components/` folder | ✅ | All section files moved to `components/` |
| 4 callers updated | ✅ | `HomePage.tsx`, `ToolbarDesktop.tsx`, `PadTitle.tsx`, `MobilePadTitle.tsx` |
| Barrel exports updated | ✅ | `index.ts` exports all sections + `SettingsPanel` |
| `UserProfileDialog.tsx` imports updated | ✅ | Now imports from `@components/settings/types` and `@components/settings/constants` |

### Phase 5 — iOS PWA Push Notice ✅ COMPLETE

| # | Task | Status | Files Changed |
|---|------|--------|---------------|
| 5.1 | `NotificationsSection.tsx` — detect iOS Safari via `usePlatformDetection`, show `IOSPWANotice` instead of disabled push toggle | ✅ | `NotificationsSection.tsx` |
| 5.2 | iOS ≥ 16.4 (not PWA): "Add to Home Screen" info card with CTA → triggers existing `showPWAInstallPrompt()` (DRY — reuses `PWAInstallPrompt` component) | ✅ | `NotificationsSection.tsx` |
| 5.3 | iOS < 16.4: neutral info card — "Push notifications require iOS 16.4 or later" | ✅ | `NotificationsSection.tsx` |
| 5.4 | iOS PWA (installed) + non-iOS: no change — normal push toggle | ✅ | No changes needed |

**All phases completed. Post-implementation fixes (history revert + scroll fix) applied in follow-up session. iOS PWA push notice added in Phase 5.**

---

## 13. Final Sign-Off Checklist

| Principle | Planned? | Implemented? | Section | Evidence |
|-----------|:--------:|:------------:|---------|----------|
| Production-ready | ✅ | ✅ | §8.8 | All 11 checklist items green |
| Industry-standard | ✅ | ✅ | §8.2 | Close button, back navigation, compact sidebar — matches GitHub/Notion/Linear |
| KISS | ✅ | ✅ | §9.1 | 0 new abstractions, inline skeletons, static links |
| DRY | ✅ | ✅ | §9.2 | `SOCIAL_MEDIA_DOMAINS` derived, `onBack` removed, `@ts-ignore` removed |
| SOLID | ✅ | ✅ | §9.3 | `onClose` wired (ISP), `useProfileUpdate` cleaned (SRP), interfaces match behavior |
| YAGNI | ✅ | ✅ | §9.4 | Dead `onBack` prop removed from all 4 components |
| UI/UX Principles | ✅ | ✅ | §9.5 | Consistent icons (`Lu*`), semantic radii, close button, 44px touch targets |
| Naming Conventions | ✅ | ✅ | §10.1–10.5 | `settings/`, `SettingsPanel`, `*Section`, no Hungarian notation |
| Abstraction Layers | ✅ | ✅ | §10.5 | `GITHUB_REPO_URL` in `src/config/`, clean hook patterns |
| Rename Strategy | ✅ | ✅ | §10.6 | All 4 phases completed in single session |
| Mobile Back-Button UX | ✅ | ⛔ Reverted | §11 | Caused immediate-close bug; removed. Deferred to app-wide solution (§14) |
| Config Centralization | ✅ | ✅ | — | `config.links.githubRepoUrl` in `src/config/index.ts` + `LinksConfig` type |
| Platform-Aware UX | ✅ | ✅ | §9.5, Phase 5 | iOS Safari users see actionable "Add to Home Screen" guidance instead of dead disabled toggle. Reuses `usePlatformDetection` + `showPWAInstallPrompt()` (DRY). |

---

## 14. Remaining Technical Debt (Non-blocking)

These items were identified during review but deferred as non-blocking. They are improvement opportunities, not bugs:

| # | Item | Severity | Rationale for Deferral |
|---|------|----------|----------------------|
| 1 | Extract `updateAvatarInDB` → `hooks/useAvatarUpload.ts` | 🟡 Low | Function has only 2 callers, both in `ProfileSection.tsx`. Extraction adds a file with no real reuse benefit today. Revisit if avatar logic is needed elsewhere. |
| 2 | `renderPaginationButtons()` in `DocumentsSection.tsx` (60-line imperative builder) | 🟡 Low | Works correctly. Could be replaced with daisyUI `join` pagination or extracted to a shared `<Pagination>` component if reused. |
| 3 | Direct `axios.get` in `DocumentsSection.tsx` | 🟡 Low | Should eventually move to `@api` layer. Not blocking — feature works correctly. |
| 4 | Direct `fetch('/api/fetchMetadata')` in `SocialLinks.tsx` | 🟡 Low | Same as above — should be in `@api` or a hook. |
| 5 | `window.location.assign` for navigation in `DocumentsSection.tsx` | 🟡 Low | Should use `useRouter().push()`. Acceptable for now — causes full page load. |
| 6 | `ILinkMetadata.themeColor` and `socialBanner` — unused fields in `types.ts` | 🟡 Info | Part of API response contract. Not displayed but typed. YAGNI flag for future cleanup. |
| 7 | Quiet hours UI in `NotificationsSection.tsx` | 🟡 Check | Verify backend supports quiet hours. If not, this is YAGNI. |
| 8 | Documents "Unknown" owner | 🟡 Data | Supabase team: verify documents API endpoint includes owner data or add `owner_name` to response. |
| 9 | `<SettingsSection>` shared wrapper component | 🟡 Nice-to-have | The pattern `<section className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">` is repeated. A wrapper would be DRYer but adds abstraction. |
| 10 | Mobile back-button integration (app-wide `ModalRouter`) | 🟠 Medium | Per-component `pushState`/`popstate` was implemented and reverted (see §11). Proper solution requires a centralized `ModalRouter` / `OverlayManager` that coordinates history state across all modals, integrates with Next.js `router.beforePopState`, and uses a single `popstate` listener. This is a cross-cutting concern. |
| 11 | `Dialog.tsx` `flex flex-col` impact audit | 🟡 Low | Adding `flex flex-col` to `ModalContent` was necessary for SettingsPanel scroll. All other modals (ShareModal, SignInForm, ChatroomContext, GlobalDialog) verified safe — they render content-sized children that behave identically in block vs flex-column layout. Monitor for any edge cases in new modals. |

---

*This document was authored and reviewed by Head of Engineering, Head of UI/UX, Front-End Engineering, PM, and Supabase Team. All planned work (Phases 1–5) has been implemented and verified. Post-implementation fixes applied: browser history integration reverted (§11 — overengineering), scroll/height chain fixed (§2.1, §2.4 — `Dialog.tsx` flex layout + `SettingsPanel.tsx` flex-based sizing). Phase 5: iOS PWA push notification guidance added to `NotificationsSection` — platform-aware UX using existing `usePlatformDetection` + `showPWAInstallPrompt()`. Mobile sidebar scroll fix (2026-02-13): `<aside>` changed from `shrink-0` to `flex-1 min-h-0` on mobile, ensuring ScrollArea activates and Sign Out button is always reachable.*

