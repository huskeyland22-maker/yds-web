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

  return (
    <section className="tactical-zone-stock-bridge" aria-label="우선순위 종목 TOP5">
      <div className="tactical-zone-stock-bridge__head">
        <p className="m-0 tactical-zone-stock-bridge__title">우선순위 종목 TOP5</p>
        {bridge.regimeLabel ? (
          <span className="tactical-zone-stock-bridge__regime-tag">{bridge.regimeLabel}</span>
        ) : null}
      </div>
      {bridge.focusLabel ? (
        <p className="m-0 tactical-zone-stock-bridge__focus-hint">{bridge.focusLabel}</p>
      ) : null}

      {loading ? (
        <p className="m-0 tactical-zone-stock-bridge__sync" role="status">
          종목 실데이터 동기화 중…
        </p>
      ) : null}

      <ol className="tactical-zone-stock-bridge__rank">
        {bridge.priorities.map((item, index) => {
          const selected = selectedId === item.id
          const stageMeta = TRADING_STAGE_META[item.stage]
          const ladder =
            item.stageLadder?.length > 0
              ? item.stageLadder
              : [STAGE_LADDER_FALLBACK[item.stage] ?? stageMeta?.label ?? item.stage]
          const reasons = item.reasons?.length ? item.reasons : ["실데이터 평가 대기"]

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
                <div className="tactical-zone-stock-bridge__pick-head">
                  <span className="tactical-zone-stock-bridge__pick-rank">{index + 1}</span>
                  <span className="tactical-zone-stock-bridge__pick-symbol">{item.symbol}</span>
                  <span
                    className="tactical-zone-stock-bridge__pick-trust font-mono tabular-nums"
                    title={`종목 신뢰도 ${item.confidence}`}
                  >
                    {item.confidence}
                  </span>
                  {item.regimeBoost ? (
                    <span className="tactical-zone-stock-bridge__boost-badge">연계</span>
                  ) : null}
                </div>

                <div className="tactical-zone-stock-bridge__trust-row">
                  <span className="tactical-zone-stock-bridge__trust-k">신뢰도</span>
                  <span
                    className="tactical-zone-stock-bridge__trust-blocks font-mono"
                    aria-hidden
                    title={`${item.confidence}%`}
                  >
                    {item.confidenceBar}
                  </span>
                  <span className="tactical-zone-stock-bridge__trust-level">{item.confidenceLevel}</span>
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

                <ul className="m-0 tactical-zone-stock-bridge__reasons">
                  {reasons.map((reason) => {
                    const warn = reason.startsWith("⚠")
                    return (
                      <li
                        key={reason}
                        className={[
                          "tactical-zone-stock-bridge__reason",
                          warn ? "tactical-zone-stock-bridge__reason--warn" : "",
                        ].join(" ")}
                      >
                        {warn ? reason : `✓ ${reason}`}
                      </li>
                    )
                  })}
                </ul>

                {ladder.length > 0 ? (
                  <div className="tactical-zone-stock-bridge__ladder" aria-label="최근 이동 경로">
                    <span className="tactical-zone-stock-bridge__ladder-k">이동 경로</span>
                    <div className="tactical-zone-stock-bridge__ladder-steps">
                      {ladder.map((step, stepIdx) => (
                        <span key={`${step}-${stepIdx}`} className="tactical-zone-stock-bridge__ladder-step-wrap">
                          {stepIdx > 0 ? (
                            <span className="tactical-zone-stock-bridge__ladder-arrow" aria-hidden>
                              ↓
                            </span>
                          ) : null}
                          <span
                            className="tactical-zone-stock-bridge__ladder-step"
                            data-active={stepIdx === ladder.length - 1 ? "true" : undefined}
                          >
                            {step}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <span className="tactical-zone-stock-bridge__pick-stage" data-stage={item.stage}>
                  <span aria-hidden>{stageMeta?.emoji ?? "⚪"}</span> 현재 {item.stageLabel}
                  <span className="tactical-zone-stock-bridge__pick-score" title="종합 우선순위 점수">
                    · {item.score}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** @type {Record<string, string>} */
const STAGE_LADDER_FALLBACK = {
  interest: "관심",
  pullback: "눌림",
  trend: "추세",
  takeProfit: "익절",
  risk: "리스크",
}
