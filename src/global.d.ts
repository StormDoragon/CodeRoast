/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
  readonly VITE_SPONSOR_URL?: string;
  readonly VITE_PRO_WAITLIST_URL?: string;
}

// Minimal WebGPU surface used by the capability check.
interface Navigator {
  gpu?: { requestAdapter(options?: unknown): Promise<unknown | null> };
}
