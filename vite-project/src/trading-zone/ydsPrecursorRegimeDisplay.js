/**
 * Precursor 체제 UI 표시명 (검증·대시보드 공용)
 * 내부 id(enum): stable | transition | risk | panic — 로직은 id 기준 유지
 */

/** @typedef {"stable" | "transition" | "risk" | "panic" | "unknown"} PrecursorRegimeId */

/** @type {readonly PrecursorRegimeId[]} */
export const PRECURSOR_REGIME_IDS = ["stable", "transition", "risk", "panic"]

export const PRECURSOR_REGIME_DISPLAY = [
  {
    id: "stable",
    order: 0,
    label: "안정국면",
    emoji: "🟢",
    hints: ["위험 신호 미약", "강세/중립 우세"],
  },
  {
    id: "transition",
    order: 1,
    label: "전환국면",
    emoji: "🟡",
    hints: ["체제 변화 초기", "패턴 이동 감지"],
  },
  {
    id: "risk",
    order: 2,
    label: "경계국면",
    emoji: "🟠",
    hints: ["위험 증가 진행", "PRI-A 상승", "패닉 패턴 유사도 확대"],
  },
  {
    id: "panic",
    order: 3,
    label: "위기국면",
    emoji: "🔴",
    hints: ["패닉 전조 심화", "PRI-A/PRI-B 고위험", "패닉 패턴 우세"],
  },
]

/** Phase 10 등 기존 import 호환 */
export const REGIME_STATES = PRECURSOR_REGIME_DISPLAY

/** @type {Record<Exclude<PrecursorRegimeId, "unknown">, (typeof PRECURSOR_REGIME_DISPLAY)[number]>} */
export const REGIME_BY_ID = Object.fromEntries(PRECURSOR_REGIME_DISPLAY.map((s) => [s.id, s]))

export const REGIME_SEQUENCE_LABEL_KO = PRECURSOR_REGIME_DISPLAY.map((s) => s.label).join(" → ")

const UNKNOWN_REGIME = {
  id: "unknown",
  order: -1,
  label: "—",
  emoji: "⚪",
  hints: [],
}

/**
 * @param {PrecursorRegimeId | string | null | undefined} id
 * @param {{ reason?: string; scores?: Record<string, unknown> }} [extra]
 */
export function regimeDisplayForId(id, extra = {}) {
  const base = REGIME_BY_ID[id] ?? UNKNOWN_REGIME
  return { ...base, ...extra }
}

/**
 * @param {number[]} orders 압축된 regime.order 배열
 */
export function formatRegimeSequenceSummary(orders) {
  return orders
    .map((o) => {
      const s = PRECURSOR_REGIME_DISPLAY.find((r) => r.order === o)
      return s ? `${s.emoji} ${s.label}` : "?"
    })
    .join(" → ")
}
