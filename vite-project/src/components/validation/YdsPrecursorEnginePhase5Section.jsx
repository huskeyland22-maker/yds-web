import { useMemo } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase5Report,
  PATTERN_ARCHETYPES,
  PRECURSOR_ENGINE_PHASE5_LABEL,
} from "../../trading-zone/ydsPrecursorEnginePhase5.js"

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   latestPanic?: Record<string, unknown> | null
 * }} props
 */
export default function YdsPrecursorEnginePhase5Section({
  events = YDS_VALIDATION_EVENT_DATASET,
  latestCycleRow = null,
  latestPanic = null,
}) {
  const latestSnapshot = useMemo(() => {
    if (latestPanic && typeof latestPanic === "object") {
      return {
        vix: latestPanic.vix,
        fearGreed: latestPanic.fearGreed,
        cnn: latestPanic.fearGreed,
        bofa: latestPanic.bofa,
        putCall: latestPanic.putCall,
        highYield: latestPanic.highYield,
        date: latestPanic.tradeDate ?? latestPanic.updatedAt ?? null,
      }
    }
    if (latestCycleRow) {
      const panic = panicDataFromCycleRow(latestCycleRow)
      if (panic) return { ...latestCycleRow, ...panic }
    }
    return null
  }, [latestCycleRow, latestPanic])

  const report = useMemo(
    () => buildPrecursorEnginePhase5Report(events, { latestSnapshot }),
    [events, latestSnapshot],
  )

  const {
    tpCount,
    panicCount,
    tpTable,
    contributionAnalysis,
    patternClusters,
    similarityEngineDraft,
    patternDictionary,
    notes,
  } = report

  const { compare } = similarityEngineDraft

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p5"
      aria-labelledby="yds-precursor-engine-p5-title"
    >
      <h2 id="yds-precursor-engine-p5-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE5_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        TP {tpCount}/{panicCount}건 · 왜 잡혔는지 · 공통 패턴 · 검증 전용
      </p>

      <article className="yds-precursor-engine-p5__block" aria-label="1. TP 이벤트 테이블">
        <p className="m-0 panic-validation-panel__h3">1. TP 이벤트 테이블</p>
        <div className="yds-precursor-engine-p5__scroll">
          <table className="panic-validation-year-table yds-precursor-engine-p5__tp-table">
            <thead>
              <tr>
                <th scope="col">이벤트명</th>
                <th scope="col">최초 경고</th>
                <th scope="col">PRI-A</th>
                <th scope="col">PRI-B</th>
                <th scope="col">주요 기여 지표</th>
                <th scope="col">패턴</th>
              </tr>
            </thead>
            <tbody>
              {tpTable.map((row) => (
                <tr key={row.id} className="yds-precursor-engine-p5__row-tp">
                  <td>{row.name}</td>
                  <td className="font-mono tabular-nums">{row.firstWarning}</td>
                  <td className="font-mono tabular-nums">{row.priAAtWarning ?? "—"}</td>
                  <td className="font-mono tabular-nums">{row.priBAtWarning ?? "—"}</td>
                  <td>{row.topContributors || "—"}</td>
                  <td>
                    {row.patternCluster}
                    {row.patternSimilarity != null ? ` (${row.patternSimilarity}%)` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="yds-precursor-engine-p5__block" aria-label="2. 기여도 분석">
        <p className="m-0 panic-validation-panel__h3">2. 기여도 분석</p>
        <table className="panic-validation-year-table yds-precursor-engine-p5__contrib-table">
          <thead>
            <tr>
              <th scope="col">지표</th>
              <th scope="col">TP 기여 비율</th>
              <th scope="col">Top2 기여율</th>
              <th scope="col">평균 점수</th>
              <th scope="col">TP 건수</th>
            </tr>
          </thead>
          <tbody>
            {contributionAnalysis.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td className="font-mono tabular-nums">{row.tpRate}%</td>
                <td className="font-mono tabular-nums">{row.topContributorRate}%</td>
                <td className="font-mono tabular-nums">{row.avgPoints}</td>
                <td className="font-mono tabular-nums">
                  {row.eventCount}/{tpCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="yds-precursor-engine-p5__block" aria-label="3. 패턴 군집화">
        <p className="m-0 panic-validation-panel__h3">3. 패턴 군집화</p>
        <ul className="yds-precursor-engine-p5__archetype-legend">
          {Object.values(PATTERN_ARCHETYPES).map((a) => (
            <li key={a.id}>
              <strong>{a.label}</strong> — {a.description}
            </li>
          ))}
        </ul>
        <table className="panic-validation-year-table yds-precursor-engine-p5__cluster-table">
          <thead>
            <tr>
              <th scope="col">패턴</th>
              <th scope="col">TP 배정</th>
              <th scope="col">유사≥60%</th>
              <th scope="col">멤버</th>
            </tr>
          </thead>
          <tbody>
            {patternClusters.map((c) => (
              <tr key={c.id}>
                <td>{c.label}</td>
                <td className="font-mono tabular-nums">{c.memberCount}</td>
                <td className="font-mono tabular-nums">{c.similarCount}</td>
                <td className="text-xs">{c.members.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="yds-precursor-engine-p5__block" aria-label="4. 유사도 엔진 초안">
        <p className="m-0 panic-validation-panel__h3">4. 유사도 엔진 초안</p>
        <p className="m-0 yds-event-detail__hint">
          {similarityEngineDraft.version} · {similarityEngineDraft.purpose}
        </p>
        <p className="m-0 yds-event-detail__hint">
          API: {similarityEngineDraft.apiShape.input} → {similarityEngineDraft.apiShape.output}
        </p>
        {compare.currentVector ? (
          <>
            <p className="m-0 yds-event-detail__hint">
              현재 ({compare.asOf ?? "—"}) PRI-A {compare.currentPriA ?? "—"} · PRI-B{" "}
              {compare.currentPriB ?? "—"}
            </p>
            <table className="panic-validation-year-table yds-precursor-engine-p5__sim-table">
              <thead>
                <tr>
                  <th scope="col">패턴</th>
                  <th scope="col">유사도</th>
                  <th scope="col">참조 이벤트</th>
                </tr>
              </thead>
              <tbody>
                {compare.similarities.map((s) => (
                  <tr
                    key={s.patternId}
                    className={
                      s.patternId === compare.nearestPattern?.patternId
                        ? "yds-precursor-engine-p5__row-nearest"
                        : ""
                    }
                  >
                    <td>{s.patternLabel}</td>
                    <td className="font-mono tabular-nums">{s.similarity}%</td>
                    <td className="font-mono text-xs">{s.referenceEventId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="m-0 yds-event-detail__hint">현재 시장 스냅샷 없음 — extended history fallback 사용</p>
        )}
      </article>

      <article className="yds-precursor-engine-p5__block yds-precursor-engine-p5__final" aria-label="5. 전조 패턴 사전">
        <p className="m-0 panic-validation-panel__h3">5. {patternDictionary.title}</p>
        <p className="m-0 yds-precursor-engine-p5__dict-summary">{patternDictionary.summary}</p>
        <p className="m-0 yds-event-detail__hint">{patternDictionary.currentMarketHint}</p>
        <ul className="yds-precursor-engine-p5__dict-entries">
          {patternDictionary.entries.map((e) => (
            <li key={e.patternId}>
              <strong>{e.title}</strong> — {e.signature}
              {e.members.length ? ` · TP: ${e.members.join(", ")}` : ""}
            </li>
          ))}
        </ul>
        <ul className="yds-engine-candidate__notes">
          {patternDictionary.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </article>
    </section>
  )
}
