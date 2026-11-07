import { useEffect, useState } from "react"
import { useFirebaseAuthUser } from "./useFirebaseAuthUser.js"
import {
  MEMBERSHIP_STATUS,
  membershipStatusFromApiBody,
} from "../content/ydsMembership.js"

/**
 * Fetch GET /api/me-membership for the signed-in Firebase user.
 * Does not accept client-supplied uid/plan.
 *
 * @returns {{
 *   status: import("../content/ydsMembership.js").MembershipStatus
 *   authReady: boolean
 *   reason: string | null
 *   refreshedAt: number | null
 * }}
 */
export function useMembershipQuery() {
  const { user, authReady } = useFirebaseAuthUser()
  const [status, setStatus] = useState(
    /** @type {import("../content/ydsMembership.js").MembershipStatus} */ (
      MEMBERSHIP_STATUS.LOADING
    ),
  )
  const [reason, setReason] = useState(/** @type {string | null} */ (null))
  const [refreshedAt, setRefreshedAt] = useState(/** @type {number | null} */ (null))

  useEffect(() => {
    if (!authReady) {
      setStatus(MEMBERSHIP_STATUS.LOADING)
      setReason(null)
      return
    }

    if (!user) {
      setStatus(MEMBERSHIP_STATUS.LOGGED_OUT)
      setReason(null)
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
          setReason(`http_${res.status}`)
          setRefreshedAt(Date.now())
          return
        }
        const body = await res.json().catch(() => null)
        if (cancelled) return
        const next = membershipStatusFromApiBody(body)
        setStatus(next)
        setReason(typeof body?.reason === "string" ? body.reason : null)
        setRefreshedAt(Date.now())
      } catch {
        if (cancelled) return
        setStatus(MEMBERSHIP_STATUS.ERROR)
        setReason("fetch_failed")
        setRefreshedAt(Date.now())
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authReady, user])

  return { status, authReady, reason, refreshedAt }
}
