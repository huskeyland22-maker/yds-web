import { useMemo } from "react"
import { TRADING_STAGE_META, tradingStageBadge } from "../../trading-zone/tacticalTradingZoneData.js"
import {
  computeTradingZoneProgress,
  resolvePositionPriceLevels,
} from "../../trading-zone/tradingZonePriceProgress.js"
import { buildMarketPolicy } from "../../trading-zone/marketPolicyEngine.js"
import { buildTradingConfidenceBreakdown } from "../../trading-zone/tradingZoneConfidenceEngine.js"
import { buildStagePathDisplay } from "../../trading-zone/tradingZoneMarketStockBridge.js"
import TacticalConfidenceGrade from "./TacticalConfidenceGrade.jsx"
import TacticalTodayActionChips from "./TacticalTodayActionChips.jsx"
import { stageActionsToTodayActionChips } from "../../trading-zone/tradingZoneTodayActionChips.js"
import {
  STAGE_STATUS_SHORT,
  formatStagePathDateOnly,
} from "../../trading-zone/tradingZoneDetailMobile.js"

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
 *   focusMode?: boolean
 *   marketPolicy?: object | null
 *   stockEvaluation?: import("../../trading-zone/tradingZoneStockEvaluation.js").TradingZoneStockEvaluation | null
 *   stockEvalLoading?: boolean
 * }} props
 */
export default function TacticalStockDetailPanel({
  position,
  panicData = null,
  marketPolicy = null,
  focusMode = false,
  stockEvaluation = null,
  stockEvalLoading = false,
}) {
  const badge = tradingStageBadge(position)
  const stagePathDisplay = useMemo(
    () => buildStagePathDisplay(position.stageHistory ?? []),
    [position.stageHistory],
  )
  const stagePathDates = useMemo(
    () => formatStagePathDateOnly(stagePathDisplay.segments),
    [stagePathDisplay.segments],
  )
  const stageStatusShort = STAGE_STATUS_SHORT[position.stage] ?? badge.label
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

  const todayActionChips = useMemo(
    () => stageActionsToTodayActionChips(todayActions),
    [todayActions],
  )

  const entryRationale = useMemo(() => {
    if (stockEvaluation?.dataReady && stockEvaluation.strengthHighlights?.length) {
      return stockEvaluation.strengthHighlights.slice(0, 3)
    }
    if (stockEvaluation?.dataReady && stockEvaluation.entryRationale.length) {
      return stockEvaluation.entryRationale.slice(0, 3)
    }
    return []
  }, [stockEvaluation])

  const riskFactors = useMemo(() => {
    if (stockEvaluation?.dataReady && stockEvaluation.riskFactors?.length) {
      return stockEvaluation.riskFactors.slice(0, 2)
    }
    return []
  }, [stockEvaluation])

  const confidence = useMemo(() => {
    const base = buildTradingConfidenceBreakdown({ position, panicData, activeAux: new Set(position.aux ?? []) })
    if (stockEvaluation?.dataReady) {
      return { ...base, score: stockEvaluation.confidence }
    }
    return base
  }, [position, panicData, stockEvaluation])

  return (
    <div
      className="tactical-zone-detail tactical-zone-detail--simple tactical-zone-detail--compact"
      role="region"
      aria-label={`${position.symbol} 상세`}
      data-stage={position.stage}
    >
      <header className="tactical-zone-detail__head">
        <p className="m-0 tactical-zone-detail__name">
          {position.symbol}
          <TacticalConfidenceGrade score={confidence.score} className="tactical-zone-detail__grade" />
        </p>
        {stockEvalLoading ? (
          <p className="m-0 tactical-zone-detail__eval-hint" role="status">
            실데이터 평가 중…
          </p>
        ) : null}
      </header>

      {progress ? (
        <div className="tactical-zone-detail__simple-body">
          <section
            className="tactical-zone-detail__block tactical-zone-detail__block--position"
            aria-labelledby={`${position.id}-position`}
          >
            <h3 id={`${position.id}-position`} className="m-0 tactical-zone-detail__block-title">
              현재 위치
            </h3>
            <p className="m-0 tactical-zone-detail__position-oneline" data-stage={position.stage}>
              <span className="tactical-zone-detail__position-oneline-stage">
                <span aria-hidden>{badge.emoji}</span> {STAGE_LABEL[position.stage] ?? badge.label}
              </span>
              <span className="tactical-zone-detail__position-oneline-sep" aria-hidden>
                |
              </span>
              <span className="tactical-zone-detail__position-oneline-status">{stageStatusShort}</span>
            </p>
            <p className="m-0 tactical-zone-detail__position-stage tactical-zone-detail__position-stage--desktop" data-stage={position.stage}>
              <span aria-hidden>{badge.emoji}</span> {STAGE_LABEL[position.stage] ?? badge.label}
            </p>
            <p className="m-0 tactical-zone-detail__position-status tactical-zone-detail__position-status--desktop">
              {POSITION_STATUS_LINE[position.stage] ?? "실전 대응 구간"}
            </p>
            {stagePathDates && stagePathDates !== "—" ? (
              <p className="m-0 tactical-zone-detail__stage-path" title={stagePathDisplay.path}>
                {stagePathDates}
              </p>
            ) : null}
          </section>

          <section
            className="tactical-zone-detail__block tactical-zone-detail__block--price"
            aria-labelledby={`${position.id}-price`}
          >
            <h3 id={`${position.id}-price`} className="m-0 tactical-zone-detail__block-title">
              가격 위치
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

          <section
            className="tactical-zone-detail__block tactical-zone-detail__block--action"
            aria-labelledby={`${position.id}-action`}
          >
            <h3 id={`${position.id}-action`} className="m-0 tactical-zone-detail__block-title">
              오늘 행동
            </h3>
            <TacticalTodayActionChips
              chips={todayActionChips}
              className="tactical-zone-detail__today-chips"
            />
          </section>

          {!focusMode && (entryRationale.length || riskFactors.length) ? (
            <ul className="m-0 tactical-zone-detail__quick-factors">
              {entryRationale.map((line) => (
                <li key={line}>✓ {line}</li>
              ))}
              {riskFactors.map((line) => (
                <li key={line} className="is-warn">
                  ⚠ {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="m-0 tactical-zone-detail__no-price">가격 영역 계산 대기</p>
      )}

    </div>
  )
}
