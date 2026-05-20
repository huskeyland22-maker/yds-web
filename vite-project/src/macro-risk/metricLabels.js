/** 표시명·툴팁만 관리 (데이터 키·로직 불변) */

/** @type {Record<string, { label: string; tooltip?: string }>} */
export const METRIC_LABEL_KO = {
  US10Y: {
    label: "10년물 국채금리 (US10Y)",
    tooltip: "미국 장기금리 / 성장·인플레",
  },
  REAL_YIELD: {
    label: "실질금리 (REAL)",
    tooltip: "인플레 제외 실질 수익률",
  },
  DXY: {
    label: "달러지수 (DXY)",
    tooltip: "달러 강세 / 유동성",
  },
  MOVE: {
    label: "채권 변동성 (MOVE)",
    tooltip: "미국채 변동성",
  },
  US30Y: {
    label: "30년물 국채금리 (US30Y)",
    tooltip: "장기 인플레 / 재정",
  },
  BEI: {
    label: "기대인플레이션 (BEI)",
    tooltip: "시장 인플레 기대",
  },
  VXN: {
    label: "나스닥 변동성 (VXN)",
    tooltip: "나스닥 공포 지수",
  },
  US2Y: {
    label: "2년물 국채금리 (US2Y)",
    tooltip: "연준 정책 기대",
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
