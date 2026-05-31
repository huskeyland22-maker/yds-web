import { TRADING_STAGE_META } from "../../trading-zone/tacticalTradingZoneData.js"
import TacticalConfidenceGrade from "./TacticalConfidenceGrade.jsx"

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
    <section className="tactical-zone-stock-bridge tactical-zone-stock-bridge--compact" aria-label="우선순위 종목 TOP5">
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

      <ol className="tactical-zone-stock-bridge__rank">
        {bridge.priorities.map((item, index) => {
          const selected = selectedId === item.id
          const stageMeta = TRADING_STAGE_META[item.stage]
          const displayReasons = (item.reasons ?? []).filter((r) => !r.startsWith("⚠")).slice(0, 2)
          const coreReasons = displayReasons.length ? displayReasons : ["평가 대기"]

          return (
            <li key={item.id} className="tactical-zone-stock-bridge__rank-item">
              <button
                type="button"
                className={[
                  "tactical-zone-stock-bridge__pick",
                  selected ? "tactical-zone-stock-bridge__pick--selected" : "",
                  item.regimeBoost ? "tactical-zone-stock-bridge__pick--boost" : "",
                ].join(" ")}
                onClick={() => onSelect?.(item.id)}
                aria-pressed={selected}
              >
                <div className="tactical-zone-stock-bridge__pick-top">
                  <div className="tactical-zone-stock-bridge__pick-head">
                    <span className="tactical-zone-stock-bridge__pick-rank">{index + 1}</span>
                    <span className="tactical-zone-stock-bridge__pick-symbol">{item.symbol}</span>
                    <TacticalConfidenceGrade
                      score={item.confidence}
                      compact
                      className="tactical-zone-stock-bridge__pick-grade"
                    />
                  </div>
                  <ul className="m-0 tactical-zone-stock-bridge__reasons-stack">
                    {coreReasons.map((reason) => (
                      <li key={reason} className="tactical-zone-stock-bridge__reason-line">
                        ✓ {reason}
                      </li>
                    ))}
                  </ul>
                  <span className="tactical-zone-stock-bridge__pick-stage-mini" data-stage={item.stage}>
                    <span aria-hidden>{stageMeta?.emoji ?? "⚪"}</span> {item.stageLabel}
                  </span>
                </div>

                <span
                  className="tactical-zone-stock-bridge__confidence-bar"
                  role="meter"
                  aria-valuenow={item.confidence}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`신뢰도 ${item.confidence}`}
                >
                  <span
                    className="tactical-zone-stock-bridge__confidence-fill"
                    style={{ width: `${item.confidence}%` }}
                  />
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
