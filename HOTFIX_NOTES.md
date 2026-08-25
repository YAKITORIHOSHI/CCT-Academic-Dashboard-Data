# Optimization & Security Hardening Notes

This round of changes focuses on functionality, security, and component responsiveness.

## Security

- **No hardcoded service credentials.** `src/firebase/config.js` now reads every value from build-time environment variables and logs which `VITE_FIREBASE_*` variables are missing instead of falling back to committed keys.
- **Avatar URL sanitization.** All avatar URLs sourced from the Realtime Database or localStorage are validated against a strict `https://` pattern (`sanitizeAvatarUrl` in `AuthContext`) before reaching `<img>` elements, update flows, or cache writes. Tampered database values cannot inject other URL schemes.
- **Env template completeness.** `.env.example` documents all required Firebase variables plus optional `VITE_DEV_HTTPS` and the Supabase profile-picture values.

## Functionality

- Cleaned all unused imports, unused catch parameters, and stale hook dependencies across pages, layout components, `CustomSelect`, and `AuthContext`.
- `SettingsPage` preference helpers moved to module scope with per-user keys (mirrors `App.jsx`), removing unstable callback dependencies.
- The 5-minute inactivity timeout constant is hoisted to module scope in `AuthContext`.
- Removed dead `App.css` (30 KB, never imported; contained unlayered global rules that would have broken page headings if ever included).

## Responsiveness & touch

- Fixed a cascade bug where the unlayered `.modal-backdrop` safe-area rule zeroed vertical modal padding on devices without insets; padding now floors at `0.75rem`.
- Navbar account dropdown flips above its trigger and clamps to available space on short viewports (landscape phones) instead of overflowing past the screen edge.
- Enlarged sub-44px touch targets: login password visibility toggle, "Keep me signed in" row (now a full-height labelled checkbox), sidebar drawer/account-panel close buttons, and the profile save button.
- Login page respects notch/home-indicator safe-area insets on all sides.
