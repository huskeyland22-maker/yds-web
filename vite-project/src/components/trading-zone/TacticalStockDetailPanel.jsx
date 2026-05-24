import {
  TRADING_STAGE_FLOW,
  TRADING_STAGE_META,
  TRADING_ZONE_FIELD_PENDING,
  TRADING_ZONE_STANDARD_AUX,
  tradingStageBadge,
} from "../../trading-zone/tacticalTradingZoneData.js"
import {
  computeTradingZoneProgress,
  resolvePositionPriceLevels,
} from "../../trading-zone/tradingZonePriceProgress.js"
import {
  formatStageHistoryChipDisplay,
  formatStageHistoryLog,
} from "../../trading-zone/tradingZoneStageHistory.js"

const FIELD_ROWS = [
  { key: "rr", label: "RR" },
  { key: "expectedReturn", label: "기대수익" },
  { key: "holdingDays", label: "보유일" },
  { key: "weight", label: "비중" },
]

/**
 * @param {{ position: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition }} props
 */
export default function TacticalStockDetailPanel({ position }) {
  const badge = tradingStageBadge(position)
  const historyLog = formatStageHistoryLog(position.stageHistory ?? [])
  const levels = resolvePositionPriceLevels(position)
  const progress = computeTradingZoneProgress(levels)
  const activeAux = new Set(position.aux ?? [])

  const flowActiveIndex = TRADING_STAGE_FLOW.includes(position.stage)
    ? TRADING_STAGE_FLOW.indexOf(position.stage)
    : -1

  const currentStageId =
    position.stage === "interest" ||
    position.stage === "pullback" ||
    position.stage === "trend" ||
    position.stage === "takeProfit"
      ? position.stage
      : null

  let historyHighlightIndex = -1
  if (historyLog.length && currentStageId) {
    for (let i = historyLog.length - 1; i >= 0; i -= 1) {
      if (historyLog[i].stage === currentStageId) {
        historyHighlightIndex = i
        break
      }
    }
  }

  const resolveFieldValue = (key) => {
    if (key === "holdingDays") {
      if (position.holdingDays != null && Number.isFinite(position.holdingDays)) {
        return `${position.holdingDays}일`
      }
      return TRADING_ZONE_FIELD_PENDING
    }
    const raw = position[key]
    if (raw == null) return TRADING_ZONE_FIELD_PENDING
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw)
    const s = String(raw).trim()
    if (!s || s === "—" || s === "-") return TRADING_ZONE_FIELD_PENDING
    return s
  }

  return (
    <div
      className="tactical-zone-detail tactical-zone-detail--compact"
      role="region"
      aria-label={`${position.symbol} 상세`}
      data-stage={position.stage}
    >
      <div className="tactical-zone-detail__bundle">
        <p className="m-0 tactical-zone-detail__name">{position.symbol}</p>

        <div className="tactical-zone-detail__stage-block">
          <p className="m-0 tactical-zone-detail__current-line">
            <span className="tactical-zone-detail__current-label">현재단계</span>
            <span className="tactical-zone-detail__current-sep" aria-hidden>
              :
            </span>
            <span className="tactical-zone-detail__current-value">
              <span aria-hidden>{badge.emoji}</span> {badge.label}
            </span>
          </p>

          <div
            className="tactical-zone-stage-flow tactical-zone-stage-flow--compact"
            aria-label="단계 진행"
          >
            {TRADING_STAGE_FLOW.map((stageId, i) => {
              const meta = TRADING_STAGE_META[stageId]
              const isActive = position.stage === stageId
              const isMuted = flowActiveIndex >= 0 && i > flowActiveIndex
              return (
                <span key={stageId} className="tactical-zone-stage-flow__segment">
                  {i > 0 ? (
                    <span
                      className={[
                        "tactical-zone-stage-flow__arrow",
                        isMuted ? "tactical-zone-stage-flow__arrow--muted" : "",
                      ].join(" ")}
                      aria-hidden
                    >
                      →
                    </span>
                  ) : null}
                  <span
                    className={[
                      "tactical-zone-stage-flow__chip",
                      isActive ? "tactical-zone-stage-flow__chip--active" : "",
                      isMuted ? "tactical-zone-stage-flow__chip--muted" : "",
                    ].join(" ")}
                    data-stage={stageId}
                  >
                    {meta.label}
                  </span>
                </span>
              )
            })}
          </div>
        </div>

        {progress ? (
          <div
            className="tactical-zone-price-block"
            style={{ "--progress-pct": `${progress.progressPct}%` }}
          >
            <div className="tactical-zone-price-stats font-mono tabular-nums">
              <span className="tactical-zone-price-stats__item tactical-zone-price-stats__item--stop">
                <span className="tactical-zone-price-stats__label">손절</span>
                <span className="tactical-zone-price-stats__val">{progress.formatted.stop}</span>
              </span>
              <span className="tactical-zone-price-stats__sep" aria-hidden>
                |
              </span>
              <span className="tactical-zone-price-stats__item tactical-zone-price-stats__item--current">
                <span className="tactical-zone-price-stats__label">현재</span>
                <span className="tactical-zone-price-stats__val">{progress.formatted.current}</span>
              </span>
              <span className="tactical-zone-price-stats__sep" aria-hidden>
                |
              </span>
              <span className="tactical-zone-price-stats__item tactical-zone-price-stats__item--target">
                <span className="tactical-zone-price-stats__label">목표</span>
                <span className="tactical-zone-price-stats__val">{progress.formatted.target}</span>
              </span>
              <span className="tactical-zone-price-stats__sep" aria-hidden>
                |
              </span>
              <span className="tactical-zone-price-stats__item tactical-zone-price-stats__item--achieve">
                <span className="tactical-zone-price-stats__label">달성</span>
                <span className="tactical-zone-price-stats__val">{progress.progressPct}%</span>
              </span>
            </div>

            <div className="tactical-zone-progress__track-wrap">
              <div className="tactical-zone-progress__track">
                <span className="tactical-zone-progress__rail" />
                <span className="tactical-zone-progress__fill" />
                <span className="tactical-zone-progress__dot tactical-zone-progress__dot--stop" />
                <span className="tactical-zone-progress__dot tactical-zone-progress__dot--current" />
                <span className="tactical-zone-progress__dot tactical-zone-progress__dot--target" />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="tactical-zone-detail__footer">
        <div className="tactical-zone-detail__aux">
          <p className="m-0 tactical-zone-detail__section-label">보조지표</p>
          <div className="tactical-zone-detail__aux-tags">
            {TRADING_ZONE_STANDARD_AUX.map((tag) => (
              <span
                key={tag}
                className={[
                  "tactical-zone-aux-tag",
                  activeAux.has(tag) ? "tactical-zone-aux-tag--on" : "tactical-zone-aux-tag--off",
                ].join(" ")}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <dl className="tactical-zone-fields-rows m-0" aria-label="실전 필드">
          {FIELD_ROWS.map(({ key, label }) => {
            const value = resolveFieldValue(key)
            const pending = value === TRADING_ZONE_FIELD_PENDING
            return (
              <div key={key} className="tactical-zone-fields-rows__row">
                <dt className="tactical-zone-fields-rows__label">{label}</dt>
                <dd
                  className={[
                    "tactical-zone-fields-rows__value font-mono tabular-nums",
                    pending ? "tactical-zone-fields-rows__value--pending" : "",
                  ].join(" ")}
                >
                  {value}
                </dd>
              </div>
            )
          })}
        </dl>

        {historyLog.length ? (
          <div className="tactical-zone-detail__history">
            <p className="m-0 tactical-zone-detail__section-label">상태 이력</p>
            <div className="tactical-zone-history-timeline" aria-label="상태 이력 타임라인">
              {historyLog.map((h, i) => (
                <span
                  key={`${h.stage}-${h.dateLabel}-${i}`}
                  className={[
                    "tactical-zone-history-chip",
                    i === historyHighlightIndex
                      ? "tactical-zone-history-chip--current"
                      : "tactical-zone-history-chip--past",
                  ].join(" ")}
                  data-stage={h.stage}
                >
                  {formatStageHistoryChipDisplay(h)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
