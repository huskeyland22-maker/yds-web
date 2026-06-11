import { useMemo } from "react"
import { resolveMacroV1Status } from "../../panic-v2/panicMacroV1Status.js"
import { getStagePhilosophy } from "../../content/ydsCyclePhilosophy.js"
import {
  MARKET_POSITION_STAGES,
  resolveMarketPositionNavigation,
  resolveMarketPositionView,
} from "../../content/ydsMarketPositionEngine.js"
import { resolvePanicActionView } from "../../content/ydsPanicActionView.js"
import { getFinalScore } from "../../utils/tradingScores.js"
import { resolveYdsStageNavigation } from "../../utils/ydsStageNavigation.js"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import { resolveEventLayer } from "../../content/ydsEventLayer.js"
import { resolveMarketLevelRegime } from "../../content/ydsRegimeLayer.js"
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
 * Dual Cycle Hero — 시장 위치 + 패닉 강도
 * @param {{ panicData?: object | null; historyRows?: object[] }} props
 */
export default function YdsDualCycleHero({ panicData = null, historyRows = [] }) {
  const model = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
    const rounded = Math.max(0, Math.min(100, Math.round(score)))
    const fearStage = resolveMacroV1Status(rounded)
    const marketView = resolveMarketPositionView(panicData)
    const panicView = resolvePanicActionView(rounded)
    if (!fearStage || !marketView || !panicView) return null

    const fearNav = resolveYdsStageNavigation(rounded)
    const marketNav = resolveMarketPositionNavigation(marketView.position.id)
    const philosophy = getStagePhilosophy(fearStage.id)
    const momentum = resolveMomentumLayer(panicData, historyRows, {
      fearStageLabel: fearStage.label,
    })
    const eventLayer = resolveEventLayer(panicData, historyRows)
    const levelRegime = resolveMarketLevelRegime(panicData, historyRows, momentum)

    return {
      score: rounded,
      fearStage,
      fearNav,
      philosophy,
      marketView,
      marketNav,
      panicView,
      momentum,
      eventLayer,
      levelRegime,
    }
  }, [panicData, historyRows])

  if (!model) {
    return (
      <section className="yds-dual-cycle-hero yds-dual-cycle-hero--empty" aria-label="Dual Cycle">
        <p className="yds-dual-cycle-hero__empty">시장 사이클 불러오는 중…</p>
      </section>
    )
  }

  const { position } = model.marketView

  return (
    <section className="yds-dual-cycle-hero" aria-label="시장 위치 · 패닉 강도">
      <div className="yds-dual-cycle-hero__grid">
        <article
          className="yds-dual-cycle-hero__axis yds-dual-cycle-hero__axis--market"
          aria-label="시장 상태"
        >
          <p className="yds-dual-cycle-hero__axis-label">시장 상태</p>
          <p
            className="yds-dual-cycle-hero__stage yds-dual-cycle-hero__stage--market"
            style={{ "--axis-color": position.color }}
          >
            <span aria-hidden>{position.emoji}</span> {position.label}
          </p>
          {position.descriptions.length ? (
            <ul className="yds-dual-cycle-hero__state-subs">
              {position.descriptions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <p className="yds-dual-cycle-hero__metrics font-mono tabular-nums">
            CNN {fmtMetric(position.cnn, 0)} · VIX {fmtMetric(position.vix)} · BofA{" "}
            {fmtMetric(position.bofa)}
          </p>

          <div className="yds-dual-cycle-hero__rail" aria-hidden>
            {MARKET_POSITION_STAGES.map((step) => {
              const active = step.id === position.id
              return (
                <span
                  key={step.id}
                  className={[
                    "yds-dual-cycle-hero__chip",
                    active ? "yds-dual-cycle-hero__chip--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={active ? { "--chip-color": step.color } : undefined}
                >
                  {step.emoji} {step.short}
                </span>
              )
            })}
          </div>
        </article>

        <article
          className="yds-dual-cycle-hero__axis yds-dual-cycle-hero__axis--fear"
          aria-label="패닉 강도"
        >
          <p className="yds-dual-cycle-hero__axis-label">패닉 강도</p>
          <p className="yds-dual-cycle-hero__score-secondary font-mono tabular-nums">
            {model.panicView.scoreDisplay}
          </p>
          <p
            className="yds-dual-cycle-hero__stage"
            style={{ "--axis-color": model.fearStage.color }}
          >
            {model.panicView.currentLine}
          </p>
          {model.panicView.nextLine ? (
            <p className="yds-dual-cycle-hero__segment">{model.panicView.nextLine}</p>
          ) : null}

          <div className="yds-dual-cycle-hero__rail" aria-hidden>
            {model.panicView.rail.map((step) => (
              <span
                key={step.id}
                className={[
                  "yds-dual-cycle-hero__chip",
                  step.active ? "yds-dual-cycle-hero__chip--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={step.active ? { "--chip-color": step.color } : undefined}
              >
                {step.emoji} {step.label}
              </span>
            ))}
          </div>
        </article>
      </div>

      <YdsLayerStackIndicator
        levelLabel={`${position.emoji} ${position.label}`}
        regimeLabel={
          model.levelRegime?.regime
            ? `${model.levelRegime.regime.emoji} ${model.levelRegime.regime.label}`
            : null
        }
        ydsScore={model.score}
        momentumLevel={model.momentum.level}
        eventLevel={model.eventLayer.level}
      />

      <YdsDualCyclePositionNav
        fearNav={model.fearNav}
        marketNav={{
          currentStage: model.marketNav.current,
          nextStage: model.marketNav.next,
          nextLine: model.marketNav.next
            ? `다음 ${model.marketNav.nextLine}`
            : model.marketNav.nextLine,
        }}
      />
    </section>
  )
}
