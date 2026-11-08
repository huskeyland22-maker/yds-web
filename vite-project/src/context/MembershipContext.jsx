import { createContext, useContext, useMemo } from "react"
import { isProUnlocked, MEMBERSHIP_STATUS } from "../content/ydsMembership.js"
import { useMembershipQuery } from "../hooks/useMembershipQuery.js"

const MembershipContext = createContext(null)

/**
 * Provides membership status from the server ledger (via /api/me-membership).
 */
export function MembershipProvider({ children }) {
  const {
    status,
    authReady,
    plan,
    ledgerStatus,
    source,
    reason,
    refreshedAt,
    refresh,
  } = useMembershipQuery()

  const value = useMemo(() => {
    const isPro = isProUnlocked(status)
    return {
      status,
      authReady,
      plan,
      ledgerStatus,
      source,
      reason,
      refreshedAt,
      refresh,
      isPro,
      /** True while auth is not ready or membership fetch is in flight */
      isLoading: !authReady || status === MEMBERSHIP_STATUS.LOADING,
      isLoggedOut: status === MEMBERSHIP_STATUS.LOGGED_OUT,
      isError: status === MEMBERSHIP_STATUS.ERROR,
      isFree:
        status === MEMBERSHIP_STATUS.FREE ||
        status === MEMBERSHIP_STATUS.LOGGED_OUT ||
        status === MEMBERSHIP_STATUS.LOADING ||
        status === MEMBERSHIP_STATUS.ERROR,
    }
  }, [status, authReady, plan, ledgerStatus, source, reason, refreshedAt, refresh])

  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>
}

/**
 * @returns {{
 *   status: import("../content/ydsMembership.js").MembershipStatus
 *   authReady: boolean
 *   plan: "free" | "pro" | null
 *   ledgerStatus: string | null
 *   source: string | null
 *   reason: string | null
 *   refreshedAt: number | null
 *   refresh: () => void
 *   isPro: boolean
 *   isLoading: boolean
 *   isLoggedOut: boolean
 *   isError: boolean
 *   isFree: boolean
 * }}
 */
export function useMembership() {
  const ctx = useContext(MembershipContext)
  if (!ctx) {
    // Fail closed when provider is missing (should not happen in App tree).
    return {
      status: MEMBERSHIP_STATUS.ERROR,
      authReady: true,
      plan: null,
      ledgerStatus: null,
      source: null,
      reason: "provider_missing",
      refreshedAt: null,
      refresh: () => {},
      isPro: false,
      isLoading: false,
      isLoggedOut: false,
      isError: true,
      isFree: true,
    }
  }
  return ctx
}
