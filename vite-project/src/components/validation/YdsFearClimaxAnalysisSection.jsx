import { useMemo } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildFearClimaxAnalysisReport,
  FEAR_CLIMAX_ANALYSIS_IDS,
  formatStageBadge,
} from "../../trading-zone/ydsPanicFearClimaxAnalysis.js"
import { formatMetric } from "../../trading-zone/ydsHistoricalEventTypes.js"

function formatYds(value) {
  if (value == null || !Number.isFinite(value)) return "—"
  return String(Math.round(value))
}

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsFearClimaxAnalysisSection({ events = YDS_VALIDATION_EVENT_DATASET }) {
  const report = useMemo(() => {
    const targets = events.filter((e) => FEAR_CLIMAX_ANALYSIS_IDS.includes(e.id))
    return buildFearClimaxAnalysisReport(targets)
  }, [events])

  const { rows, summary, globalInsights, yenVsCovidClimax } = report

  return (
    <section
      className="panic-validation-panel yds-fear-climax-analysis"
      aria-labelledby="yds-fear-climax-analysis-title"
    >
      <h2 id="yds-fear-climax-analysis-title" className="panic-validation-panel__h2">
        YDS 최종 검증 — 공포확대 vs 극점
      </h2>
      <p className="panic-validation-panel__note">
        엔진 튜닝 전 분석 전용 · 가중치/캡 수정 없음 · 코로나·2022·SVB·엔캐리 4건
      </p>

      <article className="yds-fear-climax-analysis__verdict" aria-label="종합 판정">
        <p className="m-0 yds-fear-climax-analysis__verdict-title">검증 질문: 시장 저점 탐지기 vs 공포 탐지기?</p>
        <ul className="yds-fear-climax-analysis__insights">
          {globalInsights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </article>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">1. 공포확대 · 극점 YDS 비교표</p>
        <table className="panic-validation-year-table panic-validation-year-table--vs yds-panic-validation__table">
          <thead>
            <tr>
              <th scope="col">이벤트</th>
              <th scope="col">공포확대 날짜</th>
              <th scope="col">공포확대 YDS</th>
              <th scope="col">극점 날짜</th>
              <th scope="col">극점 YDS</th>
              <th scope="col">차이(공포−극점)</th>
              <th scope="col">최고 YDS 시점</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className="font-mono tabular-nums">{row.fear.date ?? "—"}</td>
                <td className="font-mono tabular-nums">
                  {formatYds(row.fear.yds)} {formatStageBadge(row.fear.stageEmoji, row.fear.stageLabel)}
                </td>
                <td className="font-mono tabular-nums">{row.climax.date ?? "—"}</td>
                <td className="font-mono tabular-nums">
                  {formatYds(row.climax.yds)} {formatStageBadge(row.climax.stageEmoji, row.climax.stageLabel)}
                </td>
                <td
                  className={[
                    "font-mono tabular-nums",
                    row.deltaFearMinusClimax > 0 ? "panic-validation-year-table__up" : "",
                    row.deltaFearMinusClimax < 0 ? "panic-validation-year-table__down" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {row.deltaFearMinusClimax != null
                    ? `${row.deltaFearMinusClimax > 0 ? "+" : ""}${row.deltaFearMinusClimax}`
                    : "—"}
                </td>
                <td>
                  {row.peak ? (
                    <>
                      {row.peak.label} {formatYds(row.peak.yds)} ({row.peak.date})
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">2. 이벤트별 분석 리포트</p>
        {rows.map((row) => (
          <article key={`report-${row.id}`} className="yds-fear-climax-analysis__event-card">
            <p className="m-0 yds-fear-climax-analysis__event-title">{row.name}</p>
            <p className="m-0 font-mono tabular-nums yds-fear-climax-analysis__event-metrics">
              공포확대 YDS {formatYds(row.fear.yds)} · 극점 YDS {formatYds(row.climax.yds)} · 최고{" "}
              {row.peak ? `${row.peak.label} ${formatYds(row.peak.yds)}` : "—"}
            </p>
            <table className="panic-validation-year-table yds-fear-climax-analysis__mini-table">
              <thead>
                <tr>
                  <th scope="col">구분</th>
                  <th scope="col">VIX</th>
                  <th scope="col">HY</th>
                  <th scope="col">단기/중기</th>
                  <th scope="col">가중 규칙</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>공포확대</td>
                  <td className="font-mono tabular-nums">{formatMetric(row.fear.vix)}</td>
                  <td className="font-mono tabular-nums">{formatMetric(row.fear.highYield)}</td>
                  <td className="font-mono tabular-nums">
                    {row.fear.shortScore}/{row.fear.midScore}
                  </td>
                  <td>{row.fear.weightNote ?? "—"}</td>
                </tr>
                <tr>
                  <td>극점</td>
                  <td className="font-mono tabular-nums">{formatMetric(row.climax.vix)}</td>
                  <td className="font-mono tabular-nums">{formatMetric(row.climax.highYield)}</td>
                  <td className="font-mono tabular-nums">
                    {row.climax.shortScore}/{row.climax.midScore}
                  </td>
                  <td>{row.climax.weightNote ?? "—"}</td>
                </tr>
              </tbody>
            </table>
            <ul className="yds-fear-climax-analysis__insights">
              {row.insights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">3. 엔캐리 71 vs 코로나 66 (극점) 원인 분석</p>
        <ul className="yds-fear-climax-analysis__insights yds-fear-climax-analysis__insights--accent">
          {yenVsCovidClimax.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="m-0 panic-validation-panel__note">
          요약: 코로나 최고 YDS는 공포확대 {formatYds(rows.find((r) => r.id === "panic-2020-covid")?.fear.yds)}(극점{" "}
          {formatYds(rows.find((r) => r.id === "panic-2020-covid")?.climax.yds)}). 엔캐리는 극점{" "}
          {formatYds(rows.find((r) => r.id === "panic-2024-yen-carry")?.climax.yds)}이 최고(공포확대{" "}
          {formatYds(rows.find((r) => r.id === "panic-2024-yen-carry")?.fear.yds)}).
        </p>
      </div>

      <div className="yds-panic-validation__block">
        <p className="m-0 panic-validation-panel__h3">4. 엔진 요인 평가 (수정 없음)</p>
        <dl className="yds-fear-climax-analysis__factors">
          <div>
            <dt>VIX 캡 (40 이상 → scoreVIX 100)</dt>
            <dd>
              공포확대 {summary.compared}건 중 VIX 캡 적용 다수. 캡 이후 VIX 60·80 차이가 단기 점수에 반영되지 않음.
            </dd>
          </div>
          <div>
            <dt>HY 가중 (HY&gt;6 → 중기 60%)</dt>
            <dd>
              코로나·SVB 극점에서 HY&gt;6 적용 → VIX 극단값이 최종 YDS에 40%만 반영. 엔캐리 극점(HY 4.5%)은 단기 70%로
              상대 고점 발생.
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
