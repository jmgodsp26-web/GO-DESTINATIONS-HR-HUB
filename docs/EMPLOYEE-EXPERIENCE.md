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
