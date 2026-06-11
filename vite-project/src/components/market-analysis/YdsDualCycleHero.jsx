import { useMemo } from "react"
import { resolveMacroV1Status } from "../../panic-v2/panicMacroV1Status.js"
import { getStagePhilosophy } from "../../content/ydsCyclePhilosophy.js"
import { resolveMarketPositionView } from "../../content/ydsMarketPositionEngine.js"
import { resolvePanicActionView } from "../../content/ydsPanicActionView.js"
import { getFinalScore } from "../../utils/tradingScores.js"
import { resolveMomentumLayer } from "../../content/ydsMomentumLayer.js"
import { resolveEventLayer } from "../../content/ydsEventLayer.js"
import { resolveMarketLevelRegime } from "../../content/ydsRegimeLayer.js"
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
 * Dual Cycle Hero — 근거 분석 (상단 카드와 단계 중복 없음)
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

    const philosophy = getStagePhilosophy(fearStage.id)
    const momentum = resolveMomentumLayer(panicData, historyRows, {
      fearStageLabel: fearStage.label,
    })
    const eventLayer = resolveEventLayer(panicData, historyRows)
    const levelRegime = resolveMarketLevelRegime(panicData, historyRows, momentum)

    return {
      score: rounded,
      philosophy,
      marketView,
      panicView,
      momentum,
      eventLayer,
      levelRegime,
    }
  }, [panicData, historyRows])

  if (!model) {
    return (
      <section className="yds-dual-cycle-hero yds-dual-cycle-hero--empty" aria-label="근거 분석">
        <p className="yds-dual-cycle-hero__empty">근거 데이터 불러오는 중…</p>
      </section>
    )
  }

  const { position } = model.marketView

  return (
    <section className="yds-dual-cycle-hero" aria-label="시장 근거 분석">
      <div className="yds-dual-cycle-hero__grid">
        <article
          className="yds-dual-cycle-hero__axis yds-dual-cycle-hero__axis--market"
          aria-label="시장 상태 근거"
        >
          <p className="yds-dual-cycle-hero__axis-label">시장 상태 근거</p>
          <p className="yds-dual-cycle-hero__metrics font-mono tabular-nums">
            CNN {fmtMetric(position.cnn, 0)} · VIX {fmtMetric(position.vix)} · BofA{" "}
            {fmtMetric(position.bofa)}
          </p>
          {position.descriptions.length ? (
            <ul className="yds-dual-cycle-hero__state-subs">
              {position.descriptions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </article>

        <article
          className="yds-dual-cycle-hero__axis yds-dual-cycle-hero__axis--fear"
          aria-label="패닉 강도 근거"
        >
          <p className="yds-dual-cycle-hero__axis-label">패닉 강도 근거</p>
          <p className="yds-dual-cycle-hero__philosophy">{model.philosophy.actionGuide}</p>
          <p className="yds-dual-cycle-hero__philosophy-hint">
            {model.philosophy.role} · {model.philosophy.hint}
          </p>
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
    </section>
  )
}
