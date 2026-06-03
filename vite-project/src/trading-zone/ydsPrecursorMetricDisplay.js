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

/** @type {Record<string, { id: string; emoji: string; name: string; subtitle: string; description: string }>} */
export const RISK_PATTERN_UI = {
  lehman: {
    id: "lehman",
    emoji: "🏦",
    name: "리먼형",
    subtitle: "시스템 위기",
    description: "금융 시스템·신용 붕괴로 확산되는 패닉 전조 패턴",
  },
  covid: {
    id: "covid",
    emoji: "😱",
    name: "코로나형",
    subtitle: "공포 패닉",
    description: "변동성·공포지수가 급격히 확대되는 전염형 패닉 패턴",
  },
  tariff: {
    id: "tariff",
    emoji: "📜",
    name: "관세형",
    subtitle: "정책 충격",
    description: "정책 변화와 불확실성으로 인한 시장 충격 패턴",
  },
  svb: {
    id: "svb",
    emoji: "🏛️",
    name: "SVB형",
    subtitle: "금융 사고",
    description: "은행·금융 사고가 시장 전반으로 번지는 위기 패턴",
  },
  bull: {
    id: "bull",
    emoji: "🚀",
    name: "강세장형",
    subtitle: "유동성 확대",
    description: "변동성 완화·위험 선호가 우세한 저스트레스 구간",
  },
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

const LABEL_TO_PATTERN_ID = {
  리먼형: "lehman",
  코로나형: "covid",
  관세형: "tariff",
  SVB형: "svb",
  강세장형: "bull",
}

/**
 * @param {string | null | undefined} patternId
 * @param {string | null | undefined} patternLabel
 */
export function resolveRiskPatternId(patternId, patternLabel) {
  if (patternId && RISK_PATTERN_UI[patternId]) return patternId
  if (patternLabel && RISK_PATTERN_UI[patternLabel]) return patternLabel
  if (patternLabel && LABEL_TO_PATTERN_ID[patternLabel]) return LABEL_TO_PATTERN_ID[patternLabel]
  if (patternLabel && PATTERN_LABEL_KO[patternLabel] && RISK_PATTERN_UI[PATTERN_LABEL_KO[patternLabel]]) {
    return PATTERN_LABEL_KO[patternLabel]
  }
  return null
}

/** @param {string | null | undefined} patternId */
export function getRiskPatternDisplay(patternId, patternLabel) {
  const id = resolveRiskPatternId(patternId, patternLabel)
  if (id && RISK_PATTERN_UI[id]) return RISK_PATTERN_UI[id]
  const fallbackName =
    patternLabel?.endsWith("형") ? patternLabel : patternLabel ? `${patternLabel}형` : "—"
  return {
    id: id ?? patternId ?? "unknown",
    emoji: "❓",
    name: fallbackName,
    subtitle: "",
    description: "패턴 설명 준비 중",
  }
}

/**
 * @param {string | null | undefined} patternId
 * @param {string | null | undefined} patternLabel
 */
export function formatRiskPatternLabel(patternId, patternLabel) {
  const d = getRiskPatternDisplay(patternId, patternLabel)
  return d.name !== "—" ? d.name : "—"
}

/**
 * UI 한 줄 표시: 🏦 리먼형 (시스템 위기)
 * @param {string | null | undefined} patternId
 * @param {string | null | undefined} patternLabel
 */
export function formatRiskPatternDisplayLine(patternId, patternLabel) {
  const d = getRiskPatternDisplay(patternId, patternLabel)
  if (d.name === "—") return "—"
  return d.subtitle ? `${d.emoji} ${d.name} (${d.subtitle})` : `${d.emoji} ${d.name}`
}
