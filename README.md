# CCT Academic Records Dashboard

A responsive React/Vite application for City College of Tagaytay academic records, approvals, reporting, catalog administration, and Firebase backup/recovery.

## Current architecture

The workspace follows a component-first data flow:

1. The overview loads first. Other authorized pages load on demand and remain mounted after the first visit so form/filter state is retained. Private student and retention data stay in memory, with immediate scope isolation when the account or role changes.
2. Session-scoped cached collections load only after the authoritative Firebase access mapping has verified the signed-in user. Cache keys include the Firebase project, auth UID, role, and department; entries expire after 15 minutes.
3. Firebase Realtime Database subscriptions start during an idle/background task after the interface is mounted.
4. Large catalog and record snapshots are normalized in a Web Worker before React state is updated.
5. Academic record creation, editing, review, and deletion await server transactions. Stale form revisions are rejected with a recovery message. Catalog changes also await Firebase acknowledgement; failed changes retain their form inputs and expose synchronization errors.
6. Session generation guards discard late snapshots, background writes, and normalization results after an account switch. Idle cache writes coalesce; sign-out clears the active cache.
7. Realtime listeners stay attached during reconnection. Backup and audit subscriptions are limited to the VPAA role, and snapshot normalization bursts coalesce before reaching the worker.

Authentication and authorization checks still complete before protected workspace content is shown.

## Database-driven academic hierarchy

The CCT Subject Catalog no longer derives programs or courses from source-code constants. Its hierarchy is:

```text
Academic unit / school
└── Program
    └── Subject
```

Firebase collections:

- `departments`: academic units or schools
- `programs`: program records linked by their `department` value
- `subjects`: subject records linked by `department` and optional `programId`
- `requests`: academic performance records linked to the same department/program scope

The VPAA can add or remove academic units, programs, and subjects from **Institutional Unit**. Department-wide/common subjects use an empty `programId`.

## CCT branding and Firebase project

The required Firebase project is `academicdashboarddata`. `src/firebase/config.js` pins the exact user-supplied public SDK configuration, including Analytics measurement ID `G-3VR70C544M`; environment variables cannot select another project. CLI deployment commands explicitly target this project, and `AGENTS.md` records the preference for future work. Analytics initializes only when supported by the browser, following [Firebase's Analytics API](https://firebase.google.com/docs/reference/js/analytics#issupported).

Hosting and database rules for `academicdashboarddata` were deployed on 2026-10-16. Live HTML, entry assets, security headers, and rules match this build; the four existing access mappings were preserved. This deployment did not migrate Auth users/data, change Auth policy or authorized domains, or deploy Cloud Functions. Earlier browser-verification notes describe the previous environment.

On 2026-10-17, login access was reconciled for all nine existing Auth accounts: profile UIDs and access mappings now agree, the user confirmed the incomplete Arts and Science Dean profile, and assigned school names match the catalog. Verified legacy record owners were updated without changing grades or approvals. The login form now retains inputs and displays access-verification errors. Hosting version `7e998297a5842dfc` contains this fix. Auth passwords and database rules were preserved; Functions remain undeployed. Validation: 39 unit tests, 23 security tests, and four concurrency tests pass.

The subsequent navigation layout fix was deployed as Hosting version `3981beb25f8170a8`. Desktop navigation fits below the header and scrolls independently; the mobile drawer fills the visible screen. Long forms and dropdowns scroll within their rounded panels. Build/lint and all 39 unit tests passed for this change; browser checks covered desktop, narrow phones, short landscape screens, and nested dialogs. This Hosting-only update preserved Firebase configuration, environments, access rules, accounts, data, and prepared Functions.

The chart refinement adds animated SVG depth to circular distributions and columns, elevated line charts of actual annual totals, and clean Chromium scrollbars without arrow buttons. Numeric legends, approved-record/school scope, zero/absent distinctions and OS/app reduced-motion preferences are preserved. Build/lint, all 39 unit tests, and temporary rendering/geometry/scope checks pass. Interactive browser verification of this revision remains unavailable while local browser use is disabled in Work settings. See the current source ZIP's release notes for its Hosting release; Firebase configuration, environment files, security rules, accounts, data and prepared Functions remain unchanged.

The interface uses the City College of Tagaytay crest, a cool neutral neumorphic canvas (`#edf0ef`), a charcoal dark theme (`#23282b`), and burgundy (`#7f2038`) actions. The split sign-in page has a continuously panning campus photograph and a corner crest, with no pause control. Extra image width guarantees sideways travel on desktop and mobile. As requested, this photograph keeps moving even with reduced motion enabled; other interface animations retain reduced-motion support. On mobile, the campus becomes a compact banner above the form. Firebase Authentication and Realtime Database use `academicdashboarddata`. Accounts use initials, with no profile photo uploads.

The design draws on [Creative Tim’s Soft UI Dashboard](https://demos.creative-tim.com/soft-ui-dashboard-react/), [CSS-Tricks’ neumorphism guidance](https://css-tricks.com/neumorphism-and-css/), and [NN/G’s research on visible interaction cues](https://www.nngroup.com/articles/flat-ui-less-attention-cause-uncertainty/). Raised panels and recessed fields provide depth; text contrast, explicit labels, focus outlines, and visible selected states preserve usability.

## Verification

```sh
npm run check
npm test
npm run test:security
npm run test:concurrency
```

The concurrency suite requires Firebase CLI and Java 21. It uses a local Realtime Database emulator on `127.0.0.1:19000` with the demo project `demo-cct-concurrency`. Its permissive rules are test-only and must never be deployed to the real project. Tests cover competing creation, stale edits/deletes, independent additions, deleted records, and cancelled account sessions. Unit tests cover cache isolation, expiry, coalescing, storage failures, and legacy migration.

Production access uses the UID, role, and department rules in database.rules.json. See [CCT security notes](SECURITY.md) for free-project limits and prepared server functions. Cached data never authorizes access or gets replayed as a collection-wide write. Record writes require connectivity and wait for acknowledgement; offline caches are for reading and rendering, not durable pending writes.

## Interface changes

- Readable 14px body copy and controls, with secondary text at least 12px and stronger light/dark contrast
- Single-column record and catalog forms with persistent labels and explicit optional fields
- Title Case headings and labels, comfortable button padding, and consistent 12px controls / 20px panels
- Distinct label, placeholder, and entered-value styling; long dropdown choices wrap instead of truncating
- Animated circular distributions, columns with SVG depth, and line charts of actual annual totals, with readable numeric legends, reduced-motion support and separate zero/absent states
- Desktop navigation stays within the visible viewport below the header; its menu and footer scroll independently of the page, including on short screens
- Press feedback, brief page/modal transitions, animated chart fills, and reduced-motion support
- Full-height mobile navigation drawer with a fixed profile, scrollable links/footer, safe-area support, and automatic dismissal at the desktop breakpoint
- Program filters and program labels in records, reports, CSV export, and the subject combobox
- Portal-based responsive dropdowns and modal-safe menus, with scrollbars contained inside rounded panels and long forms remaining reachable
- Slim rounded scrollbars without arrow buttons in Chromium, themed fallback styling in Firefox, and native high-contrast controls
- Responsive record table/cards and mobile bottom-sheet forms
- Restored school logo for the browser tab/favicon
- Database synchronization and pending-write status indicators

## Role matrix

| Role | Records | Approval | Catalog | Accounts | Backups | Reports |
| --- | --- | --- | --- | --- | --- | --- |
| VPAA | Create, edit, delete all | Approve/return all | Full control | Read directory; secure changes prepared | Export; secure restore prepared | All units |
| President | Read-only | None | Read-only | None | None | All units |
| Deans | Assigned unit | Approve/return assigned unit | Read-only | None | None | Assigned unit |
| Heads | Create/revise assigned unit | Submit to dean | Read-only | None | None | Assigned unit |

## Local development

Use an operating-system-native dependency installation. Do not reuse `node_modules` copied from another operating system.

```bash
npm ci
npm run dev
```

Production verification:

```bash
npm run check
npm run preview
```

Deployment:

```bash
npm run deploy
```

Copy `.env.example` to `.env.local` for local feature/App Check/development flags. Its public Firebase values document the configuration pinned in `src/firebase/config.js`. The source package intentionally excludes `.env.local`, build output, and `node_modules`.

For GitHub releases, see [encrypted environment backup and recovery](security/RELEASE_ENV.md). Run `npm run env:encrypt` to refresh the hidden `.env.enc` backup. Its private key stays outside this repository and must be backed up separately; never attach the key or plaintext environment files to a release.

Light is the default for new users and the signed-out screen; the Light / Dark / Use System Settings choice is available only in Settings and is saved per user. System Settings responds when the device theme changes. All current CCT accounts use @college.cct.edu.

The default deploy includes Hosting and database rules. Cloud Functions remain prepared but undeployed while billing is disabled; account administration and full snapshot imports are inactive. Follow [SECURITY.md](SECURITY.md) before enabling those services. Run npm run test:security to verify access rules and server authorization locally.

## Adviser revisions and academic modules

See [the requirement audit](deliverables/ADVISER_AUDIT.md) and [the ordered changed-file list](deliverables/CHANGED_FILES.md). The audit was reported before implementation; established subject-record and approval workflows were retained.

- **Annual Reports:** one college-wide submission per Academic Year, canonical year key, five year-level counts, calculated total, and a year-level view filter. Changing a timestamp cannot create another annual submission. Use Edit to correct the existing year. Subject-level academic records remain supporting detail, with their existing subject/program/semester uniqueness.
- **Student Records:** search by name or student number; academic status, current Academic Year, year level, optional program, current subject assignments, and retention history. Student identity survives annual progression. Student records are not hard-deleted; update their status. Presidents do not receive individual student/retention data.
- **Retention and Movement:** section dropdowns include Academic Year. Retained, Shiftee, Transferee, Withdrawn, and Graduated share this module. Shiftee/Transferee entries require a destination. No birthday field is accepted. Sections and students must belong to the same school, and the section must match the entry's Academic Year.
- **Faculty Performance:** ratings per faculty/year and a Department Head assignment displayed for each school. Only the VPAA or assigned Dean can change faculty ratings and assignments.
- **School Achievements:** grouped by the existing CCT school/academic-unit directory, without program, staff, or achievement-category groups. The underlying department identifier links the school; the module does not introduce a competing grouping hierarchy.
- **TOPCIT Results:** annual participant total and five achieved-level counts. Enter the levels on the certificates; the system does not guess levels from scores.
- **System Administration:** Accounts and Access plus Backup and Recovery under one VPAA-only module. Existing verified VPAA access remains the administrator permission; no new role or password was invented.

The dashboard and main analytics chart display CCT aggregate figures. Subject enrollments are labelled separately from unique student counts. The exact TF reference graph and expansion of “TF” were not supplied, so matching its specific structure remains unverified. The provisional aggregate charts retain clear category labels and values.

Backups include all eight academic collections and original catalog IDs. Prepared restores share the same pure validation as browser forms, validate relationships before the atomic commit, and advance revisions without overwriting access or audit history. Imported accounts lacking Auth users are labelled Not Provisioned; incomplete profiles render safely without granting access.

For a fresh install, run `npm ci` and copy `.env.example` to `.env.local` if you need local feature flags. The SDK configuration targets `academicdashboarddata`. Server dependencies use `npm ci --prefix functions`. Full restore and account provisioning remain disabled by the client feature flag until the prepared services are separately deployed and verified.

## Design and accessibility references

The palette, visual hierarchy, explicit labels, and reduced-motion controls are informed by [NN/G visual hierarchy guidance](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/), [W3C contrast guidance](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum), and [W3C animation guidance](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions). The custom neumorphic surfaces use these as usability constraints. This is not a claim of a complete WCAG certification.

Firebase transactions and their live listeners follow [Realtime Database read/write guidance](https://firebase.google.com/docs/database/web/read-and-write) and [the transaction API](https://firebase.google.com/docs/reference/js/database). Simultaneous-use tests cover competing annual submissions, conflicting edits, independent writes, and account-session cancellation. They do not certify unlimited capacity on the free Firebase plan.

Submitted zero counts remain visible as zero-valued chart categories; an absent submission has its own empty state. Hosting CSP permits the Firebase regional long-poll transport for networks without WebSockets.

## Firebase failure handling

See [Firebase resilience notes](deliverables/FIREBASE_RESILIENCE.md). Absent collections produce empty states; denied or malformed reads produce errors. Initialization, realtime setup/callbacks, public actions and prepared server operations are guarded. Read deadlines prevent indefinite loading, listeners are cleaned up, and writes wait for acknowledgement without artificial commit timeouts. Catalog and login forms keep inputs after failed operations. Latest verification: 66 passing tests (39 unit, 23 production-rule/server, 4 concurrency).
