# CCT adviser audit and implementation report

Audit completed before coding on 2026-10-14. Stack: React 19 with JavaScript, Vite 8, Tailwind CSS 4, Firebase Authentication and Realtime Database. Existing working subject records, approval workflows, catalog data, and user edits were preserved.

| # | Requirement | Status at audit | Existing evidence / missing part | Result |
| --- | --- | --- | --- | --- |
| 1 | Period → Academic Year | PARTIALLY IMPLEMENTED | `src/utils/academic.js` and record fields already used `academicYear`; a reporting-period description and Reporting Year labels remained. | Updated remaining visible wording and filter labels; preserved existing safe database fields. |
| 2 | Complete combined titles | PARTIALLY IMPLEMENTED | Existing pages had complete titles, but login branding split its system title. | One complete CCT login title; unified new page titles; one administration page heading with subordinate tab headings; corrected the browser title encoding. |
| 3 | One record per Academic Year | PARTIALLY IMPLEMENTED | Existing `requests` prevented duplicate subject/program/semester submissions, but no college-wide annual submission existed. | Added `annualReports/AY_YYYY_YYYY`. Submission validates totals and uses a server transaction; duplicate creation offers Edit. Production rules enforce the year key and revision, independent of counts or timestamps. |
| 4 | Year-level reporting and filter | NOT IMPLEMENTED | Existing Reports & Analytics showed subject outcome counts; no year-level enrollment report or gender-only submission form was found. | Annual Reports includes five year levels, automatic total, a year-level filter, and CSV export. |
| 5 | Retention sections dropdown, Academic Year, no birthday | NOT IMPLEMENTED | No retention screen was found. | Retention includes section dropdowns labelled by Academic Year, linked-school/year validation, and no birthday fields. |
| 6 | Shiftee / Transferee inside Retention | NOT IMPLEMENTED | No separate movement modules were found. | Retention and Movement includes both statuses, destination validation, and movement filters. No separate modules were added. |
| 7 | Assigned Department Head in Faculty Performance | NOT IMPLEMENTED | No faculty performance screen or faculty assignment records were found. | Added school faculty ratings and displayed Department Head assignments. VPAA/assigned Dean controls the assignments. |
| 8 | Achievements per school only | NOT IMPLEMENTED | No achievements screen was found. | Added school groups using the existing CCT school/academic-unit directory, without program, person, or award-category grouping. |
| 9 | Restricted System Admin Backup & Recovery | PARTIALLY IMPLEMENTED | `src/pages/BackupPage.jsx` already required VPAA permission; it was a standalone navigation module. | Moved Accounts and Access plus Backup and Recovery under VPAA-only System Administration; database permissions remain restricted. |
| 10 | TF reference graph | NOT IMPLEMENTED / REFERENCE UNAVAILABLE | No expansion of TF or reference graph was supplied; the attached images describe navigation and login. | Used labelled CCT aggregate charts provisionally. Exact matching to TF remains unverified. |
| 11 | General/aggregate figures | PARTIALLY IMPLEMENTED | Overview had aggregate metrics but emphasized department comparisons. | Main overview and analytics charts now show CCT aggregate outcomes; detailed approved-record tables remain available. |
| 12 | TOPCIT participants and achieved levels | NOT IMPLEMENTED | No TOPCIT data collection or screen was found. | Added annual participant counts, five achieved levels, computed totals, CSV, and overview charts. Levels come from certificates rather than guessed score thresholds. |
| 13 | Searchable students and academic details | NOT IMPLEMENTED | Existing records contained subject totals, not individual students. | Added student search by name/number, status, year level, current subjects/program, notes, and retention history; individual data is restricted by role and school. |

## Assumptions used to preserve working features

“One record per Academic Year” applies to a college-wide annual report. Existing subject records remain supporting detail and retain subject/program/semester uniqueness. Existing authorized VPAA access represents System Administration, since no separate System Admin role was present. “School” uses the current CCT school/academic-unit directory instead of inventing another grouping hierarchy. No TF definition or visual reference was inferred.

## Earlier unfinished requests handled

| Request | Result |
| --- | --- |
| CCT branding and resource images | CCT crest and campus photograph from the supplied resource project; CCT Firebase configuration, browser title, labels, and institutional email aliases. |
| Firebase-only accounts and initials | Firebase handles authentication and data; accounts use initials; unsupported avatar data has no client access. |
| Neumorphic UI and readability | Cool neutral surfaces with burgundy actions; balanced radii, recessed inputs, persistent labels, stronger contrast, comfortable buttons, title case, optional labels, and purposeful motion. Existing carousel-specific features were not found, so none was invented. |
| More space, especially sidebar | Wider navigation, larger item spacing, full-height sidebar matching workspace content, and mobile drawer. |
| Light/dark palette and list | Light default. Light, Dark, and Use System Settings are available only in Settings; system changes are followed automatically; preferences are scoped per user. |
| Split login | Full left campus image with continuous sideways pan, upper-left crest, right-side form. Mobile uses a campus banner above the form. Per the later request, the photo has no pause control and keeps moving even with reduced motion enabled; the rest of the interface retains reduced-motion support. |
| Cache and simultaneous access | Scoped, expiring caches; stale-session guards; no collection-wide cached writes; transaction/revision conflict handling; new private academic data stays in memory. |
| Stronger security | Deny-by-default database rules; UID-bound access directory; verified role/school scope; field, count, ownership and revision validation; protected audit and account operations; live Auth policies and Hosting headers. |
| Errors, warnings and deprecations | Clean lint/build; dependency audits report zero vulnerabilities; migrated Vite configuration and removed deprecated transitive dependencies; fixed incomplete imported-profile rendering and mobile form overflow. |
| Test supplied VPAA credentials | Successfully signed in to the actual CCT database. Credentials were not stored in source or fixtures. |
| Keep billing disabled; prepare functions | Billing stays disabled. Secure account provisioning, access administration, snapshot restore, and server audit functions are prepared and emulator-tested, but undeployed. |

## Verification and limitations

- `npm run check`: passes with zero lint warnings and a successful production build.
- `npm test`: 29 passing unit tests.
- `npm run test:security`: 23 passing tests against production database rules and prepared server authorization, including two devices competing for one annual report.
- `npm run test:concurrency`: 4 passing tests, including stale updates/deletes and simultaneous independent additions.
- Root and Functions dependency audits: zero vulnerabilities.
- Browser verification: actual VPAA sign-in locally and on deployed Hosting in Chrome; every navigation screen; annual totals; student and retention form labels; theme list and automatic system-theme changes; 390px mobile navigation/forms; split login; sign-out. No invented live student or annual-report data was inserted.

The new modules begin empty until CCT staff submit their actual data. Four imported profiles lack matching Auth users; the Arts and Sciences profile is incomplete. These remain unprovisioned and receive no access. App Check is prepared but not enforced because no registered site key was supplied. Full server administration and snapshot restore remain inactive while billing stays disabled. The exact TF reference still needs to be supplied for a faithful match. Concurrency tests are not a certification of unlimited users on the free Firebase plan.

Complete working files are included in `CCT_complete_source.zip`; see `CHANGED_FILES.md` for the ordered list.

Hosted Chrome authentication and live database synchronization passed with no console warnings/errors. The embedded browser intermittently aborted Google authentication requests; this did not reproduce in Chrome. Hosting transport-policy fixes were deployed for Firebase long polling on networks without WebSockets. Live header checks confirmed no-store/revalidation on homepage and SPA routes, immutable caching on fingerprinted assets, and the security headers.

The Firebase resilience follow-up adds guarded initialization, subscriptions, bounded reads, awaited catalog saves, missing-account handling and structured operation errors. See [FIREBASE_RESILIENCE.md](FIREBASE_RESILIENCE.md). Latest verification totals 56 passing tests.
