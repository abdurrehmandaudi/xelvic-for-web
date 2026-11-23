# Xelvic for web, desktop and Vision Pro

This repository is the standalone React web client for the Xelvic account
system. It ships the web app itself and the shells that make the same client an
installed app on macOS, Windows, Linux and visionOS. The UI, routes and API
contracts stay in `src/`; no screen was redesigned or reimplemented for a
platform.

Every shell wraps the **same built web client**. The reason is the same on each
one: the live API answers CORS only for `https://xelvic.com`, so the page is
served from a local origin and every `/api`, `/media`, `/ws` and CDN request is
proxied beside it. The page then sees one origin and the server's allow-list is
never involved.

## What exists, and what each piece is for

| Platform | Shell | Artifact | State |
| --- | --- | --- | --- |
| Web | Vite build of `src/` | `dist/` | The original app. Typecheck, lint and 496 tests pass |
| macOS | Electron 45 + `desktop/electron/*` | `Xelvic-0.1.0-arm64.dmg` (139 MB) | Launched and exercised: login, media, WebSocket path |
| Windows | Electron 45 + the same main/proxy | `Xelvic-0.1.0-x64.zip` (169 MB) | Built on macOS; not run on Windows yet |
| Linux | Electron 45 + the same main/proxy | `Xelvic-0.1.0-x64.tar.gz` (137 MB) | Built on macOS; not run on Linux yet |
| visionOS | SwiftUI + `WKWebView` + `visionos/XelvicVision/LocalServer.swift` | `Xelvic.ipa` (25 MB) | Ran in the Vision Pro simulator; signed archive exported |
| tvOS | — | — | **Not possible this way**: no WebKit in the tvOS SDK |
| watchOS | — | — | **Not possible this way**: no WebKit in the watchOS SDK |
| iOS | Existing uploaded app | — | Outside this repository |

Build artifacts are not committed. They live in `desktop-release/` and
`visionos/build/`, both ignored by git. See [Building the artifacts](#building-the-artifacts).

## The one-origin design

```
page (http://127.0.0.1:47831)
  ├─ /api/*               → https://api.xelvic.com
  ├─ /media/*             → https://api.xelvic.com (redirects followed here)
  ├─ /ws/*                → wss://api.xelvic.com (raw TLS tunnel)
  ├─ /__xelvic_cdn/*      → https://cdn.xelvic.com
  └─ everything else      → the bundled dist/ with SPA fallback
```

- **Electron** (`desktop/electron/proxy.cjs`) serves `dist/` with Node's `http`
  module and forwards the four routes above. It follows media redirects itself,
  because a browser following a private file's redirect to signed storage meets
  the storage service's CORS rules.
- **visionOS** (`visionos/XelvicVision/LocalServer.swift`) does the same with
  `Network.framework` and `URLSession`; WebSocket is a raw TLS tunnel.
- The port is fixed at **47831** on every platform, so the built client's
  `VITE_API_URL` is `http://127.0.0.1:47831` inside the bundles. A second
  instance is prevented on macOS; the proxy binds loopback.

Two defects were found and fixed while bringing these up, both in the proxy:

1. **WebSocket upgrade crash** — `wss:` was passed as Node's request protocol,
   which only accepts `https:`. The scheme is now normalised and the upgrade
   path is guarded.
2. **Private media 400s** — a media request redirects to signed storage
   (R2). The proxy forwarded `Authorization: Bearer …` across that redirect,
   which made storage read it as a broken SigV4 request
   (`Missing x-amz-content-sha256`). A browser drops account headers on a
   cross-origin redirect; the proxy now does the same. The Swift server mirrors
   that rule in its `URLSession` redirect delegate.

Desktop sign-in persists across relaunches: `desktop/electron/preload.cjs`
marks the window, and `src/store/session.ts` uses `localStorage` only inside
that shell. The browser keeps using `sessionStorage`, so closing a tab still
signs out.

## Platform notes

### macOS

- `desktop/` contains the main process, preload, local server, Info.plist usage
  strings (camera, microphone, location), menu and single-instance lock.
- Ad-hoc signed (`mac.identity: "-"`). It runs locally; a Mac that downloads it
  needs right-click → Open, or
  `xattr -dr com.apple.quarantine /Applications/Xelvic.app`.
- Public distribution needs an Apple Developer Program membership, a
  Developer ID Application certificate and notarization; `desktop/README.md`
  lists the environment variables.

### Windows

- `Xelvic-0.1.0-x64.zip` is portable: unzip, run `Xelvic.exe`. Windows 10/11
  x64. First run shows SmartScreen's unknown-publisher prompt (unsigned).
- The NSIS installer target is configured but cannot run on this Mac yet:
  NSIS's `makensis` is x86_64 and Rosetta 2 is not installed. On a Windows
  machine `npx electron-builder --win nsis --x64` produces
  `Xelvic-Setup-0.1.0-x64.exe`; on Apple Silicon macOS install Rosetta first,
  then `npm run desktop:dist:win:installer`.
- Microsoft Store distribution needs a Partner Center account, a Store identity
  (Identity Name / Publisher / Publisher Display Name / Application ID) and an
  APPX/MSIX build; Store signing is handled by Microsoft.

### Linux

- `Xelvic-0.1.0-x64.tar.gz` unpacks to `Xelvic-0.1.0-x64/xelvic-desktop`.
- Some distributions need the Electron SUID helper fixed once:
  `sudo chown root:root …/chrome-sandbox && sudo chmod 4755 …/chrome-sandbox`.
- A `.deb` needs a maintainer name and email in the package metadata; add
  `linux.maintainer` and restore the `deb` target when that address is decided.

### visionOS

- `visionos/XelvicVision/` is a native visionOS app: SwiftUI window plus
  `WKWebView` (with camera/microphone/geolocation delegate decisions) and a
  Swift local server.
- App icon is a layered visionOS stack (`AppIcon.solidimagestack`), 1024×1024
  PNGs at 2x on a 512-point canvas.
- Verified in the Vision Pro simulator: the login window renders and the QR is
  live. Screenshot: `visionos/screenshots/visionos-3840x2160.png`.
- Archive and export succeed with the existing Xcode account (team
  `P7U3BYUWTX`, automatic signing), producing `visionos/build/export/Xelvic.ipa`.
- Upload reaches App Store Connect but is blocked on an **app record** for
  `com.xelvic.desktop.vision`. Create it in App Store Connect (New App →
  visionOS) and rerun the upload.
- Limits: Vision Pro does not expose its cameras to apps; embedded `WKWebView`
  has no Web Push and no service workers; geolocation goes through the system
  prompt.

### Apple TV and Apple Watch

Both SDKs were checked directly: `WebKit.framework` is absent from the tvOS and
watchOS SDKs (and their simulators). Electron and Tauri do not target either
platform. An Apple TV or watch client would be a native SwiftUI rewrite against
the same API — not a shell around this web client. The QR sign-in hand-off is a
good fit for a TV companion if that project is ever started.

## Building the artifacts

Run from the repository root:

| Command | Produces |
| --- | --- |
| `npm run build` | web build in `dist/` |
| `npm run desktop` | builds and opens the Electron app (any desktop OS) |
| `npm run desktop:dist` | macOS DMG (arm64) |
| `npm run desktop:dist:win` | Windows ZIP |
| `npm run desktop:dist:win:installer` | Windows NSIS setup (needs Rosetta on this Mac, or Windows) |
| `npm run desktop:dist:linux` | Linux tar.gz |
| `npm run visionos:prepare` | web build + copies `dist/` into the visionOS bundle |
| `npm run visionos:build` | compiles the visionOS app for the simulator |

Flags for the desktop build: `VITE_API_URL` / `VITE_WS_URL` are set by
`build:desktop` to the local origin; the proxy target can be overridden with
`XELVIC_API_TARGET`, `XELVIC_WS_TARGET`, `XELVIC_CDN_TARGET` and
`XELVIC_DESKTOP_PORT`.

## Verification recorded

- `npm test` — **496/496 tests pass** (44 files)
- `npm run typecheck` — clean
- `npm run lint` — 0 errors, 2 pre-existing `exhaustive-deps` warnings in
  `VibeSlide.tsx`
- macOS app: launched, QR login, feed media (`/media` redirect) and the
  WebSocket upgrade path exercised; a 403 from the API for an invalid token
  reaches the client intact
- visionOS: built and launched in the Vision Pro simulator; same QR screen
- The Swift server was also compiled and run on macOS as a harness: static,
  API, SPA fallback, private media (200 image/jpeg) and WebSocket upgrade all
  behaved like the Electron proxy
- **Not verified:** Windows and Linux binaries have not been run on those OSes;
  no real Vision Pro device run; no App Store review; no Windows Store
  submission

## Secrets and environment

- `.env` and `.env.*` are ignored by git (`.env.local` included). No env file
  is committed.
- Signing material (`*.p8`, `*.p12`, `*.cer`, `*.mobileprovision`) and build
  outputs (`desktop-release/`, `visionos/build/`,
  `visionos/XelvicVision/Resources/dist/`) are ignored.
- Tokens are never logged by the wrappers. The local proxy binds loopback only.
- App Store Connect API keys, Apple ID passwords, Windows Authenticode
  certificates and Partner Center identities must stay outside the repository.
