import {
  TRADING_STAGE_FLOW,
  TRADING_STAGE_META,
  TRADING_ZONE_STANDARD_AUX,
  tradingStageBadge,
} from "../../trading-zone/tacticalTradingZoneData.js"
import {
  computeTradingZoneProgress,
  resolvePositionPriceLevels,
} from "../../trading-zone/tradingZonePriceProgress.js"
import {
  formatStageHistoryLog,
  formatStageHistoryTimelineSegment,
} from "../../trading-zone/tradingZoneStageHistory.js"

/**
 * @param {{ position: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition }} props
 */
export default function TacticalStockDetailPanel({ position }) {
  const badge = tradingStageBadge(position)
  const historyLog = formatStageHistoryLog(position.stageHistory ?? [])
  const levels = resolvePositionPriceLevels(position)
  const progress = computeTradingZoneProgress(levels)
  const activeAux = new Set(position.aux ?? [])

  const displayStop = progress?.formatted.stop ?? position.stop ?? "—"
  const displayTarget = progress?.formatted.target ?? position.target ?? "—"
  const displayEntry = position.entry?.trim() ? position.entry.replace(/\s*~\s*/g, "~") : "—"

  const currentDisplay = progress?.formatted.current ?? "—"

  return (
    <div className="tactical-zone-detail" role="region" aria-label={`${position.symbol} 상세`}>
      <p className="m-0 tactical-zone-detail__name">{position.symbol}</p>

      <div className="tactical-zone-detail__flow">
        <div className="tactical-zone-stage-flow" aria-label="단계 흐름">
          {TRADING_STAGE_FLOW.map((stageId, i) => {
            const meta = TRADING_STAGE_META[stageId]
            const active = stageId === position.stage
            return (
              <span key={stageId} className="tactical-zone-stage-flow__item">
                {i > 0 ? (
                  <span className="tactical-zone-stage-flow__arrow" aria-hidden>
                    →
                  </span>
                ) : null}
                <span
                  className={[
                    "tactical-zone-stage-flow__chip",
                    active ? "tactical-zone-stage-flow__chip--active" : "tactical-zone-stage-flow__chip--muted",
                  ].join(" ")}
                  data-stage={stageId}
                >
                  {meta.emoji} {meta.label}
                </span>
              </span>
            )
          })}
        </div>
        <p className="m-0 tactical-zone-detail__current">
          현재: {badge.emoji} {badge.label}
        </p>
      </div>

      <dl className="tactical-zone-detail__grid m-0">
        <div className="tactical-zone-detail__grid-cell tactical-zone-detail__grid-cell--entry">
          <dt>진입</dt>
          <dd>
            <span className="tactical-zone-price-pill font-mono tabular-nums">{displayEntry}</span>
          </dd>
        </div>
        <div className="tactical-zone-detail__grid-cell tactical-zone-detail__grid-cell--stop">
          <dt>손절</dt>
          <dd>
            <span className="tactical-zone-price-pill font-mono tabular-nums">{displayStop}</span>
          </dd>
        </div>
        <div className="tactical-zone-detail__grid-cell tactical-zone-detail__grid-cell--target">
          <dt>목표</dt>
          <dd>
            <span className="tactical-zone-price-pill font-mono tabular-nums">{displayTarget}</span>
          </dd>
        </div>
      </dl>

      {progress ? (
        <div
          className="tactical-zone-progress"
          style={{ "--progress-pct": `${progress.progressPct}%` }}
        >
          <div className="tactical-zone-progress__chart font-mono tabular-nums">
            <div className="tactical-zone-progress__ends">
              <span className="tactical-zone-progress__end tactical-zone-progress__end--stop">
                손절<span className="tactical-zone-progress__end-num">{progress.formatted.stop}</span>
              </span>
              <span className="tactical-zone-progress__end tactical-zone-progress__end--target">
                목표<span className="tactical-zone-progress__end-num">{progress.formatted.target}</span>
              </span>
            </div>

            <div className="tactical-zone-progress__track-wrap">
              <div className="tactical-zone-progress__current-tag" aria-hidden>
                <span className="tactical-zone-progress__current-dot">●</span>
                <span className="tactical-zone-progress__current-label">현재{currentDisplay}</span>
              </div>
              <div className="tactical-zone-progress__track">
                <span className="tactical-zone-progress__rail" />
                <span className="tactical-zone-progress__fill" />
                <span className="tactical-zone-progress__dot tactical-zone-progress__dot--stop" />
                <span className="tactical-zone-progress__dot tactical-zone-progress__dot--current" />
                <span className="tactical-zone-progress__dot tactical-zone-progress__dot--target" />
              </div>
            </div>

            <p className="m-0 tactical-zone-progress__achieve-row">
              <span className="tactical-zone-progress__achieve-label">목표달성</span>
              <span className="tactical-zone-progress__achieve-pct font-mono tabular-nums">
                {progress.progressPct}%
              </span>
            </p>
          </div>
        </div>
      ) : null}

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

      <dl className="tactical-zone-detail__reserved m-0" aria-label="실전 필드 예약">
        <div className="tactical-zone-detail__reserved-cell">
          <dt>RR</dt>
          <dd>{position.rr?.trim() ? position.rr : "—"}</dd>
        </div>
        <div className="tactical-zone-detail__reserved-cell">
          <dt>기대수익</dt>
          <dd>{position.expectedReturn?.trim() ? position.expectedReturn : "—"}</dd>
        </div>
        <div className="tactical-zone-detail__reserved-cell">
          <dt>보유일</dt>
          <dd>{position.holdingDays != null ? `${position.holdingDays}일` : "—"}</dd>
        </div>
        <div className="tactical-zone-detail__reserved-cell">
          <dt>비중</dt>
          <dd>{position.weight?.trim() ? position.weight : "—"}</dd>
        </div>
      </dl>

      {historyLog.length ? (
        <div className="tactical-zone-detail__history">
          <p className="m-0 tactical-zone-detail__section-label">상태 이력</p>
          <p className="m-0 tactical-zone-history-timeline font-mono" aria-label="상태 이력 타임라인">
            {historyLog.map((h, i) => (
              <span key={`${h.stage}-${h.dateLabel}-${i}`} className="tactical-zone-history-timeline__item">
                {i > 0 ? (
                  <span className="tactical-zone-history-timeline__arrow" aria-hidden>
                    →
                  </span>
                ) : null}
                <span className="tactical-zone-history-timeline__segment" data-stage={h.stage}>
                  {formatStageHistoryTimelineSegment(h)}
                </span>
              </span>
            ))}
          </p>
        </div>
      ) : null}
    </div>
  )
}
