# GO brand design refresh

Presentation changes only, based on the supplied GO Branding Guidelines v2, January 2024.

- Primary: Denim Blue #3A5D83.
- Accent: Canyon Orange #ED9027; dark text on orange buttons.
- Approved supporting palette: Deep Ocean Blue #182E3F, Dusty Sky Blue #9EAFC1, and the guide's blue/orange/neutral tints.
- Open Sans throughout. Bold and extra-bold headings; semibold controls; readable body text.
- The complete website logo is bundled locally, kept in its original proportions with no cropping, outlining, or drop shadow. Primary logo displays at least 58 pixels wide where shown.
- Shared navigation, dashboard welcome panels, cards, tables, forms, and sign-in layout receive consistent spacing, surfaces, and focus styles.
- Reduced-motion preference disables decorative animation. Mobile header uses the existing sidebar profile/sign-out actions to keep the toolbar within the viewport.
- Existing semantic error/success colors and status labels are retained for recognition.

## Scope protection

No server, database, authentication context, API client, leave calculation, permission, approval, persistence, or deployment configuration changes. All event handlers and existing controls retain their original behavior. Added welcome copy is decorative.

## Validation

TypeScript check and production build pass. All 60 existing test-runner tests pass, including the HTTP authentication, authorization, persistence, and leave workflow suites. Desktop employee/admin dashboards, sign-in, leave form, navigation, and a 390-pixel mobile view were checked using isolated synthetic fixtures. Preview API requests are intercepted locally and mutations are disabled; no production HR data or credentials are used.

The private visual preview is separately hosted. Its mock API code is not part of the application's source or production bundle. The design branch must be reviewed before merging to main triggers the Cloud Run deployment.
