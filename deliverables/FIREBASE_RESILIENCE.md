# Firebase error handling follow-up

The existing sign-in, record transactions, account calls, backups, and restores already handled most SDK failures. The audit found gaps in subscription setup/callbacks, catalog write acknowledgements, read deadlines, initialization failures, and prepared server error classification.

## Completed changes

1. `src/services/firebaseSafety.js` provides guarded Firebase initialization, safe collection decoding, subscription setup/callback handling and cleanup, bounded reads, public action result validation, and consistent error messages.
2. `src/firebase/config.js` handles initialization failures without crashing module imports. Only the expected already-initialized Auth case uses the existing instance. Optional configured App Check failures are not silently ignored.
3. `src/context/AuthContext.jsx` safely verifies missing access/profile data, limits reads to 30 seconds per request, clears failed directory requests for retry, guards realtime callbacks, checks supported access roles, and exposes structured results for all public mutations. Catalog changes await Firebase acknowledgement and maintain pending/error state. Failed backup writes do not add a phantom completed backup.
4. `src/context/AcademicDataProvider.jsx` treats absent collections as empty, reports malformed/denied reads, safely starts and cleans up listeners, bounds pre-transaction reads, and retains forms after failures. Stale updates to deleted entries report that the entry no longer exists.
5. `src/services/recordTransactions.js` bounds the initial read and cleans up its listener even on failure. Commit promises are never artificially timed out: a write may already have committed, so no uncertain commit is reported as a confirmed failure or automatically replayed.
6. `src/workers/dataNormalizer.worker.js` uses the same empty/invalid collection handling as the main thread.
7. `src/pages/LoginPage.jsx` shows an initialization error and disables sign-in when services cannot initialize.
8. `src/pages/InstitutionalUnitPage.jsx` awaits catalog operations, retains inputs on failure, prevents duplicate submits, and uses try/catch/finally to release the busy state.
9. `src/pages/AcademicWorkspacePage.jsx` releases busy state in finally and displays errors for failed/missing results.
10. `functions/firebaseErrors.js`, `functions/index.js`, and `functions/validation.js` protect prepared privileged operations, classify connectivity failures separately from validation, handle absent Auth/directory users, recover incomplete action counters, and accept explicit null collection values in snapshots without changing unspecified collections.
11. `tests/firebase-safety.test.js` and expanded security tests cover these cases; `package.json` includes the new regression suite.

Missing collections require no startup seed. Firebase creates a path when an authorized user submits its first valid entry. Missing accounts/access remain protected; they require a verified administrator setup. Permission failures are reported as errors rather than treated as empty data.

## Verification

- 29 unit tests pass.
- 23 production-rule/server tests pass against local Firebase emulators, including authorized empty reads, denied listeners, missing Auth users, missing directory profiles, malformed counters, and connectivity errors.
- 4 two-device concurrency tests pass.
- Build and lint pass without warnings.

The frontend changes are deployed to the existing CCT Hosting project. Prepared Functions remain undeployed because billing stays disabled. Production data was not seeded, cleared, or changed during the failure tests.
