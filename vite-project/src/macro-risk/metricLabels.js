/** 표시명·툴팁만 관리 (데이터 키·로직 불변) */

/** @type {Record<string, { label: string; tooltip?: string }>} */
export const METRIC_LABEL_KO = {
  US10Y: {
    label: "10년물 국채금리 (US10Y)",
    tooltip: "성장 / 인플레 / 주식시장",
  },
  US2Y: {
    label: "2년물 국채금리 (US2Y)",
    tooltip: "연준 정책 기대",
  },
  US30Y: {
    label: "30년물 국채금리 (US30Y)",
    tooltip: "장기 인플레 / 재정",
  },
}

/**
 * @param {string} key
 * @param {string} [fallback]
 */
export function metricDisplayLabel(key, fallback = key) {
  return METRIC_LABEL_KO[key]?.label ?? fallback
}

/**
 * @param {string} key
 */
export function metricDisplayTooltip(key) {
  return METRIC_LABEL_KO[key]?.tooltip ?? undefined
}
