import { useCallback, useEffect, useState } from "react"
import { useStockPickFavorites } from "./useStockPickFavorites.js"
import {
  countUnreadPickAlerts,
  loadPickAlertFeed,
  markAllPickAlertsRead,
} from "../content/ydsStockPickAlertStorage.js"
import {
  notifyPickAlertBrowser,
  requestPickAlertPermission,
  scanStockPickAlerts,
} from "../content/ydsStockPickAlertEngine.js"
import { toast } from "../utils/toast.js"

/**
 * @param {import("../content/ydsStockPickModel.js").StockPickView[]} liveStocks
 */
export function useStockPickAlerts(liveStocks) {
  const { favorites } = useStockPickFavorites()
  const [unread, setUnread] = useState(() => countUnreadPickAlerts())
  const [feed, setFeed] = useState(() => loadPickAlertFeed())

  const refresh = useCallback(() => {
    setUnread(countUnreadPickAlerts())
    setFeed(loadPickAlertFeed())
  }, [])

  useEffect(() => {
    if (!liveStocks.length || !favorites.size) return
    const created = scanStockPickAlerts(liveStocks, favorites)
    if (created.length) {
      for (const alert of created.slice(0, 3)) {
        toast.success(`${alert.name}: ${alert.message}`)
        notifyPickAlertBrowser(alert)
      }
      refresh()
    }
  }, [liveStocks, favorites, refresh])

  const markRead = useCallback(() => {
    markAllPickAlertsRead()
    refresh()
  }, [refresh])

  const enableBrowser = useCallback(async () => {
    const result = await requestPickAlertPermission()
    if (result === "granted") toast.success("브라우저 알림이 활성화되었습니다.")
    else if (result === "denied") toast.error("브라우저 알림이 차단되었습니다.")
    return result
  }, [])

  return { unread, feed, refresh, markRead, enableBrowser, favorites }
}
