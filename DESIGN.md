# RELAY Attendance — Web design system (DESIGN.md)

> Visual authority for the `web/` dashboard. Pinned 2026-10-10 by explicit user decision: **shadcn/ui, neutral base, light + dark**. Impeccable's craft floor applies on top of this; where they disagree, this pinned system wins.

## Direction

The dashboard **is** shadcn/ui — not "shadcn-inspired". Components come from the shadcn registry (new-york style, neutral base, CSS variables) and are consumed as shipped: do not re-skin them into something else. Operate mode: quiet surfaces, one accent (primary), precise type, dense-but-breathable data tables. No decorative gradients, no glass, no hero metrics.

## Tokens — the only colour source

- All colours are the shadcn CSS variables in `src/index.css` (`--background`, `--foreground`, `--muted`, `--muted-foreground`, `--primary`, `--border`, `--ring`, `--destructive`, `--chart-1…5`, …) consumed via Tailwind utilities (`bg-background`, `text-muted-foreground`, `border-border`). **No raw hex, no `slate-*`/`indigo-*` palette classes in components** — that is what makes dark mode automatic.
- Exception: **status/flag chips** use Tailwind state hues with explicit dark variants (`bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-600/20`), centralised in `src/lib/utils.ts` (`STATUS_META`, `FLAG_META`, `ROLE_META`).
- Radii: `rounded-md` controls, `rounded-lg` cards/surfaces, `rounded-full` chips. Shadows: shadcn `shadow-xs/sm` only; no custom shadows.
- Charts (recharts): stroke/fill from `var(--chart-1…5)`, grid from `var(--border)`, tooltips styled like popovers.

## Type

- **Geist** (Google Fonts, `<link>` in `index.html`) with `system-ui` fallback; set via `--font-sans` in the theme layer.
- Body 14px (`text-sm`); page titles `text-lg font-semibold tracking-tight` (no kickers/eyebrows); table cells 13px with **`tabular-nums` on every numeric/timestamp column**; card titles `text-sm font-medium`; secondary text `text-muted-foreground text-[13px]`.

## Density & layout (per user decision: tighten where it helps)

- App shell: fixed sidebar (16rem, `border-r`), sticky header (h-14, `border-b`), content `p-4 md:p-6`, max width unbounded (data tools need width), section gaps `gap-4`.
- Tables: compact rows (`h-10`), header `text-xs uppercase tracking-wide text-muted-foreground`, cell padding `px-3`.
- Sidebar: role-filtered nav with `NavLink`-driven active state = `bg-accent text-accent-foreground`; collapses to a `Sheet` under `md`.
- One authored motion moment: content sections fade/slide in once on route change (`animation` on the page wrapper) — nothing else animates except shadcn defaults.

## Component vocabulary (from the registry)

Button · Card · Input · Label · Badge · Alert · Table · Dialog · AlertDialog · DropdownMenu · Select · Tabs · Textarea · Switch · Separator · Skeleton · Tooltip · Sheet · Avatar · Sonner (toasts) · Checkbox · Popover.

Mapping from the previous custom kit: chips → `Badge`; inline panels → `Card`; error banners → `Alert variant="destructive"`; confirm/reject dialogs → `Dialog`/`AlertDialog`; dropdown actions → `DropdownMenu`; loading → `Skeleton` rows; action feedback → `sonner` toasts.

## Status language

- Status chips = `Badge` (outline) + tint classes + 6px dot where state is critical (attendance/live status); leave states keep plain chips.
- Flags (`OUT_OF_RANGE`, `TIME_DRIFT`) are destructive/amber badges with an icon (lucide `TriangleAlert` / `Clock3`), never colour alone.
- Numbers: distances `m` under 1 km else `km` (2dp); durations `Xh YYm`; timestamps `HH:mm` (24h), dates `DD MMM YYYY`.

## Browser surfaces (cheap craft)

Theme `::selection` from primary tint; scrollbars themed for both modes (thin, `--border` thumb); focus rings = shadcn default (`ring-ring/50`); `color-scheme` set per theme; `theme-color` meta updated.

## Verification

Built result is checked in batched rounds: `npm run build` clean → `scripts/impeccable detect web/` (0 findings or addressed) → real-browser screenshots (login, team board, leave queue, reports) in **both light and dark** → fix findings in one pass. No round trips per element.
