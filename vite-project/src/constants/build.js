/** Vite 빌드 시 주입 — `generate-build-meta.mjs` 의 gitCommit-timestamp */
export const BUILD_ID = String(import.meta.env.VITE_APP_BUILD_ID ?? "dev")
export const VERSION_LABEL = String(import.meta.env.VITE_APP_VERSION_LABEL ?? "").trim() || "dev"
