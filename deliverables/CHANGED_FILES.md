# Complete CCT source and changed-file list

The archive contains complete current files, not patches or snippets. Files are ordered by path; removed files are explicitly identified. Existing unrelated source/assets are retained.

Setup: `npm ci`, then `npm run dev`. Prepared server services use `npm ci --prefix functions`. Billing and privileged service flags remain disabled.

## Changed files

1. `.env.example` — CCT public SDK configuration, App Check placeholder, disabled server-service flag, and loopback development host.
2. `.firebaserc` — Targets the CCT Firebase project.
3. `.gitattributes` — Consistent LF text files.
4. `.gitignore` — Excludes private environment files, logs, tooling cache and generated archives.
5. `.npmrc` — Pins trusted install-script permissions without duplicated package settings.
6. `.tmp-cct-preview.html` — Local development preview entry retained for the existing browser workflow.
7. `.tmp-cct-preview.jsx` — Renders the actual application instead of outdated mock data.
8. `README.md` — Documents architecture, the revised interface, role limits, academic modules, assumptions, research and setup.
9. `SECURITY.md` — Documents deployed protections, prepared services, private data scopes, migration and verified limitations.
10. `database.rules.json` — Default-deny UID/role/school rules; record ownership, revisions, annual keys, counts, academic references, and protected administration.
11. `deliverables/ADVISER_AUDIT.md` — Requirement-by-requirement initial audit, implemented results, earlier requests, verification and remaining external prerequisites.
12. `deliverables/CHANGED_FILES.md` — Ordered changed-file manifest and full source delivery instructions.
13. `deliverables/FIREBASE_RESILIENCE.md` — Detailed Firebase failure audit, changed methods, missing-data behavior and verification.
14. `firebase.json` — Production security/cache headers, CCT rules, and prepared Node 22 Functions codebase.
15. `firebase.security.json` — Local Auth/Database emulator test configuration.
16. `functions/.npmrc` — Explicit server dependency install-script permissions.
17. `functions/academicValidation.js` — Pure canonical validation shared by browser forms and the prepared restore service; identity and stale-edit helpers.
18. `functions/firebaseErrors.js` — Prepared server error boundary preserving validation/authorization errors and classifying network failures.
19. `functions/index.js` — Prepared secure account/restore/audit functions with a server error boundary, missing Auth-user checks and safe action counters.
20. `functions/package-lock.json` — Complete reproducible server dependency resolution.
21. `functions/package.json` — Prepared Firebase server dependencies, runtime and dependency fixes.
22. `functions/scripts/migrate-access.mjs` — Trusted conditional CCT UID/email/legacy ownership migration without persisting administrative credentials.
23. `functions/validation.js` — Strong account validation, bounded safe snapshots, duplicate rejection, and cross-collection academic relationship validation.
24. `functions/vendor/native-domexception/index.cjs` — Uses the Node native DOMException instead of a deprecated shim.
25. `functions/vendor/native-domexception/package.json` — Local compatibility package for the native DOMException replacement.
26. `index.html` — CCT browser identity, corrected title encoding, crest/favicon and default light color.
27. `package-lock.json` — Complete reproducible root dependency resolution.
28. `package.json` — Current dependencies, modern tooling, dependency overrides and verification/deployment scripts.
29. `security/auth-policy.json` — Records the deployed signup/deletion restrictions, enumeration protection and password policy.
30. `src/App.jsx` — Lazy authorized modules, preserved visited-page state, per-user themes, full-height layout and protected System Admin routing.
31. `src/assets/background.jpg` — CCT campus photograph from the supplied resource project.
32. `src/assets/school-logo.png` — CCT crest from the supplied school resource project.
33. `src/components/common/AggregateChart.jsx` — Explicit aggregate category labels and values with animated bars and honest empty states.
34. `src/components/common/CustomSelect.jsx` — Readable, keyboard-accessible portal dropdowns with placement safeguards; optional single-line triggers and short selected labels preserve full menu labels.
35. `src/components/common/Feedback.jsx` — Consistent CCT feedback and labelled confirmation dialogs.
36. `src/components/common/StatCard.jsx` — Readable neumorphic summary cards and responsive spacing.
37. `src/components/common/SubjectCombobox.jsx` — Persistent labels, catalog program context and responsive selection.
38. `src/components/common/ThemeSelect.jsx` — Light, Dark and Use System Settings appearance list; compact triggers display System with the complete label available to assistive technology and on hover.
39. `src/components/layout/Navbar.jsx` — CCT header and initials-based account menu; appearance controls are available only in Settings. Phone spacing preserves the crest, title and navigation controls.
40. `src/components/layout/Sidebar.jsx` — Spacious full-height navigation, new module entries, mobile drawer, safe profile editing and role restrictions.
41. `src/context/AcademicDataProvider.jsx` — Safe live module data, empty/invalid snapshots, bounded reads, stale/deleted-entry protection and validated writes.
42. `src/context/AuthContext.jsx` — Verified UID access and caches, guarded callbacks/reads, structured action boundaries, acknowledged catalog changes and complete backups.
43. `src/context/academicData.js` — Academic module context/hook.
44. `src/context/auth.js` — Separate authentication context/hook exports for safe React refresh.
45. `src/firebase/config.js` — CCT SDK setup with guarded initialization and a safe unavailable-service state.
46. `src/index.css` — Readable shared controls, balanced radii, title case, optional-label styling and responsive components.
47. `src/main.jsx` — Loads the CCT design layer and maintains the application recovery boundary.
48. `src/neumorphism.css` — Complete CCT light/dark tokens, raised/recessed surfaces, readable forms, spacious navigation, continuous campus-photo motion at every screen width, 44px appearance triggers and a compact horizontal preference row.
49. `src/pages/AcademicWorkspacePage.jsx` — Complete Student Records, Annual Reports, Retention/Movement, Faculty Performance, School Achievements and TOPCIT screens with scoped forms, filters, totals, details and CSV.
50. `src/pages/AccountsPage.jsx` — Prepared server account controls, explicit availability, initials and safe incomplete/unprovisioned profile rendering.
51. `src/pages/BackupPage.jsx` — Complete academic exports, restricted recovery controls, prepared server restore and correctly awaited record reconciliation.
52. `src/pages/DashboardPage.jsx` — CCT aggregate outcomes, TOPCIT levels, annual enrollment and verified active account count.
53. `src/pages/InstitutionalUnitPage.jsx` — CCT catalog forms awaiting confirmation, retained failed inputs, protected busy state and linked-data checks.
54. `src/pages/LoginPage.jsx` — Split CCT login with continuous campus-photo motion and no pause control, plus an explicit initialization error and disabled sign-in when services cannot initialize.
55. `src/pages/RecordsPage.jsx` — Readable single-column CCT forms and consistent transaction/conflict validation, review and optional fields.
56. `src/pages/ReportsPage.jsx` — Academic Year wording, aggregate CCT chart and preserved detailed report/export views.
57. `src/pages/SettingsPage.jsx` — CCT preferences, single-row appearance control, accessible display/performance controls, accurate service state and constrained single-column phone grids.
58. `src/pages/SystemAdminPage.jsx` — VPAA-only Accounts/Backup administration tabs with one main page title.
59. `src/services/backgroundDataWorker.js` — Coalesced normalization and stale-session protection.
60. `src/services/collectionCache.js` — UID/role/school/project-scoped expiring caches, coalesced writes, quota handling, legacy cleanup and logout isolation.
61. `src/services/firebaseSafety.js` — Guarded Firebase initialization, empty/invalid collection handling, safe listeners, bounded reads, structured public results and friendly errors.
62. `src/services/recordTransactions.js` — Keeps an acknowledged live snapshot attached while optimistic concurrency transactions settle.
63. `src/services/useTheme.js` — Light default, per-user saved choice and reactive system-theme changes.
64. `src/services/userPreferences.js` — Project/user-scoped preferences with safe storage handling.
65. `src/utils/academicModules.js` — Browser export of the canonical shared pure academic validator.
66. `src/utils/csv.js` — CSV quoting and formula-injection protection.
67. `src/utils/recordConcurrency.js` — Semantic stale-record protection and immutable identity checks.
68. `src/workers/dataNormalizer.worker.js` — Worker normalization aligned with CCT data and permissions.
69. `tests/academic-modules.test.js` — Meaningful automated regression coverage for CCT cache, academic validation, security, or simultaneous writes.
70. `tests/cache.test.js` — Meaningful automated regression coverage for CCT cache, academic validation, security, or simultaneous writes.
71. `tests/database.rules.json` — Meaningful automated regression coverage for CCT cache, academic validation, security, or simultaneous writes.
72. `tests/firebase-concurrency.test.js` — Meaningful automated regression coverage for CCT cache, academic validation, security, or simultaneous writes.
73. `tests/firebase-safety.test.js` — Regression tests for absent data, invalid data, initialization failures, subscription callbacks, read deadlines and incomplete/rejected responses.
74. `tests/firebase-security.test.js` — Meaningful automated regression coverage for CCT cache, academic validation, security, or simultaneous writes.
75. `tests/firebase.emulator.json` — Meaningful automated regression coverage for CCT cache, academic validation, security, or simultaneous writes.
76. `tests/record-concurrency.test.js` — Meaningful automated regression coverage for CCT cache, academic validation, security, or simultaneous writes.
77. `tests/security-validation.test.js` — Meaningful automated regression coverage for CCT cache, academic validation, security, or simultaneous writes.
78. `tests/server-security.test.js` — Meaningful automated regression coverage for CCT cache, academic validation, security, or simultaneous writes.
79. `vite.config.js` — Current Vite code splitting, warning-free configuration and loopback development host.

The generated Firebase Hosting hash cache is local tooling data and is excluded. The archive excludes actual account passwords, administrative tokens, service-account files, database dumps, private environment files, dependencies and build output.

## Verification

56 tests pass: 29 unit tests, 23 production-rule/server emulator tests, and 4 concurrency tests. Build and lint pass without warnings. Dependency resolution is unchanged by this follow-up; the prior audits report zero vulnerabilities.

## Deployment

The current Hosting target is https://academicdashboarddata.web.app. The local switch does not deploy this project or migrate users/data. Earlier deployment and UI-verification notes below describe the previous environment. Server failure handling remains prepared and emulator-tested; the exact TF graph remains unverified.

Homepage/SPA cache and fingerprinted-asset policies were verified. Firebase regional long polling is allowed by the CSP. Hosted Chrome authentication passed in the preceding UI verification; the embedded browser intermittently aborted Google Auth requests.

## Appearance follow-up — 14 October 2026

Changes for the reported overflow, in implementation order:

1. `src/components/common/CustomSelect.jsx` — Adds opt-in single-line selected labels; other dropdowns retain wrapping. Short trigger text keeps its full accessible description and tooltip.
2. `src/components/common/ThemeSelect.jsx` — Uses System in compact controls, preserving Light, Dark and Use System Settings in the list.
3. `src/pages/SettingsPage.jsx` — Places Appearance and its selector on one horizontal row. The helper description remains available to assistive technology. Explicit single-column grids prevent narrow-screen overflow.
4. `src/components/layout/Navbar.jsx` — Adds scoped phone spacing hooks for the crest and account menu.
5. `src/neumorphism.css` — Fixes trigger height at 44px and the preference row at 68px. Phone layouts fit the selected System label, including the saved Montserrat font.
6. `deliverables/CHANGED_FILES.md` — Records this revision; the source archive contains complete updated files.

Validation for this UI follow-up: `npm run check` passes with zero lint warnings. Real Firebase sign-in and all three appearance choices were verified in the browser; desktop, 390px and 320px layouts keep the controls on one row and the header selector inside the header. System remains selected after the test. The preceding 56 backend/unit/concurrency tests were not rerun for this presentation-only revision.

## Settings-only appearance — 14 October 2026

This later request supersedes the header-selector placement in the preceding follow-up. Light, Dark and Use System Settings remain in the compact Settings row, with the same saved preferences and Light default.

1. `src/components/layout/Navbar.jsx` — Removes the header appearance selector and its unused import/props.
2. `src/App.jsx` — Stops passing theme properties to the header; Settings retains them.
3. `src/neumorphism.css` — Restores the school title on narrow phones now that the header has more room.
4. `README.md` — Documents Settings as the sole location for changing appearance.
5. `deliverables/ADVISER_AUDIT.md` — Updates the current appearance-control location.
6. `deliverables/CHANGED_FILES.md` — Records this follow-up and the complete updated source delivery.

Validation: build and lint pass without warnings. Browser verification confirms zero appearance selectors in the header and one in Settings, the three menu choices, working Light/System switching, and a 320px phone layout without horizontal overflow. Browser logs contain no warnings/errors. Hosting is deployed; saved preferences and Firebase behavior are unchanged.

## Continuous campus photo motion — 14 October 2026

The browser reported reduced motion enabled, and the previous CSS disabled the photo animation entirely. Animating object position could also produce no horizontal movement when the image had no horizontal crop.

1. `src/pages/LoginPage.jsx` — Removes Pause/Play controls, state and icon imports. Preserves the campus photograph, fixed crest, captions and sign-in behavior.
2. `src/neumorphism.css` — Gives the photograph extra width and continuously translates it sideways over 36 seconds in each direction. The image covers the panel throughout the movement on desktop and phones. An explicit photo-only exception keeps it running with reduced motion enabled; other interface animations still honor that preference.
3. `README.md` — Documents the continuously moving photo and the requested motion exception.
4. `deliverables/ADVISER_AUDIT.md` — Updates the current login-photo behavior.
5. `deliverables/CHANGED_FILES.md` — Records the cause, changed files and updated complete source delivery.

Validation: build and lint pass without warnings. With the browser's reduced-motion preference enabled, time-separated samples show the photo moving 80px on desktop and 62px on a 390px phone. The image covers the panel in both samples and the mobile crest stays fixed. No Pause/Play control remains, and browser logs contain no warnings/errors. The animation runs continuously, reversing direction every 36 seconds without a hold at either end.

## Firebase-only release configuration — 16 October 2026

Removed the obsolete root environment configuration and an empty installed-package directory. Current application dependencies, authentication, data access, and documentation use Firebase. The encrypted `.env.enc` backup was refreshed from `.env.local` only, using the existing external private key.

The complete source ZIP was rebuilt from current project files and includes `.env.enc`, `security/env-vault.mjs`, `security/RELEASE_ENV.md`, and `tests/env-vault.test.js`. Plaintext environments, the private key, local previews, tooling caches, installed dependencies, and build output are excluded. Firebase SDK configuration, Authentication code, rules, deployment configuration, environment settings, dependencies, and lockfiles were preserved.

Validation: `npm run check` passes and `npm test` reports 34 passing tests. The encrypted backup recovers the Firebase environment byte for byte. Production services were not modified.

## Required Firebase project — 16 October 2026

The user selected `academicdashboarddata` and measurement ID `G-3VR70C544M` as the required project going forward. `AGENTS.md` records this preference. `src/firebase/config.js` now pins the complete supplied public SDK configuration; environment overrides cannot select another project. Initialization rejects an existing default app with a mismatched project, database URL, or web app ID. Optional Analytics checks browser support before initialization and cannot block the core services.

Updated `.firebaserc`, explicit deployment commands, the trusted access-migration target, Hosting CSP, `.env.example`, `.env.local`, and current documentation. The encrypted environment backup and complete source archive were refreshed. Plaintext environments and the external private key remain excluded from the archive. Local emulator tests continue to use isolated demo projects.

Validation: build and lint pass even with deliberately conflicting Firebase project/key environment overrides; the resulting bundle contains only the required project configuration. All 36 unit tests pass, including mismatched-app rejection and unsupported/failing Analytics. No cloud deployment, data migration, account provisioning, or production policy verification was performed by this switch.
