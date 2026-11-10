import { useMemo } from "react"
import { useMembership } from "../../context/MembershipContext.jsx"
import { buildPanicCenterVisibility } from "../../content/ydsMarketAnalysisProGate.js"
import { resolvePanicBottomDcaSignal } from "../../utils/panicBottomDcaSignal.js"
import {
  buildPanicScoreV2Breakdown,
  getPanicScoreV2,
  PANIC_INDEX_STAGE_BANDS,
  resolvePanicIndexStatus,
} from "../../utils/tradingScores.js"
import YdsProFeatureGate from "./YdsProFeatureGate.jsx"

/** @param {number | null | undefined} n @param {number} [digits] */
function fmtNum(n, digits = 2) {
  if (n == null || !Number.isFinite(Number(n))) return "—"
  const x = Number(n)
  if (Number.isInteger(x)) return String(x)
  const f = 10 ** digits
  return String(Math.round(x * f) / f)
}

/**
 * Live metric chips from existing panicData only (no invented series / BBB).
 * @param {object | null | undefined} panicData
 * @returns {{ id: string; label: string; value: string }[]}
 */
function buildLiveMetricCards(panicData) {
  if (!panicData || typeof panicData !== "object") return []
  /** @type {{ id: string; label: string; key: string; digits: number }[]} */
  const defs = [
    { id: "vix", label: "VIX", key: "vix", digits: 1 },
    { id: "cnn", label: "CNN Fear & Greed", key: "fearGreed", digits: 0 },
    { id: "putCall", label: "Put/Call", key: "putCall", digits: 2 },
    { id: "bofa", label: "BofA Bull & Bear", key: "bofa", digits: 1 },
    { id: "highYield", label: "HY Spread", key: "highYield", digits: 2 },
    { id: "move", label: "MOVE", key: "move", digits: 1 },
  ]
  const out = []
  for (const d of defs) {
    const raw = Number(panicData[d.key])
    if (!Number.isFinite(raw)) continue
    out.push({ id: d.id, label: d.label, value: fmtNum(raw, d.digits) })
    if (out.length >= 6) break
  }
  return out
}

/**
 * /market-analysis — Panic Index (일상 화면)
 * 순서: 현재 점수·매수 단계 → FEAR SCALE → History → Drivers
 * @param {{
 *   panicData?: object | null
 *   className?: string
 *   historySlot?: import("react").ReactNode
 * }} props
 */
export default function YdsPanicIndexCenter({
  panicData = null,
  className = "",
  historySlot = null,
}) {
  const { isPro } = useMembership()
  const visibility = useMemo(() => buildPanicCenterVisibility(isPro), [isPro])
  const score = useMemo(() => getPanicScoreV2(panicData), [panicData])
  const status = useMemo(() => resolvePanicIndexStatus(score), [score])
  const dcaSignal = useMemo(() => resolvePanicBottomDcaSignal(score), [score])
  const breakdown = useMemo(() => buildPanicScoreV2Breakdown(panicData), [panicData])

  const asOfRaw = panicData?.date ?? panicData?.asOfDate ?? panicData?.updatedAt ?? null
  const asOfDate =
    asOfRaw && /^\d{4}-\d{2}-\d{2}/.test(String(asOfRaw)) ? String(asOfRaw).slice(0, 10) : null

  const markerPct = score != null ? Math.max(0, Math.min(100, score)) : null
  const metricCards = useMemo(() => buildLiveMetricCards(panicData), [panicData])
  const gaugeDeg = markerPct != null ? Math.round((markerPct / 100) * 180) : 0

  return (
    <article
      className={["yds-panic-center", "yds-panic-center--research", "yds-panic-center--premium-desk", className]
        .filter(Boolean)
        .join(" ")}
      aria-label="Panic Index"
    >
      <header className="yds-panic-center__hero">
        <div className="yds-panic-center__hero-card">
          <div className="yds-panic-center__hero-top">
            <p className="yds-panic-center__label">PANIC INDEX</p>
            {asOfDate ? (
              <p className="yds-panic-center__asof">As of {asOfDate}</p>
            ) : null}
          </div>

          {score != null && status ? (
            <div className="yds-panic-center__hero-body yds-panic-center__hero-body--desk">
              <div
                className="yds-panic-center__gauge"
                style={{ "--yds-gauge-deg": `${gaugeDeg}deg` }}
                aria-label={`Panic Index ${score}점 · ${status.label}`}
              >
                <div className="yds-panic-center__gauge-arc" aria-hidden />
                <div className="yds-panic-center__gauge-readout">
                  <p className="yds-panic-center__score font-mono tabular-nums">
                    {score}
                    <span className="yds-panic-center__score-den">/100</span>
                  </p>
                  <p
                    className="yds-panic-center__stage"
                    style={status.color ? { color: status.color } : undefined}
                  >
                    {status.label}
                  </p>
                  <p className="yds-panic-center__stage-range font-mono tabular-nums">
                    {status.min}–{status.max}
                  </p>
                </div>
              </div>

              <div className="yds-panic-center__summary-card">
                <div className="yds-panic-center__summary-head">
                  <span className="yds-ai-badge">AI 해석</span>
                  <span className="yds-panic-center__summary-kicker">핵심 요약</span>
                </div>
                <p className="yds-panic-center__lede">
                  {status.blurb
                    ? status.blurb
                    : "현재 시장의 공포 수준을 나타내는 장기 투자 참고 지표입니다. 단기 매매 신호가 아닙니다."}
                </p>
                {metricCards.length > 0 ? (
                  <ul className="yds-panic-center__focus-list">
                    {metricCards.slice(0, 3).map((card) => (
                      <li key={card.id}>
                        <span>{card.label}</span>
                        <strong className="font-mono tabular-nums">{card.value}</strong>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {dcaSignal ? (
                  <YdsProFeatureGate
                    unlocked={visibility.proDcaGuidance}
                    className="yds-pro-gate--compact"
                    body="분할매수 참고 안내는 PRO 멤버십에서 확인할 수 있습니다."
                  >
                    <div
                      className={[
                        "yds-panic-center__dca",
                        `yds-panic-center__dca--${dcaSignal.id}`,
                      ].join(" ")}
                      aria-label="SPX 저점 분할매수 참고 신호"
                    >
                      <p className="yds-panic-center__dca-band">{dcaSignal.bandLabel}</p>
                      {dcaSignal.stage === 0 ? (
                        <p className="yds-panic-center__dca-line">
                          {dcaSignal.addLabel}:{" "}
                          <span className="font-mono tabular-nums">{dcaSignal.addPct}%</span>
                        </p>
                      ) : (
                        <>
                          <p className="yds-panic-center__dca-line">
                            {dcaSignal.addLabel}:{" "}
                            <span className="font-mono tabular-nums">{dcaSignal.addPct}%</span>
                          </p>
                          <p className="yds-panic-center__dca-line">
                            누적 투입:{" "}
                            <span className="font-mono tabular-nums">{dcaSignal.cumulativePct}%</span>
                          </p>
                        </>
                      )}
                      <p className="yds-panic-center__dca-note">참고 신호 · 자동 주문 없음</p>
                    </div>
                  </YdsProFeatureGate>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="yds-panic-center__incomplete" role="status">
              <p className="yds-panic-center__incomplete-title">데이터 입력 필요</p>
              <p className="yds-panic-center__incomplete-body">
                VIX · CNN Fear &amp; Greed · Cboe Total P/C가 모두 있어야 계산할 수 있습니다.
              </p>
            </div>
          )}

          <div className="yds-panic-center__scale" aria-hidden={score == null}>
            <div className="yds-panic-center__bar">
              {PANIC_INDEX_STAGE_BANDS.map((b) => {
                const widthPct = b.max - b.min + (b.max === 100 ? 1 : 0)
                return (
                  <div
                    key={b.id}
                    className={[
                      "yds-panic-center__bar-seg",
                      status?.id === b.id ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      width: `${widthPct}%`,
                      background: b.color,
                    }}
                    title={`${b.label} ${b.min}–${b.max}`}
                  />
                )
              })}
              {markerPct != null ? (
                <span
                  className="yds-panic-center__bar-marker"
                  style={{ left: `${markerPct}%` }}
                  title={`${score}`}
                />
              ) : null}
            </div>
            <div className="yds-panic-center__bar-labels font-mono tabular-nums">
              <span>0</span>
              <span>20</span>
              <span>40</span>
              <span>60</span>
              <span>80</span>
              <span>100</span>
            </div>
          </div>

          {metricCards.length > 0 ? (
            <div className="yds-panic-center__metric-grid" aria-label="주요 지표">
              {metricCards.map((card) => (
                <div key={card.id} className="yds-panic-center__metric-card">
                  <p className="yds-panic-center__metric-label">{card.label}</p>
                  <p className="yds-panic-center__metric-value font-mono tabular-nums">{card.value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <section className="yds-panic-center__block yds-panic-center__block--fear">
        <h3 className="yds-panic-center__block-label">FEAR SCALE</h3>
        <div className="yds-panic-center__fear-scale" role="list">
          {PANIC_INDEX_STAGE_BANDS.map((b) => {
            const isCurrent = status?.id === b.id
            const widthPct = b.max - b.min + (b.max === 100 ? 1 : 0)
            return (
              <div
                key={b.id}
                role="listitem"
                className={[
                  "yds-panic-center__fear-stage",
                  isCurrent ? "is-current" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ "--fear-flex": widthPct, "--fear-color": b.color }}
              >
                <div className="yds-panic-center__fear-swatch" aria-hidden />
                <div className="yds-panic-center__fear-meta">
                  <div className="yds-panic-center__fear-title-row">
                    <span className="yds-panic-center__stage-name">{b.label}</span>
                    {isCurrent ? (
                      <span className="yds-panic-center__now-badge">현재</span>
                    ) : null}
                  </div>
                  <span className="yds-panic-center__td-range font-mono tabular-nums">
                    {b.min}–{b.max}
                  </span>
                  {isCurrent ? (
                    <span className="yds-panic-center__td-blurb">{b.blurb}</span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {historySlot ? (
        <div className="yds-panic-center__history-slot">
          <YdsProFeatureGate unlocked={visibility.proHistoryChart}>
            {historySlot}
          </YdsProFeatureGate>
        </div>
      ) : null}

      <section className="yds-panic-center__block yds-panic-center__block--drivers">
        <h3 className="yds-panic-center__block-label">PANIC DRIVERS</h3>
        <YdsProFeatureGate unlocked={visibility.proDriversDetail}>
          <div className="yds-panic-center__drivers-wrap">
            <table className="yds-panic-center__drivers">
              <thead>
                <tr>
                  <th scope="col">지표</th>
                  <th scope="col" className="is-num is-primary">
                    Value
                  </th>
                  <th scope="col" className="is-num is-secondary">
                    Score
                  </th>
                  <th scope="col" className="is-num is-secondary">
                    Weight
                  </th>
                  <th scope="col" className="is-num is-secondary">
                    Contribution
                  </th>
                </tr>
              </thead>
              <tbody>
                {(breakdown?.lines ?? []).map((line) => (
                  <tr key={line.id}>
                    <th scope="row">
                      <span className="yds-panic-center__driver-name">{line.label}</span>
                      <span className="yds-panic-center__driver-src">{line.source}</span>
                    </th>
                    <td className="is-num is-primary font-mono tabular-nums">
                      {line.value == null ? "—" : fmtNum(line.value)}
                    </td>
                    <td className="is-num is-secondary font-mono tabular-nums">
                      {line.score == null ? "—" : fmtNum(line.score, 1)}
                    </td>
                    <td className="is-num is-secondary font-mono tabular-nums">
                      {Math.round(line.weight * 100)}%
                    </td>
                    <td className="is-num is-secondary font-mono tabular-nums">
                      {line.contrib == null ? "—" : fmtNum(line.contrib, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {breakdown?.ok ? (
                <tfoot>
                  <tr>
                    <th scope="row">
                      <span className="yds-panic-center__total-label">Weighted total</span>
                      <span className="yds-panic-center__total-hint">최종 합산 점수</span>
                    </th>
                    <td colSpan={3} />
                    <td className="is-num is-total font-mono tabular-nums">
                      {breakdown.rawTotal != null ? fmtNum(breakdown.rawTotal, 2) : "—"}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <ul className="yds-panic-center__drivers-mobile">
            {(breakdown?.lines ?? []).map((line) => (
              <li key={line.id}>
                <div className="yds-panic-center__drivers-mobile-head">
                  <span>{line.label}</span>
                  <span className="yds-panic-center__driver-src">{line.source}</span>
                </div>
                <p className="yds-panic-center__drivers-mobile-value font-mono tabular-nums">
                  {line.value == null ? "—" : fmtNum(line.value)}
                </p>
                <dl>
                  <div>
                    <dt>Score</dt>
                    <dd className="font-mono tabular-nums">
                      {line.score == null ? "—" : fmtNum(line.score, 1)}
                    </dd>
                  </div>
                  <div>
                    <dt>Weight</dt>
                    <dd className="font-mono tabular-nums">{Math.round(line.weight * 100)}%</dd>
                  </div>
                  <div>
                    <dt>Contrib.</dt>
                    <dd className="font-mono tabular-nums">
                      {line.contrib == null ? "—" : fmtNum(line.contrib, 1)}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
            {breakdown?.ok ? (
              <li className="yds-panic-center__drivers-mobile-total">
                <div className="yds-panic-center__drivers-mobile-head">
                  <span>Weighted total</span>
                  <span className="yds-panic-center__total-hint">최종 합산 점수</span>
                </div>
                <p className="yds-panic-center__drivers-mobile-value font-mono tabular-nums">
                  {breakdown.rawTotal != null ? fmtNum(breakdown.rawTotal, 2) : "—"}
                </p>
              </li>
            ) : null}
          </ul>
        </YdsProFeatureGate>
      </section>
    </article>
  )
}
