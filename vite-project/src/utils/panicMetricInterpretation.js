import { formatMetricValue } from "../components/macroCycleChartUtils.js"
import { findChartMetric } from "./panicDeskMetrics.js"

/** @typedef {"positive" | "neutral" | "warning" | "danger"} InterpretTone */

/**
 * @typedef {{
 *   metricKey: string
 *   metricTitle: string
 *   value: number
 *   valueText: string
 *   statusLabel: string
 *   tone: InterpretTone
 *   headline: string
 *   body: string
 * }} MetricInterpretation
 */

const LOOKBACK = 20

/** @param {object[]} rows @param {string} key */
export function historyMetricValues(rows, key) {
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => {
      if (key === "highYield" || key === "hyOas") return Number(row.highYield ?? row.hyOas)
      if (key === "gsBullBear") return Number(row.gsBullBear ?? row.gsSentiment)
      return Number(row[key])
    })
    .filter(Number.isFinite)
}

/** @param {number[]} values @param {number} [n] */
function recentAverage(values, n = LOOKBACK) {
  const slice = values.slice(-n)
  if (!slice.length) return null
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

/**
 * @param {number} value
 * @param {number | null} avg
 * @param {string} formattedValue
 * @param {{ higherIsBad?: boolean; unit?: string }} opts
 */
function avgComparisonLine(value, avg, formattedValue, opts = {}) {
  const { higherIsBad = true, unit = "" } = opts
  if (avg == null || !Number.isFinite(avg)) {
    return `${formattedValue} — 최근 히스토리 평균 산출에 데이터가 부족합니다.`
  }
  const avgFmt = formatMetricValue(
    opts.metricKey ?? "vix",
    avg,
  )
  const diff = value - avg
  const pct = avg !== 0 ? (diff / Math.abs(avg)) * 100 : 0
  if (Math.abs(pct) < 4) {
    return `${formattedValue}은(는) 최근 ${LOOKBACK}일 평균 ${avgFmt}${unit} 대비 유사한 수준입니다.`
  }
  const dir = diff > 0 ? "높" : "낮"
  const bias =
    Math.abs(pct) >= 12
      ? higherIsBad
        ? diff > 0
          ? "리스크 프리미엄 확대 쪽으로 해석됩니다."
          : "리스크 완화 쪽으로 해석됩니다."
        : diff > 0
          ? "심리 개선 쪽으로 해석됩니다."
          : "심리 둔화 쪽으로 해석됩니다."
      : "방향성은 제한적입니다."
  return `${formattedValue}은(는) 최근 ${LOOKBACK}일 평균 ${avgFmt}${unit} 대비 ${Math.abs(pct).toFixed(0)}% ${dir}습니다. ${bias}`
}

/** @param {InterpretTone} tone */
export function interpretTonePanelClass(tone) {
  switch (tone) {
    case "positive":
      return "border-cyan-500/25 bg-cyan-500/[0.06]"
    case "warning":
      return "border-orange-500/25 bg-orange-500/[0.06]"
    case "danger":
      return "border-rose-500/30 bg-rose-500/[0.07]"
    default:
      return "border-white/[0.08] bg-white/[0.02]"
  }
}

/** @param {InterpretTone} tone */
export function interpretToneTextClass(tone) {
  switch (tone) {
    case "positive":
      return "text-cyan-300"
    case "warning":
      return "text-orange-300"
    case "danger":
      return "text-rose-300"
    default:
      return "text-slate-300"
  }
}

/** @param {InterpretTone} tone */
export function interpretToneBadgeClass(tone) {
  switch (tone) {
    case "positive":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
    case "warning":
      return "border-orange-500/30 bg-orange-500/10 text-orange-200"
    case "danger":
      return "border-rose-500/35 bg-rose-500/10 text-rose-200"
    default:
      return "border-white/10 bg-white/[0.04] text-slate-300"
  }
}

/**
 * @param {number} v
 * @returns {{ statusLabel: string; tone: InterpretTone; headline: string; detail: string }}
 */
function interpretVix(v) {
  if (v <= 15) {
    return {
      statusLabel: "극도 낙관",
      tone: "warning",
      headline: "변동성이 매우 낮아 안심 구간이나, 비이성적 낙관(컨플라이언시)에 유의하세요.",
      detail: "옵션 프리미엄이 얇은 편이라 급변 시 대응 속도가 중요합니다.",
    }
  }
  if (v <= 20) {
    return {
      statusLabel: "안정",
      tone: "positive",
      headline: "현재 시장 변동성은 안정 구간입니다.",
      detail: "단기 과열 신호는 제한적이나, 과도한 낙관은 아직 아닙니다.",
    }
  }
  if (v < 30) {
    return {
      statusLabel: "경계",
      tone: "warning",
      headline: "변동성이 평균 이상으로 상승한 경계 구간입니다.",
      detail: "헤지 수요와 이벤트 리스크를 함께 점검할 필요가 있습니다.",
    }
  }
  return {
    statusLabel: "공포",
    tone: "danger",
    headline: "변동성이 공포 영역에 진입했습니다.",
    detail: "단기 변동 확대와 리스크오프 가능성을 전제한 운용이 필요합니다.",
  }
}

/** @param {number} v */
function interpretPutCall(v) {
  if (v <= 0.5) {
    return {
      statusLabel: "과열",
      tone: "warning",
      headline: "풋콜 비율이 낮아 콜 쏠림·과열 심리가 우세합니다.",
      detail: "조정 시 옵션 포지션의 델타 리스크가 빠르게 커질 수 있습니다.",
    }
  }
  if (v < 0.8) {
    return {
      statusLabel: "중립",
      tone: "neutral",
      headline: "옵션 수요가 균형에 가깝습니다.",
      detail: "공포·탐욕 쏠림이 크지 않아 방향성 베팅은 제한적입니다.",
    }
  }
  return {
    statusLabel: "공포",
    tone: "danger",
    headline: "풋 수요가 우세해 방어적 헤지 심리가 강합니다.",
    detail: "하방 보호 비용 상승 구간으로, 변동성 급등과 동행할 수 있습니다.",
  }
}

/** @param {number} v */
function interpretFearGreed(v) {
  if (v >= 75) {
    return {
      statusLabel: "극도 탐욕",
      tone: "danger",
      headline: "시장 심리가 극단적 탐욕 영역입니다.",
      detail: "밸류에이션·레버리지 과열을 점검하고, 추격 매수 리스크를 관리하세요.",
    }
  }
  if (v >= 60) {
    return {
      statusLabel: "탐욕",
      tone: "warning",
      headline: "탐욕 구간 — 상승 모멘텀은 유효하나 과열 신호도 공존합니다.",
      detail: "수익 실현 압력과 변동성 확대 가능성을 병행해 보세요.",
    }
  }
  if (v >= 40) {
    return {
      statusLabel: "중립",
      tone: "positive",
      headline: "공포·탐욕이 균형에 가까운 중립 심리입니다.",
      detail: "매크로 이벤트 전까지는 추세 추종과 역추세가 혼재할 수 있습니다.",
    }
  }
  if (v > 25) {
    return {
      statusLabel: "공포",
      tone: "warning",
      headline: "공포 심리가 우세한 구간입니다.",
      detail: "안전자산 선호와 변동성 매수(헤지) 수요를 함께 확인하세요.",
    }
  }
  return {
    statusLabel: "극도 공포",
    tone: "danger",
    headline: "극단적 공포 심리 — 역사적으로 반등 전환 후보 구간이기도 합니다.",
    detail: "유동성 스트레스 여부를 확인하고, 분할 대응을 고려하세요.",
  }
}

/** @param {number} v */
function interpretHighYield(v) {
  if (v < 3) {
    return {
      statusLabel: "안정",
      tone: "positive",
      headline: "하이일드 스프레드가 낮아 신용 스트레스는 제한적입니다.",
      detail: "리스크 자산 선호 환경과 궁합이 좋은 구간입니다.",
    }
  }
  if (v < 5) {
    return {
      statusLabel: "경계",
      tone: "warning",
      headline: "스프레드가 확대되며 신용 리스크 프리미엄이 상승 중입니다.",
      detail: "디폴트 서프라이즈와 펀드 플로우 악화를 점검하세요.",
    }
  }
  return {
    statusLabel: "스트레스",
    tone: "danger",
    headline: "하이일드 스프레드가 스트레스 구간입니다.",
    detail: "크레딧 이벤트·유동성 경색 시 주식·채권 동반 약세 가능성이 큽니다.",
  }
}

/** @param {number} v */
function interpretMove(v) {
  if (v < 90) {
    return {
      statusLabel: "안정",
      tone: "positive",
      headline: "채권 변동성이 낮아 금리 시장은 비교적 안정적입니다.",
      detail: "주식 변동성과의 괴리(분리) 여부를 함께 보세요.",
    }
  }
  if (v < 110) {
    return {
      statusLabel: "경계",
      tone: "warning",
      headline: "채권 변동성이 상승하며 금리 리스크가 커지고 있습니다.",
      detail: "듀레이션·크레딧 동반 악화 가능성을 점검하세요.",
    }
  }
  return {
    statusLabel: "위험",
    tone: "danger",
    headline: "MOVE가 높은 수준 — 채권 시장 스트레스 신호입니다.",
    detail: "유동성 쇼크·금리 급변 시 주식 리스크오프로 전이될 수 있습니다.",
  }
}

/** @param {number} v */
function interpretSkew(v) {
  if (v < 125) {
    return {
      statusLabel: "낮음",
      tone: "positive",
      headline: "꼬리위험 프리미엄이 낮은 편입니다.",
      detail: "블랙스완 헤지 수요가 과도하지 않습니다.",
    }
  }
  if (v < 140) {
    return {
      statusLabel: "보통",
      tone: "neutral",
      headline: "SKEW가 평균적 — 꼬리위험 인식은 보통 수준입니다.",
      detail: "급락 헤지 비용이 점진적으로만 상승한 상태입니다.",
    }
  }
  return {
    statusLabel: "꼬리위험",
    tone: "warning",
    headline: "꼬리위험 지표가 상승 — 하방 보험 수요가 강합니다.",
    detail: "급락 시나리오 헤지가 비싸진 구간으로, 변동성 이벤트에 민감합니다.",
  }
}

/** @param {number} v */
function interpretBofa(v) {
  if (v <= 2) {
    return {
      statusLabel: "극도 공포",
      tone: "danger",
      headline: "BofA 심리가 극단적 약세입니다.",
      detail: "역발상 매수 논리와 함께, 추가 악재 여지를 확인하세요.",
    }
  }
  if (v <= 4) {
    return {
      statusLabel: "공포",
      tone: "warning",
      headline: "투자자 심리가 방어적입니다.",
      detail: "현금·헤지 비중 확대 신호로 해석됩니다.",
    }
  }
  if (v <= 6) {
    return {
      statusLabel: "중립",
      tone: "neutral",
      headline: "BofA 심리가 중립권입니다.",
      detail: "강세·약세 극단으로 치우치지 않았습니다.",
    }
  }
  if (v < 8) {
    return {
      statusLabel: "탐욕",
      tone: "warning",
      headline: "심리가 낙관 쪽으로 기울었습니다.",
      detail: "레버리지·위험선호 확대와 동행할 수 있습니다.",
    }
  }
  return {
    statusLabel: "극도 탐욕",
    tone: "danger",
    headline: "BofA 심리가 과열 구간입니다.",
    detail: "심리 피크 구간에서의 되돌림 리스크를 관리하세요.",
  }
}

/** @param {number} v */
function interpretGsBullBear(v) {
  if (v <= 25) {
    return {
      statusLabel: "극도 약세",
      tone: "danger",
      headline: "GS 강세·약세 지표가 극단적 약세입니다.",
      detail: "기관·매크로 심리가 크게 위축된 상태입니다.",
    }
  }
  if (v <= 40) {
    return {
      statusLabel: "약세",
      tone: "warning",
      headline: "약세 심리가 우세합니다.",
      detail: "리스크오프·현금 비중 확대와 궁합이 좋습니다.",
    }
  }
  if (v <= 60) {
    return {
      statusLabel: "중립",
      tone: "neutral",
      headline: "강세·약세 신호가 혼재한 중립권입니다.",
      detail: "추세 확신보다 이벤트 대응이 유효할 수 있습니다.",
    }
  }
  if (v < 75) {
    return {
      statusLabel: "강세",
      tone: "positive",
      headline: "강세 심리가 우세합니다.",
      detail: "위험자산 선호 환경과 정합성이 있습니다.",
    }
  }
  return {
    statusLabel: "극도 강세",
    tone: "warning",
    headline: "극단적 강세 심리 — 과열·되돌림 리스크를 점검하세요.",
    detail: "모멘텀은 유효하나 밸류에이션 부담이 커질 수 있습니다.",
  }
}

/** @param {number} v */
function interpretVxn(v) {
  if (v <= 18) {
    return {
      statusLabel: "안정",
      tone: "positive",
      headline: "나스닥 변동성이 낮아 성장주 리스크는 제한적입니다.",
      detail: "VIX 대비 괴리가 크면 섹터 로테이션 신호일 수 있습니다.",
    }
  }
  if (v <= 25) {
    return {
      statusLabel: "경계",
      tone: "warning",
      headline: "나스닥 변동성이 상승 중입니다.",
      detail: "테크·고베타 종목의 조정 폭이 커질 수 있습니다.",
    }
  }
  return {
    statusLabel: "공포",
    tone: "danger",
    headline: "VXN이 높은 공포 구간 — 성장주 변동성 급등 상태입니다.",
    detail: "지수 대비 개별주 디커플링 여부를 확인하세요.",
  }
}

/**
 * @param {string} metricKey
 * @param {unknown} rawValue
 * @param {{ historyRows?: object[] }} [opts]
 * @returns {MetricInterpretation | null}
 */
export function interpretPanicMetric(metricKey, rawValue, opts = {}) {
  const value = Number(rawValue)
  if (!Number.isFinite(value)) return null

  const meta = findChartMetric(metricKey)
  const metricTitle = meta?.chartLabel ?? meta?.label ?? metricKey
  const valueText = formatMetricValue(metricKey, value)
  const history = historyMetricValues(opts.historyRows ?? [], metricKey)
  const avg = recentAverage(history)

  let core
  switch (metricKey) {
    case "vix":
      core = interpretVix(value)
      break
    case "putCall":
      core = interpretPutCall(value)
      break
    case "fearGreed":
      core = interpretFearGreed(value)
      break
    case "highYield":
    case "hyOas":
      core = interpretHighYield(value)
      break
    case "move":
      core = interpretMove(value)
      break
    case "skew":
      core = interpretSkew(value)
      break
    case "bofa":
      core = interpretBofa(value)
      break
    case "gsBullBear":
      core = interpretGsBullBear(value)
      break
    case "vxn":
      core = interpretVxn(value)
      break
    default:
      return null
  }

  const higherIsBadMap = {
    vix: true,
    vxn: true,
    putCall: true,
    fearGreed: false,
    highYield: true,
    hyOas: true,
    move: true,
    skew: true,
    bofa: false,
    gsBullBear: false,
  }

  const avgLine = avgComparisonLine(value, avg, valueText, {
    higherIsBad: higherIsBadMap[metricKey] ?? true,
    metricKey: metricKey === "hyOas" ? "highYield" : metricKey,
  })

  return {
    metricKey,
    metricTitle,
    value,
    valueText,
    statusLabel: core.statusLabel,
    tone: core.tone,
    headline: core.headline,
    body: `${avgLine} ${core.detail}`,
  }
}
