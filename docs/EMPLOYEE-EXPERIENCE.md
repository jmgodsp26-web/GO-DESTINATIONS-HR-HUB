# Employee experience design pass

This pass makes existing employee tasks clearer without changing HR policy, authentication, permissions, database records, API calls, calculations, or approval steps. Uses the official GO branding guideline palette and Open Sans.

## Presentation changes

- My Workspace: compact personal welcome, readable leave balances, keyboard-accessible pending card, and shortcuts to notifications, documents, and profile.
- My Leave: status overview with counts and filters, including existing Cancelled records; visible HR feedback; readable cards on mobile and labelled detail controls.
- Leave form: numbered sections and a progress indicator for the existing details/review stages. Scrollable dialog and sticky actions keep the form usable on phones. Review displays the existing current/requested/projected balance values.
- Documents: clearer employee title, labelled search and comfortable controls. Access behavior remains unchanged.
- Notifications: unread summary, pressed-state filters, clearer copy and mobile wrapping.
- Calendar: clearer legend/filter presentation and instructions. Event data and privacy rules remain unchanged.

## Validation

- All 60 existing tests passed, including authentication, authorization, HTTP workflows, attachments, persistence, leave approval/cancellation, working days and calendar privacy.
- TypeScript and production build passed. Vite retains the existing large-bundle warning.
- AST comparison: all 76 original event handlers remain present and all 19 API calls match in the six changed components. Added handlers only navigate existing tabs, filter existing statuses, or open existing request details.
- Browser QA with isolated sample fixtures: dashboard shortcuts, full-day and half-day review, projected balance, rejected/cancelled filters, visible HR feedback, document search, notifications and calendar navigation. Mobile viewport 390 x 844: no horizontal page overflow on dashboard or leave history; long leave form scrolls inside the dialog and actions remain visible.
- Sample preview intercepts local API calls, blocks mutations, and never connects to the production database.

## Release boundary

This change is held on a design branch for preview approval. Main and the production Cloud Run deployment are not updated by this design pass.

## Holiday coverage and plain language revision

- Replaced dense holiday tiles with full-width holiday rows: date/name, coordinator coverage, four staff counts, and one View team action. Rows stack on phones.
- Added read-only summaries for holidays, holidays needing attention, and pending leave/shift requests. Uses the existing coverage status and required coordinator counts; no staffing or approval rule changes.
- Preserved Cards/Table views, year selector, Add shift, and the existing holiday details modal. Clarified the Program Coordinator abbreviation.
- Simplified navigation, page titles, help, form feedback, empty states and supporting copy across 20 components: Employees, Documents, Reports, Activity Log, My Leave and Holiday Coverage. Internal IDs, stored statuses and leave type names remain unchanged.
- Latest validation: 60 existing tests passed; TypeScript, production build and whitespace checks passed. AST comparison found all 357 existing handler expressions preserved and all 57 API calls unchanged in the 20 updated components.
- Desktop and 390 x 844 mobile sample preview: Cards/Table switching, opening team details, summary values and coordinator gaps checked. Cards have no horizontal overflow. Preview fixtures now include consistent working and pending sample staff for reviewing details.
- Production remains on main; this revision updates the same draft design PR and sample preview only.
