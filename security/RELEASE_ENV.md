# Encrypted environment backup for GitHub releases

Only `.env.enc` is intended for distribution. It contains an authenticated, encrypted snapshot of the root environment files (`.env`, `.env.local`, and any mode variants present when encryption runs). It excludes `.env.example` and other example/sample/template files. Both filenames and file contents are encrypted. The existing plaintext files remain available for local development and are ignored by Git.

The helper uses Node's built-in AES-256-GCM with a fresh random 96-bit nonce per backup, a 128-bit authentication tag, and a random 256-bit key. There is no password to guess and no decryption key in the application, repository, or encrypted file. The dot-prefixed encrypted file also receives the Windows Hidden attribute. Hiding is a convenience, not a security boundary, and that Windows attribute may not survive an upload/download.

## Create or refresh the encrypted file

```sh
npm run env:encrypt
npm run env:verify
```

On this Windows machine, the default key location is:

```text
%LOCALAPPDATA%\MyWebz\release-secrets\env.key
```

The helper generates this key once, restricts its Windows permissions to the current user and SYSTEM, and reuses it for subsequent backups. On other platforms, the default is `~/.local/share/MyWebz/release-secrets/env.key` with owner-only file permissions. A new backup is verified against the original bytes before replacing an older backup. If the old backup exists but the key is missing or incorrect, encryption stops instead of replacing it.

**Back up `env.key` privately** in a password manager that accepts file attachments or on a protected offline drive. Losing it makes the encrypted backup unrecoverable. Keep that backup separate from the release. Anyone who obtains both files can decrypt the environment; do not put the key in GitHub, source code, release notes, a downloadable attachment, or a public build artifact.

## Include the file in a release

- Commit the application changes, the helper, its tests, the documentation, `.env.example`, `.gitignore`, and `.gitattributes` as usual. `.env.enc` is explicitly allowed by `.gitignore` and can be committed or uploaded as a release asset.
- If attaching `.env.enc` in GitHub's file picker, enable **View > Show > Hidden items** in File Explorer to select it. A dot-prefixed filename remains visible through tools that list hidden files.
- Exclude plaintext environments, private keys, credentials, data exports, and `.git` from manually created archives. `.gitignore` does not filter files you attach or ZIP manually. The export exclusions in `.gitattributes` apply to Git-generated source archives once committed.
- Refresh the encrypted file whenever the environment changes. `deliverables/CCT_complete_source.zip` includes the current Firebase-only source, encrypted backup, helper, and recovery instructions; plaintext environments and the private key are excluded.

The encrypted file is a private recovery/transfer mechanism. A public release cannot decrypt it automatically. Authorized recipients must receive the key separately through a private channel. The app continues to load local environment configuration normally; it does not decrypt the backup in a browser.

## Recover on this or another computer

Install a Node version supported by this project. Restore the private key to the default location, or point to its location using an environment variable (PowerShell example):

```powershell
$env:MYWEBZ_ENV_KEY_FILE = 'D:\Private\MyWebz\env.key'
npm run env:verify
npm run env:restore -- --output 'D:\Private\MyWebz-restored'
```

The key must remain outside the project, including when a custom path is selected. Restore authenticates the complete backup before writing anything, rejects unsafe filenames, and refuses to overwrite any existing destination environment file. Review the restored files privately, then copy the required environment files into your local project. Never restore secrets into a public web directory or a release-staging directory.

## Browser configuration and previous exposure

Vite replaces used `VITE_*` variables in browser bundles at build time; encrypting `.env` does not hide those bundled values. Never put a server password, administrator/service-account credential, or other true secret in a `VITE_*` variable. Those belong on a backend or in its deployment secret store. See [Vite environment security guidance](https://vite.dev/guide/env-and-mode).

Firebase's client configuration is public by design; database access depends on Firebase Authentication and enforced Security Rules. See [Firebase API key guidance](https://firebase.google.com/docs/projects/api-keys). This backup change does not change production access rules or certify the entire application against data breaches.

The local inspection found `.env` and `.env.local` ignored and absent as files from all available local Git commits; the existing source ZIP contained only the example environment file. This does not check old GitHub release assets, remote-only history, or configuration values copied into other files. If a true secret was previously published anywhere, revoke/rotate it; encrypting a new copy does not undo that exposure.
