import { useId, useState } from "react"

/** @type {Record<number, string>} */
export const VALIDATION_PHASE_SUBTITLES = {
  36: "Alert Center",
  35: "Watchlist Center",
  32: "Portfolio Builder",
  31: "Conviction Engine",
  30: "Performance Dashboard",
  29: "Auto Paper Trading (28.5)",
  28: "Trading Journal",
  27: "Entry Radar",
  26: "Stock Radar",
  25: "Sector Radar",
  22: "라이브 시장 비교",
  21: "조기경보 스코어카드",
  20: "패닉 타임머신",
  18: "행동 성과 보드",
  17: "시장 검증 저널",
  16: "신뢰도 · 시장 해석",
  15: "행동 가이드",
  13: "실시장 검증 로그",
  11: "국면 이력",
  10: "국면 변화 탐지",
  9: "위험 패턴 히스토리",
  8: "위험 패턴 분리 v2",
  7: "위험 패턴 Radar 검증",
  6: "실시간 위험 패턴",
  5: "TP 위험 패턴 분석",
  4: "미탐지 분석",
  3: "조기경보 실시간",
  2: "조기경보 · 충격감지",
  1: "전조 엔진 검증",
}

/**
 * 검증 페이지 Phase 섹션 접기 — 로직 없음 · 자식은 펼침 시에만 마운트
 *
 * @param {{
 *   phase: number
 *   subtitle?: string
 *   defaultOpen?: boolean
 *   children: import("react").ReactNode
 * }} props
 */
export default function ValidationPhaseAccordion({
  phase,
  subtitle = "",
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div className={`validation-phase-accordion${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="validation-phase-accordion__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="validation-phase-accordion__chevron" aria-hidden>
          {open ? "▼" : "▶"}
        </span>
        <span className="validation-phase-accordion__title">Phase {phase}</span>
        {!open && subtitle ? (
          <span className="validation-phase-accordion__subtitle">{subtitle}</span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          className="validation-phase-accordion__panel"
          role="region"
          aria-label={`Phase ${phase}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
