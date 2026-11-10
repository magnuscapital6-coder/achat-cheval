/// <reference types="@cloudflare/vitest-plugin/types" />

// Les bindings tels que les voient les tests : les mêmes que `Env` dans
// `src/worker/index.ts`, avec les valeurs de `vitest.config.ts`.
declare namespace Cloudflare {
  interface Env {
    DB: D1Database
    FILES: R2Bucket
    APP_ORIGIN: string
    ADMIN_CREDENTIALS: string
    RESEND_API_KEY?: string
  }
}
