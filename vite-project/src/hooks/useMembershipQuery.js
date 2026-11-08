import { useCallback, useEffect, useState } from "react"
import { useFirebaseAuthUser } from "./useFirebaseAuthUser.js"
import {
  MEMBERSHIP_STATUS,
  membershipStatusFromApiBody,
} from "../content/ydsMembership.js"

/**
 * Fetch GET /api/me-membership for the signed-in Firebase user.
 * Does not accept client-supplied uid/plan.
 * Never exposes tokens in returned state.
 *
 * @returns {{
 *   status: import("../content/ydsMembership.js").MembershipStatus
 *   authReady: boolean
 *   plan: "free" | "pro" | null
 *   ledgerStatus: string | null
 *   source: string | null
 *   reason: string | null
 *   refreshedAt: number | null
 *   refresh: () => void
 * }}
 */
export function useMembershipQuery() {
  const { user, authReady } = useFirebaseAuthUser()
  const [status, setStatus] = useState(
    /** @type {import("../content/ydsMembership.js").MembershipStatus} */ (
      MEMBERSHIP_STATUS.LOADING
    ),
  )
  const [plan, setPlan] = useState(/** @type {"free" | "pro" | null} */ (null))
  const [ledgerStatus, setLedgerStatus] = useState(/** @type {string | null} */ (null))
  const [source, setSource] = useState(/** @type {string | null} */ (null))
  const [reason, setReason] = useState(/** @type {string | null} */ (null))
  const [refreshedAt, setRefreshedAt] = useState(/** @type {number | null} */ (null))
  const [refreshNonce, setRefreshNonce] = useState(0)

  const refresh = useCallback(() => {
    setRefreshNonce((n) => n + 1)
  }, [])

  const clearLedgerFields = () => {
    setPlan(null)
    setLedgerStatus(null)
    setSource(null)
    setReason(null)
  }

  useEffect(() => {
    if (!authReady) {
      setStatus(MEMBERSHIP_STATUS.LOADING)
      clearLedgerFields()
      return
    }

    if (!user) {
      setStatus(MEMBERSHIP_STATUS.LOGGED_OUT)
      clearLedgerFields()
      setRefreshedAt(null)
      return
    }

    let cancelled = false
    setStatus(MEMBERSHIP_STATUS.LOADING)
    setReason(null)

    ;(async () => {
      try {
        const token = await user.getIdToken()
        if (cancelled) return
        const res = await fetch("/api/me-membership", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        })
        if (cancelled) return
        if (!res.ok) {
          setStatus(MEMBERSHIP_STATUS.ERROR)
          setPlan(null)
          setLedgerStatus(null)
          setSource(null)
          setReason(`http_${res.status}`)
          setRefreshedAt(Date.now())
          return
        }
        const body = await res.json().catch(() => null)
        if (cancelled) return
        const next = membershipStatusFromApiBody(body)
        setStatus(next)
        setPlan(next === MEMBERSHIP_STATUS.PRO ? "pro" : "free")
        setLedgerStatus(typeof body?.status === "string" ? body.status : null)
        setSource(typeof body?.source === "string" ? body.source : null)
        setReason(typeof body?.reason === "string" ? body.reason : null)
        setRefreshedAt(Date.now())
      } catch {
        if (cancelled) return
        setStatus(MEMBERSHIP_STATUS.ERROR)
        setPlan(null)
        setLedgerStatus(null)
        setSource(null)
        setReason("fetch_failed")
        setRefreshedAt(Date.now())
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authReady, user, refreshNonce])

  return {
    status,
    authReady,
    plan,
    ledgerStatus,
    source,
    reason,
    refreshedAt,
    refresh,
  }
}
