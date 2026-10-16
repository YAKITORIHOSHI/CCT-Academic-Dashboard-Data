# Optimization & Security Hardening Notes

This round of changes focuses on functionality, security, and component responsiveness.

## Security

- **Pinned Firebase project.** The public SDK configuration uses academicdashboarddata as required by the user. Environment variables cannot switch projects; server credentials and private keys remain outside source and release archives.
- **Initials-based accounts.** Accounts use initials; profile-picture integrations and uploads are removed.
- **Environment backups.** .env.example documents public Firebase values and local flags. Only the authenticated encrypted .env.enc backup may be published; its private key stays outside the repository.

## Functionality

- Cleaned all unused imports, unused catch parameters, and stale hook dependencies across pages, layout components, `CustomSelect`, and `AuthContext`.
- Shared preference helpers scope saved settings by Firebase project and user.
- The 5-minute inactivity timeout constant is hoisted to module scope in `AuthContext`.
- Removed the unused App.css stylesheet, preserving the upstream cleanup.

## Responsiveness & touch

- Fixed a cascade bug where the unlayered `.modal-backdrop` safe-area rule zeroed vertical modal padding on devices without insets; padding now floors at `0.75rem`.
- Navbar account dropdown flips above its trigger and clamps to available space on short viewports (landscape phones) instead of overflowing past the screen edge.
- Enlarged sub-44px touch targets: login password visibility toggle, "Keep me signed in" row (now a full-height labelled checkbox), sidebar drawer/account-panel close buttons, and the profile save button.
- Login page respects notch/home-indicator safe-area insets on all sides.
