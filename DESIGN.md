# DESIGN.md — WellNest Clinic Front Desk

## Direction

**Warm clinical calm.** A wellness clinic should feel trustworthy and human, not
sterile or corporate. Deep teal carries action, a warm paper tone carries the
page, and clay is an accent used sparingly. Headings use a soft serif; the UI
uses a neutral sans.

## Modes per surface

| Surface | Mode | Notes |
|---|---|---|
| `/`, `/demo` | Persuade / Read | Earn attention, then explain. |
| `/chat`, `/book`, `/my-appointments` | Operate | Visitor completes a task. |
| `/staff/login`, `/dashboard/*` | Operate | Scanability and consistency first. |

## Tokens

Defined in `src/app/globals.css` (`@theme`), consumed as Tailwind utilities and
overridden for `prefers-color-scheme: dark`.

| Token | Role |
|---|---|
| `paper` | Page background (warm off-white / near-black) |
| `surface` | Cards, panels, inputs |
| `ink` | Primary text |
| `muted` | Secondary text (tinted, never neutral gray) |
| `line` | Borders and dividers |
| `primary` / `primary-hover` / `primary-fg` | Action color and its foreground |
| `accent` | Reserved clay accent |
| `success` / `warn` / `danger` | Semantic states |

Type: `font-display` (Fraunces serif) for h1–h3; `font-sans` (Geist) for UI and
body; `font-mono` (Geist Mono) for references, codes and measurements only.

Shape: cards `rounded-2xl`, controls `rounded-lg`, chat bubbles
`rounded-2xl` with one squared corner. Shadow is offset + soft blur; no hard
block shadows, no glass, no gradient text, no colored side borders.

## Shared primitives

`src/components/ui.ts` is the single source for `inputClass`, `labelClass`,
`primaryButtonClass`, `secondaryButtonClass`, `dangerButtonClass`, `cardClass`,
`errorClass`, `successClass`. Prefer these over ad-hoc color classes.

## Craft floor for this project

- Body and placeholder text ≥ 4.5:1; secondary text is tinted from the palette.
- Every control ships hover, focus-visible, disabled, loading, error and success
  states. Keyboard focus is always visible (`:focus-visible` ring from tokens).
- Browser surfaces are themed: selection color, scrollbar, caret, underline
  offset, tabular numerals in tables.
- Groups are tight, sections are generous, more space above a heading than below.
- Icons are drawn SVG from one family; no emoji or unicode glyphs as icons.
- One authored moment per page at most; no identical entrance on every section.

## Verification

Because screenshots were unavailable in this environment, the pass was verified
with `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm smoke` (39 runtime
checks), and the Impeccable mechanical detector (`detect --json src` → no
findings).
