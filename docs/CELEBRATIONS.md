# Team celebrations

My Workspace dashboard includes today's birthdays and work anniversaries and a next-seven-days list. Dates use the signed-in employee's configured timezone (America/New_York fallback). February 29 birthdays appear February 28 in non-leap years. Inactive accounts are excluded. Birthday payloads omit original dates, birth years, age, email and phone. Work anniversaries show completed service years, starting at one year.

Birthday sharing is enabled by default for saved dates. Employees can hide their own birthday in the card; administrators can change visibility under “HR: birthday visibility” in their own My Workspace card. This setting governs the employee celebration feed and reaction endpoint; existing HR-only employee records and admin milestone tools remain accessible to HR.

Today-only reactions support celebration, cake, heart and applause. Each active employee has one stored reaction per event occurrence; selecting another replaces it and selecting the active emoji removes it. Counts and named reactors are shared with signed-in employees. Hidden, inactive, future, past and invalid events cannot receive reactions. One grouped in-app notification per celebrant/date is created on the first teammate reaction, never one per click. Reactions refresh on focus and every minute while the dashboard is visible. No email or push notification is sent.

Multiple cards rotate every eight seconds and offer manual previous/next and pause controls. Pointer/keyboard interaction pauses rotation; reduced-motion preference disables automatic rotation. A single card stays still. No upcoming events yields a quiet empty state.

Data persists in hr_v2_celebrationPreferences and hr_v2_celebrationReactions, through the existing serialized transaction adapter. GET reads only users, the current session and these two collections. Reaction writes also include notifications to preserve a grouped notification. Existing database rules/IAM still apply; endpoints require active authenticated accounts and first-login password change completion. Only admins can change someone else's birthday setting.
