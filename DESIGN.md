# DESIGN.md — WellNest Clinic Front Desk

## Direction

**Professional SaaS.** Clean neutral surfaces, a single indigo accent, and
information-dense operator screens. The staff area borrows the three-pane
support-inbox pattern: navigation rail, conversation list, thread, and a details
panel. The public landing is quiet and typographic.

Built on **shadcn/ui** (Base UI primitives) with Tailwind v4 CSS variables.

## Modes per surface

| Surface | Mode | Notes |
|---|---|---|
| `/` | Persuade | Quiet landing, clear CTA pair. |
| `/demo`, `/my-appointments` | Read / Operate | Short, legible. |
| `/chat`, `/book` | Operate | Task-focused. |
| `/dashboard/inbox` | Operate | Three-pane inbox; scan and reply. |
| `/dashboard/*` | Operate | Tables, forms, consistent controls. |

## Tokens

Defined in `src/app/globals.css`; light and dark via the `.dark` class. Values
are shadcn-style semantic variables (oklch):

| Token | Role |
|---|---|
| `background` / `foreground` | Page surface and primary text |
| `card` / `card-foreground` | Panels, list and thread surfaces |
| `muted` / `muted-foreground` | Subtle fills and secondary text |
| `primary` | Indigo accent (`oklch(0.585 0.233 277)`), actions and active state |
| `accent` | Hover/selected fills |
| `border` / `input` | Hairlines and control borders |
| `destructive` | Errors and destructive actions |
| `sidebar*` | Sidebar-scale tokens |

Type: `Geist` (sans) for UI and body; `Geist Mono` only for IDs, references and
measurement. No serif display face.

Shape: `--radius: 0.75rem`; controls `rounded-md`, cards `rounded-xl`, avatars
and pills fully round. Shadows are subtle and layered, never hard.

## Shared primitives

- `src/components/ui/*` — shadcn components (Button, Badge, Avatar, Input,
  Textarea, Separator, ScrollArea, Tooltip, DropdownMenu, Tabs).
- `src/components/ui.ts` — class constants for the bespoke forms that predate
  shadcn (`inputClass`, `primaryButtonClass`, `cardClass`, …). Prefer shadcn
  components in new work.
- `src/lib/utils.ts` — `cn` helper.

## Inbox pattern (`/dashboard/inbox`)

Four regions, collapsing by width:

1. **Navigation rail** — brand, staff identity, icon nav, sign out (dashboard layout).
2. **Conversation list** — "All chats" with a count, All/Mine/Unassigned
   filters, avatar rows with last message and relative time.
3. **Thread** — header with contact, status pill and actions (Claim, Resolve,
   overflow), message bubbles (visitor left on `muted`, AI/agent right on
   `primary/10`), and a composer with Send.
4. **Details** — contact, Chat info (status, Chat ID, started, message count),
   Chat tags (open handoff ticket), and staff-only internal notes.

Below `md` the layout is single-pane: list first, then the thread with a back
button. The details panel appears at `xl` and above.

Motion: one authored moment — message bubbles settle in with a short GSAP
stagger (`power2.out`) when a conversation opens or new messages arrive.

## Craft floor for this project

- Body and placeholder text meet 4.5:1; secondary text uses `muted-foreground`.
- Every control has hover, focus-visible, disabled and loading states; focus is
  always visible.
- Real content and working controls; empty, error and permission states exist.
- Groups are tight and sections generous; more space above a heading than below.
- Icons are lucide, one stroke weight, sized with the text.

## Verification

`pnpm shots` renders landing, login, dashboard and inbox at desktop (1440×900)
and mobile (390×844) through Playwright into `artifacts/`. Backed by
`pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm smoke`, `pnpm test`, and the
Impeccable detector.
