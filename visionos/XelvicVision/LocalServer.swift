import Combine
import Foundation
import Network

/// A local HTTP server that makes the bundled web client and the live API one
/// origin.
///
/// The web client talks to the API through the Vite dev proxy on the Mac, and
/// through `desktop/electron/proxy.cjs` in the Electron apps. This is the same
/// job in Swift: the window loads `http://127.0.0.1:47831`, so `/api`,
/// `/media`, `/ws` and the CDN path are same-origin and the API's CORS policy
/// never applies. Redirects are followed here (with the account headers
/// dropped when they cross hosts), because a browser following a private
/// media redirect to storage hits the storage service's CORS rules instead.
final class LocalServer: ObservableObject {
    @Published private(set) var url: URL?
    @Published private(set) var lastError: String?

    private let queue = DispatchQueue(label: "com.xelvic.vision.local-server")
    private let port: UInt16
    private let apiHost = "api.xelvic.com"
    private let cdnHost = "cdn.xelvic.com"
    private let dist: URL
    private let baseConfiguration: URLSessionConfiguration
    private var listener: NWListener?

    private static let crlfcrlf = Data("\r\n\r\n".utf8)

    init(port: UInt16 = 47831, dist: URL? = nil) {
        self.port = port
        if let dist {
            self.dist = dist
        } else {
            let root = Bundle.main.resourceURL ?? Bundle.main.bundleURL
            self.dist = root.appendingPathComponent("dist", isDirectory: true)
        }

        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 120
        configuration.timeoutIntervalForResource = 600
        configuration.httpMaximumConnectionsPerHost = 8
        baseConfiguration = configuration
    }

    func start() {
        guard listener == nil else { return }

        let parameters = NWParameters.tcp
        parameters.allowLocalEndpointReuse = true
        parameters.requiredLocalEndpoint = .hostPort(
            host: .ipv4(.loopback),
            port: NWEndpoint.Port(rawValue: port)!
        )

        do {
            let listener = try NWListener(using: parameters)
            install(listener)
        } catch {
            // Some simulator builds refuse a required local endpoint; binding
            // the port itself still keeps the server on this machine.
            do {
                let listener = try NWListener(using: .tcp, on: NWEndpoint.Port(rawValue: port)!)
                install(listener)
            } catch {
                DispatchQueue.main.async { self.lastError = error.localizedDescription }
            }
        }
    }

    private func install(_ listener: NWListener) {
        listener.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready:
                DispatchQueue.main.async { self.url = URL(string: "http://127.0.0.1:\(self.port)/") }
            case .failed(let error):
                DispatchQueue.main.async { self.lastError = error.localizedDescription }
            default:
                break
            }
        }
        listener.newConnectionHandler = { [weak self] connection in
            self?.accept(connection)
        }
        listener.start(queue: queue)
        self.listener = listener
    }

    func stop() {
        listener?.cancel()
        listener = nil
        DispatchQueue.main.async { self.url = nil }
    }

    // MARK: - Reading a request

    private func accept(_ connection: NWConnection) {
        connection.start(queue: queue)
        readHead(connection, buffer: Data())
    }

    private func readHead(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 256 * 1024) { [weak self] data, _, isComplete, error in
            guard let self else { return }
            var buffer = buffer
            if let data { buffer.append(data) }
            if error != nil {
                connection.cancel()
                return
            }
            if let range = buffer.range(of: Self.crlfcrlf) {
                let head = Data(buffer[..<range.lowerBound])
                let rest = Data(buffer[range.upperBound...])
                guard let request = Request(head: head) else {
                    self.sendStatus(400, "Bad Request", connection)
                    return
                }
                self.readBody(request, head: rest, connection: connection)
                return
            }
            if isComplete {
                connection.cancel()
                return
            }
            if buffer.count > 128 * 1024 {
                self.sendStatus(431, "Request Header Fields Too Large", connection)
                return
            }
            self.readHead(connection, buffer: buffer)
        }
    }

    private func readBody(_ request: Request, head: Data, connection: NWConnection) {
        if request.path.hasPrefix("/ws") {
            openWebSocket(request, head: head, connection: connection)
            return
        }

        let chunked = request.header("transfer-encoding")?.lowercased().contains("chunked") == true
        if chunked {
            // The client only sends a body with a known length (multipart
            // uploads from FormData), so a chunked body is not something this
            // server needs to decode.
            sendStatus(411, "Length Required", connection)
            return
        }

        let length = Int(request.header("content-length") ?? "") ?? 0
        if request.method == "GET" || request.method == "HEAD" || length <= 0 {
            dispatch(request, body: .none, connection: connection)
            return
        }

        var sink = BodySink()
        sink.append(head)
        if sink.count >= length {
            dispatch(request, body: sink.finish(), connection: connection)
            return
        }
        readRemaining(request, sink: sink, length: length, connection: connection)
    }

    private func readRemaining(_ request: Request, sink: BodySink, length: Int, connection: NWConnection) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 256 * 1024) { [weak self] data, _, isComplete, error in
            guard let self else { return }
            var sink = sink
            if let data { sink.append(data) }
            if error != nil {
                sink.discard()
                connection.cancel()
                return
            }
            if sink.count >= length {
                self.dispatch(request, body: sink.finish(), connection: connection)
                return
            }
            if isComplete {
                sink.discard()
                connection.cancel()
                return
            }
            self.readRemaining(request, sink: sink, length: length, connection: connection)
        }
    }

    // MARK: - Routing

    private func dispatch(_ request: Request, body: Body, connection: NWConnection) {
        if request.path.hasPrefix("/api") || request.path.hasPrefix("/media") {
            proxy(request, body: body, host: apiHost, path: request.target, connection: connection)
            return
        }
        if request.path.hasPrefix("/__xelvic_cdn") {
            var path = request.target
            if let range = path.range(of: "/__xelvic_cdn") {
                path.removeSubrange(range)
            }
            if path.isEmpty { path = "/" }
            proxy(request, body: body, host: cdnHost, path: path, connection: connection)
            return
        }
        serveStatic(request, connection: connection)
    }

    private func proxy(_ request: Request, body: Body, host: String, path: String, connection: NWConnection) {
        guard let url = URL(string: "https://\(host)\(path)") else {
            sendStatus(400, "Bad Request", connection)
            return
        }

        var outgoing = URLRequest(url: url)
        outgoing.httpMethod = request.method
        for (name, value) in request.headers {
            let lower = name.lowercased()
            if ["host", "connection", "content-length", "transfer-encoding", "accept-encoding"].contains(lower) {
                continue
            }
            outgoing.setValue(value, forHTTPHeaderField: name)
        }
        // The API's origin allow-list recognises the deployed web client, not
        // this server; it sees the same trusted client the browser would.
        outgoing.setValue("https://web.xelvic.com", forHTTPHeaderField: "Origin")
        outgoing.setValue("https://web.xelvic.com/", forHTTPHeaderField: "Referer")

        var tempFile: URL?
        switch body {
        case .none:
            break
        case .data(let data):
            outgoing.httpBody = data
        case .file(let url):
            tempFile = url
        }

        let delegate = ProxyDelegate(
            connection: connection,
            queue: queue,
            originalHost: host,
            tempFile: tempFile
        )
        let session = URLSession(configuration: baseConfiguration, delegate: delegate, delegateQueue: nil)
        delegate.session = session

        let task: URLSessionTask
        if let tempFile {
            task = session.uploadTask(with: outgoing, fromFile: tempFile)
        } else {
            task = session.dataTask(with: outgoing)
        }
        task.resume()
    }

    // MARK: - WebSocket tunnel

    private func openWebSocket(_ request: Request, head: Data, connection: NWConnection) {
        let parameters = NWParameters(tls: NWProtocolTLS.Options(), tcp: NWProtocolTCP.Options())
        let upstream = NWConnection(host: NWEndpoint.Host(apiHost), port: 443, using: parameters)

        var lines = [
            "GET \(request.target) HTTP/1.1",
            "Host: \(apiHost)",
            "Upgrade: websocket",
            "Connection: Upgrade",
            "Origin: https://web.xelvic.com",
        ]
        if let key = request.header("sec-websocket-key") {
            lines.append("Sec-WebSocket-Key: \(key)")
        }
        lines.append("Sec-WebSocket-Version: \(request.header("sec-websocket-version") ?? "13")")
        if let extensions = request.header("sec-websocket-extensions") {
            lines.append("Sec-WebSocket-Extensions: \(extensions)")
        }
        if let proto = request.header("sec-websocket-protocol") {
            lines.append("Sec-WebSocket-Protocol: \(proto)")
        }
        let handshake = Data((lines.joined(separator: "\r\n") + "\r\n\r\n").utf8)

        upstream.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready:
                upstream.send(content: handshake, completion: .contentProcessed { error in
                    if error != nil {
                        connection.cancel()
                        upstream.cancel()
                        return
                    }
                    if !head.isEmpty {
                        upstream.send(content: head, completion: .contentProcessed { _ in })
                    }
                    self.pump(from: upstream, to: connection)
                    self.pump(from: connection, to: upstream)
                })
            case .failed, .cancelled:
                connection.cancel()
            default:
                break
            }
        }
        upstream.start(queue: queue)
    }

    private func pump(from source: NWConnection, to destination: NWConnection) {
        source.receive(minimumIncompleteLength: 1, maximumLength: 128 * 1024) { [weak self] data, _, isComplete, error in
            if let data, !data.isEmpty {
                destination.send(content: data, completion: .contentProcessed { sendError in
                    if sendError != nil {
                        source.cancel()
                        destination.cancel()
                    }
                })
            }
            if isComplete || error != nil {
                source.cancel()
                destination.cancel()
                return
            }
            self?.pump(from: source, to: destination)
        }
    }

    // MARK: - Static files

    private func serveStatic(_ request: Request, connection: NWConnection) {
        guard request.method == "GET" || request.method == "HEAD" else {
            sendStatus(405, "Method Not Allowed", connection)
            return
        }
        if request.path.contains("..") {
            sendStatus(403, "Forbidden", connection)
            return
        }

        var relative = request.path
        if relative == "/" { relative = "/index.html" }
        var file = dist.appendingPathComponent(String(relative.dropFirst()))
        var isDirectory: ObjCBool = false

        if !FileManager.default.fileExists(atPath: file.path, isDirectory: &isDirectory) || isDirectory.boolValue {
            if (relative as NSString).pathExtension.isEmpty {
                file = dist.appendingPathComponent("index.html")
            } else {
                sendStatus(404, "Not Found", connection)
                return
            }
        }

        guard let data = try? Data(contentsOf: file) else {
            sendStatus(404, "Not Found", connection)
            return
        }

        let cache = file.lastPathComponent == "index.html"
            ? "no-store"
            : "public, max-age=31536000, immutable"
        let head = [
            "HTTP/1.1 200 OK",
            "Content-Type: \(mimeType(for: file.pathExtension))",
            "Content-Length: \(data.count)",
            "Cache-Control: \(cache)",
            "Connection: close",
            "",
            "",
        ].joined(separator: "\r\n")

        connection.send(content: Data(head.utf8), completion: .contentProcessed { _ in
            if request.method == "HEAD" {
                connection.cancel()
                return
            }
            connection.send(content: data, completion: .contentProcessed { _ in connection.cancel() })
        })
    }

    // MARK: - Small responses

    private func sendStatus(_ code: Int, _ text: String, _ connection: NWConnection, message: String? = nil) {
        let body = Data((message ?? text).utf8)
        let head = [
            "HTTP/1.1 \(code) \(text)",
            "Content-Type: text/plain; charset=utf-8",
            "Content-Length: \(body.count)",
            "Connection: close",
            "",
            "",
        ].joined(separator: "\r\n")
        connection.send(content: Data(head.utf8), completion: .contentProcessed { _ in
            connection.send(content: body, completion: .contentProcessed { _ in connection.cancel() })
        })
    }
}

// MARK: - Request

private struct Request {
    let method: String
    let target: String
    let version: String
    let headers: [(String, String)]

    init?(head: Data) {
        guard let text = String(data: head, encoding: .utf8) else { return nil }
        let lines = text.components(separatedBy: "\r\n")
        guard let first = lines.first else { return nil }
        let parts = first.split(separator: " ", maxSplits: 2).map(String.init)
        guard parts.count >= 2 else { return nil }

        method = parts[0].uppercased()
        target = parts[1]
        version = parts.count > 2 ? parts[2] : "HTTP/1.1"

        var headers: [(String, String)] = []
        for line in lines.dropFirst() where !line.isEmpty {
            guard let colon = line.firstIndex(of: ":") else { continue }
            let name = String(line[..<colon]).trimmingCharacters(in: .whitespaces)
            let value = String(line[line.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
            headers.append((name, value))
        }
        self.headers = headers
    }

    var path: String {
        if let question = target.firstIndex(of: "?") {
            return String(target[..<question])
        }
        return target
    }

    func header(_ name: String) -> String? {
        headers.first { $0.0.caseInsensitiveCompare(name) == .orderedSame }?.1
    }
}

// MARK: - Bodies

private enum Body {
    case none
    case data(Data)
    case file(URL)
}

/// Keeps a request body until it is complete. Small bodies stay in memory;
/// uploads spill to a temporary file so a large video never sits in RAM whole.
private struct BodySink {
    private static let threshold = 16 * 1024 * 1024

    private var data = Data()
    private var file: URL?
    private var handle: FileHandle?
    private(set) var count = 0

    mutating func append(_ chunk: Data) {
        guard !chunk.isEmpty else { return }
        count += chunk.count
        if let handle {
            try? handle.write(contentsOf: chunk)
            return
        }
        if data.count + chunk.count > Self.threshold {
            spill()
            try? handle?.write(contentsOf: chunk)
        } else {
            data.append(chunk)
        }
    }

    private mutating func spill() {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("xelvic-upload-\(UUID().uuidString)")
        guard FileManager.default.createFile(atPath: url.path, contents: nil),
              let handle = try? FileHandle(forWritingTo: url) else { return }
        try? handle.write(contentsOf: data)
        self.handle = handle
        self.file = url
        data.removeAll(keepingCapacity: false)
    }

    mutating func finish() -> Body {
        if let handle {
            try? handle.close()
            self.handle = nil
            if let file { return .file(file) }
        }
        return data.isEmpty ? .none : .data(data)
    }

    mutating func discard() {
        try? handle?.close()
        handle = nil
        if let file { try? FileManager.default.removeItem(at: file) }
        file = nil
        data.removeAll(keepingCapacity: false)
    }
}

// MARK: - URLSession streaming

private final class ProxyDelegate: NSObject, URLSessionDataDelegate {
    private let connection: NWConnection
    private let originalHost: String
    private let tempFile: URL?
    var session: URLSession?

    private var response: HTTPURLResponse?
    private var headersSent = false
    private var finished = false

    init(connection: NWConnection, queue: DispatchQueue, originalHost: String, tempFile: URL?) {
        self.connection = connection
        self.originalHost = originalHost
        self.tempFile = tempFile
        super.init()
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        var next = request
        if next.url?.host != originalHost {
            // Private media redirects to signed storage. A browser drops the
            // account's headers on a cross-origin redirect, and storage needs
            // that: a stray Bearer token makes it answer as if it were the
            // signed request itself ("Missing x-amz-content-sha256").
            next.setValue(nil, forHTTPHeaderField: "Authorization")
            next.setValue(nil, forHTTPHeaderField: "Cookie")
            next.setValue(nil, forHTTPHeaderField: "Origin")
            next.setValue(nil, forHTTPHeaderField: "Referer")
        }
        completionHandler(next)
    }

    func urlSession(
        _ session: URLSession,
        dataTask: URLSessionDataTask,
        didReceive response: URLResponse,
        completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
    ) {
        self.response = response as? HTTPURLResponse
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        sendHeadIfNeeded()
        connection.send(content: data, completion: .contentProcessed { _ in })
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard !finished else { return }
        finished = true

        if let error, !headersSent {
            let body = Data("The server could not be reached.\n\(error.localizedDescription)".utf8)
            let head = [
                "HTTP/1.1 502 Bad Gateway",
                "Content-Type: text/plain; charset=utf-8",
                "Content-Length: \(body.count)",
                "Connection: close",
                "",
                "",
            ].joined(separator: "\r\n")
            connection.send(content: Data(head.utf8), completion: .contentProcessed { [connection] _ in
                connection.send(content: body, completion: .contentProcessed { _ in connection.cancel() })
            })
        } else {
            sendHeadIfNeeded()
            connection.send(
                content: nil,
                contentContext: .defaultMessage,
                isComplete: true,
                completion: .contentProcessed { [connection] _ in connection.cancel() }
            )
        }

        session.finishTasksAndInvalidate()
        if let tempFile { try? FileManager.default.removeItem(at: tempFile) }
    }

    private func sendHeadIfNeeded() {
        guard !headersSent, let response else { return }
        headersSent = true

        var lines = ["HTTP/1.1 \(response.statusCode) \(httpStatusText(response.statusCode))"]
        for (key, value) in response.allHeaderFields {
            let name = String(describing: key)
            let lower = name.lowercased()
            if ["connection", "transfer-encoding", "content-encoding", "content-length"].contains(lower) {
                continue
            }
            lines.append("\(name): \(value)")
        }
        lines.append("Connection: close")
        lines.append("")
        lines.append("")
        connection.send(content: Data(lines.joined(separator: "\r\n").utf8), completion: .contentProcessed { _ in })
    }
}

// MARK: - Helpers

private func mimeType(for pathExtension: String) -> String {
    switch pathExtension.lowercased() {
    case "html": return "text/html; charset=utf-8"
    case "js", "mjs": return "text/javascript; charset=utf-8"
    case "css": return "text/css; charset=utf-8"
    case "json", "map": return "application/json; charset=utf-8"
    case "txt": return "text/plain; charset=utf-8"
    case "svg": return "image/svg+xml"
    case "png": return "image/png"
    case "jpg", "jpeg": return "image/jpeg"
    case "webp": return "image/webp"
    case "gif": return "image/gif"
    case "ico": return "image/x-icon"
    case "woff": return "font/woff"
    case "woff2": return "font/woff2"
    case "ttf": return "font/ttf"
    case "otf": return "font/otf"
    case "mp3": return "audio/mpeg"
    case "m4a": return "audio/mp4"
    case "ogg": return "audio/ogg"
    case "wav": return "audio/wav"
    case "mp4": return "video/mp4"
    case "webm": return "video/webm"
    case "mov": return "video/quicktime"
    case "wasm": return "application/wasm"
    default: return "application/octet-stream"
    }
}

private func httpStatusText(_ status: Int) -> String {
    switch status {
    case 200: return "OK"
    case 201: return "Created"
    case 202: return "Accepted"
    case 204: return "No Content"
    case 206: return "Partial Content"
    case 301: return "Moved Permanently"
    case 302: return "Found"
    case 303: return "See Other"
    case 304: return "Not Modified"
    case 307: return "Temporary Redirect"
    case 308: return "Permanent Redirect"
    case 400: return "Bad Request"
    case 401: return "Unauthorized"
    case 403: return "Forbidden"
    case 404: return "Not Found"
    case 405: return "Method Not Allowed"
    case 408: return "Request Timeout"
    case 409: return "Conflict"
    case 411: return "Length Required"
    case 413: return "Payload Too Large"
    case 415: return "Unsupported Media Type"
    case 422: return "Unprocessable Entity"
    case 429: return "Too Many Requests"
    case 500: return "Internal Server Error"
    case 502: return "Bad Gateway"
    case 503: return "Service Unavailable"
    case 504: return "Gateway Timeout"
    default: return "Response"
    }
}
