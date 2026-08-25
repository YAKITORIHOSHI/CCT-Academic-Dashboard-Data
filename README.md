# NCI Academic Performance Monitoring & Reporting System

A responsive React/Vite application for **Natsuki College of Imus** institutional academic records, approvals, reporting, catalog administration, and Firebase backup/recovery. Profile pictures are stored in Supabase Storage.

## Current architecture

The workspace follows a component-first data flow:

1. All authorized workspace pages are imported and mounted during the initial authenticated render.
2. Cached collections render immediately when available (per-user namespaced localStorage, versioned by `DATA_VERSION`).
3. Firebase Realtime Database subscriptions start during an idle/background task after the interface is mounted.
4. Large catalog and record snapshots are normalized in a Web Worker before React state is updated.
5. Catalog and record mutations update the interface optimistically, then synchronize to Firebase while the sidebar and Settings page expose synchronization status.

Authentication and authorization checks still complete before protected workspace content is shown.

## Services

| Service | Purpose |
| --- | --- |
| Firebase Authentication | Institutional sign-in (`@college.cvt.edu` accounts), session persistence choice, suspended-account enforcement |
| Firebase Realtime Database | Live source of truth for all workspace collections (asia-southeast1) |
| Supabase Storage | Profile-picture (`avatar`) uploads with automatic cleanup of previous files |

## Database-driven academic hierarchy

The Institutional Subject Catalog does not derive programs or courses from source-code constants. Its hierarchy is:

```text
Academic unit / school
└── Program
    └── Subject
```

Firebase Realtime Database collections:

- `departments`: academic units or schools
- `programs`: program records linked by their `department` value
- `subjects`: subject records linked by `department` and optional `programId`
- `requests`: academic performance records linked to the same department/program scope
- `accounts`: staff directory records provisioned through the Accounts page
- `backups`: snapshot metadata with SHA-256 checksums (last 100)
- `auditLogs`: append-only action history (last 500)
- `activityTicker`: live activity feed on the dashboard (last 25)

The VPAA can add or remove academic units, programs, and subjects from **System Settings**. Department-wide/common subjects use an empty `programId`.

## Security posture

- All service credentials are injected at build time from `.env.local` — no keys are hardcoded in source.
- Avatar URLs are sanitized to well-formed `https://` values before being bound to `<img>` elements or persisted to the database/local cache, regardless of database contents.
- Sessions auto-sign-out after 5 minutes of inactivity; tab-away periods longer than the timeout also force re-authentication.
- "Keep me signed in" is opt-in per login; otherwise auth state uses in-memory persistence only.
- Suspended accounts are signed out immediately on every account-directory sync, not just at login.
- Backups embed a SHA-256 checksum that restore flows verify before applying; restores require an active connection so local and remote data cannot diverge.
- Role and department-scoped permission checks run server-of-truth-side in `AuthContext` before every mutation (records, catalog, accounts, backups).

## Interface

- Natsuki College of Imus colorway (deep navy/cyan accents, rose-gold role badges) with hero banners
- Per-user dark/light theme plus optional Montserrat/Oswald typefaces, saved per account and applied before first paint to prevent flash
- Non-scrolling compact desktop sidebar with viewport-height adaptations; sticky mobile navigation drawer with safe-area and touch support
- Portal-based responsive dropdowns that clamp/flip within the viewport; modal-safe menus
- Responsive record table/cards, mobile bottom-sheet forms, and 44px-class touch targets for primary controls
- Database synchronization, pending-write status indicators, and a live activity ticker
- School logo favicon and branded metadata

## Role matrix

| Role | Records | Approval | Catalog | Accounts | Backups | Reports |
| --- | --- | --- | --- | --- | --- | --- |
| VPAA | Create, edit, delete all | Approve/return all | Full control | Full control | Full control | All units |
| President | Read-only | None | Read-only | None | None | All units |
| Deans | Assigned unit | Approve/return assigned unit | Read-only | None | None | Assigned unit |
| Heads | Create/revise own records in assigned unit | Submit to dean | Read-only | None | None | Assigned unit |

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

Copy `.env.example` to `.env.local` (and provide the Supabase values in `.env` if profile pictures are used), then fill in your Firebase project values before running the application. The source package intentionally excludes `.env.local`, build output, and `node_modules`.
