"use strict";

/**
 * Xelvic for macOS.
 *
 * The window is the same web client the browser serves, wrapped so it has a
 * Dock icon, a real window, its own storage and no browser around it. The
 * built `dist/` is served by `proxy.cjs` on localhost, and every API, media
 * and WebSocket call goes through that same local origin — which is why the
 * packaged app needs no CORS change on the server.
 */

const { app, BrowserWindow, Menu, session, shell, dialog, nativeImage } = require("electron");
const path = require("node:path");
const { createServer } = require("./proxy.cjs");

const PORT = Number(process.env.XELVIC_DESKTOP_PORT || 47831);
const API_TARGET = process.env.XELVIC_API_TARGET || "https://api.xelvic.com";
const WS_TARGET = process.env.XELVIC_WS_TARGET || "wss://api.xelvic.com";
const CDN_TARGET = process.env.XELVIC_CDN_TARGET || "https://cdn.xelvic.com";
const APP_ORIGIN = `http://127.0.0.1:${PORT}`;

const ALLOWED_PERMISSIONS = new Set([
  "media",
  "geolocation",
  "notifications",
  "clipboard-sanitized-write",
  "fullscreen",
  "pointerLock",
]);

let mainWindow = null;
let proxyServer = null;

function distDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "dist")
    : path.resolve(__dirname, "..", "..", "dist");
}

function buildMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "close" }],
    },
  ];

  return Menu.buildFromTemplate(template);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    show: false,
    backgroundColor: "#F7F7FB",
    title: "Xelvic",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      // A chat client keeps its timers and audio alive when it is in the
      // background; the browser throttle would delay messages and playback.
      backgroundThrottling: false,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
    if (!app.isPackaged) {
      window.webContents.openDevTools({ mode: "detach" });
    }
  });

  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(APP_ORIGIN)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) {
      shell.openExternal(url);
    }
  });

  window.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  window.loadURL(APP_ORIGIN);
  mainWindow = window;
  return window;
}

function installPermissionHandlers() {
  const isAllowed = (_webContents, permission) => ALLOWED_PERMISSIONS.has(permission);

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(isAllowed(webContents, permission));
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) =>
    isAllowed(webContents, permission),
  );
}

async function startProxy() {
  proxyServer = await createServer({
    distDir: distDir(),
    apiTarget: API_TARGET,
    wsTarget: WS_TARGET,
    cdnTarget: CDN_TARGET,
    port: PORT,
  });
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    app.setName("Xelvic");
    if (process.platform === "win32") {
      // Windows groups the taskbar entry and its notifications under this id.
      app.setAppUserModelId("com.xelvic.desktop");
    }
    app.setAboutPanelOptions({
      applicationName: "Xelvic",
      applicationVersion: app.getVersion(),
      copyright: "Copyright © 2026 Xelvic",
      credits: "Xelvic on your computer.",
    });

    if (!app.isPackaged && app.dock) {
      const icon = nativeImage.createFromPath(path.join(__dirname, "..", "build", "icon.icns"));
      if (!icon.isEmpty()) app.dock.setIcon(icon);
    }

    try {
      await startProxy();
    } catch (error) {
      dialog.showErrorBox(
        "Xelvic could not start",
        `The local app server could not listen on port ${PORT}.\n\n${error.message}`,
      );
      app.quit();
      return;
    }

    installPermissionHandlers();
    Menu.setApplicationMenu(buildMenu());
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("will-quit", () => {
    if (proxyServer) {
      proxyServer.close();
      proxyServer = null;
    }
  });
}
