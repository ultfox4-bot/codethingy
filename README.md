# Ultfox Code Redeemer

Electron desktop app that lets you generate, share, and redeem 36-character
codes. Keys are stored on a shared online server so they sync across every
device that runs the app.

## Features

- **Redeem** a 36-char key to reveal the embedded message and any attached link.
- **Request a code** form opens a pre-filled email to `Ultfox4@gmail.com`.
- **Admin menu** (password-protected): generate keys, embed up to 200 chars of
  text, attach an external file link (Google Drive, Dropbox, etc.), revoke keys,
  and view active / redeemed / revoked lists.
- Keys are **single-use** — once redeemed, they cannot be redeemed again.
- Once a key is redeemed the renderer also opens a mailto draft notifying
  `Ultfox4@gmail.com` of the redemption.

## Run locally

```bash
yarn install
yarn start
```

## Build the Windows installer locally

```bash
yarn dist:win
```

The installer is written to `dist/Ultfox-Code-Redeemer-Setup-<version>.exe`.

## GitHub Actions build

Pushes to `main`/`master` and workflow runs trigger
`.github/workflows/build.yml`, which produces a Windows NSIS installer and
uploads it as a workflow artifact. Pushing a `v*` tag also publishes it to a
GitHub Release.

The lockfile `yarn.lock` is committed alongside `package.json` so the workflow
uses `yarn install --frozen-lockfile` for reproducible builds.

## Configure the backend URL

`config.js` holds the default backend URL. Override it at runtime with the
`ULTFOX_BACKEND_URL` environment variable.
