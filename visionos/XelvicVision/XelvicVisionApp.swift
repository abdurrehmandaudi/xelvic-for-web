import SwiftUI

@main
struct XelvicVisionApp: App {
    @StateObject private var server = LocalServer()

    var body: some Scene {
        WindowGroup("Xelvic") {
            Group {
                if let url = server.url {
                    WebView(url: url)
                } else if let error = server.lastError {
                    ContentUnavailableView(
                        "Xelvic could not start",
                        systemImage: "exclamationmark.triangle",
                        description: Text(error)
                    )
                } else {
                    ProgressView("Starting Xelvic…")
                }
            }
            .onAppear { server.start() }
        }
        .defaultSize(width: 1280, height: 820)
    }
}
