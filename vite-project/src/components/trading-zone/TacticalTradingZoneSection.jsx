import { useEffect, useMemo, useRef, useState } from "react"
import {
  TRADING_BUCKET_META,
  TRADING_MARKETS,
  TRADING_ZONE_TAKE_PROFIT_EMPTY,
  getTradingZonePositions,
  resolveDefaultTradingPositionId,
  tradingStageBadge,
} from "../../trading-zone/tacticalTradingZoneData.js"
import {
  LIVE_DISPLAY_BUCKET_ORDER,
  buildLiveTradingBuckets,
} from "../../trading-zone/tradingZoneLiveBuckets.js"
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
import TacticalConfidenceGrade from "./TacticalConfidenceGrade.jsx"
import StockPickReasonList from "./StockPickReasonList.jsx"
import { buildStockDisplayReasons } from "../../trading-zone/tradingZoneStockDisplayReasons.js"
import { buildMarketStockBridge } from "../../trading-zone/tradingZoneMarketStockBridge.js"
import { buildRecommendationTrackRows, formatRecommendPriceRangeCompact } from "../../trading-zone/tradingZoneRecommendationTrack.js"
import { STAGE_STATUS_SHORT } from "../../trading-zone/tradingZoneDetailMobile.js"

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
  const watchLabel =
    evaluation?.dataReady && evaluation.signalId === "watch"
      ? "관망·대기"
      : evaluation?.dataReady && evaluation.signalLabel
        ? evaluation.signalLabel
        : STAGE_STATUS_SHORT[position.stage] ?? "관망"
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
      <span className="tactical-zone-chip__head">
        <span className="tactical-zone-chip__name">{position.symbol}</span>
        {trustScore != null ? (
          <>
            <span className="tactical-zone-chip__score font-mono tabular-nums">{trustScore}</span>
            <TacticalConfidenceGrade score={trustScore} compact className="tactical-zone-chip__grade" />
          </>
        ) : null}
        <span
          className="tactical-zone-chip__badge"
          data-stage={position.stage}
          title={badge.label}
        >
          <span className="tactical-zone-chip__badge-dot" aria-hidden>
            ●
          </span>
          <span className="tactical-zone-chip__badge-label">{badge.label}</span>
        </span>
      </span>
      <span className="tactical-zone-chip__watch">{watchLabel}</span>
    </button>
  )
}

/**
 * @param {{
 *   title: string
 *   subtitle?: string
 *   bucketId: import("../../trading-zone/tacticalTradingZoneData.js").TradingBucketId
 *   positions: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition[]
 *   selectedId: string | null
 *   evalMap?: Record<string, import("../../trading-zone/tradingZoneStockEvaluation.js").TradingZoneStockEvaluation>
 *   onSelect: (id: string) => void
 * }} props
 */
/**
 * @param {{
 *   position: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition
 *   confidence: number | null
 *   evaluation?: import("../../trading-zone/tradingZoneStockEvaluation.js").TradingZoneStockEvaluation | null
 *   reasons?: string[]
 *   selected: boolean
 *   onSelect: (id: string) => void
 * }} props
 */
function TodayPickCard({
  position,
  confidence,
  evaluation = null,
  reasons = [],
  selected,
  onSelect,
  marketPolicy = null,
  recommendRows = [],
}) {
  const badge = tradingStageBadge(position)
  const displayReasons =
    reasons.length > 0
      ? reasons
      : buildStockDisplayReasons(position, evaluation, { limit: 3 })
  const [detailOpen, setDetailOpen] = useState(false)
  const zones = evaluation?.priceZones ?? null
  const goalRate = (() => {
    const entry = Number(zones?.entryNum)
    const target = Number(zones?.targetNum)
    const current = Number(zones?.current)
    if (!Number.isFinite(entry) || !Number.isFinite(target) || !Number.isFinite(current) || target <= entry) return null
    const raw = ((current - entry) / (target - entry)) * 100
    return Math.max(0, Math.min(100, Math.round(raw)))
  })()
  const todayAction = marketPolicy?.actionLines?.primary ?? "종목 탐색 우선"
  const myRecs = recommendRows.filter((r) => r.symbol === position.symbol)
  const latestRec = myRecs[0] ?? null

  return (
    <section className="tactical-zone-today-pick" aria-label="오늘의 추천">
      <p className="m-0 tactical-zone-today-pick__kicker">오늘의 추천</p>
      <button
        type="button"
        className={["tactical-zone-today-pick__card", selected ? "tactical-zone-today-pick__card--selected" : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={() => onSelect(position.id)}
      >
        <div className="tactical-zone-today-pick__head-row">
          <span className="tactical-zone-today-pick__symbol">{position.symbol}</span>
          {confidence != null ? (
            <span className="tactical-zone-today-pick__score-wrap">
              <span className="tactical-zone-today-pick__score-label">신뢰도</span>
              <span className="tactical-zone-today-pick__score font-mono tabular-nums">{confidence}</span>
              <TacticalConfidenceGrade score={confidence} compact className="tactical-zone-today-pick__grade" />
            </span>
          ) : null}
        </div>
        <span className="tactical-zone-today-pick__badge" data-stage={position.stage}>
          <span aria-hidden>●</span>
          {badge.label}
        </span>
        <div className="tactical-zone-today-pick__meta-grid">
          <p className="m-0 tactical-zone-today-pick__meta-row">
            <span>현재 구간</span>
            <strong>{badge.label}</strong>
          </p>
          <p className="m-0 tactical-zone-today-pick__meta-row">
            <span>목표도달률</span>
            <strong className="font-mono tabular-nums">{goalRate != null ? `${goalRate}%` : "—"}</strong>
          </p>
          <p className="m-0 tactical-zone-today-pick__meta-row tactical-zone-today-pick__meta-row--full">
            <span>오늘 행동</span>
            <strong>{todayAction}</strong>
          </p>
        </div>
        {displayReasons.length ? (
          <div className="tactical-zone-today-pick__reasons-block">
            <p className="m-0 tactical-zone-today-pick__reasons-title">추천 이유</p>
            <StockPickReasonList reasons={displayReasons} max={3} />
          </div>
        ) : evaluation?.dataReady && evaluation.signalLabel ? (
          <span className="tactical-zone-today-pick__hint">{evaluation.signalLabel}</span>
        ) : null}
        <span
          role="button"
          tabIndex={0}
          className="tactical-zone-today-pick__detail-toggle"
          onClick={(e) => {
            e.stopPropagation()
            setDetailOpen((v) => !v)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              e.stopPropagation()
              setDetailOpen((v) => !v)
            }
          }}
        >
          {detailOpen ? "상세 닫기 ▲" : "상세 보기 ▼"}
        </span>
        {detailOpen ? (
          <div className="tactical-zone-today-pick__detail-panel">
            <div className="tactical-zone-today-pick__progress">
              <p className="m-0 tactical-zone-today-pick__detail-title">가격 위치 바</p>
              <div className="tactical-zone-today-pick__progress-bar">
                <span style={{ width: `${goalRate ?? 0}%` }} />
              </div>
              <p className="m-0 tactical-zone-today-pick__progress-caption">
                {formatRecommendPriceRangeCompact(zones?.entryNum, zones?.current, position.market)} / 목표{" "}
                {formatRecommendPriceRangeCompact(zones?.targetNum, zones?.targetNum, position.market)}
              </p>
            </div>
            <div className="tactical-zone-today-pick__history">
              <p className="m-0 tactical-zone-today-pick__detail-title">추천 성과 기록</p>
              <p className="m-0 tactical-zone-today-pick__history-line">
                {latestRec
                  ? `${latestRec.recommendedAt} · ${
                      latestRec.returnPct != null
                        ? `${latestRec.returnPct > 0 ? "+" : ""}${latestRec.returnPct.toFixed(1)}%`
                        : "—"
                    }`
                  : "기록 없음"}
              </p>
              <p className="m-0 tactical-zone-today-pick__detail-title">과거 추천 내역</p>
              <ul className="m-0 tactical-zone-today-pick__history-list">
                {myRecs.slice(0, 3).map((r) => (
                  <li key={`${r.id}-${r.recommendedAt}`}>{`${r.recommendedAt} · ${formatRecommendPriceRangeCompact(
                    r.recommendedPrice,
                    r.currentPrice,
                    r.market,
                  )}`}</li>
                ))}
                {!myRecs.length ? <li>기록 없음</li> : null}
              </ul>
            </div>
          </div>
        ) : null}
      </button>
    </section>
  )
}

function BucketCard({ title, subtitle, bucketId, positions, selectedId, onSelect, evalMap = {} }) {
  const sorted = useMemo(() => {
    return [...positions].sort((a, b) => {
      const sa = evalMap[a.id]?.dataReady ? evalMap[a.id].tacticalScore : 0
      const sb = evalMap[b.id]?.dataReady ? evalMap[b.id].tacticalScore : 0
      return sb - sa
    })
  }, [positions, evalMap])

  return (
    <div className="tactical-zone-bucket" data-bucket={bucketId}>
      <p className="m-0 tactical-zone-bucket__title">
        {title}
        {subtitle ? <span className="tactical-zone-bucket__subtitle">{subtitle}</span> : null}
      </p>
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
        disableStageShift: true,
      }),
    [positions, panicData, engineLink],
  )

  const baseMarketPolicy = useMemo(() => buildMarketPolicy({ panicData }), [panicData])

  const { evalMap, enrichedPositions, loading: stockEvalLoading } = useTradingZoneStockEvaluations({
    positions: strategyState.adjustedPositions,
    market,
    panicData,
    macroBehavior: strategyState.behavior,
    marketPolicy: baseMarketPolicy,
    cycleScore,
    enabled: true,
  })

  const livePositions = enrichedPositions

  const liveBuckets = useMemo(
    () =>
      buildLiveTradingBuckets({
        positions: livePositions,
        evalMap,
        market,
        panicData,
      }),
    [livePositions, evalMap, market, panicData],
  )

  const interestPositions = liveBuckets.buckets.interest ?? []
  const secondaryBucketIds = useMemo(
    () =>
      LIVE_DISPLAY_BUCKET_ORDER.filter(
        (bucketId) => bucketId !== "interest" && (liveBuckets.buckets[bucketId]?.length ?? 0) > 0,
      ),
    [liveBuckets],
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
    const marketPositions = livePositions.filter((p) => p.market === id)
    const buckets = buildLiveTradingBuckets({
      positions: livePositions,
      evalMap,
      market: id,
      panicData,
    })
    setSelectedId(
      buckets.todayPick?.id ?? resolveDefaultTradingPositionId(id, marketPositions),
    )
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
  const recommendRows = useMemo(
    () => buildRecommendationTrackRows(livePositions, recommendPriorityIds, recommendLiveById),
    [livePositions, recommendPriorityIds, recommendLiveById],
  )

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
        description="오늘의 추천 · 관심 · 추세 — 신뢰도 자동 분류"
        tone="sky"
        tier="main"
      />

      <hr className="tactical-trading-zone__divider" aria-hidden />

      <div className="tactical-trading-zone__engine">
        <TacticalEngineLinkBar
          link={engineLink}
          marketPolicy={marketPolicyView}
          panicScore={panicScore}
          panicData={panicData}
          hideTitle
        />
      </div>

      <TacticalMarketStockBridge
        bridge={marketStockBridge}
        selectedId={selectedId}
        onSelect={setSelectedId}
        loading={stockEvalLoading}
      />

      <section className="tactical-trading-zone__ai-briefing" aria-label="AI 브리핑">
        <p className="m-0 tactical-trading-zone__ai-title">🤖 AI 브리핑</p>
        <ul className="m-0 tactical-trading-zone__ai-lines">
          {aiBriefSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      {stockEvalLoading ? (
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

      {interestPositions.length ? (
        <BucketCard
          bucketId="interest"
          title={TRADING_BUCKET_META.interest.title}
          subtitle={TRADING_BUCKET_META.interest.hint}
          positions={interestPositions}
          selectedId={selectedId}
          evalMap={evalMap}
          onSelect={setSelectedId}
        />
      ) : null}

      {liveBuckets.todayPick ? (
        <TodayPickCard
          position={liveBuckets.todayPick}
          confidence={liveBuckets.todayPickConfidence}
          evaluation={evalMap[liveBuckets.todayPick.id] ?? null}
          reasons={
            marketStockBridge.priorities.find((p) => p.id === liveBuckets.todayPick?.id)?.reasons ?? []
          }
          marketPolicy={marketPolicyView}
          recommendRows={recommendRows}
          selected={selectedId === liveBuckets.todayPick.id}
          onSelect={setSelectedId}
        />
      ) : null}

      {secondaryBucketIds.length ? (
        <div
          className="tactical-trading-zone__buckets"
          style={{ "--bucket-cols": secondaryBucketIds.length }}
        >
          {secondaryBucketIds.map((bucketId) => (
            <BucketCard
              key={bucketId}
              bucketId={bucketId}
              title={TRADING_BUCKET_META[bucketId].title}
              subtitle={TRADING_BUCKET_META[bucketId].hint}
              positions={liveBuckets.buckets[bucketId]}
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
            panicData={panicData}
            marketPolicy={marketPolicyView}
            stockEvaluation={evalMap[selectedPosition.id] ?? null}
            stockEvalLoading={stockEvalLoading}
          />
        </div>
      ) : null}

      <TacticalRecommendationTrack
        positions={livePositions}
        priorityIds={recommendPriorityIds}
        liveById={recommendLiveById}
      />
    </section>
  )
}
