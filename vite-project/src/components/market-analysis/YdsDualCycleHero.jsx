import { useMemo } from "react"
import { MACRO_V1_STATUS_BANDS, resolveMacroV1Status } from "../../panic-v2/panicMacroV1Status.js"
import { YDS_FEAR_CYCLE_RAIL, getStagePhilosophy } from "../../content/ydsCyclePhilosophy.js"
import {
  MARKET_CYCLE_STAGES,
  resolveMarketCycleNavigation,
  resolveMarketCycleStage,
} from "../../content/ydsMarketCycleDisplay.js"
import { getFinalScore } from "../../utils/tradingScores.js"
import { resolveYdsStageNavigation } from "../../utils/ydsStageNavigation.js"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import { resolveEventLayer } from "../../content/ydsEventLayer.js"
import { resolveMarketLevelRegime } from "../../content/ydsRegimeLayer.js"
import { resolveMarketState } from "../../content/ydsStateEngine.js"
import YdsDualCyclePositionNav from "./YdsDualCyclePositionNav.jsx"
import YdsLayerStackIndicator from "./YdsLayerStackIndicator.jsx"

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function fmtMetric(v, digits = 1) {
  const n = toNum(v)
  if (n == null) return "—"
  return digits === 0 ? String(Math.round(n)) : n.toFixed(digits)
}

/**
 * Dual Cycle Hero — 공포(YDS) + 시장(CNN·BofA) 2축 + Momentum
 * @param {{ panicData?: object | null; historyRows?: object[] }} props
 */
export default function YdsDualCycleHero({ panicData = null, historyRows = [] }) {
  const model = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
    const rounded = Math.max(0, Math.min(100, Math.round(score)))
    const fearStage = resolveMacroV1Status(rounded)
    if (!fearStage) return null

    const cnn = toNum(panicData.fearGreed)
    const bofa = toNum(panicData.bofa)
    const marketStage = resolveMarketCycleStage(cnn, bofa)
    if (!marketStage) return null

    const fearNav = resolveYdsStageNavigation(rounded)
    const marketNav = resolveMarketCycleNavigation(marketStage.id)
    const philosophy = getStagePhilosophy(fearStage.id)
    const momentum = resolveMomentumLayer(panicData, historyRows, {
      fearStageLabel: fearStage.label,
    })
    const eventLayer = resolveEventLayer(panicData, historyRows)
    const levelRegime = resolveMarketLevelRegime(panicData, historyRows, momentum)
    const marketState = resolveMarketState(panicData, historyRows, momentum)

    return {
      score: rounded,
      fearStage,
      fearNav,
      philosophy,
      cnn,
      bofa,
      marketStage,
      marketNav,
      momentum,
      eventLayer,
      levelRegime,
      marketState,
    }
  }, [panicData, historyRows])

  if (!model) {
    return (
      <section className="yds-dual-cycle-hero yds-dual-cycle-hero--empty" aria-label="Dual Cycle">
        <p className="yds-dual-cycle-hero__empty">시장 사이클 불러오는 중…</p>
      </section>
    )
  }

  return (
    <section className="yds-dual-cycle-hero" aria-label="공포·시장 Dual Cycle">
      <div className="yds-dual-cycle-hero__grid">
        <article
          className="yds-dual-cycle-hero__axis yds-dual-cycle-hero__axis--fear"
          aria-label="공포 사이클"
        >
          <p className="yds-dual-cycle-hero__axis-label">패닉 강도 · 장기</p>
          <p className="yds-dual-cycle-hero__score-secondary font-mono tabular-nums">
            YDS <span>{model.score}</span>
          </p>
          <p
            className="yds-dual-cycle-hero__stage"
            style={{ "--axis-color": model.fearStage.color }}
          >
            <span aria-hidden>{model.fearStage.emoji}</span> {model.fearStage.label}
          </p>
          <p className="yds-dual-cycle-hero__segment">{model.philosophy.segmentLabel}</p>

          <div className="yds-dual-cycle-hero__rail" aria-hidden>
            {YDS_FEAR_CYCLE_RAIL.map((step) => {
              const active = step.id === model.fearStage.id
              const band = MACRO_V1_STATUS_BANDS.find((b) => b.id === step.id)
              return (
                <span
                  key={step.id}
                  className={[
                    "yds-dual-cycle-hero__chip",
                    active ? "yds-dual-cycle-hero__chip--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-stage={step.id}
                  style={active ? { "--chip-color": band?.color ?? "#94a3b8" } : undefined}
                >
                  {step.emoji} {step.short}
                </span>
              )
            })}
          </div>
        </article>

        <article
          className="yds-dual-cycle-hero__axis yds-dual-cycle-hero__axis--market"
          aria-label="시장 상태"
        >
          <p className="yds-dual-cycle-hero__axis-label">시장 상태</p>
          {model.marketState ? (
            <>
              <p
                className="yds-dual-cycle-hero__stage yds-dual-cycle-hero__stage--market"
                style={{ "--axis-color": model.marketState.color }}
              >
                <span aria-hidden>{model.marketState.emoji}</span> {model.marketState.label}
              </p>
              {model.marketState.subtitles.length ? (
                <ul className="yds-dual-cycle-hero__state-subs">
                  {model.marketState.subtitles.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p
              className="yds-dual-cycle-hero__stage yds-dual-cycle-hero__stage--market"
              style={{ "--axis-color": model.marketStage.color }}
            >
              <span aria-hidden>{model.marketStage.emoji}</span> {model.marketStage.label}
            </p>
          )}
          <p className="yds-dual-cycle-hero__metrics font-mono tabular-nums">
            CNN {fmtMetric(model.cnn, 0)} · BofA {fmtMetric(model.bofa)}
          </p>
          <p className="yds-dual-cycle-hero__segment">
            {model.levelRegime?.regime?.summary ?? model.marketStage.role}
          </p>

          <div className="yds-dual-cycle-hero__rail" aria-hidden>
            {MARKET_CYCLE_STAGES.map((step) => {
              const active = step.id === model.marketStage.id
              return (
                <span
                  key={step.id}
                  className={[
                    "yds-dual-cycle-hero__chip",
                    active ? "yds-dual-cycle-hero__chip--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-market={step.id}
                  style={active ? { "--chip-color": step.color } : undefined}
                >
                  {step.emoji}{" "}
                  {step.id === "partialCash" ? "일부" : step.label}
                </span>
              )
            })}
          </div>
        </article>
      </div>

      <YdsLayerStackIndicator
        levelLabel={
          model.marketState
            ? `${model.marketState.emoji} ${model.marketState.label}`
            : model.levelRegime?.level
              ? `${model.levelRegime.level.emoji} ${model.levelRegime.level.label}`
              : null
        }
        regimeLabel={
          model.levelRegime?.regime
            ? `${model.levelRegime.regime.emoji} ${model.levelRegime.regime.label}`
            : null
        }
        ydsScore={model.score}
        momentumLevel={model.momentum.level}
        eventLevel={model.eventLayer.level}
      />

      <YdsDualCyclePositionNav fearNav={model.fearNav} marketNav={model.marketNav} />
    </section>
  )
}
