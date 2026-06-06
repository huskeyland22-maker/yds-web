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
import YdsDualCyclePositionNav from "./YdsDualCyclePositionNav.jsx"

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
 * Dual Cycle Hero — 공포(YDS) + 시장(CNN·BofA) 2축
 * @param {{ panicData?: object | null }} props
 */
export default function YdsDualCycleHero({ panicData = null }) {
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

    return {
      score: rounded,
      fearStage,
      fearNav,
      philosophy,
      cnn,
      bofa,
      marketStage,
      marketNav,
    }
  }, [panicData])

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
          <p className="yds-dual-cycle-hero__axis-label">공포 사이클</p>
          <p className="yds-dual-cycle-hero__score font-mono tabular-nums">
            YDS 총점 <strong>{model.score}</strong>
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
          aria-label="시장 사이클"
        >
          <p className="yds-dual-cycle-hero__axis-label">시장 사이클</p>
          <p
            className="yds-dual-cycle-hero__stage yds-dual-cycle-hero__stage--market"
            style={{ "--axis-color": model.marketStage.color }}
          >
            <span aria-hidden>{model.marketStage.emoji}</span> {model.marketStage.label}
          </p>
          <p className="yds-dual-cycle-hero__metrics font-mono tabular-nums">
            CNN {fmtMetric(model.cnn, 0)} · BofA {fmtMetric(model.bofa)}
          </p>
          <p className="yds-dual-cycle-hero__segment">{model.marketStage.role}</p>

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
                  {step.id === "partialCash" ? "일부" : step.label.replace("과열주의", "주의")}
                </span>
              )
            })}
          </div>
        </article>
      </div>

      <YdsDualCyclePositionNav fearNav={model.fearNav} marketNav={model.marketNav} />
    </section>
  )
}
