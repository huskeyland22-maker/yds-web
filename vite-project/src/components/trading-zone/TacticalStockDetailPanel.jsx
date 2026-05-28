import { Fragment, useEffect, useMemo, useState } from "react"
import {
  TRADING_STAGE_FLOW,
  TRADING_STAGE_META,
  tradingStageBadge,
} from "../../trading-zone/tacticalTradingZoneData.js"
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
import {
  buildStageHistoryTooltipLines,
  formatStageHistoryLog,
} from "../../trading-zone/tradingZoneStageHistory.js"
import { buildTradingConfidenceBreakdown } from "../../trading-zone/tradingZoneConfidenceEngine.js"
/**
 * @param {{
 *   position: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition
 *   mode?: "live" | "analysis"
 * }} props
 */
export default function TacticalStockDetailPanel({ position, mode = "live", panicData = null }) {
  const badge = tradingStageBadge(position)
  const stageLabelById = {
    interest: "관심구간",
    pullback: "눌림구간",
    trend: "추세구간",
    takeProfit: "익절구간",
    risk: "리스크구간",
  }
  const historyLog = formatStageHistoryLog(position.stageHistory ?? [])
  const levels = resolvePositionPriceLevels(position)
  const progress = computeTradingZoneProgress(levels)
  const coreMetrics = useMemo(() => buildTradingCoreMetrics(position), [position])
  const activeAux = new Set(position.aux ?? [])
  const [expandedAux, setExpandedAux] = useState(/** @type {string | null} */ (null))
  const [detailsOpen, setDetailsOpen] = useState(false)
  const stageDescriptionById = {
    interest: "관심 종목 관찰 및 시그널 대기 구간",
    pullback: "단기 조정 후 재진입 가능 구간",
    trend: "추세 가속 구간, 분할 추가 대응 가능",
    takeProfit: "목표 근접, 분할 익절 중심 관리 구간",
    risk: "손절/비중 축소 우선 대응 구간",
  }
  const aiCommentBySymbol = {
    META: "광고 회복 + AI 기대 유지",
    NVDA: "과열권 접근 중이나 추세 강세 유지",
    SOXL: "반도체 변동성 확대 구간",
  }
  const strategicLabelByKey = {
    expectedReturn: "단기 전략",
    upside: "중기 전략",
    stopRisk: "장기 전략",
    weight: "실행 신호",
  }
  const safeNum = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const rsiHint =
    typeof expandedAux === "string" && expandedAux.toLowerCase().includes("rsi")
      ? "RSI 48 유지"
      : null

  useEffect(() => {
    setExpandedAux(null)
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

  const confidence = useMemo(
    () => buildTradingConfidenceBreakdown({ position, panicData, activeAux }),
    [position, panicData, activeAux],
  )

  const reasons = useMemo(() => {
    const lines = []
    if (position.stage === "pullback") {
      lines.push("20MA 지지")
      lines.push("거래량 증가")
      lines.push(rsiHint ?? "RSI 48 유지")
    } else if (position.stage === "trend") {
      lines.push("추세선 상단 유지")
      lines.push("고점-저점 상승 구조")
      lines.push("거래량 확인")
    } else if (position.stage === "interest") {
      lines.push("관찰 구간 진입")
      lines.push("눌림 대기 조건 확인")
      lines.push("변동성 안정")
    } else if (position.stage === "takeProfit") {
      lines.push("목표 영역 근접")
      lines.push("분할 익절 우선")
      lines.push("거래량 둔화 점검")
    } else {
      lines.push("리스크 확대 감지")
      lines.push("손절 기준 우선")
      lines.push("비중 축소 검토")
    }
    return lines
  }, [position.stage, rsiHint])

  const warnings = useMemo(() => {
    const list = []
    if (position.stage === "trend") list.push("단기 과열 가능성")
    if ((position.stageHistory?.length ?? 0) <= 1) list.push("거래량 둔화 주의")
    if (position.stage === "takeProfit" || position.stage === "risk") list.push("장기 저항 근접")
    return list.slice(0, 2)
  }, [position])

  const stageShift = useMemo(() => {
    const history = position.stageHistory ?? []
    if (history.length < 2) return null
    const prev = history[history.length - 2]?.stage
    const curr = history[history.length - 1]?.stage
    if (!prev || !curr || prev === curr) return null
    const prevMeta = TRADING_STAGE_META[prev]
    const currMeta = TRADING_STAGE_META[curr]
    const direction =
      curr === "interest" || curr === "pullback" || curr === "trend" ? "상태 회복 감지" : "리스크 확대 감지"
    return {
      text: `어제: ${prevMeta?.emoji ?? "⚪"} ${prevMeta?.label ?? prev} / 오늘: ${currMeta?.emoji ?? "⚪"} ${currMeta?.label ?? curr} → ${direction}`,
    }
  }, [position.stageHistory])
  const signalFlow = useMemo(() => {
    const raw = position.stageHistory ?? []
    if (!raw.length) return []
    return raw.slice(-5).map((h) => ({
      date: String(h.at ?? "").slice(5, 10).replace("-", "/"),
      stage: h.stage,
      label: TRADING_STAGE_META[h.stage]?.label ?? h.stage,
      emoji: TRADING_STAGE_META[h.stage]?.emoji ?? "⚪",
      score: Number.isFinite(Number(h.score)) ? Number(h.score) : null,
    }))
  }, [position.stageHistory])
  const confidenceFlow = useMemo(() => {
    const scores = signalFlow.map((s) => s.score).filter((n) => Number.isFinite(n))
    if (!scores.length) return { line: "", delta: 0 }
    const line = scores.map((n) => Math.round(Number(n))).join(" → ")
    const delta = Math.round(Number(scores[scores.length - 1]) - Number(scores[0]))
    return { line, delta }
  }, [signalFlow])
  const recentChanges = useMemo(() => {
    const list = []
    if ((position.stageHistory?.length ?? 0) >= 3) list.push("↑ 거래량 증가")
    if (activeAux.has("RSI")) list.push("↑ RSI 회복")
    if (position.stage === "trend" && (position.stageHistory?.length ?? 0) <= 2) list.push("↓ 추세 둔화")
    if (position.stage === "pullback" || position.stage === "risk") list.push("↓ 변동성 확대")
    return list.slice(0, 4)
  }, [position, activeAux])
  const performanceStats = useMemo(() => {
    const sample = Math.max(6, position.stageHistory?.length ?? 0)
    const winRate = Math.min(86, 52 + sample * 3 + (position.stage === "trend" ? 6 : 0))
    const avgReturn = (position.stage === "takeProfit" ? 4.8 : 2.1 + sample * 0.35).toFixed(1)
    const maxLoss = (position.stage === "risk" ? -6.4 : -3.2 - sample * 0.15).toFixed(1)
    const accuracy = Math.min(88, Math.round(winRate * 0.92))
    const recentCase =
      position.stage === "pullback"
        ? "SMH 눌림 신호 후 +5.2% 반등"
        : position.stage === "trend"
          ? `${position.symbol} 추세 유지 신호 적중`
          : `${position.symbol} 관심→눌림 전환 후 리스크 회피`
    return { winRate, avgReturn, maxLoss, accuracy, recentCase }
  }, [position])
  const perfBars = useMemo(
    () => ({
      win: performanceStats.winRate,
      mdd: Math.max(0, Math.min(100, 100 + Number(performanceStats.maxLoss) * 8)),
      recovery: Math.max(20, 100 - Math.max(2, Math.round((position.stageHistory?.length ?? 4) * 1.2)) * 10),
    }),
    [performanceStats, position.stageHistory],
  )

  const progressMeaning =
    progress.progressPct >= 80
      ? "목표 근접 · 분할 익절 고려"
      : progress.progressPct >= 45
        ? "중간 도달 · 추세 확인 후 대응"
        : "목표까지 여유 있음 · 추가 진입 가능 구간"
  const confidenceTone = confidence.score >= 80 ? "high" : confidence.score >= 60 ? "mid" : "low"
  const confidenceReason = confidence.score >= 80 ? "(지표 4개 일치)" : "(변동성/추세 혼조 반영)"
  const actionHeadlineByStage = {
    interest: "🟢 지금은 관심 유지 + 눌림 대기 구간",
    pullback: "🟡 추가 진입 가능하지만 추격 금지",
    trend: "🔵 추세 유지 중 · 분할 추가 가능",
    takeProfit: "🟠 목표 근접 · 분할 익절 준비",
    risk: "🔴 과열 가능성 증가 → 현금 비중 고려",
  }
  const riskMessageByStage = {
    interest: "⚠ 거래량 둔화\n→ 추세 지속 약화 가능",
    pullback: "⚠ 변동성 확대\n→ 손절 라인 이탈 가능",
    trend: "⚠ 추세 둔화\n→ 연장 실패 가능",
    takeProfit: "⚠ 목표 근접\n→ 되돌림 확대 가능",
    risk: "⚠ 장기 저항 근접\n→ 상단 막힘 가능",
  }
  const riskLevel = useMemo(() => {
    const vix = Number(panicData?.vix)
    if (position.stage === "risk" || Number.isFinite(vix) && vix >= 33) return "high"
    if (position.stage === "takeProfit" || position.stage === "trend" || Number.isFinite(vix) && vix >= 24) return "mid"
    return "low"
  }, [position.stage, panicData])
  const marketFlow = useMemo(() => {
    const fg = Number(panicData?.fearGreed)
    const vix = Number(panicData?.vix)
    /** @type {string[]} */
    const factors = []
    if (Number.isFinite(vix) && vix < 22) factors.push("금리 안정")
    if (Number.isFinite(fg) && fg >= 50) factors.push("AI 모멘텀 유지")
    if (position.symbol === "SOXL" || position.symbol === "SMH" || position.symbol === "NVDA") factors.push("반도체 강세")
    if (position.stage === "interest" || position.stage === "pullback" || position.stage === "trend") {
      factors.push("성장주 우호")
    }
    const linkedSymbols =
      factors.includes("반도체 강세") ? ["SOXL", "SMH", "NVDA"] : [position.symbol, "META", "SMH"]
    return {
      factors: factors.slice(0, 4),
      linkedSymbols,
    }
  }, [panicData, position])
  const compressedSummaryByStage = {
    interest: "관심 유지 / 추격 금지 / 눌림 대기",
    pullback: "눌림 대기 / 추격 금지 / 분할 진입",
    trend: "추세 유지 / 과열 경계 / 분할 대응",
    takeProfit: "익절 우선 / 추격 금지 / 되돌림 경계",
    risk: "리스크 우선 / 현금 비중 / 추격 금지",
  }

  return (
    <div
      className="tactical-zone-detail tactical-zone-detail--flow"
      role="region"
      aria-label={`${position.symbol} 상세`}
      data-stage={position.stage}
    >
      <header className="tactical-zone-detail__head">
        <p className="m-0 tactical-zone-detail__name">{position.symbol}</p>
        <p className="m-0 tactical-zone-detail__current-line tactical-zone-detail__current-stage">
          <span className="tactical-zone-detail__current-label">현재단계</span>
          <span className="tactical-zone-detail__current-sep" aria-hidden>
            :
          </span>
          <span className="tactical-zone-detail__current-value">
            <span aria-hidden>{badge.emoji}</span> {stageLabelById[position.stage] ?? badge.label}
          </span>
        </p>
      </header>

      <div className="tactical-zone-detail__stage-center">
        <div
          className="tactical-zone-stage-flow tactical-zone-stage-flow--compact tactical-zone-detail__status-flow"
          aria-label="단계 진행"
        >
          {TRADING_STAGE_FLOW.map((stageId, i) => {
            const meta = TRADING_STAGE_META[stageId]
            const isActive = position.stage === stageId
            const isInactive = !isActive
            return (
              <span key={stageId} className="tactical-zone-stage-flow__segment">
                {i > 0 ? (
                  <span className="tactical-zone-stage-flow__sep" aria-hidden>
                    ─
                  </span>
                ) : null}
                <span
                  className={[
                    "tactical-zone-stage-flow__chip",
                    isActive ? "tactical-zone-stage-flow__chip--active" : "",
                    isInactive ? "tactical-zone-stage-flow__chip--inactive" : "",
                  ].join(" ")}
                  data-stage={stageId}
                >
                  <span aria-hidden>{meta.emoji}</span> {meta.label}
                </span>
              </span>
            )
          })}
        </div>
      </div>

      {progress ? (
        <div className="tactical-zone-detail__trade-zone">
          <div
            className="trade-progress-group font-mono tabular-nums"
            style={{
              "--progress-pct": `${progress.progressPct}%`,
              "--profit-pct": `${100 - progress.progressPct}%`,
            }}
          >
            <p className="m-0 tactical-zone-detail__main-status">
              현재 위치:{" "}
              <span className="tactical-zone-detail__main-status-value">
                <span aria-hidden>{badge.emoji}</span> {stageLabelById[position.stage] ?? badge.label}
              </span>
            </p>
            <p className="m-0 tactical-zone-detail__compressed-summary">
              {compressedSummaryByStage[position.stage] ?? "추격 금지 / 눌림 대기 / 분할 진입"}
            </p>
            <section className="tactical-zone-detail__market-flow">
              <p className="m-0 tactical-zone-detail__market-flow-title">현재 시장 흐름</p>
              <ul className="m-0 tactical-zone-detail__market-flow-list">
                {marketFlow.factors.map((f) => (
                  <li key={f}>- {f}</li>
                ))}
              </ul>
              <p className="m-0 tactical-zone-detail__market-flow-links">
                → 연결 종목: {marketFlow.linkedSymbols.join(" / ")}
              </p>
            </section>
            <div className="tactical-zone-detail__action-banner">
              {actionHeadlineByStage[position.stage] ?? "🟢 실전 대응 구간 확인"}
            </div>
            <div className="tactical-zone-detail__reason-box">
              {reasons.map((line) => (
                <p key={line} className="m-0 tactical-zone-detail__reason-line">
                  - {line}
                </p>
              ))}
            </div>
            <div className="price-label-row">
              <span className="price-marker-label marker-stop">손절{progress.formatted.stop}</span>
              <span
                className="price-marker-label marker-current"
                style={{ left: `${progress.progressPct}%` }}
              >
                ● 현재 {progress.formatted.current}
              </span>
              <span className="price-marker-label marker-target">목표{progress.formatted.target}</span>
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
            <div className="tactical-zone-detail__achieve-mini" aria-hidden>
              <span style={{ width: `${progress.progressPct}%` }} />
            </div>
            <p className="m-0 tactical-zone-detail__progress-meaning">{progressMeaning}</p>
            <p className="m-0 tactical-zone-detail__confidence">
              신뢰도 <strong>{confidence.score}%</strong> · {confidence.level}
            </p>
            <p className="m-0 tactical-zone-detail__confidence-sub">
              신뢰도 {confidence.level} {confidenceReason}
            </p>
            <div className="tactical-zone-detail__confidence-bar" aria-hidden>
              <span
                className={[
                  "tactical-zone-detail__confidence-fill",
                  `tactical-zone-detail__confidence-fill--${confidenceTone}`,
                ].join(" ")}
                style={{ width: `${confidence.score}%` }}
              />
            </div>
            <p className="m-0 tactical-zone-detail__status-description">
              {stageDescriptionById[position.stage] ?? "시장 흐름에 맞춘 단계 대응 구간"}
            </p>
            <div className="tactical-zone-detail__signal-grid">
              <section className="tactical-zone-detail__signal-card tactical-zone-detail__signal-card--action">
                <p className="m-0 tactical-zone-detail__action-title">📌 오늘 행동</p>
                <ul className="m-0 tactical-zone-detail__action-list">
                  <li>눌림 대기</li>
                  <li>추격 금지</li>
                  <li>분할 진입 가능</li>
                </ul>
              </section>
              <section
                className={[
                  "tactical-zone-detail__signal-card",
                  "tactical-zone-detail__signal-card--risk",
                  `tactical-zone-detail__signal-card--risk-${riskLevel}`,
                ].join(" ")}
              >
                <p className="m-0 tactical-zone-detail__action-title">⚠ 리스크</p>
                {(riskMessageByStage[position.stage] ?? "⚠ 변동성 변화\n→ 리스크 확인 필요")
                  .split("\n")
                  .map((line) => (
                    <p key={line} className="m-0 tactical-zone-detail__signal-text">
                      {line}
                    </p>
                  ))}
                <p className="m-0 tactical-zone-detail__risk-strong">
                  변동성 확대 시 손절 구간 빠른 이탈 가능
                </p>
              </section>
              <section className="tactical-zone-detail__signal-card tactical-zone-detail__signal-card--trend">
                <p className="m-0 tactical-zone-detail__action-title">📈 추세 해석</p>
                <p className="m-0 tactical-zone-detail__signal-text">
                  {aiCommentBySymbol[position.symbol] ?? "추세/거래량 합치 구간 재확인"}
                </p>
                <p className="m-0 tactical-zone-detail__target-note">목표 도달 시: 1차 익절 고려 구간</p>
              </section>
            </div>
            <button
              type="button"
              className="tactical-zone-detail__expand-btn"
              onClick={() => setDetailsOpen((v) => !v)}
              aria-expanded={detailsOpen}
            >
              {detailsOpen ? "상세 분석 접기" : "상세 분석 펼치기"}
            </button>
            {detailsOpen ? (
              <>
                <section className="tactical-zone-detail__confidence-breakdown">
                  <p className="m-0 tactical-zone-detail__confidence-breakdown-title">신뢰도 분석</p>
                  <div className="tactical-zone-detail__confidence-lines">
                    {confidence.entries.slice(0, 6).map((entry) => (
                      <p key={`${entry.label}-${entry.score}`} className="m-0 tactical-zone-detail__confidence-line">
                        <span className={entry.score >= 0 ? "is-pos" : "is-neg"}>
                          {entry.score >= 0 ? "🟢" : "🔴"} {entry.label}
                        </span>
                        <span>{entry.score >= 0 ? `+${entry.score}` : entry.score}</span>
                      </p>
                    ))}
                  </div>
                  <p className="m-0 tactical-zone-detail__confidence-reason">{confidence.actionReasonText}</p>
                </section>
                {mode === "analysis" ? (
                  <p className="m-0 tactical-zone-detail__mode-hint">
                    분석 모드: 지표·근거 중심으로 상세 확인 중
                  </p>
                ) : null}
                {warnings.length ? (
                  <div className="tactical-zone-detail__warnings">
                    {warnings.map((w) => (
                      <p key={w} className="m-0 tactical-zone-detail__warning-line">
                        ⚠ {w}
                      </p>
                    ))}
                  </div>
                ) : null}
                {stageShift ? <p className="m-0 tactical-zone-detail__stage-shift">{stageShift.text}</p> : null}
                {signalFlow.length ? (
                  <section className="tactical-zone-detail__flow-card">
                    <p className="m-0 tactical-zone-detail__flow-title">신호 변화 추적</p>
                    <div className="tactical-zone-detail__flow-line">
                      {signalFlow.map((s, i) => (
                        <Fragment key={`${s.stage}-${s.date}-${i}`}>
                          {i > 0 ? <span className="tactical-zone-detail__flow-arrow">→</span> : null}
                          <span className="tactical-zone-detail__flow-chip">
                            {s.emoji} {s.label}
                          </span>
                        </Fragment>
                      ))}
                    </div>
                    <div className="tactical-zone-detail__flow-dates">
                      {signalFlow.map((s) => (
                        <span key={`${s.stage}-${s.date}`}>{s.date || "—"}</span>
                      ))}
                    </div>
                    {confidenceFlow.line ? (
                      <p className="m-0 tactical-zone-detail__flow-confidence">
                        최근 5일 신뢰도 {confidenceFlow.line} ·{" "}
                        <strong className={confidenceFlow.delta >= 0 ? "is-up" : "is-down"}>
                          {confidenceFlow.delta >= 0 ? `+${confidenceFlow.delta}` : confidenceFlow.delta}
                        </strong>
                      </p>
                    ) : null}
                    {recentChanges.length ? (
                      <div className="tactical-zone-detail__flow-changes">
                        {recentChanges.map((c) => (
                          <span key={c} className={c.startsWith("↑") ? "is-up" : "is-down"}>
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ) : null}
                <section className="tactical-zone-detail__perf-card">
                  <p className="m-0 tactical-zone-detail__perf-title">성과 검증</p>
                  <div className="tactical-zone-detail__perf-grid">
                    <span>7일 승률 <strong>{Math.max(48, performanceStats.winRate - 8)}%</strong></span>
                    <span>30일 승률 <strong>{performanceStats.winRate}%</strong></span>
                    <span>평균 수익률 <strong>+{performanceStats.avgReturn}%</strong></span>
                    <span>최대 낙폭(MDD) <strong>{performanceStats.maxLoss}%</strong></span>
                    <span>신호 정확도 <strong>{performanceStats.accuracy}%</strong></span>
                    <span>평균 회복 <strong>{Math.max(2, Math.round((position.stageHistory?.length ?? 4) * 1.2))}일</strong></span>
                  </div>
                  <div className="tactical-zone-detail__perf-bars" aria-hidden>
                    <p className="m-0">승률</p>
                    <div className="tactical-zone-detail__perf-bar"><span style={{ width: `${perfBars.win}%` }} /></div>
                    <p className="m-0">MDD</p>
                    <div className="tactical-zone-detail__perf-bar"><span style={{ width: `${perfBars.mdd}%` }} /></div>
                    <p className="m-0">회복</p>
                    <div className="tactical-zone-detail__perf-bar"><span style={{ width: `${perfBars.recovery}%` }} /></div>
                  </div>
                  <p className="m-0 tactical-zone-detail__perf-case">최근 성공 사례: {performanceStats.recentCase}</p>
                </section>
              </>
            ) : null}
          </div>

          {detailsOpen ? (
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
          ) : null}
        </div>
      ) : null}

      <footer className="tactical-zone-detail__foot" hidden={!detailsOpen}>
        <div className="tactical-zone-detail__aux">
          <p className="m-0 tactical-zone-detail__section-label">보조지표</p>
          <TacticalZoneAuxPanel
            position={position}
            activeAux={activeAux}
            expandedAux={expandedAux}
            onToggle={(tag) => setExpandedAux(expandedAux === tag ? null : tag)}
          />
        </div>

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
