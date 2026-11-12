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

## Dashboards

Both dashboards follow the approved mock-up: a greeting, the first screen of key cards, then supporting sections that glide in on scroll.

- **Employee:** hero with the flight to the next approved leave, team celebrations beside the pinned company update, four balance cards with rings, then waiting-on-HR, next time off, holiday boarding passes, recent requests and documents.
- **Admin:** four stat cards, the quick-review queue, upcoming holidays as boarding passes with coordinator coverage (a ticket opens the team; the full planner sits behind "Coverage planner"), who is out today by department, the pinned update and team milestones.

Shared pieces in `WorkspaceUI.tsx`: `BalanceCard`, `SectionCard`, `DateTile`, `StatusPill`, `Reveal`, `SunMark` / `MoonMark`. The pinned note is `AnnouncementNote` in `AnnouncementsView.tsx`.

## Building a page

- Start the page with `PageHeading`. The last word of a multi-word title is accented automatically.
- Use `go-button` with `go-button-primary` (orange), `go-button-secondary`, `go-button-navy`, `go-button-quiet` or `go-button-danger`. Add `go-button-sm` in dense rows. Each screen has one orange main action; everything else is secondary.
- Buttons placed in a page header without `go-button` are drawn as secondary pills automatically.
- For tabs and quick filters, use a `go-segmented` group (`is-small` for compact rows) and mark the selected button with `aria-pressed`. `go-read-filter` looks the same.
- Wrap content in `go-surface` or `go-task-panel` cards. Use `StatCard` for numbers; pass `ring` for a 0–1 progress ring.
- Show leave balances with `LeaveBalanceGrid` (the dashboard ring cards). Use `go-chip` for small labels (`is-type`, `is-pending`, `is-good`).
- Use `go-ticket-list` / `go-ticket` for dated items such as holidays.
- Use the shared `Dialog` component. Use toasts through `useToast()`.

## Other shared patterns

- **Activity Log:** entries are grouped by company date ("Today", "Yesterday") with one icon and colour per kind of change (`utils/auditDisplay.ts`). Sixty entries show at a time.
- **Notifications:** each kind of update has its own icon (`go-notif-icon is-good | is-bad | is-warm | is-calm`).
- **Settings:** use `go-switch` (with `role="switch"`) for on/off settings. Employees see company settings as read-only text with a "Set by HR" tag.
- **Avatars:** initials sit in a round cream circle (`go-directory-avatar`, `go-row-avatar`, `go-milestone-avatar`).

## Dates and wording

Never show a raw `2026-11-20` or "day(s)". Use the helpers in `brandDisplay.ts`:

- `formatDateRange(start, end)`: "Nov 20, 2026", "Dec 21–23, 2026".
- `formatDayCount(n)`: "1 day", "3 days".
- `formatStamp(timestamp, withTime?)`: "Nov 7, 2026" or "Nov 7, 2026, 4:04 AM EST", in company (Eastern) time.
- `friendlyMessage(text)`: tidies older stored notification text that still has ISO dates or "day(s)".

## Motion

- Pages rise in section by section. Titles animate word by word. Cards tilt slightly under a mouse.
- Celebration and approval moments use `launchConfetti()`. Rejections and errors never do.
- Everything is switched off for people who choose reduced motion: CSS animations and transitions stop, the dashboard flight path is drawn still, and confetti does not run.

## Tailwind note

Tailwind v4 keeps its utilities in a cascade layer, so rules in the brand layer win over them. If a brand rule sets `display` on an element that also uses a responsive utility such as `md:hidden`, add the matching media query in `go-brand.css` (see the phone-only header controls).
