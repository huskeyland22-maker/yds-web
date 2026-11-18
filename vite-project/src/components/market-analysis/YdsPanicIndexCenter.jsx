import { useMemo } from "react"
import { Link } from "react-router-dom"
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
import YdsAiMarketBriefing from "./YdsAiMarketBriefing.jsx"
import { formatMarketBasisKst } from "../../utils/marketTimestamp.js"
import {
  classifyMetricState,
  classifyPanicScoreState,
  hasConfirmedCollection,
  isPlaceholderUpdatedAt,
  isSeedMetricValue,
  isSeedSnapshot,
  panicAsOfDate,
  panicFreshnessNotice,
  readFiniteMetric,
} from "../../utils/panicDataFreshness.js"

/** @param {number | null | undefined} n @param {number} [digits] */
function fmtNum(n, digits = 2) {
  if (n == null || !Number.isFinite(Number(n))) return "—"
  const x = Number(n)
  if (Number.isInteger(x)) return String(x)
  const f = 10 ** digits
  return String(Math.round(x * f) / f)
}

/** Panic Index V2 입력 — VIX · CNN · Put/Call만. 점수 계산과 동일. */
const PANIC_CORE_METRICS = [
  { id: "vix", label: "VIX", keys: ["vix"], digits: 1, delta: "pct" },
  { id: "cnn", label: "CNN Fear & Greed", keys: ["fearGreed"], digits: 0, delta: "pct" },
  { id: "putCall", label: "Put/Call Ratio", keys: ["putCall"], digits: 2, delta: "pct" },
]

/** HY·BBB는 Credit Cycle 영역. Panic 점수에 넣지 않고 참고만 표시. */
const CREDIT_CYCLE_REF_METRICS = [
  { id: "highYield", label: "HY 스프레드", keys: ["highYield", "hyOas"], digits: 2, delta: "bp" },
  { id: "bbb", label: "BBB 스프레드", keys: ["bbbSpread", "bbb", "bbbOas"], digits: 2, delta: "bp" },
]

/**
 * @param {object | null | undefined} source
 * @param {string[]} keys
 */
function readMetric(source, keys) {
  if (!source || typeof source !== "object") return null
  for (const key of keys) {
    const n = readFiniteMetric(source[key])
    if (n != null) return n
  }
  return null
}

/**
 * @param {object[]} history
 * @param {string[]} keys
 */
function metricSeries(history, keys, metricId) {
  const points = []
  for (const row of history || []) {
    if (isSeedSnapshot(row) || isSeedMetricValue(row, metricId)) continue
    const n = readMetric(row, keys)
    if (n != null) points.push(n)
  }
  return points
}

function missingMetricLabel(id) {
  if (id === "bbb") return "저장된 값 없음"
  if (id === "bofa") return "최신값 없음"
  return "최신 데이터 없음"
}

/**
 * Existing band words already used for these inputs. No new scale.
 * @param {string} id
 * @param {number | null} value
 */
function metricTone(id, value) {
  if (value == null) return ""
  if (id === "vix") {
    if (value >= 24) return "경계"
    if (value <= 16) return "안정"
    return "중립"
  }
  if (id === "cnn") {
    if (value >= 75) return "탐욕"
    if (value >= 60) return "위험 선호"
    if (value <= 30) return "공포"
    return "중립"
  }
  if (id === "bofa") {
    if (value >= 7) return "낙관"
    if (value <= 3) return "비관"
    return "중립"
  }
  if (id === "putCall") {
    if (value >= 1.05) return "헤지"
    if (value <= 0.7) return "추격"
    return "균형"
  }
  if (id === "highYield" || id === "bbb") {
    if (value >= 5.5) return "신용 확대"
    if (value <= 4.2) return "신용 안정"
    return "보통"
  }
  return ""
}

/**
 * @param {number} current
 * @param {number} previous
 * @param {'pct' | 'bp'} mode
 */
function formatDelta(current, previous, mode) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (mode === "bp" && current <= 30 && previous <= 30) {
    const bp = Math.round((current - previous) * 100)
    if (bp === 0) return "0bp"
    return `${bp > 0 ? "+" : ""}${bp}bp`
  }
  if (previous === 0) return null
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const rounded = Math.round(pct * 10) / 10
  if (Math.abs(rounded) < 0.05) return "0.0%"
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`
}

/**
 * @param {{ id: string, label: string, keys: string[], digits: number, delta: 'pct' | 'bp' }} def
 * @param {object | null | undefined} panicData
 * @param {object[]} history
 */
function buildRiskCard(def, panicData, history) {
  const value = readMetric(panicData, def.keys)
  const series = metricSeries(history, def.keys, def.id)
  const previous = series.length
    ? Math.abs((series[series.length - 1] ?? NaN) - (value ?? NaN)) < 1e-9
      ? series.length > 1
        ? series[series.length - 2]
        : null
      : series[series.length - 1]
    : null
  const spark = value == null ? series.slice(-18) : [...series.slice(-17), value]
  return {
    id: def.id,
    label: def.label,
    value: value == null ? null : fmtNum(value, def.digits),
    tone: metricTone(def.id, value),
    delta: value == null || previous == null ? null : formatDelta(value, previous, def.delta),
    deltaUp: value != null && previous != null ? value > previous : null,
    spark,
    missing: value == null,
  }
}

function Sparkline({ points }) {
  if (!points || points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const d = points
    .map((n, i) => {
      const x = (i / (points.length - 1)) * 100
      const y = 28 - ((n - min) / span) * 24
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")
  const up = points[points.length - 1] >= points[0]
  return (
    <svg className="yds-risk-spark" viewBox="0 0 100 32" aria-hidden>
      <path d={d} fill="none" stroke={up ? "#e11d48" : "#059669"} strokeWidth="2" />
    </svg>
  )
}

/**
 * /market-analysis — Panic Index (일상 화면)
 * Design B: gauge · 핵심 요약 · AI 시장 리포트 → 3지표(+신용 참고) → History → 종목 데스크 → Drivers
 * @param {{
 *   panicData?: object | null
 *   className?: string
 *   historySlot?: import("react").ReactNode
 *   belowHero?: import("react").ReactNode
 *   historyRows?: object[]
 *   cycleFlow?: object | null
 *   dualLiquidity?: object | null
 *   etfContext?: object | null
 * }} props
 */
export default function YdsPanicIndexCenter({
  panicData = null,
  className = "",
  historySlot = null,
  historyRows = [],
  belowHero = null,
  cycleFlow = null,
  dualLiquidity = null,
  etfContext = null,
}) {
  const { detailAccess } = useMembership()
  const visibility = useMemo(
    () => buildPanicCenterVisibility(detailAccess === true),
    [detailAccess],
  )
  const score = useMemo(() => getPanicScoreV2(panicData), [panicData])
  const status = useMemo(() => resolvePanicIndexStatus(score), [score])
  const dcaSignal = useMemo(() => resolvePanicBottomDcaSignal(score), [score])
  const breakdown = useMemo(() => buildPanicScoreV2Breakdown(panicData), [panicData])

  const asOfDate = panicAsOfDate(panicData)
  const scoreDataState = useMemo(() => classifyPanicScoreState(panicData), [panicData])
  const collectionIso =
    hasConfirmedCollection(panicData) && !isPlaceholderUpdatedAt(panicData)
      ? panicData?.updatedAt ?? panicData?.updated_at ?? null
      : null
  const collectionLabel = collectionIso ? formatMarketBasisKst(collectionIso) : null

  const markerPct = score != null ? Math.max(0, Math.min(100, score)) : null
  const metricCards = useMemo(
    () => PANIC_CORE_METRICS.map((def) => buildRiskCard(def, panicData, historyRows)),
    [panicData, historyRows],
  )
  const creditRefCards = useMemo(
    () => CREDIT_CYCLE_REF_METRICS.map((def) => buildRiskCard(def, panicData, historyRows)),
    [panicData, historyRows],
  )
  const keyPoints = metricCards.filter((card) => card.delta && !card.missing).slice(0, 3)
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
            <p className="yds-panic-center__label">시장 위험 지수</p>
            <p className="yds-panic-center__asof">
              <span className={`yds-data-state is-${scoreDataState.toLowerCase()}`}>{scoreDataState}</span>
              {asOfDate ? ` 기준일 ${asOfDate}` : " 기준일 없음"}
              {collectionLabel ? ` · 수집 ${collectionLabel}` : " · 수집 시각 없음"}
              {scoreDataState === "LIVE" ? null : ` · ${panicFreshnessNotice(scoreDataState)}`}
            </p>
          </div>

          <div
            className={[
              "yds-panic-center__hero-body",
              "yds-panic-center__hero-body--desk",
              score == null ? "is-empty" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={["yds-panic-center__gauge", score == null ? "is-empty" : ""]
                .filter(Boolean)
                .join(" ")}
              style={{ "--yds-gauge-deg": `${gaugeDeg}deg` }}
              aria-label={
                score != null && status
                  ? `Panic Index ${score}점 · ${status.label}`
                  : "Panic Index 미측정"
              }
            >
              <div className="yds-panic-center__gauge-arc" aria-hidden />
              {score != null ? (
                <svg
                  className="yds-panic-center__gauge-needle"
                  viewBox="0 0 220 110"
                  aria-hidden
                >
                  <line
                    x1="110"
                    y1="28"
                    x2="110"
                    y2="6"
                    stroke="#e2e8f0"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    transform={`rotate(${gaugeDeg - 90} 110 110)`}
                  />
                </svg>
              ) : null}
              <div className="yds-panic-center__gauge-readout">
                {score != null && status ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <p className="yds-panic-center__score yds-panic-center__score--empty font-mono tabular-nums">
                      —
                      <span className="yds-panic-center__score-den">/100</span>
                    </p>
                    <p className="yds-panic-center__stage yds-panic-center__stage--empty">미측정</p>
                    <p className="yds-panic-center__stage-range">실수집 점수 없음</p>
                  </>
                )}
              </div>
            </div>

            <div className="yds-panic-center__summary-card">
              <div className="yds-panic-center__summary-head">
                <span className="yds-panic-center__summary-kicker">핵심 요약</span>
                <span className="yds-ai-badge">AI 해석</span>
              </div>
              {score != null && status?.label ? (
                <p
                  className="yds-panic-center__stage-pill"
                  style={status.color ? { "--yds-stage-tone": status.color } : undefined}
                >
                  {status.label}
                  {status.min != null && status.max != null ? (
                    <span className="font-mono tabular-nums">
                      {" "}
                      · {status.min}–{status.max}
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className="yds-panic-center__stage-pill yds-panic-center__stage-pill--empty">
                  데이터 없음
                </p>
              )}
              <p className="yds-panic-center__lede">
                {score != null && status?.blurb
                  ? status.blurb
                  : "실제 수집된 VIX · CNN · Put/Call이 없어 점수를 계산하지 않았습니다. 시드 이력은 점수에 쓰지 않습니다."}
              </p>
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

            <section className="yds-panic-center__report" aria-label="AI 시장 보고서">
              <div className="yds-panic-center__report-head">
                <div className="yds-panic-center__report-mark" aria-hidden>
                  AI
                </div>
                <div>
                  <h3 className="yds-panic-center__report-title">AI 시장 보고서</h3>
                  <p className="yds-panic-center__report-sub">저장된 지표·가격 구조 기반</p>
                </div>
              </div>
              <YdsAiMarketBriefing
                panicData={panicData}
                cycleFlow={cycleFlow}
                dualLiquidity={dualLiquidity}
                etfContext={etfContext}
                className="yds-panic-center__briefing"
              />
              {keyPoints.length ? (
                <ul className="yds-panic-center__report-deltas">
                  {keyPoints.map((card) => (
                    <li key={card.id}>
                      <span className="yds-panic-center__report-check" aria-hidden>
                        ✔
                      </span>
                      <span>
                        {card.label} {card.value}
                        {card.delta ? (
                          <strong className={card.deltaUp ? "is-up" : "is-down"}> {card.delta}</strong>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>

          <div
            className={["yds-panic-center__scale", score == null ? "is-empty" : ""]
              .filter(Boolean)
              .join(" ")}
            aria-hidden={score == null}
          >
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
            {score == null ? (
              <p className="yds-panic-center__scale-empty">점수 미측정 · 마커 없음</p>
            ) : null}
          </div>

          <div className="yds-panic-center__metric-grid" aria-label="Panic Index 핵심 지표">
            {metricCards.map((card) => {
              const dataState = classifyMetricState(panicData, card.id)
              return (
              <div key={card.id} className="yds-panic-center__metric-card">
                <p className="yds-panic-center__metric-label">
                  {card.label}
                  <span className={`yds-data-state is-${dataState.toLowerCase()}`}>{dataState}</span>
                </p>
                <p className="yds-panic-center__metric-value font-mono tabular-nums">
                  {card.value ?? "—"}
                  {card.delta ? (
                    <span className={card.deltaUp ? "is-up" : "is-down"}>{card.delta}</span>
                  ) : null}
                </p>
                {card.tone ? <p className="yds-panic-center__metric-tone">{card.tone}</p> : null}
                {card.missing ? <p className="yds-panic-center__metric-tone">{missingMetricLabel(card.id)}</p> : null}
                <Sparkline points={card.spark} />
              </div>
              )
            })}
          </div>
          <div className="yds-panic-center__credit-ref" aria-label="신용 사이클 참고 지표">
            <p className="yds-panic-center__credit-ref-title">
              신용 참고 · Panic 점수 미포함 ·{" "}
              <Link to="/credit-cycle">신용 사이클(준비 중)</Link>
            </p>
            <div className="yds-panic-center__metric-grid yds-panic-center__metric-grid--credit">
              {creditRefCards.map((card) => {
                const dataState = classifyMetricState(panicData, card.id)
                return (
                  <div key={card.id} className="yds-panic-center__metric-card is-credit-ref">
                    <p className="yds-panic-center__metric-label">
                      {card.label}
                      <span className={`yds-data-state is-${dataState.toLowerCase()}`}>{dataState}</span>
                    </p>
                    <p className="yds-panic-center__metric-value font-mono tabular-nums">
                      {card.value ?? "—"}
                    </p>
                    {card.tone ? <p className="yds-panic-center__metric-tone">{card.tone}</p> : null}
                    {card.missing ? (
                      <p className="yds-panic-center__metric-tone">{missingMetricLabel(card.id)}</p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </header>

      {historySlot ? (
        <div className="yds-panic-center__history-slot yds-panic-center__history-slot--design-b">
          <YdsProFeatureGate unlocked={visibility.proHistoryChart}>{historySlot}</YdsProFeatureGate>
        </div>
      ) : null}

      {belowHero ? <div className="yds-panic-center__stock-slot">{belowHero}</div> : null}

      <section
        className={[
          "yds-panic-center__block",
          "yds-panic-center__block--fear",
          score == null ? "is-unmeasured" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="yds-panic-center__block-head">
          <h3 className="yds-panic-center__block-label">FEAR SCALE</h3>
          {score == null ? (
            <p className="yds-panic-center__block-status">미측정</p>
          ) : status ? (
            <p className="yds-panic-center__block-status is-live">
              현재 {status.label} · {score}/100
            </p>
          ) : null}
        </div>
        {score == null ? (
          <p className="yds-panic-center__empty-note" role="status">
            실수집 Panic Index가 없어 현재 위치를 표시하지 않습니다. 구간 정의만 참고용으로 보여 줍니다.
          </p>
        ) : null}
        <div className="yds-panic-center__fear-scale" role="list">
          {PANIC_INDEX_STAGE_BANDS.map((b) => {
            const isCurrent = score != null && status?.id === b.id
            const widthPct = b.max - b.min + (b.max === 100 ? 1 : 0)
            return (
              <div
                key={b.id}
                role="listitem"
                className={[
                  "yds-panic-center__fear-stage",
                  isCurrent ? "is-current" : "",
                  score == null ? "is-dormant" : "",
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
                      <span className="yds-panic-center__now-badge">
                        {scoreDataState === "LIVE" ? "현재" : "이 점수"}
                      </span>
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

      <section className="yds-panic-center__block yds-panic-center__block--drivers">
        <h3 className="yds-panic-center__block-label">PANIC DRIVERS</h3>
        <YdsProFeatureGate
          unlocked={visibility.proDriversDetail}
          body="지표별 점수, 가중치, 기여도는 PRO에서 확인할 수 있습니다. 없는 값은 —로 표시합니다."
        >
          {!(breakdown?.lines?.length) ? (
            <p className="yds-panic-center__empty-note" role="status">
              드라이버 분해를 계산할 실수집 지표가 없습니다. Value / Score / Weight / Contribution은 데이터가
              연결되면 표시됩니다.
            </p>
          ) : (
            <>
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
                    {breakdown.lines.map((line) => (
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
                {breakdown.lines.map((line) => (
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
            </>
          )}
        </YdsProFeatureGate>
      </section>
    </article>
  )
}
