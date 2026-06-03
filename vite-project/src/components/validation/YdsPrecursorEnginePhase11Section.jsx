import { useMemo, useState } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase11Report,
  PRECURSOR_ENGINE_PHASE11_LABEL,
  REGIME_HISTORY_WINDOWS,
} from "../../trading-zone/ydsPrecursorEnginePhase11.js"

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   latestPanic?: Record<string, unknown> | null
 * }} props
 */
export default function YdsPrecursorEnginePhase11Section({
  events = YDS_VALIDATION_EVENT_DATASET,
  latestCycleRow = null,
  latestPanic = null,
}) {
  const [windowDays, setWindowDays] = useState(90)

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
    () => buildPrecursorEnginePhase11Report(events, { latestSnapshot }),
    [events, latestSnapshot],
  )

  const { current, summary, changeLog, changeLogTotal, windows, notes } = report
  const windowData = windows[windowDays] ?? windows[90]
  const regime = current.regime

  const timelineWidth = windowData?.segments?.length
    ? windowData.segments.reduce((sum, s) => sum + (s.daySpan || 1), 0)
    : 1

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p11"
      aria-labelledby="yds-precursor-engine-p11-title"
    >
      <h2 id="yds-precursor-engine-p11-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE11_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        국면 변화 이력 · Phase 10 판정 기준 · 검증 전용
      </p>

      <article
        className={`yds-precursor-engine-p11__current yds-precursor-engine-p11__current--${regime.id}`}
        aria-label="현재 국면"
      >
        <span className="yds-precursor-engine-p11__current-emoji">{regime.emoji}</span>
        <div>
          <p className="m-0 yds-precursor-engine-p11__current-label">{regime.label}</p>
          <p className="m-0 yds-precursor-engine-p11__duration">{current.durationLabel}</p>
        </div>
      </article>

      <article className="yds-precursor-engine-p11__summary" aria-label="Summary">
        <p className="m-0 panic-validation-panel__h3">Summary</p>
        <div className="yds-precursor-engine-p11__summary-grid">
          <div className="yds-precursor-engine-p11__summary-card">
            <p className="yds-precursor-engine-p11__summary-key">현재 국면</p>
            <p className="yds-precursor-engine-p11__summary-val">
              {summary.currentRegime?.emoji} {summary.currentRegime?.label}
            </p>
          </div>
          <div className="yds-precursor-engine-p11__summary-card">
            <p className="yds-precursor-engine-p11__summary-key">직전 국면</p>
            <p className="yds-precursor-engine-p11__summary-val">
              {summary.previousRegime
                ? `${summary.previousRegime.emoji} ${summary.previousRegime.label}`
                : "—"}
            </p>
          </div>
          <div className="yds-precursor-engine-p11__summary-card">
            <p className="yds-precursor-engine-p11__summary-key">지속일수</p>
            <p className="yds-precursor-engine-p11__summary-val font-mono tabular-nums">
              {summary.durationDays > 0 ? `${summary.durationDays}일` : "—"}
            </p>
          </div>
          <div className="yds-precursor-engine-p11__summary-card">
            <p className="yds-precursor-engine-p11__summary-key">변화 방향</p>
            <p
              className={`yds-precursor-engine-p11__summary-val yds-precursor-engine-p11__direction--${summary.changeDirection.id}`}
            >
              {summary.changeDirection.label}
            </p>
          </div>
        </div>
      </article>

      <article className="yds-precursor-engine-p11__block" aria-label="최근 변경 로그">
        <p className="m-0 panic-validation-panel__h3">최근 변경 로그</p>
        {changeLog.length ? (
          <ul className="yds-precursor-engine-p11__changelog">
            {changeLog.map((entry) => (
              <li key={`${entry.date}-${entry.toId}`} className="yds-precursor-engine-p11__changelog-item">
                <span className="yds-precursor-engine-p11__changelog-date font-mono tabular-nums">
                  {entry.date}
                </span>
                <span className="yds-precursor-engine-p11__changelog-flow">
                  <span>{entry.from.emoji} {entry.from.label}</span>
                  <span className="yds-precursor-engine-p11__changelog-arrow">→</span>
                  <span>{entry.to.emoji} {entry.to.label}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-slate-500">기록된 국면 변경 없음</p>
        )}
        {changeLogTotal > changeLog.length ? (
          <p className="panic-validation-panel__note m-0">
            전체 {changeLogTotal}건 중 최근 {changeLog.length}건 표시
          </p>
        ) : null}
      </article>

      <article className="yds-precursor-engine-p11__block" aria-label="국면 타임라인">
        <div className="yds-precursor-engine-p11__block-head">
          <p className="m-0 panic-validation-panel__h3">국면 타임라인</p>
          <div className="yds-precursor-engine-p11__window-tabs" role="tablist">
            {REGIME_HISTORY_WINDOWS.map((w) => (
              <button
                key={w.id}
                type="button"
                role="tab"
                aria-selected={windowDays === w.id}
                className={
                  windowDays === w.id
                    ? "yds-precursor-engine-p11__window-tab yds-precursor-engine-p11__window-tab--active"
                    : "yds-precursor-engine-p11__window-tab"
                }
                onClick={() => setWindowDays(w.id)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <p className="m-0 yds-precursor-engine-p11__change-count">
          {windowData?.label} 동안{" "}
          <strong className="font-mono tabular-nums">{windowData?.changeCount ?? 0}</strong>회 변경
          <span className="text-slate-500">
            {" "}
            · {windowData?.points ?? 0}개 시점
          </span>
        </p>
        <div className="yds-precursor-engine-p11__timeline" role="img" aria-label="국면 타임라인 바">
          {windowData?.segments?.map((seg) => (
            <div
              key={`${seg.startDate}-${seg.regimeId}`}
              className={`yds-precursor-engine-p11__timeline-seg yds-precursor-engine-p11__timeline-seg--${seg.regimeId}`}
              style={{ flexGrow: seg.daySpan || 1, flexBasis: `${((seg.daySpan || 1) / timelineWidth) * 100}%` }}
              title={`${seg.startDate} ~ ${seg.endDate} · ${seg.regime.label}`}
            />
          ))}
        </div>
        <div className="yds-precursor-engine-p11__timeline-legend">
          {windowData?.segments?.map((seg) => (
            <span
              key={`leg-${seg.startDate}-${seg.regimeId}`}
              className={`yds-precursor-engine-p11__timeline-tag yds-precursor-engine-p11__timeline-tag--${seg.regimeId}`}
            >
              {seg.regime.emoji} {seg.regime.label}
              <span className="font-mono tabular-nums text-slate-500">
                {seg.startDate?.slice(5)}
              </span>
            </span>
          ))}
        </div>
      </article>

      <ul className="panic-validation-panel__notes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
