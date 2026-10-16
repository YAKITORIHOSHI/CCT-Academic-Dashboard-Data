# Firebase project preference

- Use Firebase project `academicdashboarddata` for this application from now on. Keep the exact web app configuration supplied by the user in `src/firebase/config.js`, including measurement ID `G-3VR70C544M`.
- Keep the SDK configuration, Firebase CLI target, migration tools, Hosting policy, environment examples, encrypted environment backup, documentation, and source release consistent with this project. Do not let environment overrides silently select a different Firebase project.
- Preserve Firebase Authentication, Realtime Database, prepared Cloud Functions, and the existing access rules. Changing the client configuration does not migrate users/data or deploy security policies; report live deployment/migration status accurately.
- Use isolated `demo-*` projects for local emulator tests. Never run destructive tests against the production project.
- Keep plaintext environment files and the external decryption key out of Git and release archives. Refresh `.env.enc` after environment changes.
- Clear `DEBUG` in Firebase CLI subprocesses and avoid debug output containing the full process environment. `firebase login:list --json` can include stored tokens; display only explicitly selected account metadata. Keep diagnostic logs out of Git and release archives.
