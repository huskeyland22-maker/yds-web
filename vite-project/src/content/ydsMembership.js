/**
 * Membership UI status derived from GET /api/me-membership.
 * Server ledger is the source of truth — clients never invent plan/uid.
 */

/** @typedef {"logged_out" | "loading" | "free" | "pro" | "error"} MembershipStatus */

export const MEMBERSHIP_STATUS = Object.freeze({
  LOGGED_OUT: "logged_out",
  LOADING: "loading",
  FREE: "free",
  PRO: "pro",
  ERROR: "error",
})

/**
 * PRO UI/features unlock only when the server returned plan === "pro".
 * loading / free / error / logged_out stay locked (fail closed).
 * @param {MembershipStatus | string | null | undefined} status
 * @returns {boolean}
 */
export function isProUnlocked(status) {
  return status === MEMBERSHIP_STATUS.PRO
}

/**
 * Header plan badge label from server membership status.
 * Strict resolved plans only (no loading / logged out / error).
 * @param {MembershipStatus | string | null | undefined} status
 * @returns {"PRO" | "FREE" | null}
 */
export function membershipPlanBadgeLabel(status) {
  if (status === MEMBERSHIP_STATUS.PRO) return "PRO"
  if (status === MEMBERSHIP_STATUS.FREE) return "FREE"
  return null
}

/**
 * Mobile/desktop header badge presentation.
 * - logged out → hidden
 * - loading → pending placeholder (keeps layout stable)
 * - error while signed-in → FREE chip (fail-closed display only; does not unlock PRO APIs)
 * - free / pro → matching chip
 * @param {MembershipStatus | string | null | undefined} status
 * @returns {{ kind: "hidden" | "pending" | "pro" | "free", label: string | null }}
 */
export function membershipHeaderBadgeState(status) {
  if (status == null || status === MEMBERSHIP_STATUS.LOGGED_OUT) {
    return { kind: "hidden", label: null }
  }
  if (status === MEMBERSHIP_STATUS.LOADING) {
    return { kind: "pending", label: "···" }
  }
  if (status === MEMBERSHIP_STATUS.PRO) {
    return { kind: "pro", label: "PRO" }
  }
  // FREE + lookup error: show FREE for header continuity (APIs stay fail-closed).
  if (status === MEMBERSHIP_STATUS.FREE || status === MEMBERSHIP_STATUS.ERROR) {
    return { kind: "free", label: "FREE" }
  }
  return { kind: "hidden", label: null }
}

/**
 * Map API JSON to UI status. Never trust client-supplied plan.
 * @param {{ plan?: unknown } | null | undefined} body
 * @returns {"free" | "pro"}
 */
export function membershipStatusFromApiBody(body) {
  const plan = typeof body?.plan === "string" ? body.plan.trim().toLowerCase() : ""
  return plan === "pro" ? MEMBERSHIP_STATUS.PRO : MEMBERSHIP_STATUS.FREE
}

const PRODUCTION_APP_HOST = "yds-web-kappa.vercel.app"

/**
 * Preview / local verification chrome only — never on Production host.
 * @param {string} [hostname]
 * @param {{ dev?: boolean }} [opts]
 * @returns {boolean}
 */
export function isMembershipVerifyUiEnabled(hostname, opts = {}) {
  const dev = opts.dev ?? Boolean(import.meta.env?.DEV)
  if (dev) return true
  const host = typeof hostname === "string" ? hostname.trim().toLowerCase() : ""
  if (!host) return false
  if (host === PRODUCTION_APP_HOST) return false
  if (host === "localhost" || host === "127.0.0.1") return true
  return host.endsWith(".vercel.app")
}

/**
 * Safe display model for membership verify panel (no tokens / PII).
 * @param {{
 *   isLoggedOut?: boolean
 *   isLoading?: boolean
 *   isError?: boolean
 *   plan?: "free" | "pro" | null
 *   ledgerStatus?: string | null
 *   source?: string | null
 *   reason?: string | null
 * }} input
 */
export function membershipVerifyDisplayModel(input) {
  if (input?.isLoggedOut) {
    return {
      phase: "logged_out",
      planLabel: "—",
      statusLabel: "—",
      sourceLabel: "—",
      reasonLabel: "—",
      showRefresh: false,
    }
  }
  if (input?.isLoading) {
    return {
      phase: "loading",
      planLabel: "…",
      statusLabel: "…",
      sourceLabel: "…",
      reasonLabel: "…",
      showRefresh: true,
    }
  }
  if (input?.isError) {
    return {
      phase: "error",
      planLabel: "—",
      statusLabel: "—",
      sourceLabel: "—",
      reasonLabel: typeof input.reason === "string" && input.reason ? input.reason : "error",
      showRefresh: true,
    }
  }
  const planLabel =
    input?.plan === "pro" ? "PRO" : input?.plan === "free" ? "FREE" : "—"
  return {
    phase: "ready",
    planLabel,
    statusLabel: typeof input?.ledgerStatus === "string" && input.ledgerStatus ? input.ledgerStatus : "—",
    sourceLabel: typeof input?.source === "string" && input.source ? input.source : "—",
    reasonLabel: typeof input?.reason === "string" && input.reason ? input.reason : "—",
    showRefresh: true,
  }
}
