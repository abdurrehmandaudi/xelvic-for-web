# Xelvic for macOS

The web client from `src/` wrapped as a real desktop app: its own Dock icon,
window, menu and storage, installed from a `.dmg`. The page is the same build
the browser serves — this is not a second UI.

## How it is put together

| Piece | File | Job |
| --- | --- | --- |
| Main process | `electron/main.cjs` | window, menu, permissions, single-instance, external links |
| Preload | `electron/preload.cjs` | marks the window as desktop so the app keeps its tokens across launches |
| Local server | `electron/proxy.cjs` | serves `dist/` and proxies `/api`, `/media`, `/ws` and `/__xelvic_cdn` |
| App metadata + packaging | `package.json` (this directory) | app id, icon, DMG layout, Info.plist strings |
| Icon | `build/icon.icns` | generated from `public/xelvic.png` |

The window loads `http://127.0.0.1:47831`, so every API call is same-origin and
the live API's CORS policy (which only answers `https://web.xelvic.com`) never
comes into play. `proxy.cjs` follows storage redirects itself, the way the Vite
dev proxy does.

## Scripts (run from the repository root)

| Command | What it does |
| --- | --- |
| `npm run desktop` | builds the app with the local-origin env and opens Electron |
| `npm run desktop:proxy` | runs only the local server, for testing in a browser |
| `npm run desktop:dist` | builds and produces the DMG in `desktop-release/` |
| `npm run desktop:dist:win` | builds the Windows ZIP (`Xelvic-0.1.0-x64.zip`) |
| `npm run desktop:dist:win:installer` | builds the NSIS setup (`Xelvic-Setup-0.1.0-x64.exe`); needs Rosetta 2 on Apple Silicon macOS, or run on Windows |
| `npm run desktop:dist:linux` | builds the Linux `.tar.gz` |
| `npm run desktop:dist:all` | macOS + Windows + Linux in one run |

`npm run build` (the web build) is unchanged; `build:desktop` is the desktop
variant, with `VITE_API_URL` / `VITE_WS_URL` pointed at the local server.

## Distribution status

The build is **ad-hoc signed** (`mac.identity: "-"`), which is what Apple
Silicon requires to launch an unsigned app at all. It is not notarized.

- Internal/team Macs: right-click the app → **Open** once, or clear the
  quarantine flag: `xattr -dr com.apple.quarantine /Applications/Xelvic.app`
- Public distribution with a clean double-click needs an Apple Developer
  Program membership ($99/year), a **Developer ID Application** certificate and
  notarization. electron-builder takes these through environment variables —
  do not commit them:

  ```
  CSC_LINK=/path/to/developer-id.p12
  CSC_KEY_PASSWORD=...
  APPLE_ID=...
  APPLE_APP_SPECIFIC_PASSWORD=...
  APPLE_TEAM_ID=...
  ```

  Then change `mac.identity` to the certificate's common name in
  `package.json` and add `"notarize": true` to `mac`. Verify with
  `spctl -a -vvv -t exec Xelvic.app` (expect `Notarized Developer ID`) and
  `xcrun stapler validate`.

## Windows and Linux

| Platform | Artifact | Notes |
| --- | --- | --- |
| Windows x64 | `Xelvic-0.1.0-x64.zip` | Unzip and run `Xelvic.exe`. No installer is produced on this Mac because NSIS's `makensis` is x86_64 and Rosetta is not installed; run `npm run desktop:dist:win` on Windows (with the `nsis` target restored in `package.json`) for `Xelvic-Setup-0.1.0-x64.exe`. |
| Linux x64 | `Xelvic-0.1.0-x64.tar.gz` | Unpack and run `Xelvic-0.1.0-x64/xelvic-desktop`. A `.deb` needs a maintainer name/email for the package metadata; add `linux.maintainer` to `package.json` and restore the `deb` target when that address is known. |

The same `proxy.cjs` runs on all three platforms — it uses only Node core
modules. Windows notifications are grouped under `com.xelvic.desktop` via
`setAppUserModelId`.

On some Linux distributions Electron's SUID helper needs its owner fixed once:

```
sudo chown root:root /opt/Xelvic/chrome-sandbox
sudo chmod 4755 /opt/Xelvic/chrome-sandbox
```

Neither build is code-signed: Windows shows SmartScreen's "unknown publisher"
until an Authenticode certificate is configured; Linux packages are unsigned.

## Known limitations

- **Geolocation** — Chromium in Electron has no free geolocation service.
  `navigator.geolocation` needs a Google Geolocation API key, set before the
  window opens (`process.env.GOOGLE_API_KEY`). Without it, the location sheet
  reports that a place could not be found. Everything else works.
- **Updates** — the app bundles the UI it was built with. A new web build
  needs a new DMG. Auto-update (`electron-updater`) is not configured yet.
- **Web Share** — `navigator.share` is not available in Electron; the app's
  own copy/link actions are used instead.
- **Builds are arm64 only.** Add `x64` or `universal` to `mac.target` in
  `package.json` for Intel Macs.
- **Port 47831** must be free. The app shows an error dialog and quits if it is
  not.
