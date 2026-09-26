import { useEffect } from "react"
import { useFirebaseAuthUser } from "./useFirebaseAuthUser.js"
import {
  beginTradeRecordsCloudReconcile,
  endTradeRecordsCloudReconcile,
  reconcileTradeRecordsWithCloud,
  setTradeRecordsCloudAuth,
} from "../content/ydsTradeRecordsCloudSync.js"

/**
 * Login → GET/reconcile trade records. Logout → device-local only.
 * Mount once near app root (no UI).
 */
export function useTradeRecordsCloudSync() {
  const { user, authReady } = useFirebaseAuthUser()

  useEffect(() => {
    if (!authReady) return

    if (!user?.uid) {
      setTradeRecordsCloudAuth(null)
      endTradeRecordsCloudReconcile()
      return
    }

    let cancelled = false
    beginTradeRecordsCloudReconcile()
    setTradeRecordsCloudAuth({
      getIdToken: () => user.getIdToken(),
    })

    async function run() {
      try {
        const token = await user.getIdToken()
        if (cancelled) return
        await reconcileTradeRecordsWithCloud(token)
      } catch (e) {
        console.warn("[trade-records-sync] reconcile failed — local kept", e)
      } finally {
        if (!cancelled) endTradeRecordsCloudReconcile()
      }
    }

    void run()
    return () => {
      cancelled = true
      setTradeRecordsCloudAuth(null)
      beginTradeRecordsCloudReconcile()
    }
  }, [authReady, user?.uid])
}

/** Null-render bootstrap for App root. */
export default function TradeRecordsCloudSyncBootstrap() {
  useTradeRecordsCloudSync()
  return null
}
