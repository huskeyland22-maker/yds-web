import { useEffect, useMemo, useState } from "react"
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
import { buildTradingZoneStrategyState } from "../../trading-zone/tradingZoneStrategyEngine.js"
import PanicDeskSectionHeader from "../panic-desk/PanicDeskSectionHeader.jsx"
import TacticalEngineLinkBar from "./TacticalEngineLinkBar.jsx"
import TacticalStockDetailPanel from "./TacticalStockDetailPanel.jsx"

/**
 * @param {{
 *   position: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition
 *   bucketId: import("../../trading-zone/tacticalTradingZoneData.js").TradingBucketId
 *   selected: boolean
 *   onSelect: (id: string) => void
 * }} props
 */
function StockChip({ position, bucketId, selected, onSelect }) {
  const badge = tradingStageBadge(position)
  const strengthScore = (position.stageHistory?.length ?? 0) * 12 + (position.aux?.length ?? 0) * 8
  const strengthTone = strengthScore >= 40 ? "strong" : strengthScore <= 20 ? "weak" : "normal"
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
        selected ? "tactical-zone-chip--selected" : "",
        bucketId === "pullback" ? "tactical-zone-chip--priority" : "",
        strengthTone === "strong" ? "tactical-zone-chip--strong" : "",
        strengthTone === "weak" ? "tactical-zone-chip--weak" : "",
      ].join(" ")}
    >
      <span className="tactical-zone-chip__main">
        <span className="tactical-zone-chip__name">{position.symbol}</span>
        {trendLabel ? <span className="tactical-zone-chip__sub">{trendLabel}</span> : null}
      </span>
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
 *   onSelect: (id: string) => void
 * }} props
 */
function BucketCard({ title, bucketId, positions, selectedId, onSelect }) {
  return (
    <div className="tactical-zone-bucket" data-bucket={bucketId}>
      <p className="m-0 tactical-zone-bucket__title">{title}</p>
      <div className="tactical-zone-bucket__list">
        {positions.length === 0 ? (
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
          positions.map((p) => (
            <StockChip
              key={p.id}
              position={p}
              bucketId={bucketId}
              selected={selectedId === p.id}
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
 * }} props
 */
export default function TacticalTradingZoneSection({
  panicData = null,
  cycleScore = null,
  snapshot = null,
  historyRows = [],
}) {
  const positions = useMemo(() => getTradingZonePositions(), [])
  const [market, setMarket] = useState("us")
  const [mode, setMode] = useState(/** @type {"live" | "analysis"} */ ("live"))
  const [briefIdx, setBriefIdx] = useState(0)
  const [briefFade, setBriefFade] = useState(false)
  const [liveAlerts, setLiveAlerts] = useState(/** @type {string[]} */ ([]))
  const [prevStage, setPrevStage] = useState(/** @type {string | null} */ (null))
  const [selectedId, setSelectedId] = useState(() => {
    const us = positions.filter((p) => p.market === "us")
    return resolveDefaultTradingPositionId("us", us)
  })

  const engineLink = useMemo(
    () => buildTradingZoneEngineLink({ panicData, cycleScore, snapshot, historyRows }),
    [panicData, cycleScore, snapshot, historyRows],
  )

  const strategyState = useMemo(
    () => buildTradingZoneStrategyState({ positions, panicData, engineLink }),
    [positions, panicData, engineLink],
  )

  const bucketGroups = useMemo(
    () => groupPositionsByBucket(market, strategyState.adjustedPositions),
    [market, strategyState.adjustedPositions],
  )

  const marketPositions = useMemo(
    () => strategyState.adjustedPositions.filter((p) => p.market === market),
    [strategyState.adjustedPositions, market],
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
  const actionBanner = useMemo(() => {
    if (!selectedPosition) return "🟢 종목 선택 후 실전 행동 가이드를 확인하세요"
    const byStage = {
      interest: "🟢 지금은 관심 유지 + 눌림 대기 구간",
      pullback: "🟡 추가 진입 가능하지만 추격 금지",
      trend: "🔵 추세 유지 중 · 비중 분할 대응",
      takeProfit: "🟠 목표 접근 · 분할 익절 준비",
      risk: "🔴 과열 가능성 증가 → 현금 비중 고려",
    }
    const local = byStage[selectedPosition.stage] ?? "🟢 실전 행동 가이드 확인"
    return strategyState.banner ? `${strategyState.banner} | ${local}` : local
  }, [selectedPosition, strategyState.banner])

  const marketTemperature = useMemo(() => {
    const fg = Number(panicData?.fearGreed)
    const vix = Number(panicData?.vix)
    const stage = selectedPosition?.stage
    if ((Number.isFinite(vix) && vix >= 35) || stage === "risk") return { emoji: "🔴", label: "패닉", tone: "panic" }
    if ((Number.isFinite(fg) && fg >= 75) || stage === "takeProfit") return { emoji: "🟠", label: "과열", tone: "hot" }
    if ((Number.isFinite(vix) && vix >= 24) || stage === "pullback") return { emoji: "🟡", label: "경계", tone: "warn" }
    return { emoji: "🟢", label: "안정", tone: "stable" }
  }, [panicData, selectedPosition])

  const briefLines = useMemo(() => {
    const fg = Number(panicData?.fearGreed)
    const vix = Number(panicData?.vix)
    const base = [
      Number.isFinite(vix) && vix < 20 ? "VIX 안정 유지" : "VIX 변동성 확대 주의",
      Number.isFinite(fg) && fg >= 65 ? "CNN 탐욕 유지" : "CNN 중립~경계 구간",
      selectedPosition?.stage === "trend" ? "반도체 강세 지속" : "눌림 대기 전략 유리",
      (selectedPosition?.stageHistory?.length ?? 0) <= 1 ? "거래량 감소 주의" : "거래량 흐름 정상",
    ]
    return base
  }, [panicData, selectedPosition])

  const aiBriefing = useMemo(() => {
    const stageText = {
      interest: "관심 유지 구간입니다.",
      pullback: "눌림 재진입 구간입니다.",
      trend: "추세 확장 구간입니다.",
      takeProfit: "익절 관리 구간입니다.",
      risk: "리스크 관리 우선 구간입니다.",
    }[selectedPosition?.stage ?? "interest"]
    const volatility =
      Number.isFinite(Number(panicData?.vix)) && Number(panicData?.vix) >= 24
        ? "변동성은 높아졌고"
        : "변동성은 안정적이나"
    return `현재 시장은 ${stageText} ${volatility} 거래량 변화가 나타나고 있습니다. 추격 매수보다는 눌림 대기 전략이 유리합니다.`
  }, [panicData, selectedPosition])

  const actionPriority = useMemo(
    () => ["1. 눌림 대기", "2. 추격 금지", "3. 거래량 확인"],
    [],
  )

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
    if ((selectedPosition?.stageHistory?.length ?? 0) <= 1) alerts.push("🟡 거래량 둔화 시작")
    const next = alerts.slice(0, 2)
    setLiveAlerts(next)
    setPrevStage(stage)
  }, [selectedPosition, prevStage])

  return (
    <section className="tactical-trading-zone trading-card-shell panic-v2-section panic-desk-section panic-desk-section--green overflow-hidden px-2 pb-2 sm:px-2.5">
      <PanicDeskSectionHeader
        icon="🎯"
        title="실전 매매존"
        description="미국·한국 실전 진입 관리"
        tone="green"
        compact
      />

      <hr className="tactical-trading-zone__divider" aria-hidden />

      <div className="tactical-trading-zone__engine-head">
        <p className="m-0 tactical-trading-zone__engine-title">
          <span aria-hidden>📈</span> 시장 엔진 연계
        </p>
        <p className="m-0 tactical-trading-zone__engine-sub">시장 상태 → 종목 실행</p>
      </div>

      <div className="tactical-trading-zone__engine">
        <TacticalEngineLinkBar link={engineLink} hideTitle />
      </div>

      <div className="tactical-trading-zone__action-banner">{actionBanner}</div>

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
            시장 온도 {marketTemperature.emoji} {marketTemperature.label}
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
          </div>
        ) : null}
        <div className="tactical-trading-zone__priority">
          <p className="m-0 tactical-trading-zone__priority-k">오늘 우선 행동</p>
          <div className="tactical-trading-zone__priority-lines">
            {actionPriority.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
        <p className="m-0 tactical-trading-zone__backtest-seed">
          백테스트 준비: 평균 유지기간 · 승률 · MDD · 목표 도달률 (샘플 {strategyState.backtestSeed.sampleSize})
        </p>
      </section>

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
            onSelect={setSelectedId}
          />
        ))}
      </div>

      {selectedPosition ? (
        <div className="tactical-trading-zone__detail">
          <TacticalStockDetailPanel position={selectedPosition} mode={mode} panicData={panicData} />
        </div>
      ) : null}
    </section>
  )
}
