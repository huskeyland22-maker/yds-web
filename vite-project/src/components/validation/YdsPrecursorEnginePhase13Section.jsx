import { useCallback, useMemo, useState } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { formatMetric } from "../../trading-zone/ydsHistoricalEventTypes.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase13Report,
  PRECURSOR_ENGINE_PHASE13_LABEL,
  recordTodayValidationSnapshot,
} from "../../trading-zone/ydsPrecursorEnginePhase13.js"
import {
  clearPrecursorValidationLog,
  loadPrecursorValidationLog,
} from "../../trading-zone/ydsPrecursorValidationLogStorage.js"

function fmt(v, d = 0) {
  if (v == null || !Number.isFinite(v)) return "—"
  return formatMetric(v, d)
}

function DeltaCell({ value, label }) {
  if (label && !value && value !== 0) return <span>{label}</span>
  if (value == null || !Number.isFinite(value)) return <span>{label ?? "—"}</span>
  const cls =
    value > 0
      ? "yds-precursor-engine-p13__delta-up"
      : value < 0
        ? "yds-precursor-engine-p13__delta-down"
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
export default function YdsPrecursorEnginePhase13Section({
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
    const log = loadPrecursorValidationLog()
    return buildPrecursorEnginePhase13Report(events, {
      latestSnapshot,
      log,
    })
  }, [events, latestSnapshot, logVersion])

  const handleSave = useCallback(() => {
    const result = recordTodayValidationSnapshot(events, { latestSnapshot })
    setLogVersion((v) => v + 1)
    setSaveMessage(
      result.ok
        ? `${result.log[result.log.length - 1]?.date ?? "오늘"} 스냅샷 저장됨`
        : "저장 실패 (localStorage)",
    )
  }, [events, latestSnapshot])

  const handleClear = useCallback(() => {
    if (typeof window !== "undefined" && window.confirm("검증 로그 전체를 삭제할까요?")) {
      clearPrecursorValidationLog()
      setLogVersion((v) => v + 1)
      setSaveMessage("로그 삭제됨")
    }
  }, [])

  const {
    live,
    storage,
    comparison30,
    regimeChangeLog,
    patternRankChangeLog,
    stats90d,
    firstMover,
    journal,
    notes,
  } = report

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p13"
      aria-labelledby="yds-precursor-engine-p13-title"
    >
      <h2 id="yds-precursor-engine-p13-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE13_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        실제 시장 일별 기록 · localStorage · Phase 12 스냅샷 · 검증 전용
      </p>

      <div className="yds-precursor-engine-p13__toolbar">
        <button type="button" className="yds-precursor-engine-p13__btn-save" onClick={handleSave}>
          {storage.hasToday ? "오늘 스냅샷 갱신" : "오늘 스냅샷 저장"}
        </button>
        <button type="button" className="yds-precursor-engine-p13__btn-clear" onClick={handleClear}>
          로그 초기화
        </button>
        <span className="yds-precursor-engine-p13__storage-meta font-mono tabular-nums">
          {storage.totalEntries}일 · {storage.firstDate ?? "—"} ~ {storage.lastDate ?? "—"}
        </span>
      </div>
      {saveMessage ? <p className="m-0 yds-precursor-engine-p13__save-msg">{saveMessage}</p> : null}

      <article className="yds-precursor-engine-p13__live" aria-label="오늘 실측">
        <p className="m-0 panic-validation-panel__h3">오늘 실측 (저장 전 미리보기)</p>
        <div className="yds-precursor-engine-p13__live-grid font-mono tabular-nums">
          <span>YDS {fmt(live.ydsScore)}</span>
          <span>PRI-A {fmt(live.priA)}</span>
          <span>PRI-B {fmt(live.priB)}</span>
          <span>
            {live.regimeEmoji} {live.regimeLabel}
          </span>
          <span>
            {live.dominantPatternLabel} {fmt(live.dominantSimilarity)}%
          </span>
        </div>
      </article>

      <article className="yds-precursor-engine-p13__block" aria-label="30일 변화 비교">
        <p className="m-0 panic-validation-panel__h3">30일 변화 비교</p>
        {comparison30.hasPast ? (
          <p className="panic-validation-panel__note m-0">
            {comparison30.pastDate} → {comparison30.currentDate}
          </p>
        ) : (
          <p className="m-0 text-slate-500">30일 전 스냅샷 없음 · 저장 후 비교 가능</p>
        )}
        <table className="panic-validation-year-table yds-precursor-engine-p13__table">
          <thead>
            <tr>
              <th scope="col">지표</th>
              <th scope="col">30일 Δ / 변화</th>
            </tr>
          </thead>
          <tbody>
            {comparison30.rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>
                  <DeltaCell value={row.delta} label={row.deltaLabel} />
                  {row.changed ? (
                    <span className="yds-precursor-engine-p13__changed-tag"> 변경</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article
        className={`yds-precursor-engine-p13__first-mover ${firstMover.found ? "yds-precursor-engine-p13__first-mover--found" : ""}`}
        aria-label="가장 먼저 움직인 지표"
      >
        <p className="m-0 panic-validation-panel__h3">가장 먼저 움직인 지표</p>
        <p className="m-0 yds-precursor-engine-p13__first-mover-val">
          <strong>{firstMover.label}</strong>
          {firstMover.found ? (
            <>
              {" "}
              · {firstMover.date} · Δ{firstMover.delta}
            </>
          ) : null}
        </p>
        <p className="m-0 yds-precursor-engine-p13__first-mover-reason">{firstMover.reason}</p>
      </article>

      <div className="yds-precursor-engine-p13__two-col">
        <article className="yds-precursor-engine-p13__block" aria-label="국면 변경 로그">
          <p className="m-0 panic-validation-panel__h3">국면 변경 로그</p>
          <p className="panic-validation-panel__note m-0">90일 {stats90d.regimeChangeCount}회</p>
          {regimeChangeLog.length ? (
            <ul className="yds-precursor-engine-p13__log-list">
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

        <article className="yds-precursor-engine-p13__block" aria-label="패턴 순위 변경">
          <p className="m-0 panic-validation-panel__h3">패턴 순위 변경 로그</p>
          <p className="panic-validation-panel__note m-0">90일 {stats90d.patternChangeCount}회</p>
          {patternRankChangeLog.length ? (
            <ul className="yds-precursor-engine-p13__log-list">
              {patternRankChangeLog.map((e) => (
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

      <article className="yds-precursor-engine-p13__block" aria-label="Validation Journal">
        <p className="m-0 panic-validation-panel__h3">Validation Journal</p>
        {journal.length ? (
          <ul className="yds-precursor-engine-p13__journal">
            {journal.map((entry) => (
              <li key={entry.date} className="yds-precursor-engine-p13__journal-item">
                <div className="yds-precursor-engine-p13__journal-head">
                  <span className="font-mono tabular-nums">{entry.date}</span>
                  <span className="yds-precursor-engine-p13__journal-meta">
                    {entry.regimeLabel} · YDS {fmt(entry.yds)} · PRI {fmt(entry.priA)}/{fmt(entry.priB)}
                  </span>
                </div>
                <p className="m-0 yds-precursor-engine-p13__journal-text">{entry.interpretation}</p>
                <p className="m-0 yds-precursor-engine-p13__journal-pattern">{entry.patternLine}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-slate-500">저장된 일지 없음 · 오늘 스냅샷을 저장하세요</p>
        )}
      </article>

      <ul className="panic-validation-panel__notes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
