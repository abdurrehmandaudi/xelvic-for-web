"use strict";

/**
 * The one thing the page is allowed to know about its shell.
 *
 * `session.ts` keeps sign-in tokens in the browser's sessionStorage so closing
 * a tab signs out. An installed app is expected to stay signed in, like the
 * phone and like every other desktop chat client, so the page switches to
 * localStorage when this marker is present — and only then.
 */

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("xelvicDesktop", {
  platform: process.platform,
  version: process.versions.electron,
});
