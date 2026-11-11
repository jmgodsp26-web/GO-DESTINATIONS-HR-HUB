# GO brand design

The HR Hub uses one brand layer that every screen inherits. New pages get the look automatically when they use the shared building blocks below.

## Where it lives

| What | File |
|---|---|
| Fonts (Fredoka headings, Nunito text) | `index.html` |
| Tailwind palette, radii and shadows re-pointed at the GO palette | `src/index.css` (`@theme`) |
| Brand layer: shell, buttons, cards, forms, dialogs, toasts, tickets, motion | `src/go-brand.css` (loaded last) |
| Page title with animated words and orange accent, stat cards with count-up and rings | `src/components/common/WorkspaceUI.tsx` |
| Sidebar mascot | `src/components/common/GoBuddy.tsx` |
| Confetti | `src/utils/confetti.ts` |
| Display helpers (greeting, trip ranges, boarding-pass dates, quick-review balance) | `src/utils/brandDisplay.ts` |

## Palette

Only GO colours are used. Tailwind's `slate`, `indigo`, `blue`, `amber`, `orange`, `teal`, `purple` and `pink` scales are mapped to GO navy, steel blue, slate, mist, cloud, GO grey `#636466` and GO orange tints. `emerald` (success) and `rose` (errors) keep their usual meaning.

- **GO orange `#ED9027`** is reserved for the main action, the current page and progress. Text on orange uses `#2A1A08`.
- **Orange text** on light backgrounds uses `#9A5206` (5.4:1 or better), never `#ED9027`.
- **Muted text** is `#5E7186` or darker.

## Building a page

- Start the page with `PageHeading`. The last word of a multi-word title is accented automatically.
- Use `go-button` with `go-button-primary` (orange), `go-button-secondary`, `go-button-navy`, `go-button-quiet` or `go-button-danger`.
- Wrap content in `go-surface` or `go-task-panel` cards. Use `StatCard` for numbers; pass `ring` for a 0–1 progress ring.
- Use `go-ticket-list` / `go-ticket` for dated items such as holidays.
- Use the shared `Dialog` component. Use toasts through `useToast()`.

## Motion

- Pages rise in section by section. Titles animate word by word. Cards tilt slightly under a mouse.
- Celebration and approval moments use `launchConfetti()`. Rejections and errors never do.
- Everything is switched off for people who choose reduced motion: CSS animations and transitions stop, the dashboard flight path is drawn still, and confetti does not run.

## Tailwind note

Tailwind v4 keeps its utilities in a cascade layer, so rules in the brand layer win over them. If a brand rule sets `display` on an element that also uses a responsive utility such as `md:hidden`, add the matching media query in `go-brand.css` (see the phone-only header controls).
