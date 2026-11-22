# Xelvic for visionOS

The same web client, in a Vision Pro window. `WKWebView` draws the app and a
small Swift HTTP server serves it on loopback, so the page, its API calls, its
media and its WebSocket all see one origin — exactly what the Vite dev proxy
and `desktop/electron/proxy.cjs` do on the Mac.

This is a native shell, not a rewrite: routes, layout, copy, storage and the
theme system stay in `src/` and ship inside the bundle.

## Layout

| File | Job |
| --- | --- |
| `XelvicVision/XelvicVisionApp.swift` | window, server lifecycle |
| `XelvicVision/WebView.swift` | `WKWebView`, link handling, camera/microphone/geolocation decisions |
| `XelvicVision/LocalServer.swift` | static files + `/api`, `/media`, `/ws`, `/__xelvic_cdn` |
| `XelvicVision/Resources/dist` | the built web client (generated, git-ignored) |
| `XelvicVision.xcodeproj` | target `XelvicVision`, bundle id `com.xelvic.desktop.vision` |
| `XelvicVision/Info.plist` | local networking, camera/microphone/location strings |

Like the Mac build, the local server follows private-media redirects itself and
drops `Authorization`/`Cookie` when the redirect crosses to signed storage —
the storage service reads a forwarded bearer token as a broken SigV4 request.
The WebSocket path is a raw TLS tunnel to `wss://api.xelvic.com`, so chat
updates and typing/read events work the same way they do on the web.

## Build and run

```sh
npm run visionos:prepare   # builds the web client and copies dist into the bundle
open visionos/XelvicVision.xcodeproj
```

In Xcode: select the **XelvicVision** target → Signing & Capabilities → choose
your team (the bundle id is `com.xelvic.desktop.vision`; change it if it is
taken in your account), then run on **Apple Vision Pro**.

Command-line simulator build (no signing):

```sh
npm run visionos:build
```

The app is produced at
`visionos/build/Debug-xrsimulator/Xelvic.app`. To run it:

```sh
xcrun simctl create "Xelvic Vision" \
  com.apple.CoreSimulator.SimDeviceType.Apple-Vision-Pro-4K \
  com.apple.CoreSimulator.SimRuntime.visionOS-27-2
xcrun simctl boot "Xelvic Vision"
open -a Simulator
xcrun simctl install "Xelvic Vision" visionos/build/Debug-xrsimulator/Xelvic.app
xcrun simctl launch "Xelvic Vision" com.xelvic.desktop.vision
```

The visionOS simulator runtime is a separate multi-gigabyte download
(`xcodebuild -downloadPlatform visionOS`, or Xcode Settings → Components).

## App Store

visionOS apps are distributed through the App Store or TestFlight; there is no
DMG-style direct download. With the developer account already used for the iOS
app:

1. Set the team in Signing & Capabilities (automatic signing).
2. The brand icon is already a visionOS layered stack
   (`AppIcon.solidimagestack`: Front is the mark, Middle transparent, Back the
   brand pink). Replace a layer's `content.png` if a different treatment is
   wanted.
3. Set the version/build (`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`).
4. Product → Archive → Distribute App → App Store Connect.

App Review treats a pure web wrapper as a minimum-functionality risk
(Guideline 4.2); the login hand-off and media features are the native value
this build leans on, and TestFlight/internal distribution avoids the question.

## Archive and upload

The signed archive and an App Store IPA are produced by:

```sh
xcodebuild -project visionos/XelvicVision.xcodeproj -scheme XelvicVision \
  -configuration Release -destination 'generic/platform=visionOS' \
  -archivePath visionos/build/Xelvic.xcarchive \
  DEVELOPMENT_TEAM=P7U3BYUWTX CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates archive

xcodebuild -exportArchive -archivePath visionos/build/Xelvic.xcarchive \
  -exportPath visionos/build/export \
  -exportOptionsPlist /tmp/visionos-export.plist \
  -allowProvisioningUpdates
```

`Xelvic.ipa` (about 26 MB) lands in `visionos/build/export/`. Uploading with
`destination=upload` reaches App Store Connect, but it needs an **app record**
for `com.xelvic.desktop.vision` (New App → platform visionOS). Once the record
exists, Xcode Organizer (`Product → Archive → Distribute App`) or the same
`xcodebuild -exportArchive` with a `destination=upload` plist completes the
upload.

A Vision Pro simulator screenshot is kept at
`visionos/screenshots/visionos-3840x2160.png` for the App Store listing.

## Limits on this platform

- **Camera capture** — Vision Pro does not expose its cameras to apps, so
  `getUserMedia` camera capture cannot work; microphone and audio do.
- **Web notifications** — WebKit's embedded web view has no Web Push; the
  in-app notification list still works.
- **Service workers** — not available in `WKWebView`; the app's call-notice
  worker is skipped, which is already the documented behaviour for browsers
  without it.
- **Geolocation** — asks for permission through `WKUIDelegate` and the system
  prompt.
- **tvOS is not possible this way.** The tvOS SDK does not ship WebKit (no
  `WKWebView`), and neither Electron nor Tauri targets tvOS; an Apple TV client
  would be a native rewrite against the same API.
- **watchOS is not possible this way either.** The watchOS SDK ships no
  WebKit/Safari frameworks, and Electron/Tauri do not target watchOS. A watch
  app would be a native SwiftUI companion (sign-in, notifications, quick
  replies) built against the same API — not this web client.
