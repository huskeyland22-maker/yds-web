import { TRADING_STAGE_META } from "../../trading-zone/tacticalTradingZoneData.js"

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

  const top = bridge.priorities[0] ?? null

  return (
    <section className="tactical-zone-stock-bridge" aria-label="우선순위 종목 TOP5">
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
              >
                <span className="tactical-zone-stock-bridge__pick-main">
                  <span className="tactical-zone-stock-bridge__pick-rank">{index + 1}.</span>
                  <span className="tactical-zone-stock-bridge__pick-symbol">{item.symbol}</span>
                  <span className="tactical-zone-stock-bridge__pick-score">{item.score}</span>
                </span>
                <span className="tactical-zone-stock-bridge__pick-stage" data-stage={item.stage}>
                  <span aria-hidden>{stageMeta?.emoji ?? "⚪"}</span> {item.stageLabel}
                  {item.regimeBoost ? (
                    <span className="tactical-zone-stock-bridge__boost-badge">연계</span>
                  ) : null}
                </span>
                <span className="tactical-zone-stock-bridge__confidence">
                  <span className="tactical-zone-stock-bridge__confidence-label">
                    신뢰도 {item.confidence}
                  </span>
                  <span
                    className="tactical-zone-stock-bridge__confidence-bar"
                    role="meter"
                    aria-valuenow={item.confidence}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`신뢰도 ${item.confidence} ${item.confidenceLevel}`}
                  >
                    <span
                      className="tactical-zone-stock-bridge__confidence-fill"
                      style={{ width: `${item.confidence}%` }}
                    />
                  </span>
                  <span className="tactical-zone-stock-bridge__confidence-level">{item.confidenceLevel}</span>
                </span>
                {item.stagePath && item.stagePath !== "—" ? (
                  <span className="tactical-zone-stock-bridge__path" title={item.stagePath}>
                    {item.stagePath}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>

      {top ? (
        <div className="tactical-zone-stock-bridge__entry">
          <p className="m-0 tactical-zone-stock-bridge__entry-k">진입 후보</p>
          <p className="m-0 tactical-zone-stock-bridge__entry-symbol">
            {top.symbol}
            <span className="tactical-zone-stock-bridge__entry-score">{top.score}</span>
          </p>
          {top.reasons.length ? (
            <ul className="m-0 tactical-zone-stock-bridge__entry-reasons">
              {top.reasons.slice(0, 3).map((r) => (
                <li key={r}>✓ {r}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
