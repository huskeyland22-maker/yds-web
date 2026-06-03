/**
 * Precursor 검증·대시보드 UI 표시명 (내부 key: yds / priA / priB / regime / pattern)
 */

export const PRECURSOR_METRIC_DISPLAY = {
  yds: {
    key: "yds",
    label: "시장 위치",
    shortLabel: "시장 위치",
    hint: "과열·중립·관심·분할매수·패닉매수 등 현재 시장 단계",
  },
  priA: {
    key: "priA",
    label: "조기경보",
    shortLabel: "조기경보",
    hint: "시장 위험이 커지고 있는지 사전 탐지",
  },
  priB: {
    key: "priB",
    label: "충격감지",
    shortLabel: "충격감지",
    hint: "실제 충격이 발생했는지 확인",
  },
  regime: {
    key: "regime",
    label: "시장 국면",
    shortLabel: "시장 국면",
    hint: "안정국면·전환국면·경계국면·위기국면",
  },
  pattern: {
    key: "pattern",
    label: "위험 패턴",
    shortLabel: "위험 패턴",
    hint: "리먼형·코로나형·관세형·SVB형 등 역사적 패닉 전조",
  },
  interpretation: {
    key: "interpretation",
    label: "시장 해석",
    shortLabel: "시장 해석",
    hint: "패턴·지표 종합 한 줄 요약",
  },
}

/** @param {keyof typeof PRECURSOR_METRIC_DISPLAY} key */
export function getPrecursorMetricDisplay(key) {
  return PRECURSOR_METRIC_DISPLAY[key] ?? { key, label: key, shortLabel: key, hint: "" }
}

/** @type {Record<string, keyof typeof PRECURSOR_METRIC_DISPLAY>} */
const COMPARISON_ROW_KEY_MAP = {
  ydsScore: "yds",
  priA: "priA",
  priB: "priB",
  regime: "regime",
  dominantPattern: "pattern",
}

/**
 * Phase 13 등 엔진 row.label(YDS/PRI-A…) → UI 표시명
 * @param {{ key?: string; label?: string }} row
 */
export function getPrecursorComparisonRowLabel(row) {
  const mapped = row?.key ? COMPARISON_ROW_KEY_MAP[row.key] : null
  if (mapped) return getPrecursorMetricDisplay(mapped).label
  return row?.label ?? "—"
}

const PATTERN_LABEL_KO = {
  lehman: "리먼형",
  covid: "코로나형",
  tariff: "관세형",
  svb: "SVB형",
  bull: "강세장형",
  Lehman: "리먼형",
  Covid: "코로나형",
  Tariff: "관세형",
  SVB: "SVB형",
  "강세장형": "강세장형",
}

/**
 * @param {string | null | undefined} patternId
 * @param {string | null | undefined} patternLabel
 */
export function formatRiskPatternLabel(patternId, patternLabel) {
  if (patternId && PATTERN_LABEL_KO[patternId]) return PATTERN_LABEL_KO[patternId]
  if (patternLabel && PATTERN_LABEL_KO[patternLabel]) return PATTERN_LABEL_KO[patternLabel]
  if (patternLabel?.endsWith("형")) return patternLabel
  if (patternLabel) return `${patternLabel}형`
  return "—"
}
