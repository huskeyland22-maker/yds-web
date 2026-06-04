import { useMemo, useState } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase20Report,
  formatTimeMachineScore,
  PRECURSOR_ENGINE_PHASE20_LABEL,
  PANIC_TIME_MACHINE_PAGE,
} from "../../trading-zone/ydsPrecursorEnginePhase20.js"
import YdsRiskPatternLabel from "./YdsRiskPatternLabel.jsx"

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   initialEventId?: string
 *   initialOffset?: number
 *   embedded?: boolean
 * }} props
 */
export default function YdsPrecursorEnginePhase20Section({
  events = YDS_VALIDATION_EVENT_DATASET,
  initialEventId,
  initialOffset,
  embedded = false,
}) {
  const [selectedEventId, setSelectedEventId] = useState(initialEventId ?? "lehman")
  const [selectedOffset, setSelectedOffset] = useState(initialOffset ?? 0)

  const report = useMemo(
    () =>
      buildPrecursorEnginePhase20Report(events, {
        selectedEventId,
        selectedOffset,
      }),
    [events, selectedEventId, selectedOffset],
  )

  const { meta, events: machineEvents, selected, notes } = report
  const frame = selected.frame
  const offsets = meta.offsets
  const sliderIndex = Math.max(0, offsets.indexOf(selectedOffset))

  const handleEventPick = (id) => {
    setSelectedEventId(id)
    setSelectedOffset(0)
  }

  const handleSlider = (index) => {
    const offset = offsets[Number(index)]
    if (offset != null) setSelectedOffset(offset)
  }

  return (
    <section
      className={`panic-validation-panel yds-precursor-engine-p20${embedded ? " yds-precursor-engine-p20--embedded" : ""}`}
      aria-labelledby="yds-precursor-engine-p20-title"
    >
      <h2 id="yds-precursor-engine-p20-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE20_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        과거 위기 climax 기준 T-28~T-0 재생 · Phase 3·5·6·10·15 읽기 전용 · 향후{" "}
        <code>{PANIC_TIME_MACHINE_PAGE.path}</code> 독립 페이지
      </p>

      <div className="yds-precursor-engine-p20__meta">
        지원 이벤트 {meta.eventCount}건 · climax 앵커 · 슬라이더 이동 시 당시 상태 재생
      </div>

      <div className="yds-precursor-engine-p20__block">
        <h3 className="yds-precursor-engine-p20__h3">A. 이벤트 선택</h3>
        <div className="yds-precursor-engine-p20__event-chips" role="tablist" aria-label="위기 이벤트">
          {machineEvents.map((ev) => (
            <button
              key={ev.id}
              type="button"
              role="tab"
              aria-selected={selected.eventId === ev.id}
              disabled={!ev.available}
              className={[
                "yds-precursor-engine-p20__event-chip",
                selected.eventId === ev.id ? "yds-precursor-engine-p20__event-chip--active" : "",
                !ev.available ? "yds-precursor-engine-p20__event-chip--disabled" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleEventPick(ev.id)}
            >
              <span aria-hidden>{ev.emoji}</span> {ev.shortLabel}
            </button>
          ))}
        </div>
        {selected.eventSpec?.report ? (
          <p className="yds-precursor-engine-p20__event-sub">
            {selected.eventSpec.report.name} · climax {selected.eventSpec.report.climaxDate ?? "—"}
          </p>
        ) : null}
      </div>

      {frame ? (
        <>
          <div className="yds-precursor-engine-p20__block">
            <h3 className="yds-precursor-engine-p20__h3">B. 타임 슬라이더</h3>
            <div className="yds-precursor-engine-p20__slider-wrap">
              <input
                type="range"
                className="yds-precursor-engine-p20__slider"
                min={0}
                max={offsets.length - 1}
                step={1}
                value={sliderIndex}
                onChange={(e) => handleSlider(e.target.value)}
                aria-valuetext={frame.offsetLabel}
              />
              <div className="yds-precursor-engine-p20__slider-marks">
                {offsets.map((off) => (
                  <button
                    key={off}
                    type="button"
                    className={[
                      "yds-precursor-engine-p20__slider-mark",
                      off === selectedOffset ? "yds-precursor-engine-p20__slider-mark--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSelectedOffset(off)}
                  >
                    T-{off}
                  </button>
                ))}
              </div>
            </div>
            <p className="yds-precursor-engine-p20__replay-date">
              {frame.offsetLabel} · {frame.date ?? "—"}
            </p>
          </div>

          <div className="yds-precursor-engine-p20__block">
            <h3 className="yds-precursor-engine-p20__h3">C. 당시 시장 상태</h3>
            <div className="yds-precursor-engine-p20__state-grid">
              <div className="yds-precursor-engine-p20__state-card">
                <span className="yds-precursor-engine-p20__state-key">시장 위치</span>
                <span className="yds-precursor-engine-p20__state-val">
                  {frame.ydsStage?.emoji} {formatTimeMachineScore(frame.ydsScore)}{" "}
                  <small>{frame.ydsStage?.label ?? "—"}</small>
                </span>
              </div>
              <div className="yds-precursor-engine-p20__state-card">
                <span className="yds-precursor-engine-p20__state-key">조기경보 (PRI-A)</span>
                <span className="yds-precursor-engine-p20__state-val">
                  {frame.priATier.emoji} {formatTimeMachineScore(frame.priA)}
                </span>
              </div>
              <div className="yds-precursor-engine-p20__state-card">
                <span className="yds-precursor-engine-p20__state-key">충격감지 (PRI-B)</span>
                <span className="yds-precursor-engine-p20__state-val">
                  {frame.priBTier.emoji} {formatTimeMachineScore(frame.priB)}
                </span>
              </div>
              <div className="yds-precursor-engine-p20__state-card">
                <span className="yds-precursor-engine-p20__state-key">시장 국면</span>
                <span className="yds-precursor-engine-p20__state-val">
                  {frame.regime.emoji} {frame.regime.label}
                </span>
              </div>
              <div className="yds-precursor-engine-p20__state-card">
                <span className="yds-precursor-engine-p20__state-key">위험 패턴</span>
                <span className="yds-precursor-engine-p20__state-val">
                  <YdsRiskPatternLabel patternId={frame.patternId} patternLabel={frame.patternLabel} />
                  {frame.top3[0] ? (
                    <small> {formatTimeMachineScore(frame.top3[0].similarity, "%")}</small>
                  ) : null}
                </span>
              </div>
              <div className="yds-precursor-engine-p20__state-card">
                <span className="yds-precursor-engine-p20__state-key">신뢰도</span>
                <span className="yds-precursor-engine-p20__state-val">
                  {formatTimeMachineScore(frame.confidenceScore)} · {frame.confidence.label}
                </span>
              </div>
              <div className="yds-precursor-engine-p20__state-card yds-precursor-engine-p20__state-card--wide">
                <span className="yds-precursor-engine-p20__state-key">행동 가이드</span>
                <span className="yds-precursor-engine-p20__state-val">
                  {frame.action.emoji} {frame.action.label}
                </span>
              </div>
            </div>
          </div>

          <div className="yds-precursor-engine-p20__two-col">
            <div className="yds-precursor-engine-p20__block">
              <h3 className="yds-precursor-engine-p20__h3">D. Replay Timeline</h3>
              <ol className="yds-precursor-engine-p20__timeline">
                {selected.timeline.map((step, i) => (
                  <li
                    key={step.offsetDays}
                    className={[
                      "yds-precursor-engine-p20__timeline-step",
                      step.offsetDays === selectedOffset
                        ? "yds-precursor-engine-p20__timeline-step--current"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="yds-precursor-engine-p20__timeline-label">{step.headline}</span>
                    {i < selected.timeline.length - 1 ? (
                      <span className="yds-precursor-engine-p20__timeline-arrow" aria-hidden>
                        ↓
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>

            <div className="yds-precursor-engine-p20__block">
              <h3 className="yds-precursor-engine-p20__h3">E. 최초 경고</h3>
              {selected.firstReactions.length === 0 ? (
                <p className="yds-precursor-engine-p20__empty">T-28 기준 유의미 반응 없음</p>
              ) : (
                <ol className="yds-precursor-engine-p20__reaction-list">
                  {selected.firstReactions.map((r) => (
                    <li key={r.key}>
                      <span className="yds-precursor-engine-p20__reaction-order">{r.order}</span>
                      <span className="yds-precursor-engine-p20__reaction-label">{r.label}</span>
                      <span className="yds-precursor-engine-p20__reaction-when">
                        {r.offsetLabel} (Δ{r.delta})
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="yds-precursor-engine-p20__block">
            <h3 className="yds-precursor-engine-p20__h3">F. 패턴 변화 (T-28 → {frame.offsetLabel})</h3>
            <ul className="yds-precursor-engine-p20__pattern-bars">
              {selected.patternEvolution.map((p) => (
                <li key={p.patternId} className="yds-precursor-engine-p20__pattern-row">
                  <span className="yds-precursor-engine-p20__pattern-name">{p.label}</span>
                  <div className="yds-precursor-engine-p20__pattern-track">
                    <div
                      className="yds-precursor-engine-p20__pattern-bar yds-precursor-engine-p20__pattern-bar--from"
                      style={{ width: `${Math.min(100, p.from)}%` }}
                      title={`T-28 ${p.from}%`}
                    />
                    <div
                      className="yds-precursor-engine-p20__pattern-bar yds-precursor-engine-p20__pattern-bar--to"
                      style={{ width: `${Math.min(100, p.to)}%` }}
                      title={`현재 ${p.to}%`}
                    />
                  </div>
                  <span className="yds-precursor-engine-p20__pattern-delta">
                    {p.from}% → {p.to}%
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {selected.finalEvaluation ? (
            <div className="yds-precursor-engine-p20__block">
              <h3 className="yds-precursor-engine-p20__h3">G. 최종 평가</h3>
              <p className="yds-precursor-engine-p20__eval-note">
                선행 윈도우 {selected.finalEvaluation.leadWindow} · climax{" "}
                {selected.finalEvaluation.climaxDate ?? "—"}
              </p>
              <div className="yds-precursor-engine-p20__eval-grid">
                <div className="yds-precursor-engine-p20__eval-card">
                  <span className="yds-precursor-engine-p20__eval-key">YDS (시장 위치)</span>
                  <strong>{selected.finalEvaluation.yds.offsetLabel}</strong>
                  <span>
                    {selected.finalEvaluation.yds.daysBefore != null
                      ? `${selected.finalEvaluation.yds.daysBefore}일 전`
                      : "—"}
                    {selected.finalEvaluation.yds.score != null
                      ? ` · ${selected.finalEvaluation.yds.score}점`
                      : ""}
                  </span>
                </div>
                <div className="yds-precursor-engine-p20__eval-card">
                  <span className="yds-precursor-engine-p20__eval-key">PRI-A (조기경보)</span>
                  <strong>{selected.finalEvaluation.priA.offsetLabel}</strong>
                  <span>
                    {selected.finalEvaluation.priA.daysBefore != null
                      ? `${selected.finalEvaluation.priA.daysBefore}일 전`
                      : "—"}
                    {selected.finalEvaluation.priA.score != null
                      ? ` · ${selected.finalEvaluation.priA.score}점`
                      : ""}
                  </span>
                </div>
                <div className="yds-precursor-engine-p20__eval-card">
                  <span className="yds-precursor-engine-p20__eval-key">PRI-B (충격감지)</span>
                  <strong>{selected.finalEvaluation.priB.offsetLabel}</strong>
                  <span>
                    {selected.finalEvaluation.priB.daysBefore != null
                      ? `${selected.finalEvaluation.priB.daysBefore}일 전`
                      : "—"}
                    {selected.finalEvaluation.priB.score != null
                      ? ` · ${selected.finalEvaluation.priB.score}점`
                      : ""}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="yds-precursor-engine-p20__empty">선택 가능한 이벤트 데이터가 없습니다.</p>
      )}

      <ul className="panic-validation-panel__notes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
