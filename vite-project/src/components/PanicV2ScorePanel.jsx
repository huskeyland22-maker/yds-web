import { useMemo, useState } from "react"
import { computePanicV2, panicV2MetricsByGroup } from "../panic-v2/index.js"

/**
 * @param {{ panicData: object | null; legacyScore?: number | null }} props
 */
export default function PanicV2ScorePanel({ panicData, legacyScore: legacyScoreProp = null }) {
  const [explainOpen, setExplainOpen] = useState(false)

  const v2 = useMemo(() => computePanicV2(panicData), [panicData])
  const coreLines = useMemo(() => panicV2MetricsByGroup(v2, "core"), [v2])
  const expertLines = useMemo(() => panicV2MetricsByGroup(v2, "expert"), [v2])

  const legacyScore = legacyScoreProp ?? v2.legacyScore
  const status = v2.status

  if (v2.score == null) {
    return (
      <div className="panic-v2-panel panic-v2-panel--empty">
        <p className="m-0 text-[10px] text-slate-500">패닉지수 V2 — 지표 수집 중</p>
      </div>
    )
  }

  return (
    <div className="panic-v2-panel">
      <div className="panic-v2-panel__head">
        <div>
          <p className="panic-v2-panel__label">패닉지수</p>
          <p className="panic-v2-panel__score font-mono tabular-nums">{v2.score}</p>
        </div>
        {status ? (
          <span className={["panic-v2-panel__status", status.toneClass].join(" ")}>{status.label}</span>
        ) : null}
      </div>

      <div className="panic-v2-panel__breakdown">
        <div className="panic-v2-panel__group">
          <p className="panic-v2-panel__group-title">핵심</p>
          <div className="panic-v2-panel__chips">
            {coreLines.map((m) => (
              <span key={m.key} className="panic-v2-panel__chip">
                {m.shortLabel} <em>{m.contributionLabel}</em>
              </span>
            ))}
          </div>
        </div>
        <div className="panic-v2-panel__group">
          <p className="panic-v2-panel__group-title">전문가</p>
          <div className="panic-v2-panel__chips">
            {expertLines.map((m) => (
              <span key={m.key} className="panic-v2-panel__chip panic-v2-panel__chip--expert">
                {m.shortLabel} <em>{m.contributionLabel}</em>
              </span>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="panic-v2-panel__explain-toggle"
        aria-expanded={explainOpen}
        onClick={() => setExplainOpen((o) => !o)}
      >
        왜 {v2.score}인가 {explainOpen ? "−" : "+"}
      </button>

      {explainOpen ? (
        <div className="panic-v2-panel__explain">
          <p className="panic-v2-panel__explain-lead">
            8대 지표를 0~100으로 표준화 후 가중 합산 (핵심 70% + 전문가 30%).
            {v2.incomplete ? ` 현재 ${v2.completenessPct}% 지표 반영.` : ""}
          </p>
          <ul className="panic-v2-panel__explain-list">
            {v2.metrics
              .filter((m) => !m.missing)
              .map((m) => (
                <li key={m.key}>
                  <span className="panic-v2-panel__explain-metric">{m.shortLabel}</span>
                  <span className="panic-v2-panel__explain-detail">
                    원시 {m.raw ?? "—"} → 표준 {m.normalized} × 가중 {m.weight}% ={" "}
                    {m.contributionLabel}
                  </span>
                </li>
              ))}
          </ul>
          {legacyScore != null ? (
            <p className="panic-v2-panel__legacy-compare">
              기존 패닉지수(비교용): <strong className="font-mono">{legacyScore}</strong>
              <span className="panic-v2-panel__legacy-delta">
                {" "}
                (V2 − 기존 {v2.score - legacyScore >= 0 ? "+" : ""}
                {v2.score - legacyScore})
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
