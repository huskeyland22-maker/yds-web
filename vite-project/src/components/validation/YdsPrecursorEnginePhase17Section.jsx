import { useCallback, useMemo, useState } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { formatMetric } from "../../trading-zone/ydsHistoricalEventTypes.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase17Report,
  PRECURSOR_ENGINE_PHASE17_LABEL,
  recordTodayMarketJournalSnapshot,
} from "../../trading-zone/ydsPrecursorEnginePhase17.js"
import {
  clearPrecursorMarketJournal,
  loadPrecursorMarketJournal,
} from "../../trading-zone/ydsPrecursorMarketJournalStorage.js"
import { getPrecursorMetricDisplay } from "../../trading-zone/ydsPrecursorMetricDisplay.js"
import YdsRiskPatternLabel from "./YdsRiskPatternLabel.jsx"

function fmt(v, d = 0) {
  if (v == null || !Number.isFinite(v)) return "—"
  return formatMetric(v, d)
}

function DeltaCell({ value, label }) {
  if (label && !value && value !== 0) return <span>{label}</span>
  if (value == null || !Number.isFinite(value)) return <span>{label ?? "—"}</span>
  const cls =
    value > 0
      ? "yds-precursor-engine-p17__delta-up"
      : value < 0
        ? "yds-precursor-engine-p17__delta-down"
        : ""
  const sign = value > 0 ? "+" : ""
  return (
    <span className={cls}>
      {label ?? `${sign}${value}`}
    </span>
  )
}

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 * }} props
 */
export default function YdsPrecursorEnginePhase17Section({
  events = YDS_VALIDATION_EVENT_DATASET,
  latestCycleRow = null,
}) {
  const [logVersion, setLogVersion] = useState(0)
  const [saveMessage, setSaveMessage] = useState("")

  const latestSnapshot = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    if (panic) return { ...latestCycleRow, ...panic, date: latestCycleRow.date ?? panic.updatedAt }
    return latestCycleRow
  }, [latestCycleRow])

  const report = useMemo(() => {
    void logVersion
    return buildPrecursorEnginePhase17Report(events, {
      latestSnapshot,
      log: loadPrecursorMarketJournal(),
    })
  }, [events, latestSnapshot, logVersion])

  const handleSave = useCallback(() => {
    const result = recordTodayMarketJournalSnapshot(events, { latestSnapshot })
    setLogVersion((v) => v + 1)
    setSaveMessage(
      result.ok
        ? `${result.log[result.log.length - 1]?.date ?? "오늘"} 저널 저장됨 (Phase 13 동기화)`
        : "저장 실패 (localStorage)",
    )
  }, [events, latestSnapshot])

  const handleClear = useCallback(() => {
    if (typeof window !== "undefined" && window.confirm("Market Journal 전체를 삭제할까요?")) {
      clearPrecursorMarketJournal()
      setLogVersion((v) => v + 1)
      setSaveMessage("저널 삭제됨")
    }
  }, [])

  const {
    live,
    storage,
    comparison30,
    regimeChangeLog,
    patternRotationLog,
    stats90d,
    leadingIndicator,
    journal,
    dailyLog,
    weeklySummaries,
    monthlySummaries,
    notes,
  } = report
  const m = getPrecursorMetricDisplay

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p17"
      aria-labelledby="yds-precursor-engine-p17-title"
    >
      <h2 id="yds-precursor-engine-p17-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE17_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        실제 시장 일별 기록 · 행동·신뢰도·자동 해석 · 검증 페이지 전용 · Phase 0~16 읽기 전용
      </p>

      <div className="yds-precursor-engine-p17__toolbar">
        <button type="button" className="yds-precursor-engine-p17__btn-save" onClick={handleSave}>
          {storage.hasToday ? "오늘 저널 갱신" : "오늘 저널 저장"}
        </button>
        <button type="button" className="yds-precursor-engine-p17__btn-clear" onClick={handleClear}>
          저널 초기화
        </button>
        <span className="yds-precursor-engine-p17__storage-meta font-mono tabular-nums">
          {storage.totalEntries}일 · {storage.firstDate ?? "—"} ~ {storage.lastDate ?? "—"}
        </span>
      </div>
      {saveMessage ? <p className="m-0 yds-precursor-engine-p17__save-msg">{saveMessage}</p> : null}

      <article className="yds-precursor-engine-p17__snapshot" aria-label="Daily Snapshot">
        <p className="m-0 panic-validation-panel__h3">Daily Snapshot (미리보기)</p>
        <div className="yds-precursor-engine-p17__snapshot-grid font-mono tabular-nums">
          <span>
            {m("yds").label} {fmt(live.ydsScore)}
          </span>
          <span>
            {m("priA").label} {fmt(live.priA)}
          </span>
          <span>
            {m("priB").label} {fmt(live.priB)}
          </span>
          <span>
            {live.regimeEmoji} {live.regimeLabel}
          </span>
          <span>
            <YdsRiskPatternLabel
              patternId={live.dominantPatternId}
              patternLabel={live.dominantPatternLabel}
            />{" "}
            {fmt(live.dominantSimilarity)}%
          </span>
          <span>
            {live.actionEmoji} {live.actionLabel}
          </span>
          <span>
            신뢰도 {live.confidenceScore}% · {live.confidenceLabel}
          </span>
        </div>
      </article>

      <article className="yds-precursor-engine-p17__block" aria-label="30일 변화">
        <p className="m-0 panic-validation-panel__h3">30일 변화</p>
        {comparison30.hasPast ? (
          <p className="panic-validation-panel__note m-0">
            {comparison30.pastDate} → {comparison30.currentDate}
          </p>
        ) : (
          <p className="m-0 text-slate-500">30일 전 기록 없음 · 저장 후 비교</p>
        )}
        <table className="panic-validation-year-table yds-precursor-engine-p17__table">
          <thead>
            <tr>
              <th scope="col">항목</th>
              <th scope="col">Δ / 변화</th>
            </tr>
          </thead>
          <tbody>
            {comparison30.rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>
                  <DeltaCell value={row.delta} label={row.deltaLabel} />
                  {row.changed ? (
                    <span className="yds-precursor-engine-p17__changed-tag"> 변경</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article
        className={`yds-precursor-engine-p17__leading ${leadingIndicator.found ? "yds-precursor-engine-p17__leading--found" : ""}`}
        aria-label="Leading Indicator Tracking"
      >
        <p className="m-0 panic-validation-panel__h3">Leading Indicator · 누가 먼저 움직였는지</p>
        <p className="m-0 yds-precursor-engine-p17__leading-val">
          <strong>{leadingIndicator.label}</strong>
          {leadingIndicator.found ? (
            <>
              {" "}
              · {leadingIndicator.date} · Δ{leadingIndicator.delta}
            </>
          ) : null}
        </p>
        <p className="m-0 yds-precursor-engine-p17__leading-reason">{leadingIndicator.reason}</p>
        {leadingIndicator.recentMoves?.length ? (
          <ul className="yds-precursor-engine-p17__leading-list">
            {leadingIndicator.recentMoves.map((e) => (
              <li key={`${e.date}-${e.key}`}>
                <span className="font-mono tabular-nums">{e.date}</span> {e.label} Δ{e.delta}
              </li>
            ))}
          </ul>
        ) : null}
      </article>

      <div className="yds-precursor-engine-p17__two-col">
        <article className="yds-precursor-engine-p17__block" aria-label="Regime Change Log">
          <p className="m-0 panic-validation-panel__h3">Regime Change Log</p>
          <p className="panic-validation-panel__note m-0">90일 {stats90d.regimeChangeCount}회</p>
          {regimeChangeLog.length ? (
            <ul className="yds-precursor-engine-p17__log-list">
              {regimeChangeLog.map((e) => (
                <li key={`${e.date}-${e.toId}`}>
                  <span className="font-mono tabular-nums">{e.date}</span>
                  <span>
                    {e.from.emoji} {e.from.label} → {e.to.emoji} {e.to.label}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-slate-500">기록 없음</p>
          )}
        </article>

        <article className="yds-precursor-engine-p17__block" aria-label="Pattern Rotation Log">
          <p className="m-0 panic-validation-panel__h3">Pattern Rotation Log</p>
          <p className="panic-validation-panel__note m-0">90일 1위 변경 {stats90d.patternChangeCount}회</p>
          {patternRotationLog.length ? (
            <ul className="yds-precursor-engine-p17__log-list">
              {patternRotationLog.map((e) => (
                <li key={e.date}>
                  <span className="font-mono tabular-nums">{e.date}</span>
                  {e.topChanged ? (
                    <span>
                      1위 {e.fromTop} → {e.toTop}
                    </span>
                  ) : (
                    <span>순위 이동 {e.rankShifts.length}건</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-slate-500">기록 없음</p>
          )}
        </article>
      </div>

      <article className="yds-precursor-engine-p17__block" aria-label="Validation Journal">
        <p className="m-0 panic-validation-panel__h3">Validation Journal · 자동 시장 기록</p>
        {journal.length ? (
          <ul className="yds-precursor-engine-p17__journal">
            {journal.map((entry) => (
              <li key={entry.date} className="yds-precursor-engine-p17__journal-item">
                <div className="yds-precursor-engine-p17__journal-head">
                  <span className="font-mono tabular-nums">{entry.date}</span>
                  <span className="yds-precursor-engine-p17__journal-meta">
                    {entry.regimeLabel} · {entry.action} · {entry.confidence}
                  </span>
                </div>
                <p className="m-0 yds-precursor-engine-p17__journal-pattern">{entry.patternLine}</p>
                <pre className="m-0 yds-precursor-engine-p17__journal-text">{entry.journalText}</pre>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-slate-500">저장된 저널 없음</p>
        )}
      </article>

      <article className="yds-precursor-engine-p17__block" aria-label="일별 로그">
        <p className="m-0 panic-validation-panel__h3">일별 로그</p>
        {dailyLog.length ? (
          <div className="yds-precursor-engine-p17__daily-scroll">
            <table className="panic-validation-year-table yds-precursor-engine-p17__daily-table">
              <thead>
                <tr>
                  <th scope="col">날짜</th>
                  <th scope="col">위치</th>
                  <th scope="col">조기</th>
                  <th scope="col">충격</th>
                  <th scope="col">행동</th>
                  <th scope="col">신뢰</th>
                </tr>
              </thead>
              <tbody>
                {dailyLog.map((row) => (
                  <tr key={row.date}>
                    <td className="font-mono tabular-nums">{row.date}</td>
                    <td>{fmt(row.ydsScore)}</td>
                    <td>{fmt(row.priA)}</td>
                    <td>{fmt(row.priB)}</td>
                    <td>
                      {row.actionEmoji} {row.actionLabel}
                    </td>
                    <td>
                      {row.confidenceScore}% {row.confidenceLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="m-0 text-slate-500">—</p>
        )}
      </article>

      <div className="yds-precursor-engine-p17__summaries">
        <article className="yds-precursor-engine-p17__block" aria-label="주간 요약">
          <p className="m-0 panic-validation-panel__h3">주간 요약</p>
          {weeklySummaries.length ? (
            <ul className="yds-precursor-engine-p17__summary-list">
              {weeklySummaries.map((w) => (
                <li key={w.period}>
                  <span className="font-mono tabular-nums">{w.period}</span>
                  <span>{w.headline}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-slate-500">—</p>
          )}
        </article>

        <article className="yds-precursor-engine-p17__block" aria-label="월간 요약">
          <p className="m-0 panic-validation-panel__h3">월간 요약</p>
          {monthlySummaries.length ? (
            <ul className="yds-precursor-engine-p17__summary-list">
              {monthlySummaries.map((mo) => (
                <li key={mo.period}>
                  <span className="font-mono tabular-nums">{mo.period}</span>
                  <span>{mo.headline}</span>
                  {mo.lastAction ? (
                    <span className="yds-precursor-engine-p17__summary-sub">최종 {mo.lastAction}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-slate-500">—</p>
          )}
        </article>
      </div>

      <ul className="panic-validation-panel__notes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
