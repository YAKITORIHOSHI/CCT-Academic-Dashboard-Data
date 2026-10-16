# City College of Tagaytay Security

The CCT Firebase project is `academicdashboarddata`. Active CCT emails use `@college.cct.edu`. Firebase client configuration is public. Google account passwords, service-account keys, and administrative tokens must not be placed in Vite variables or the repository.

The user selected this project on 2026-10-16. SDK identity is pinned in `src/firebase/config.js`, existing apps with a mismatched project/database/app ID are rejected, and deploy commands explicitly target `academicdashboarddata`. Analytics uses measurement ID `G-3VR70C544M` with a browser-support guard. The Hosting CSP permits the Google tag and Analytics transport endpoints described in [Google's CSP guidance](https://developers.google.com/tag-platform/security/guides/csp).

This local project switch does not migrate Auth users/data, provision administrator access, or deploy configuration. Live rules, Auth policy, authorized domains, billing status, App Check, Analytics delivery, and Hosting in this project remain unverified by this change. Earlier deployment results below refer to the previous environment. `database.rules.json` and `security/auth-policy.json` remain the intended policies to deploy/verify for this project.

Environment release backups use authenticated AES-256-GCM with a random 256-bit key stored outside the project. See [release backup and recovery](security/RELEASE_ENV.md). The hidden attribute is only a display preference; the separate key provides confidentiality. Encryption of files cannot conceal values compiled into browser JavaScript.

## Access and data integrity

`database.rules.json` denies access by default. `/access/{auth.uid}` is the authoritative role, department, status, and legacy profile-ID mapping. Clients cannot modify it. Ordinary members can read only their own profile and change only their own display name. The VPAA can read the directory.

Heads and Deans must query their department; Presidents can read approved records only. Rules also protect direct row reads. Record writes require the authorized role/department, verified owner and actor UIDs, bounded student counts and grades, consistent outcome totals, allowed fields, and the next revision. Heads cannot approve records. Names never authorize runtime access. Only the VPAA can take responsibility for an orphaned legacy record; clients cannot replace an existing verified owner.

Academic modules use strict allowed fields, canonical annual/student identifiers, school-scoped queries, linked catalog IDs, and advancing revisions. Annual reports and TOPCIT summaries can be changed only by the VPAA. Individual students and retention are hidden from Presidents. Faculty and Department Head assignment writes require the VPAA or the assigned Dean. Students and sections cannot be hard-deleted. Birthdays are rejected as unsupported fields.

Catalog writes require VPAA access. Client audit writes and account provisioning are denied. Backup entries are VPAA-only and immutable after creation. Unsupported legacy collections, including avatar data, have no client access. CSV exports neutralize spreadsheet formulas.

Private caches use sessionStorage, a 15-minute expiry, and project/UID/role/department scopes. Server verification precedes hydration; other-user and old-role caches are pruned. Logout clears this project's session data. Backups and audit history are not persisted in browser caches. New academic collections, including individual student data, use only memory and are hidden immediately when the verified scope changes. Cached data never authorizes or replays writes.

## Free project and prepared functions

Billing-dependent features remain disabled in the application at the user's request. `VITE_CCT_SERVER_FUNCTIONS_ENABLED=false` keeps account creation, access changes, and full snapshot imports inactive. Record workflows, catalog management, self-name updates, and exports require the selected project's Auth/data/access setup. Administrators can manage Auth users in the Firebase console and run the trusted access migration against `academicdashboarddata`.

`functions/index.js` prepares callable account administration and restore services plus an idempotent record-audit trigger. Sensitive calls require an active VPAA, a non-revoked recent sign-in, validated inputs, and an action limit. Admin SDK provisions users; suspension disables access and revokes Auth sessions. Imports cannot alter accounts, access, or existing audit history; unsafe keys, invalid data, duplicates, and oversized files are rejected. Restore transactions serialize commits and increment revisions. Complete exports preserve original catalog IDs and include all academic modules; the prepared restore service validates school/program/subject links, retention section years, and faculty assignments against the combined proposed database before committing.

The audit trigger is **not active until deployed**. Existing audit history is preserved; current browser activity feedback is local. Cloud Functions [require Blaze for deployment](https://firebase.google.com/docs/functions/manage-functions#upgrade_your_nodejs_runtime). If the owner enables billing later, run `npm ci --prefix functions`, deploy `functions:cct-security`, verify the service, then enable the Vite flag and rebuild Hosting. This task did not attach a billing account.

## Prepared Auth policy and web protections

`security/auth-policy.json` records public signup and client deletion disabled, email-enumeration protection enabled, and a 12–128-character policy with uppercase, lowercase, numeric, and symbol requirements for new/changed passwords. Existing passwords are not forcibly invalidated on sign-in. See the [Identity Toolkit configuration reference](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/Config).

Hosting config includes CSP, HSTS, no framing, nosniff, a referrer policy, and restricted browser permissions. Fingerprinted assets are cached immutably; entry HTML is not cached. Development binds to loopback unless explicitly enabled for LAN use.

App Check initialization is prepared, but **enforcement is not enabled**. Register and test a reCAPTCHA Enterprise site key for the real domains before enforcing database App Check and setting `CCT_ENFORCE_APP_CHECK=true` for functions. Follow [Firebase App Check setup](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).

## Migration and verification

`functions/scripts/migrate-access.mjs` requires the explicit CCT project and administrator credentials. It verifies directory emails against Auth, preserves account IDs/records, and uses a conditional ETag write to avoid overwriting simultaneous changes. Dry-run first; use `--migrate-emails` for legacy aliases and `--apply` after reviewing the result. An explicitly selected, already-authorized Firebase CLI account is supported; credentials stay in memory. A legacy encoder name can be mapped once only when a unique verified profile also matches the department. Runtime access remains UID-based.

Four imported profiles have no matching Auth user; the Arts and Sciences profile lacks required name/role/status. They receive no mapping until provisioned and completed.

Run `npm run check`, `npm test`, `npm run test:security`, and `npm run test:concurrency`. Security tests exercise production rules and privileged server logic against local Auth/Database emulators. Negative tests intentionally emit permission-denied messages. Concurrency rules are test-only. These tests are not a production load certification; the free plan's connection/storage limits still apply.

On 2026-10-14 the earlier project's database rules and Hosting release were deployed, and the supplied VPAA account was verified. That result does not establish deployment or account availability in `academicdashboarddata`. Historical verification: 29 unit tests, 23 production-rule/server emulator tests, and 4 concurrency tests, with zero dependency audit vulnerabilities.

The Hosting policy allows the regional Firebase `/.lp` script and frame endpoint so Firebase Realtime Database can use its long-poll transport on devices or networks where WebSockets are unavailable. Firebase allocates transport servers within the region, so this endpoint covers both the CCT hostname and those allocated hosts. Only the long-poll path is allowed; authenticated CCT server access rules still apply. Homepage and SPA routes use no-store/revalidation; fingerprinted assets use immutable caching.

Firebase resilience guards treat absent collections as empty while keeping access failures visible. Unsupported or incomplete access mappings never grant roles. SDK startup, subscriptions, read deadlines, public action responses, and prepared privileged endpoints have controlled error handling. A missing target Auth user is rejected before access changes. Empty collections are not seeded automatically.
