/**
 * Phase A — 포트폴리오 localStorage 소유권 스코프
 *
 * - 공용 키(yds-portfolio-trades-v1 등)는 소유자 불명 orphan으로 보존만 한다.
 * - 활성 읽기/쓰기는 guest 또는 uid 슬롯만 사용한다.
 * - 공용 → 계정 자동 마이그레이션/업로드는 하지 않는다.
 */

export const PORTFOLIO_TRADES_SHARED_KEY = "yds-portfolio-trades-v1"
export const PORTFOLIO_CASH_SHARED_KEY = "yds-portfolio-cash-balance-v1"
export const PORTFOLIO_OWNER_META_KEY = "yds-portfolio-owner-v1"
export const PORTFOLIO_SYNC_META_SHARED_KEY = "yds-portfolio-sync-meta-v1"

/** @type {string | null} null = guest (logged out) */
let activeOwnerUid = /** @type {string | null} */ (null)

/** @returns {string | null} */
export function getActivePortfolioOwnerUid() {
  return activeOwnerUid
}

/**
 * @param {string | null | undefined} uid
 */
export function setActivePortfolioOwnerUid(uid) {
  activeOwnerUid = uid == null || String(uid).trim() === "" ? null : String(uid).trim()
}

/**
 * @param {string | null | undefined} ownerUid
 * @returns {string}
 */
export function portfolioTradesKeyForOwner(ownerUid) {
  const uid = ownerUid == null || String(ownerUid).trim() === "" ? null : String(ownerUid).trim()
  if (!uid) return `${PORTFOLIO_TRADES_SHARED_KEY}:guest`
  return `${PORTFOLIO_TRADES_SHARED_KEY}:uid:${uid}`
}

/**
 * @param {string | null | undefined} ownerUid
 * @returns {string}
 */
export function portfolioCashKeyForOwner(ownerUid) {
  const uid = ownerUid == null || String(ownerUid).trim() === "" ? null : String(ownerUid).trim()
  if (!uid) return `${PORTFOLIO_CASH_SHARED_KEY}:guest`
  return `${PORTFOLIO_CASH_SHARED_KEY}:uid:${uid}`
}

/**
 * @param {string | null | undefined} ownerUid
 * @returns {string}
 */
export function portfolioSyncMetaKeyForOwner(ownerUid) {
  const uid = ownerUid == null || String(ownerUid).trim() === "" ? null : String(ownerUid).trim()
  if (!uid) return `${PORTFOLIO_SYNC_META_SHARED_KEY}:guest`
  return `${PORTFOLIO_SYNC_META_SHARED_KEY}:uid:${uid}`
}

/**
 * @typedef {{
 *   uid: string | null
 *   kind: "guest" | "account"
 *   updatedAtMs: number
 * }} PortfolioOwnerMeta
 */

/** @returns {PortfolioOwnerMeta | null} */
export function readPortfolioOwnerMeta() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_OWNER_META_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    const uid =
      parsed.uid == null || String(parsed.uid).trim() === "" ? null : String(parsed.uid).trim()
    const kind = uid ? "account" : "guest"
    const updatedAtMs = Number(parsed.updatedAtMs) || 0
    return { uid, kind, updatedAtMs }
  } catch {
    return null
  }
}

/**
 * @param {string | null | undefined} ownerUid
 */
export function writePortfolioOwnerMeta(ownerUid) {
  const uid = ownerUid == null || String(ownerUid).trim() === "" ? null : String(ownerUid).trim()
  try {
    /** @type {PortfolioOwnerMeta} */
    const meta = {
      uid,
      kind: uid ? "account" : "guest",
      updatedAtMs: Date.now(),
    }
    localStorage.setItem(PORTFOLIO_OWNER_META_KEY, JSON.stringify(meta))
  } catch {
    /* ignore */
  }
}

/**
 * Cloud PUT is allowed only when the active owner meta matches the logged-in uid.
 * Missing / guest / mismatched meta → block (never guess shared-key ownership).
 *
 * @param {string | null | undefined} ownerUid
 */
export function canPushPortfolioToCloud(ownerUid) {
  if (ownerUid == null || String(ownerUid).trim() === "") return false
  const uid = String(ownerUid).trim()
  const meta = readPortfolioOwnerMeta()
  if (!meta || meta.kind !== "account" || !meta.uid) return false
  return meta.uid === uid
}

/**
 * Peek orphan shared trades key without migrating or writing.
 * @returns {string | null}
 */
export function peekSharedPortfolioTradesRaw() {
  try {
    return localStorage.getItem(PORTFOLIO_TRADES_SHARED_KEY)
  } catch {
    return null
  }
}

/**
 * @returns {string | null}
 */
export function peekSharedPortfolioCashRaw() {
  try {
    return localStorage.getItem(PORTFOLIO_CASH_SHARED_KEY)
  } catch {
    return null
  }
}
