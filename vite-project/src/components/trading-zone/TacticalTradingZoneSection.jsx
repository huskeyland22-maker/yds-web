import { useEffect, useMemo, useRef, useState } from "react"
import {
  TRADING_BUCKET_META,
  TRADING_BUCKET_ORDER,
  TRADING_MARKETS,
  TRADING_ZONE_TAKE_PROFIT_EMPTY,
  getTradingZonePositions,
  groupPositionsByBucket,
  resolveDefaultTradingPositionId,
  tradingStageBadge,
} from "../../trading-zone/tacticalTradingZoneData.js"
import { buildTradingZoneEngineLink } from "../../trading-zone/tradingZoneEngineLink.js"
import {
  appendTransitionHistory,
  buildMarketPolicy,
  detectMarketTransition,
} from "../../trading-zone/marketPolicyEngine.js"
import { isDataTraceEnabled } from "../../utils/dataFlowTrace.js"
import { getFinalScore } from "../../utils/tradingScores.js"
import { buildTradingZoneStrategyState } from "../../trading-zone/tradingZoneStrategyEngine.js"
import { useTradingZoneStockEvaluations } from "../../trading-zone/useTradingZoneStockEvaluations.js"
import PanicDeskSectionHeader from "../panic-desk/PanicDeskSectionHeader.jsx"
import TacticalEngineLinkBar from "./TacticalEngineLinkBar.jsx"
import TacticalMarketStockBridge from "./TacticalMarketStockBridge.jsx"
import TacticalRecommendationTrack from "./TacticalRecommendationTrack.jsx"
import TacticalStockDetailPanel from "./TacticalStockDetailPanel.jsx"
import { buildMarketStockBridge } from "../../trading-zone/tradingZoneMarketStockBridge.js"

/**
 * @param {{
 *   position: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition
 *   bucketId: import("../../trading-zone/tacticalTradingZoneData.js").TradingBucketId
 *   selected: boolean
 *   evaluation?: import("../../trading-zone/tradingZoneStockEvaluation.js").TradingZoneStockEvaluation | null
 *   onSelect: (id: string) => void
 * }} props
 */
function StockChip({ position, bucketId, selected, onSelect, evaluation = null }) {
  const badge = tradingStageBadge(position)
  const trustScore = evaluation?.dataReady ? evaluation.confidence : null
  const coreReason =
    evaluation?.dataReady && evaluation.strengthHighlights?.[0]
      ? evaluation.strengthHighlights[0]
      : evaluation?.dataReady && evaluation.entryRationale?.[0]
        ? evaluation.entryRationale[0]
        : null
  const strengthScore =
    trustScore ?? (position.stageHistory?.length ?? 0) * 12 + (position.aux?.length ?? 0) * 8
  const strengthTone =
    trustScore != null
      ? trustScore >= 80
        ? "strong"
        : trustScore < 58
          ? "weak"
          : "normal"
      : strengthScore >= 40
        ? "strong"
        : strengthScore <= 20
          ? "weak"
          : "normal"
  const trendLabel =
    position.stage === "trend" && (position.stageHistory?.length ?? 0) >= 3
      ? "🔥 강추세"
      : position.stage === "trend"
        ? "↗ 상승추세 유지"
        : null
  return (
    <button
      type="button"
      onClick={() => onSelect(position.id)}
      className={[
        "tactical-zone-chip",
        evaluation?.dataReady ? "tactical-zone-chip--rich" : "",
        selected ? "tactical-zone-chip--selected" : "",
        bucketId === "pullback" ? "tactical-zone-chip--priority" : "",
        strengthTone === "strong" ? "tactical-zone-chip--strong" : "",
        strengthTone === "weak" ? "tactical-zone-chip--weak" : "",
      ].join(" ")}
    >
      <span className="tactical-zone-chip__main">
        <span className="tactical-zone-chip__name">{position.symbol}</span>
        {trustScore != null ? (
          <span className="tactical-zone-chip__conf font-mono tabular-nums" title="신뢰도">
            {trustScore}
          </span>
        ) : null}
        {trendLabel ? <span className="tactical-zone-chip__sub">{trendLabel}</span> : null}
      </span>
      {coreReason ? (
        <span className="tactical-zone-chip__signal tactical-zone-chip__signal--up">✓ {coreReason}</span>
      ) : null}
      <span
        className="tactical-zone-chip__badge"
        data-stage={position.stage}
        title={badge.label}
      >
        <span aria-hidden>{badge.emoji}</span>
        {badge.label}
      </span>
    </button>
  )
}

/**
 * @param {{
 *   title: string
 *   bucketId: import("../../trading-zone/tacticalTradingZoneData.js").TradingBucketId
 *   positions: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition[]
 *   selectedId: string | null
 *   evalMap?: Record<string, import("../../trading-zone/tradingZoneStockEvaluation.js").TradingZoneStockEvaluation>
 *   onSelect: (id: string) => void
 * }} props
 */
function BucketCard({ title, bucketId, positions, selectedId, onSelect, evalMap = {} }) {
  const sorted = useMemo(() => {
    return [...positions].sort((a, b) => {
      const sa = evalMap[a.id]?.dataReady ? evalMap[a.id].tacticalScore : 0
      const sb = evalMap[b.id]?.dataReady ? evalMap[b.id].tacticalScore : 0
      return sb - sa
    })
  }, [positions, evalMap])

  return (
    <div className="tactical-zone-bucket" data-bucket={bucketId}>
      <p className="m-0 tactical-zone-bucket__title">{title}</p>
      <div className="tactical-zone-bucket__list">
        {sorted.length === 0 ? (
          bucketId === "takeProfit" ? (
            <ul className="tactical-zone-bucket__empty-stack">
              <li className="tactical-zone-bucket__empty">
                📌 {TRADING_ZONE_TAKE_PROFIT_EMPTY.status}
              </li>
              <li className="tactical-zone-bucket__empty-sub">
                • +15% 도달 시 1차 분할
              </li>
              <li className="tactical-zone-bucket__empty-sub">
                • 거래량 이탈 시 일부 축소
              </li>
              <li className="tactical-zone-bucket__empty-sub">
                📌 {TRADING_ZONE_TAKE_PROFIT_EMPTY.partial}
              </li>
            </ul>
          ) : (
            <span className="tactical-zone-bucket__empty">—</span>
          )
        ) : (
          sorted.map((p) => (
            <StockChip
              key={p.id}
              position={p}
              bucketId={bucketId}
              selected={selectedId === p.id}
              evaluation={evalMap[p.id] ?? null}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}

/**
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../../macro-risk/engine.js").MacroRiskSnapshot | null
 *   historyRows?: object[]
 *   aiReportDegraded?: boolean
 *   aiReportWarning?: string | null
 * }} props
 */
export default function TacticalTradingZoneSection({
  panicData = null,
  cycleScore = null,
  snapshot = null,
  historyRows = [],
  aiReportDegraded = false,
  aiReportWarning = null,
}) {
  const positions = useMemo(() => getTradingZonePositions(), [])
  const [market, setMarket] = useState("us")
  const [mode, setMode] = useState(/** @type {"live" | "analysis"} */ ("live"))
  const [focusMode, setFocusMode] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(max-width: 640px)").matches
  })
  const [marketTransition, setMarketTransition] = useState(() => ({
    changed: false,
    transitionState: "no-change",
    transitionStrength: "low",
    transitionLabel: "상태 유지",
    directionTag: "→ 상태 유지",
    transitionConfidence: 0,
    visibility: "hidden",
  }))
  const [transitionHistory, setTransitionHistory] = useState(/** @type {Array<{ at: string; marketState: string; transitionLabel: string; transitionConfidence: number }>} */ ([]))
  const prevPolicyRef = useRef(/** @type {ReturnType<typeof buildMarketPolicy> | null} */ (null))
  const lastStablePolicyRef = useRef(/** @type {ReturnType<typeof buildMarketPolicy> | null} */ (null))
  const [selectedId, setSelectedId] = useState(() => {
    const us = positions.filter((p) => p.market === "us")
    return resolveDefaultTradingPositionId("us", us)
  })

  const engineLink = useMemo(
    () => buildTradingZoneEngineLink({ panicData, cycleScore, snapshot, historyRows }),
    [panicData, cycleScore, snapshot, historyRows],
  )
  const panicScore = useMemo(() => getFinalScore(panicData), [panicData])

  const strategyState = useMemo(
    () =>
      buildTradingZoneStrategyState({
        positions,
        panicData,
        engineLink,
        disableStageShift: mode === "live",
      }),
    [positions, panicData, engineLink, mode],
  )

  const baseMarketPolicy = useMemo(() => buildMarketPolicy({ panicData }), [panicData])

  const { evalMap, enrichedPositions, loading: stockEvalLoading } = useTradingZoneStockEvaluations({
    positions: strategyState.adjustedPositions,
    market,
    panicData,
    macroBehavior: strategyState.behavior,
    marketPolicy: baseMarketPolicy,
    cycleScore,
    enabled: mode === "live",
  })

  const livePositions = mode === "live" ? enrichedPositions : strategyState.adjustedPositions

  const bucketGroups = useMemo(
    () => groupPositionsByBucket(market, livePositions),
    [market, livePositions],
  )

  const visibleBuckets = useMemo(
    () => TRADING_BUCKET_ORDER.filter((bucketId) => (bucketGroups[bucketId]?.length ?? 0) > 0),
    [bucketGroups],
  )

  const marketPositions = useMemo(
    () => livePositions.filter((p) => p.market === market),
    [livePositions, market],
  )

  const selectedPosition = useMemo(
    () => marketPositions.find((p) => p.id === selectedId) ?? null,
    [marketPositions, selectedId],
  )

  const onMarketChange = (id) => {
    setMarket(id)
    const next = positions.filter((p) => p.market === id)
    setSelectedId(resolveDefaultTradingPositionId(id, next))
  }
  const marketPolicy = useMemo(
    () => buildMarketPolicy({ panicData, position: selectedPosition }),
    [panicData, selectedPosition],
  )
  const isStaleFeed = Boolean(panicData?.isStale ?? panicData?.__isStale)
  useEffect(() => {
    if (!isStaleFeed) lastStablePolicyRef.current = marketPolicy
  }, [isStaleFeed, marketPolicy])
  const effectivePolicy = useMemo(
    () => (isStaleFeed && lastStablePolicyRef.current ? lastStablePolicyRef.current : marketPolicy),
    [isStaleFeed, marketPolicy],
  )
  useEffect(() => {
    const transition = detectMarketTransition(prevPolicyRef.current, effectivePolicy)
    setMarketTransition(transition)
    setTransitionHistory((history) => appendTransitionHistory(history, transition, effectivePolicy))
    prevPolicyRef.current = effectivePolicy
  }, [effectivePolicy])
  const marketPolicyView = useMemo(
    () => ({ ...effectivePolicy, marketTransition, dataDelay: isStaleFeed }),
    [effectivePolicy, marketTransition, isStaleFeed],
  )

  const marketStockBridge = useMemo(
    () =>
      buildMarketStockBridge({
        positions: livePositions,
        evalMap,
        marketPolicy: marketPolicyView,
        panicData,
        market,
      }),
    [livePositions, evalMap, marketPolicyView, panicData, market],
  )

  const recommendPriorityIds = useMemo(
    () => marketStockBridge.priorities?.map((p) => p.id) ?? [],
    [marketStockBridge.priorities],
  )

  const recommendLiveById = useMemo(() => {
    /** @type {Record<string, { price?: number | null }>} */
    const out = {}
    for (const [id, ev] of Object.entries(evalMap)) {
      const price = ev?.priceZones?.current
      if (Number.isFinite(price)) out[id] = { price }
    }
    return out
  }, [evalMap])

  const tacticalDegrade = useMemo(() => {
    const reasons = []
    /** @type {string[]} */
    const degradeCodes = []
    if (aiReportDegraded) {
      degradeCodes.push("ai_reports_degraded")
    }
    if (isStaleFeed) {
      degradeCodes.push("stale_mode")
      reasons.push("마지막 정상 정책 유지 중")
    }
    if (/timeout/i.test(String(aiReportWarning ?? ""))) {
      degradeCodes.push("timeout")
      reasons.push("일부 데이터 연결 지연")
    }
    if (!engineLink?.ready || !selectedPosition) {
      degradeCodes.push("tactical_partial")
      reasons.push("일부 종목 데이터 재동기화 중")
    }
    const fatal = !marketPolicyView?.marketState || !marketPolicyView?.actionLines
    if (fatal) degradeCodes.push("fatal_policy")
    return {
      fatal,
      recoverable: degradeCodes.some((c) => c !== "fatal_policy"),
      degradeCode: degradeCodes[0] ?? "none",
      reasons,
      source: aiReportDegraded ? "ai_reports" : isStaleFeed ? "stale_feed" : "tactical",
    }
  }, [aiReportDegraded, aiReportWarning, isStaleFeed, engineLink, selectedPosition, marketPolicyView])
  useEffect(() => {
    if (!tacticalDegrade.recoverable && !tacticalDegrade.fatal) return
    if (!isDataTraceEnabled()) return
    console.log("[Tactical Degrade]", {
      reason: tacticalDegrade.reasons.join(" | "),
      degradeCode: tacticalDegrade.degradeCode,
      source: tacticalDegrade.source,
    })
  }, [tacticalDegrade])
  useEffect(() => {
    if (typeof window === "undefined") return
    const dump = {
      marketState: marketPolicyView.marketState,
      riskLevel: marketPolicyView.riskLevel,
      transitionState: marketPolicyView.marketTransition?.transitionState,
      transitionStrength: marketPolicyView.marketTransition?.transitionStrength,
      confidence: marketPolicyView.marketTransition?.transitionConfidence ?? 0,
      actionLines: marketPolicyView.actionLines,
      stale: Boolean(marketPolicyView.dataDelay),
      at: new Date().toISOString(),
    }
    window.__YDS_POLICY__ = dump
    console.table([dump])
  }, [marketPolicyView])
  const aiBriefSummary = useMemo(() => {
    const vix = Number(panicData?.vix)
    const state = marketPolicyView.marketState ?? "neutral"
    let posture = "종목 탐색 우세"
    if (state === "overheat" || state === "panic") posture = "현금·방어 우세"
    else if (state === "pullback" || state === "caution") posture = "눌림 대기 우세"
    else if (Number.isFinite(vix) && vix >= 22) posture = "변동성 경계 우세"

    const caution = marketPolicyView.actionLines?.caution ?? "추격 금지"
    const chaseLine = /추격/.test(caution) ? caution : "추격 금지"

    const symbols = marketStockBridge.priorities
      .slice(0, 3)
      .map((p) => p.symbol)
      .join(" · ")
    const priorityLine = symbols ? `우선 종목 ${symbols}` : "우선 종목 선정 중"

    return [posture, chaseLine, priorityLine]
  }, [panicData, marketPolicyView, marketStockBridge.priorities])

  if (tacticalDegrade.fatal) {
    return (
      <section className="tactical-trading-zone trading-card-shell panic-v2-section panic-desk-section panic-desk-section--main overflow-hidden px-2 pb-2 sm:px-2.5">
        <p className="m-0 text-sm font-semibold text-amber-300">⚠ 일부 데이터 연결 지연</p>
        <p className="m-0 mt-1 text-xs text-slate-300">마지막 정상 정책을 유지하며 자동 복구를 시도 중입니다.</p>
      </section>
    )
  }

  return (
    <section className="tactical-trading-zone trading-card-shell panic-v2-section panic-desk-section panic-desk-section--main overflow-hidden px-2 pb-2 sm:px-2.5">
      <PanicDeskSectionHeader
        icon="🎯"
        title="실전 매매존"
        description="미국·한국 실전 진입 관리"
        tone="green"
        tier="main"
      />

      <hr className="tactical-trading-zone__divider" aria-hidden />

      <div className="tactical-trading-zone__hud-head">
        <div className="tactical-trading-zone__engine-head">
          <p className="m-0 tactical-trading-zone__engine-title">
            <span aria-hidden>📈</span> 시장 엔진 연계
          </p>
          <p className="m-0 tactical-trading-zone__engine-sub">시장 상태 → 오늘 행동 → 우선 종목</p>
        </div>
        <button
          type="button"
          className={["tactical-trading-zone__focus-btn", focusMode ? "is-on" : ""].join(" ")}
          onClick={() => setFocusMode((v) => !v)}
          aria-pressed={focusMode}
        >
          {focusMode ? "Focus ON" : "Focus OFF"}
        </button>
      </div>

      {!focusMode ? (
        <div className="tactical-trading-zone__engine">
          <TacticalEngineLinkBar
            link={engineLink}
            marketPolicy={marketPolicyView}
            panicScore={panicScore}
            hideTitle
          />
          <TacticalMarketStockBridge
            bridge={marketStockBridge}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={mode === "live" && stockEvalLoading}
          />
          <TacticalRecommendationTrack
            positions={livePositions}
            priorityIds={recommendPriorityIds}
            liveById={recommendLiveById}
          />
        </div>
      ) : null}

      {!focusMode ? (
        <section className="tactical-trading-zone__ai-briefing" aria-label="AI 브리핑">
          <p className="m-0 tactical-trading-zone__ai-title">🤖 AI 브리핑</p>
          <ul className="m-0 tactical-trading-zone__ai-lines">
            {aiBriefSummary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {!focusMode ? (
        <div className="tactical-trading-zone__mode-toggle" role="tablist" aria-label="실전/분석 모드">
          <button
            type="button"
            className={["tactical-trading-zone__mode-btn", mode === "live" ? "is-active" : ""].join(" ")}
            onClick={() => setMode("live")}
            role="tab"
            aria-selected={mode === "live"}
          >
            실전 모드
          </button>
          <button
            type="button"
            className={["tactical-trading-zone__mode-btn", mode === "analysis" ? "is-active" : ""].join(" ")}
            onClick={() => setMode("analysis")}
            role="tab"
            aria-selected={mode === "analysis"}
          >
            분석 모드
          </button>
        </div>
      ) : null}

      {mode === "live" && stockEvalLoading ? (
        <p className="m-0 tactical-trading-zone__stock-sync" role="status">
          📡 종목 실데이터 평가 중…
        </p>
      ) : null}

      <div className="tactical-trading-zone__tabs">
        {Object.values(TRADING_MARKETS).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onMarketChange(m.id)}
            className={[
              "tactical-trading-zone__tab",
              market === m.id ? "tactical-trading-zone__tab--active" : "",
            ].join(" ")}
            aria-pressed={market === m.id}
          >
            <span aria-hidden>{m.flag}</span> {m.label}
          </button>
        ))}
      </div>

      {visibleBuckets.length ? (
        <div
          className="tactical-trading-zone__buckets"
          style={{ "--bucket-cols": visibleBuckets.length }}
        >
          {visibleBuckets.map((bucketId) => (
            <BucketCard
              key={bucketId}
              bucketId={bucketId}
              title={TRADING_BUCKET_META[bucketId].title}
              positions={bucketGroups[bucketId]}
              selectedId={selectedId}
              evalMap={evalMap}
              onSelect={setSelectedId}
            />
          ))}
        </div>
      ) : null}

      {selectedPosition ? (
        <div className="tactical-trading-zone__detail">
          <TacticalStockDetailPanel
            position={selectedPosition}
            mode={mode}
            panicData={panicData}
            marketPolicy={marketPolicyView}
            focusMode={focusMode}
            stockEvaluation={evalMap[selectedPosition.id] ?? null}
            stockEvalLoading={stockEvalLoading}
          />
        </div>
      ) : null}
    </section>
  )
}
