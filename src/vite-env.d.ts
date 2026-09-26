/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** live (default) or snapshot */
  readonly VITE_DATA_SOURCE?: 'live' | 'snapshot';
  /** "1" adds the concept banner to the hosted preview build only */
  readonly VITE_DEMO_NOTE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
