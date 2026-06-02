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

  const focusItem =
    bridge.priorities.find((item) => item.id === selectedId) ?? bridge.priorities[0] ?? null

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

      {focusItem ? (
        <section className="tactical-zone-stock-bridge__analysis" aria-label="추천 종목 근거 분석 센터">
          <div className="tactical-zone-stock-bridge__analysis-head">
            <p className="m-0 tactical-zone-stock-bridge__analysis-title">추천 종목 근거 분석 센터</p>
            <p className="m-0 tactical-zone-stock-bridge__analysis-symbol font-mono tabular-nums">
              {focusItem.symbol} {focusItem.confidence}
            </p>
          </div>

          <div className="tactical-zone-stock-bridge__score-breakdown">
            <p className="m-0 tactical-zone-stock-bridge__score-row">
              <span>추세</span>
              <strong className="font-mono tabular-nums">+{focusItem.scoreBreakdown?.trend ?? 0}</strong>
            </p>
            <p className="m-0 tactical-zone-stock-bridge__score-row">
              <span>거래량</span>
              <strong className="font-mono tabular-nums">+{focusItem.scoreBreakdown?.volume ?? 0}</strong>
            </p>
            <p className="m-0 tactical-zone-stock-bridge__score-row">
              <span>20일선</span>
              <strong className="font-mono tabular-nums">+{focusItem.scoreBreakdown?.ma20 ?? 0}</strong>
            </p>
            <p className="m-0 tactical-zone-stock-bridge__score-row">
              <span>섹터강도</span>
              <strong className="font-mono tabular-nums">+{focusItem.scoreBreakdown?.sector ?? 0}</strong>
            </p>
            <p className="m-0 tactical-zone-stock-bridge__score-row">
              <span>YDS환경</span>
              <strong className="font-mono tabular-nums">
                {focusItem.scoreBreakdown?.yds > 0 ? "+" : ""}
                {focusItem.scoreBreakdown?.yds ?? 0}
              </strong>
            </p>
            <p className="m-0 tactical-zone-stock-bridge__score-row tactical-zone-stock-bridge__score-row--sum">
              <span>합계</span>
              <strong className="font-mono tabular-nums">{focusItem.scoreBreakdown?.total ?? focusItem.confidence}</strong>
            </p>
          </div>

          <div className="tactical-zone-stock-bridge__strength-weakness">
            <div>
              <p className="m-0 tactical-zone-stock-bridge__analysis-subtitle">강점</p>
              {(focusItem.strengths ?? []).map((line) => (
                <p key={`str-${line}`} className="m-0 tactical-zone-stock-bridge__analysis-line">
                  ✓ {line}
                </p>
              ))}
            </div>
            <div>
              <p className="m-0 tactical-zone-stock-bridge__analysis-subtitle">약점</p>
              {(focusItem.weaknesses ?? []).map((line) => (
                <p key={`weak-${line}`} className="m-0 tactical-zone-stock-bridge__analysis-line tactical-zone-stock-bridge__analysis-line--weak">
                  △ {line}
                </p>
              ))}
            </div>
          </div>
          <p className="m-0 tactical-zone-stock-bridge__risk">위험도 : {focusItem.riskLevel ?? "보통"}</p>
        </section>
      ) : null}

      <section className="tactical-zone-stock-bridge__compare" aria-label="추천 종목 비교 모드">
        <p className="m-0 tactical-zone-stock-bridge__compare-title">추천 종목 비교 모드</p>
        <div className="tactical-zone-stock-bridge__compare-table" role="table" aria-label="TOP5 비교표">
          <p className="m-0 tactical-zone-stock-bridge__compare-head" role="row">
            <span>종목명</span>
            <span>점수</span>
            <span>위험도</span>
            <span>상태</span>
          </p>
          {bridge.priorities.map((item) => (
            <p key={`cmp-${item.id}`} className="m-0 tactical-zone-stock-bridge__compare-row" role="row">
              <span>{item.symbol}</span>
              <span className="font-mono tabular-nums">{item.confidence}</span>
              <span>{item.riskLevel ?? "보통"}</span>
              <span>{item.stageLabel ?? tradingStageBadge({ stage: item.stage }).label}</span>
            </p>
          ))}
        </div>
      </section>
    </section>
  )
}
