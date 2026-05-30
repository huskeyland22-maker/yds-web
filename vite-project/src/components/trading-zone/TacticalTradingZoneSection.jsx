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
  buildPolicyBriefing,
  detectMarketTransition,
} from "../../trading-zone/marketPolicyEngine.js"
import { isDataTraceEnabled } from "../../utils/dataFlowTrace.js"
import { buildTradingZoneStrategyState } from "../../trading-zone/tradingZoneStrategyEngine.js"
import { useTradingZoneStockEvaluations } from "../../trading-zone/useTradingZoneStockEvaluations.js"
import PanicDeskSectionHeader from "../panic-desk/PanicDeskSectionHeader.jsx"
import TacticalEngineLinkBar from "./TacticalEngineLinkBar.jsx"
import TacticalMarketStockBridge from "./TacticalMarketStockBridge.jsx"
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
  const displayScore = evaluation?.dataReady ? evaluation.tacticalScore : null
  const highlights =
    evaluation?.dataReady && evaluation.strengthHighlights?.length
      ? evaluation.strengthHighlights
      : evaluation?.dataReady && evaluation.entryRationale?.length
        ? evaluation.entryRationale.slice(0, 2)
        : []
  const risks = evaluation?.dataReady ? (evaluation.riskFactors ?? []).slice(0, 1) : []
  const strengthScore =
    displayScore ?? (position.stageHistory?.length ?? 0) * 12 + (position.aux?.length ?? 0) * 8
  const strengthTone =
    displayScore != null
      ? displayScore >= 80
        ? "strong"
        : displayScore < 58
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
        {displayScore != null ? (
          <span className="tactical-zone-chip__conf" title="신뢰도">
            신뢰도 {evaluation.confidence}
          </span>
        ) : null}
        {trendLabel ? <span className="tactical-zone-chip__sub">{trendLabel}</span> : null}
      </span>
      {displayScore != null ? (
        <span className="tactical-zone-chip__score" title="실데이터 종목 점수">
          {displayScore}
        </span>
      ) : null}
      {highlights.length || risks.length ? (
        <span className="tactical-zone-chip__signals">
          {highlights.map((line) => (
            <span key={`up-${line}`} className="tactical-zone-chip__signal tactical-zone-chip__signal--up">
              ✓ {line}
            </span>
          ))}
          {risks.map((line) => (
            <span key={`risk-${line}`} className="tactical-zone-chip__signal tactical-zone-chip__signal--risk">
              ⚠ {line}
            </span>
          ))}
        </span>
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
  const [briefIdx, setBriefIdx] = useState(0)
  const [briefFade, setBriefFade] = useState(false)
  const [liveAlerts, setLiveAlerts] = useState(/** @type {string[]} */ ([]))
  const [prevStage, setPrevStage] = useState(/** @type {string | null} */ (null))
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

  const transitionConfidence = marketTransition.transitionConfidence ?? 0
  const showTransitionTag = transitionConfidence >= 40
  const showTransitionHighlight = transitionConfidence >= 70
  const showTransitionStrong = transitionConfidence >= 85
  const tacticalDegrade = useMemo(() => {
    const reasons = []
    /** @type {string[]} */
    const degradeCodes = []
    if (aiReportDegraded) {
      degradeCodes.push("ai_reports_degraded")
      reasons.push("AI 브리핑 일시 지연")
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
  const marketTemperature = useMemo(() => {
    if (marketPolicyView.marketState === "panic") return { emoji: "🔴", label: "패닉", tone: "panic" }
    if (marketPolicyView.marketState === "overheat") return { emoji: "🟠", label: "과열", tone: "hot" }
    if (marketPolicyView.marketState === "pullback" || marketPolicyView.marketState === "caution") {
      return { emoji: "🟡", label: "경계", tone: "warn" }
    }
    return { emoji: "🟢", label: "안정", tone: "stable" }
  }, [marketPolicyView])

  const briefLines = useMemo(() => {
    const fg = Number(panicData?.fearGreed)
    const vix = Number(panicData?.vix)
    const base = [
      Number.isFinite(vix) && vix < 20 ? "VIX 안정 유지" : "VIX 변동성 확대 주의",
      Number.isFinite(fg) && fg >= 65 ? "CNN 탐욕 유지" : "CNN 중립~경계 구간",
      `${marketPolicyView.sectorBias.label}`,
      (selectedPosition?.stageHistory?.length ?? 0) <= 1 ? "거래량 감소 주의" : "거래량 흐름 정상",
    ]
    return base
  }, [panicData, selectedPosition, marketPolicyView.sectorBias.label])

  const aiBriefing = useMemo(() => {
    const volatility =
      Number.isFinite(Number(panicData?.vix)) && Number(panicData?.vix) >= 24
        ? "변동성은 높아졌고"
        : "변동성은 안정적이나"
    const strengthLine = showTransitionStrong
      ? "강한 변화 구간으로 행동 강도를 즉시 재조정합니다."
      : showTransitionHighlight
        ? "의미 있는 변화가 감지되어 행동 우선순위를 조정합니다."
        : showTransitionTag
          ? "약한 변화 신호는 내부 추적 중심으로 반영합니다."
          : "노이즈 구간은 관찰 중심으로 유지합니다."
    return `현재 시장은 ${buildPolicyBriefing(marketPolicyView)} ${volatility} 거래량 변화가 나타나고 있습니다. ${strengthLine}`
  }, [panicData, marketPolicyView, showTransitionStrong, showTransitionHighlight, showTransitionTag])

  useEffect(() => {
    const delay = 6500
    const id = setInterval(() => {
      setBriefFade(true)
      setTimeout(() => {
        setBriefIdx((v) => (v + 1) % Math.max(briefLines.length, 1))
        setBriefFade(false)
      }, 220)
    }, delay)
    return () => clearInterval(id)
  }, [briefLines.length])

  useEffect(() => {
    const alerts = []
    const stage = selectedPosition?.stage ?? null
    if (prevStage && stage && prevStage !== stage) {
      alerts.push(stage === "interest" || stage === "pullback" || stage === "trend" ? "🟢 상태 회복 감지" : "🔴 단기 과열 진입 가능성")
    }
    if (showTransitionTag) {
      alerts.push(showTransitionStrong ? `🚨 강한 변화 감지 ${marketTransition.directionTag}` : marketTransition.directionTag)
    }
    if ((selectedPosition?.stageHistory?.length ?? 0) <= 1) alerts.push("🟡 거래량 둔화 시작")
    const next = alerts.slice(0, 2)
    setLiveAlerts(next)
    setPrevStage(stage)
  }, [selectedPosition, prevStage, marketTransition, showTransitionTag, showTransitionStrong])

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
          <p className="m-0 tactical-trading-zone__engine-sub">시장 상태 → AI 브리핑 → 우선 종목</p>
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
          <TacticalEngineLinkBar link={engineLink} marketPolicy={marketPolicyView} hideTitle />
          <TacticalMarketStockBridge
            bridge={marketStockBridge}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={mode === "live" && stockEvalLoading}
          />
        </div>
      ) : null}

      {tacticalDegrade.recoverable ? (
        <div className="tactical-trading-zone__ultra-summary">
          ⚠ {tacticalDegrade.reasons[0] ?? "일부 데이터 연결 지연"} · 엔진은 정상 동작 중
        </div>
      ) : null}
      {aiReportDegraded ? (
        <div className="tactical-trading-zone__ultra-summary">AI 브리핑 일시 지연</div>
      ) : null}
      {isStaleFeed ? <div className="tactical-trading-zone__ultra-summary">AI 브리핑 데이터 동기화 중</div> : null}

      {!focusMode ? (
        <section className="tactical-trading-zone__ai-briefing" aria-label="AI 브리핑">
          <p className="m-0 tactical-trading-zone__ai-title">🤖 AI 브리핑</p>
          <p className="m-0 tactical-trading-zone__ai-body">{aiBriefing}</p>
          <div className="tactical-trading-zone__ai-inline">
            <span
              className={[
                "tactical-trading-zone__ai-rotating",
                briefFade ? "is-fading" : "",
              ].join(" ")}
            >
              - {briefLines[briefIdx] ?? "시장 상태 점검 중"}
            </span>
            <span className={["tactical-trading-zone__temp", `is-${marketTemperature.tone}`].join(" ")}>
              {marketTemperature.emoji} {marketTemperature.label}
            </span>
          </div>
          {liveAlerts.length || strategyState.transitions.length ? (
            <div className="tactical-trading-zone__alerts">
              {liveAlerts.map((a) => (
                <span key={a} className="tactical-trading-zone__alert-item">
                  {a}
                </span>
              ))}
              {strategyState.transitions.map((t) => (
                <span key={t} className="tactical-trading-zone__alert-item tactical-trading-zone__alert-item--engine">
                  ⚙ {t}
                </span>
              ))}
              {transitionHistory.length ? (
                <span className="tactical-trading-zone__alert-item tactical-trading-zone__alert-item--engine">
                  🧭 최근전환 {transitionHistory[transitionHistory.length - 1]?.marketState} ({transitionHistory[transitionHistory.length - 1]?.transitionConfidence})
                </span>
              ) : null}
            </div>
          ) : null}
          <p className="m-0 tactical-trading-zone__backtest-seed">
            백테스트 준비: 평균 유지기간 · 승률 · MDD · 목표 도달률 (샘플 {strategyState.backtestSeed.sampleSize})
          </p>
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

      <div className="tactical-trading-zone__buckets">
        {TRADING_BUCKET_ORDER.map((bucketId) => (
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
