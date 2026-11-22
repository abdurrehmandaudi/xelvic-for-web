/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_WEB_URL?: string;
  readonly VITE_ENABLE_DEV_LOGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Exposed by the desktop shell's preload (see `desktop/electron/preload.cjs`). */
interface Window {
  readonly xelvicDesktop?: {
    readonly platform: string;
    readonly version: string;
  };
}
