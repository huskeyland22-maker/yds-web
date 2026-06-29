import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
import { useStockPickLiveData } from "../../hooks/useStockPickLiveData.js"
import { useStockPickAlerts } from "../../hooks/useStockPickAlerts.js"
import YdsStockPickAlertPopover from "./YdsStockPickAlertPopover.jsx"

/** 종목추천 페이지 헤더 우측 AI 알림 */
export default function YdsStockPickPageAlertButton({ className = "" }) {
  const marketContext = useYdsMarketContext()
  const { stocks } = useStockPickLiveData(marketContext)
  const pickAlerts = useStockPickAlerts(stocks)

  return (
    <YdsStockPickAlertPopover
      feed={pickAlerts.feed}
      unread={pickAlerts.unread}
      onMarkRead={pickAlerts.markRead}
      onEnableBrowser={pickAlerts.enableBrowser}
      className={className}
    />
  )
}
