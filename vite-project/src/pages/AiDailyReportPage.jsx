import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildAiDailyReport,
  AI_DAILY_REPORT_LABEL,
} from "../trading-zone/ydsAiDailyReportEngine.js"
import { formatSectorRadarScore } from "../trading-zone/ydsPrecursorEnginePhase25.js"

export default function AiDailyReportPage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )
  const latestCycleRow = history[history.length - 1] ?? null

  const latestSnapshot = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    if (panic) return { ...latestCycleRow, ...panic, date: latestCycleRow.date ?? panic.updatedAt }
    return latestCycleRow
  }, [latestCycleRow])

  const report = useMemo(
    () =>
      buildAiDailyReport(YDS_VALIDATION_EVENT_DATASET, {
        latestSnapshot,
        extraRows: history,
      }),
    [latestSnapshot, history],
  )

  const { sectionA, sectionB, sectionC, sectionD, sectionE, sectionF, narrative } = report

  return (
    <div className="yds-ai-report min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-ai-report__header">
        <div>
          <p className="yds-ai-report__kicker">{AI_DAILY_REPORT_LABEL}</p>
          <h1 className="yds-ai-report__title">{report.title}</h1>
          <p className="yds-ai-report__sub">
            기준 {report.asOfDisplay} · {report.generatedNote}
          </p>
        </div>
        <Link to="/market-analysis" className="yds-ai-report__link">
          현재 시장 분석
        </Link>
      </header>

      {!report.available ? (
        <p className="yds-ai-report__empty">시장 분석 데이터가 없어 일일 리포트를 생성할 수 없습니다.</p>
      ) : (
        <>
          <article className="yds-ai-report__narrative" aria-label="오늘의 종합 해석">
            <p className="yds-ai-report__narrative-text">{narrative}</p>
          </article>

          <section className="yds-ai-report__section" aria-labelledby="ai-report-a">
            <h2 id="ai-report-a" className="yds-ai-report__h2">
              현재 시장
            </h2>
            <p className="yds-ai-report__lead">{sectionA.headline}</p>
          </section>

          <section className="yds-ai-report__section" aria-labelledby="ai-report-b">
            <h2 id="ai-report-b" className="yds-ai-report__h2">
              시장 단계
            </h2>
            <p className="yds-ai-report__card-title">{sectionB.title}</p>
            <p className="yds-ai-report__body">{sectionB.body}</p>
            {sectionB.allocationHint ? (
              <p className="yds-ai-report__meta">권장 비중 · {sectionB.allocationHint}</p>
            ) : null}
          </section>

          <section className="yds-ai-report__section" aria-labelledby="ai-report-c">
            <h2 id="ai-report-c" className="yds-ai-report__h2">
              핵심 위험
            </h2>
            <p className="yds-ai-report__card-title">{sectionC.title}</p>
            <p className="yds-ai-report__body">{sectionC.body}</p>
            {sectionC.bullLine ? <p className="yds-ai-report__body">{sectionC.bullLine}</p> : null}
            {sectionC.contrast ? <p className="yds-ai-report__meta">{sectionC.contrast}</p> : null}
            {sectionC.confidenceLine ? (
              <p className="yds-ai-report__meta">{sectionC.confidenceLine}</p>
            ) : null}
          </section>

          <section className="yds-ai-report__section" aria-labelledby="ai-report-d">
            <h2 id="ai-report-d" className="yds-ai-report__h2">
              기회 요인 · 추천 섹터
            </h2>
            <p className="yds-ai-report__lead">{sectionD.summary}</p>
            {sectionD.items.length ? (
              <ol className="yds-ai-report__list">
                {sectionD.items.map((s) => (
                  <li key={s.label}>
                    <span className="yds-ai-report__rank">{s.rank}</span>
                    <span>{s.label}</span>
                    <span className="font-mono tabular-nums">{formatSectorRadarScore(s.score)}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>

          <section className="yds-ai-report__section" aria-labelledby="ai-report-e">
            <h2 id="ai-report-e" className="yds-ai-report__h2">
              기회 요인 · 추천 종목
            </h2>
            <p className="yds-ai-report__lead">{sectionE.summary}</p>
            {sectionE.items.length ? (
              <ol className="yds-ai-report__list">
                {sectionE.items.map((s) => (
                  <li key={`${s.rank}-${s.name}`}>
                    <span className="yds-ai-report__rank">{s.rank}</span>
                    <span>{s.name}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>

          <section className="yds-ai-report__section" aria-labelledby="ai-report-f">
            <h2 id="ai-report-f" className="yds-ai-report__h2">
              추천 행동
            </h2>
            <p className="yds-ai-report__card-title">
              현재 행동 · {sectionF.action}
              {sectionF.recommended ? ` → 권장 ${sectionF.recommended}` : ""}
            </p>
            <p className="yds-ai-report__body yds-ai-report__body--action">{sectionF.body}</p>
            {sectionF.allocation ? (
              <p className="yds-ai-report__meta">포트폴리오 · {sectionF.allocation}</p>
            ) : null}
          </section>

          <ul className="yds-ai-report__footnotes">
            {report.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
