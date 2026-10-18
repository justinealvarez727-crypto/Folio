/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_TELEMETRY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
