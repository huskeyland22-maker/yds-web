/**
 * 화면 배지: DEV | RC | PROD
 * - DEV: Vite 개발 서버
 * - RC: VITE_APP_RELEASE_CHANNEL=rc (배포 후보 검증)
 * - PROD: 프로덕션 빌드 기본값
 */

/** @typedef {"DEV" | "RC" | "PROD"} AppReleaseChannelLabel */

/** @returns {AppReleaseChannelLabel} */
export function resolveAppReleaseChannel() {
  const raw = String(import.meta.env.VITE_APP_RELEASE_CHANNEL ?? "")
    .trim()
    .toLowerCase()
  if (import.meta.env.DEV) return "DEV"
  if (raw === "rc" || raw === "release-candidate") return "RC"
  return "PROD"
}

/** @param {AppReleaseChannelLabel} channel */
export function releaseChannelTone(channel) {
  if (channel === "DEV") return "dev"
  if (channel === "RC") return "rc"
  return "prod"
}
