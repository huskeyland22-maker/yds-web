import { TRADING_STAGE_META, tradingStageBadge } from "../../trading-zone/tacticalTradingZoneData.js"
import StockPickReasonList from "./StockPickReasonList.jsx"

/**
 * @param {{
 *   bridge: import("../../trading-zone/tradingZoneMarketStockBridge.js").MarketStockBridgeModel
 *   selectedId?: string | null
 *   onSelect?: (id: string) => void
 *   loading?: boolean
 * }} props
 */
export default function TacticalMarketStockBridge({
  bridge,
  selectedId = null,
  onSelect,
  loading = false,
}) {
  if (!bridge?.ready) {
    return (
      <section className="tactical-zone-stock-bridge tactical-zone-stock-bridge--pending" aria-label="우선순위 종목">
        <p className="m-0 tactical-zone-stock-bridge__pending">종목 연계 준비 중</p>
      </section>
    )
  }

  return (
    <section
      className="tactical-zone-stock-bridge tactical-zone-stock-bridge--list"
      aria-label="우선순위 종목 TOP5"
    >
      <div className="tactical-zone-stock-bridge__head">
        <p className="m-0 tactical-zone-stock-bridge__title">우선순위 종목 TOP5</p>
        {bridge.regimeLabel ? (
          <span className="tactical-zone-stock-bridge__regime-tag">{bridge.regimeLabel}</span>
        ) : null}
      </div>

      {loading ? (
        <p className="m-0 tactical-zone-stock-bridge__sync" role="status">
          종목 실데이터 동기화 중…
        </p>
      ) : null}

      <ol className="tactical-zone-stock-bridge__list">
        {bridge.priorities.map((item, index) => {
          const selected = selectedId === item.id
          const badge = tradingStageBadge({ stage: item.stage })
          const stageMeta = TRADING_STAGE_META[item.stage]
          const reasons = item.reasons ?? []

          return (
            <li key={item.id} className="tactical-zone-stock-bridge__list-item">
              <button
                type="button"
                className={[
                  "tactical-zone-stock-bridge__row",
                  selected ? "tactical-zone-stock-bridge__row--selected" : "",
                  item.regimeBoost ? "tactical-zone-stock-bridge__row--boost" : "",
                ].join(" ")}
                onClick={() => onSelect?.(item.id)}
                aria-pressed={selected}
                aria-label={`${item.symbol} 신뢰도 ${item.confidence} ${item.stageLabel ?? badge.label}`}
              >
                <span className="tactical-zone-stock-bridge__row-main">
                  <span className="tactical-zone-stock-bridge__row-rank" aria-hidden>
                    {index + 1}
                  </span>
                  <span className="tactical-zone-stock-bridge__row-symbol">{item.symbol}</span>
                  <span className="tactical-zone-stock-bridge__row-score font-mono tabular-nums">
                    {item.confidence}
                  </span>
                  <span
                    className="tactical-zone-chip__badge tactical-zone-stock-bridge__row-badge"
                    data-stage={item.stage}
                    title={item.stageLabel ?? stageMeta?.label}
                  >
                    <span className="tactical-zone-chip__badge-dot" aria-hidden>
                      ●
                    </span>
                    <span className="tactical-zone-chip__badge-label">{badge.label}</span>
                  </span>
                </span>
                {reasons.length ? (
                  <StockPickReasonList
                    reasons={reasons}
                    max={3}
                    className="tactical-zone-stock-bridge__row-reasons"
                  />
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
