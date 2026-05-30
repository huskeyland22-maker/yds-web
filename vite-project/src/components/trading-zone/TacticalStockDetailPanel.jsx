import { Fragment, useEffect, useMemo, useState } from "react"
import { TRADING_STAGE_META, tradingStageBadge } from "../../trading-zone/tacticalTradingZoneData.js"
import TacticalZoneAuxPanel from "./TacticalZoneAuxPanel.jsx"
import {
  buildTradingCoreMetrics,
  isCoreMetricPlaceholder,
  TRADING_CORE_METRIC_FIELDS,
} from "../../trading-zone/tradingZoneCoreMetrics.js"
import {
  computeTradingZoneProgress,
  resolvePositionPriceLevels,
} from "../../trading-zone/tradingZonePriceProgress.js"
import { buildMarketPolicy } from "../../trading-zone/marketPolicyEngine.js"
import {
  buildStageHistoryTooltipLines,
  formatStageHistoryLog,
} from "../../trading-zone/tradingZoneStageHistory.js"
import { buildTradingConfidenceBreakdown } from "../../trading-zone/tradingZoneConfidenceEngine.js"
import { buildStagePathDisplay } from "../../trading-zone/tradingZoneMarketStockBridge.js"

/** @type {Record<string, string>} */
const POSITION_STATUS_LINE = {
  interest: "관심 유지 · 눌림 대기",
  pullback: "눌림 대기 · 재진입 검토",
  trend: "추세 유지 중",
  takeProfit: "목표 근접 · 분할 익절",
  risk: "리스크 축소 우선",
}

/** @type {Record<string, string>} */
const STAGE_LABEL = {
  interest: "관심구간",
  pullback: "눌림구간",
  trend: "추세구간",
  takeProfit: "익절구간",
  risk: "리스크구간",
}

/**
 * @param {import("../../trading-zone/tacticalTradingZoneData.js").TradingStageId} stage
 * @param {Array<{ key: string; icon: string; text: string; level: string }>} policyItems
 */
function buildTodayActions(stage, policyItems) {
  /** @type {{ icon: string; text: string }[]} */
  const baseByStage = {
    interest: [
      { icon: "✅", text: "관심 유지" },
      { icon: "⚠", text: "추격 금지" },
    ],
    pullback: [
      { icon: "✅", text: "눌림 구간 분할 진입 검토" },
      { icon: "⚠", text: "추격 금지" },
    ],
    trend: [
      { icon: "✅", text: "분할 추가 가능" },
      { icon: "⚠", text: "과열·추격 금지" },
    ],
    takeProfit: [
      { icon: "✅", text: "분할 익절 우선" },
      { icon: "⚠", text: "추격 금지" },
    ],
    risk: [
      { icon: "🚨", text: "비중 축소·손절 우선" },
      { icon: "⚠", text: "추격 금지" },
    ],
  }

  const items = [...(baseByStage[stage] ?? [{ icon: "⚠", text: "추격 금지" }])]
  items.push({ icon: "🚨", text: "손절선 이탈 시 대응" })

  const seen = new Set(items.map((i) => i.text))
  for (const row of policyItems) {
    const text = String(row.text ?? "").trim()
    if (!text || seen.has(text)) continue
    const icon = row.level === "danger" ? "🚨" : row.level === "caution" ? "⚠" : "✅"
    items.push({ icon, text })
    seen.add(text)
    if (items.length >= 4) break
  }

  return items.slice(0, 4)
}

/**
 * @param {{
 *   position: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition
 *   mode?: "live" | "analysis"
 *   focusMode?: boolean
 *   marketPolicy?: object | null
 *   stockEvaluation?: import("../../trading-zone/tradingZoneStockEvaluation.js").TradingZoneStockEvaluation | null
 *   stockEvalLoading?: boolean
 * }} props
 */
export default function TacticalStockDetailPanel({
  position,
  mode = "live",
  panicData = null,
  marketPolicy = null,
  focusMode = false,
  stockEvaluation = null,
  stockEvalLoading = false,
}) {
  const badge = tradingStageBadge(position)
  const historyLog = formatStageHistoryLog(position.stageHistory ?? [])
  const stagePathDisplay = useMemo(
    () => buildStagePathDisplay(position.stageHistory ?? []),
    [position.stageHistory],
  )
  const levels = useMemo(() => {
    const base = resolvePositionPriceLevels(position)
    const zones = stockEvaluation?.priceZones
    if (!zones?.current) return base
    return {
      ...base,
      current: zones.current,
      currentLabel: String(zones.current),
      entry: zones.entry ?? base.entry,
      stop: zones.stop ?? base.stop,
      target: zones.target ?? base.target,
      stopNum: zones.stopNum ?? base.stopNum,
      targetNum: zones.targetNum ?? base.targetNum,
    }
  }, [position, stockEvaluation])
  const progress = computeTradingZoneProgress(levels)
  const coreMetrics = useMemo(() => buildTradingCoreMetrics(position), [position])
  const [detailsOpen, setDetailsOpen] = useState(false)

  const strategicLabelByKey = {
    expectedReturn: "단기 전략",
    upside: "중기 전략",
    stopRisk: "장기 전략",
    weight: "실행 신호",
  }

  useEffect(() => {
    setDetailsOpen(false)
  }, [position.id])

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

  const confidence = useMemo(() => {
    const base = buildTradingConfidenceBreakdown({ position, panicData, activeAux: new Set(position.aux ?? []) })
    if (stockEvaluation?.dataReady) {
      return { ...base, score: stockEvaluation.confidence }
    }
    return base
  }, [position, panicData, stockEvaluation])

  const policy = useMemo(
    () => marketPolicy ?? buildMarketPolicy({ panicData, position }),
    [marketPolicy, panicData, position],
  )
  const policyItems = policy?.actionPolicy?.items?.length
    ? policy.actionPolicy.items
    : [{ key: "default-wait", icon: "🟡", text: "눌림 대기", level: "caution" }]

  const keyActionItems = useMemo(() => {
    const normalize = (text) => String(text ?? "").replace(/\s+/g, " ").trim()
    const seeded = [
      { key: "primary", icon: "🟢", text: policy?.actionLines?.primary ?? "", level: "safe" },
      { key: "execution", icon: "🧭", text: policy?.actionLines?.execution ?? "", level: "caution" },
      { key: "caution", icon: "⚠", text: policy?.actionLines?.caution ?? "", level: "danger" },
      ...policyItems,
    ]
    const deduped = []
    const seen = new Set()
    seeded.forEach((item) => {
      const normalized = normalize(item.text)
      if (!normalized || seen.has(normalized)) return
      seen.add(normalized)
      deduped.push({ ...item, text: normalized })
    })
    return deduped.slice(0, 3)
  }, [policy?.actionLines?.primary, policy?.actionLines?.execution, policy?.actionLines?.caution, policyItems])

  const todayActions = useMemo(
    () => buildTodayActions(position.stage, keyActionItems),
    [position.stage, keyActionItems],
  )

  const riskFactors = useMemo(() => {
    if (stockEvaluation?.dataReady && stockEvaluation.riskFactors?.length) {
      return stockEvaluation.riskFactors
    }
    return []
  }, [stockEvaluation])

  const entryRationale = useMemo(() => {
    if (stockEvaluation?.dataReady && stockEvaluation.strengthHighlights?.length) {
      return stockEvaluation.strengthHighlights
    }
    if (stockEvaluation?.dataReady && stockEvaluation.entryRationale.length) {
      return stockEvaluation.entryRationale
    }
    return []
  }, [stockEvaluation])

  return (
    <div
      className="tactical-zone-detail tactical-zone-detail--simple"
      role="region"
      aria-label={`${position.symbol} 상세`}
      data-stage={position.stage}
    >
      <header className="tactical-zone-detail__head">
        <p className="m-0 tactical-zone-detail__name">
          {position.symbol}
          {stockEvaluation?.dataReady ? (
            <span className="tactical-zone-detail__live-score" title="실데이터 종목 점수">
              {" "}
              {stockEvaluation.tacticalScore}
            </span>
          ) : null}
        </p>
        {stockEvalLoading ? (
          <p className="m-0 tactical-zone-detail__eval-hint" role="status">
            실데이터 평가 중…
          </p>
        ) : null}
      </header>

      <div className="tactical-zone-detail__aux-wrap">
        <p className="m-0 tactical-zone-detail__section-label">보조지표</p>
        <TacticalZoneAuxPanel position={position} stockEvaluation={stockEvaluation} />
      </div>

      {progress ? (
        <div className="tactical-zone-detail__simple-body">
          <section className="tactical-zone-detail__block" aria-labelledby={`${position.id}-position`}>
            <h3 id={`${position.id}-position`} className="m-0 tactical-zone-detail__block-title">
              1. 현재 위치
            </h3>
            <p className="m-0 tactical-zone-detail__position-stage" data-stage={position.stage}>
              <span aria-hidden>{badge.emoji}</span> {STAGE_LABEL[position.stage] ?? badge.label}
            </p>
            <p className="m-0 tactical-zone-detail__position-status">
              {POSITION_STATUS_LINE[position.stage] ?? "실전 대응 구간"}
            </p>
            {stagePathDisplay.path && stagePathDisplay.path !== "—" ? (
              <p className="m-0 tactical-zone-detail__stage-path" title="최근 이동 경로">
                {stagePathDisplay.path}
              </p>
            ) : null}
          </section>

          <section className="tactical-zone-detail__block" aria-labelledby={`${position.id}-price`}>
            <h3 id={`${position.id}-price`} className="m-0 tactical-zone-detail__block-title">
              2. 가격 위치
            </h3>
            <div
              className="trade-progress-group font-mono tabular-nums"
              style={{
                "--progress-pct": `${progress.progressPct}%`,
                "--profit-pct": `${100 - progress.progressPct}%`,
              }}
            >
              <div className="price-label-row">
                <span className="price-marker-label marker-stop">손절 {progress.formatted.stop}</span>
                <span
                  className="price-marker-label marker-current"
                  style={{ left: `${progress.progressPct}%` }}
                >
                  현재 {progress.formatted.current}
                </span>
                <span className="price-marker-label marker-target">목표 {progress.formatted.target}</span>
              </div>

              <div className="tactical-zone-trade-line-container">
                <div className="tactical-zone-trade-line">
                  <div className="tactical-zone-trade-line__track">
                    <div className="tactical-zone-trade-line__markers">
                      <div className="tactical-zone-trade-line__marker-anchor tactical-zone-trade-line__marker-anchor--stop">
                        <span
                          className="marker-dot tactical-zone-trade-line__dot tactical-zone-trade-line__dot--stop"
                          aria-hidden
                        />
                      </div>
                      <div
                        className="tactical-zone-trade-line__marker-anchor tactical-zone-trade-line__marker-anchor--current"
                        style={{ left: `${progress.progressPct}%` }}
                      >
                        <span
                          className="marker-dot tactical-zone-trade-line__dot tactical-zone-trade-line__dot--current"
                          aria-hidden
                        />
                      </div>
                      <div className="tactical-zone-trade-line__marker-anchor tactical-zone-trade-line__marker-anchor--target">
                        <span
                          className="marker-dot tactical-zone-trade-line__dot tactical-zone-trade-line__dot--target"
                          aria-hidden
                        />
                      </div>
                    </div>
                    <div className="tactical-zone-trade-zone-overlay" aria-hidden>
                      <span className="tactical-zone-trade-zone-overlay__danger" />
                      <span className="tactical-zone-trade-zone-overlay__profit" />
                    </div>
                    <span className="progress-line tactical-zone-trade-line__rail" />
                    <span className="progress-line tactical-zone-trade-line__fill" />
                  </div>
                </div>
              </div>

              <div className="progress-achievement m-0 tactical-zone-detail__achieve">
                <div
                  className="tactical-zone-detail__achieve-ring"
                  style={{ "--ring-progress": `${progress.progressPct}%` }}
                  aria-hidden
                >
                  <span className="tactical-zone-detail__achieve-ring-core" />
                  <span className="tactical-zone-detail__achieve-val">{progress.progressPct}%</span>
                </div>
                <span className="tactical-zone-detail__achieve-label">목표도달률</span>
              </div>
            </div>
          </section>

          <section className="tactical-zone-detail__block" aria-labelledby={`${position.id}-action`}>
            <h3 id={`${position.id}-action`} className="m-0 tactical-zone-detail__block-title">
              3. 오늘 행동
            </h3>
            <ul className="m-0 tactical-zone-detail__today-actions">
              {todayActions.map((item) => (
                <li key={item.text} className="tactical-zone-detail__today-action">
                  <span className="tactical-zone-detail__today-action-icon" aria-hidden>
                    {item.icon}
                  </span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </section>

          {!focusMode ? (
            <button
              type="button"
              className="tactical-zone-detail__expand-btn"
              onClick={() => setDetailsOpen((v) => !v)}
              aria-expanded={detailsOpen}
            >
              {detailsOpen ? "상세 분석 접기" : "상세 분석 보기"}
            </button>
          ) : null}

          {detailsOpen ? (
            <div className="tactical-zone-detail__secondary-stack">
              {entryRationale.length ? (
                <section className="tactical-zone-detail__entry-rationale">
                  <p className="m-0 tactical-zone-detail__block-title">상승 요인</p>
                  <ul className="m-0 tactical-zone-detail__entry-rationale-list">
                    {entryRationale.map((line) => (
                      <li key={line}>✓ {line}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {riskFactors.length ? (
                <section className="tactical-zone-detail__risk-factors">
                  <p className="m-0 tactical-zone-detail__block-title">위험 요소</p>
                  <ul className="m-0 tactical-zone-detail__entry-rationale-list">
                    {riskFactors.map((line) => (
                      <li key={line}>⚠ {line}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <section className="tactical-zone-detail__confidence-breakdown">
                <p className="m-0 tactical-zone-detail__confidence-breakdown-title">
                  신뢰도 {confidence.score}% · {confidence.level}
                </p>
                <div className="tactical-zone-detail__confidence-bar" aria-hidden>
                  <span
                    className={[
                      "tactical-zone-detail__confidence-fill",
                      confidence.score >= 80
                        ? "tactical-zone-detail__confidence-fill--high"
                        : confidence.score >= 60
                          ? "tactical-zone-detail__confidence-fill--mid"
                          : "tactical-zone-detail__confidence-fill--low",
                    ].join(" ")}
                    style={{ width: `${confidence.score}%` }}
                  />
                </div>
                <div className="tactical-zone-detail__confidence-lines">
                  {confidence.entries.slice(0, 5).map((entry) => (
                    <p key={`${entry.label}-${entry.score}`} className="m-0 tactical-zone-detail__confidence-line">
                      <span className={entry.score >= 0 ? "is-pos" : "is-neg"}>
                        {entry.score >= 0 ? "🟢" : "🔴"} {entry.label}
                      </span>
                      <span>{entry.score >= 0 ? `+${entry.score}` : entry.score}</span>
                    </p>
                  ))}
                </div>
              </section>
              {mode === "analysis" ? (
                <p className="m-0 tactical-zone-detail__mode-hint">분석 모드: 지표·근거 상세</p>
              ) : null}
              <div className="tactical-zone-detail__trade-info-block">
                <div className="tactical-zone-trade-info-row" role="group" aria-label="핵심 매매정보">
                  {TRADING_CORE_METRIC_FIELDS.map(({ key, label, tooltip, empty, tone }) => {
                    const value = coreMetrics[key]
                    const pending = isCoreMetricPlaceholder(value, empty)
                    return (
                      <div key={key} className="tactical-zone-info-item" title={tooltip}>
                        <span className="tactical-zone-info-item__label">
                          {strategicLabelByKey[key] ?? label}
                        </span>
                        <span
                          className={[
                            "tactical-zone-info-item__value font-mono tabular-nums",
                            pending ? "tactical-zone-info-item__value--placeholder" : "",
                            !pending ? `tactical-zone-info-item__value--${tone}` : "",
                          ].join(" ")}
                        >
                          {value}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="m-0 tactical-zone-detail__no-price">가격 영역 계산 대기</p>
      )}

      <footer className="tactical-zone-detail__foot" hidden={!detailsOpen}>
        {historyLog.length ? (
          <div className="tactical-zone-detail__status-history">
            <p className="m-0 tactical-zone-detail__section-label">상태 이력</p>
            <div className="tactical-zone-status-history" aria-label="상태 이력 타임라인">
              {historyLog.map((h, i) => {
                const isActive = i === historyHighlightIndex
                const tip = buildStageHistoryTooltipLines(h)
                const emoji = TRADING_STAGE_META[h.stage]?.emoji ?? "⚪"
                return (
                  <Fragment key={`${h.stage}-${h.dateLabel}-${i}`}>
                    {i > 0 ? (
                      <span className="tactical-zone-timeline-connector" aria-hidden>
                        →
                      </span>
                    ) : null}
                    <div
                      className={[
                        "tactical-zone-timeline-node",
                        isActive ? "tactical-zone-timeline-node--active" : "",
                      ].join(" ")}
                      data-stage={h.stage}
                      tabIndex={0}
                    >
                      <span className="tactical-zone-timeline-node__emoji" aria-hidden>
                        {emoji}
                      </span>
                      <span className="tactical-zone-timeline-node__date font-mono tabular-nums">
                        {h.dateLabel || "—"}
                      </span>
                      <span className="sr-only">{h.label}</span>
                      <div className="tactical-zone-timeline-node__tooltip" role="tooltip">
                        <span>가격 {tip.price}</span>
                        <span>점수 {tip.score}</span>
                        <span>상태 {tip.state}</span>
                      </div>
                    </div>
                  </Fragment>
                )
              })}
            </div>
          </div>
        ) : null}
      </footer>
    </div>
  )
}
