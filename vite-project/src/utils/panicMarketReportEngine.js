/**
 * 9대 패닉지표 → 자동 시장 리포트 (숫자 기반, 동적 문장)
 */
import { formatMetricValue } from "../components/macroCycleChartUtils.js"
import { computeMarketAction } from "./panicMarketActionEngine.js"
import { interpretPanicMetric } from "./panicMetricInterpretation.js"

/**
 * @typedef {{
 *   summary: string
 *   shortTerm: string
 *   midTerm: string
 *   longTerm: string
 *   risk: string
 *   sector: string
 *   risks: string[]
 *   actionMode?: string
 *   regimeLabel?: string
 *   tradeDate?: string
 * }} PanicMarketReport
 */

const METRIC_ORDER = [
  { key: "vix", name: "VIX" },
  { key: "vxn", name: "VXN" },
  { key: "putCall", name: "P/C" },
  { key: "fearGreed", name: "공포탐욕" },
  { key: "highYield", name: "신용(OAS)" },
  { key: "move", name: "MOVE" },
  { key: "skew", name: "SKEW" },
  { key: "bofa", name: "BofA" },
  { key: "gsBullBear", name: "GS B/B" },
]

function pick(data, key) {
  if (!data) return null
  if (key === "highYield") {
    const n = Number(data.highYield ?? data.hyOas)
    return Number.isFinite(n) ? n : null
  }
  if (key === "gsBullBear") {
    const n = Number(data.gsBullBear ?? data.gsSentiment)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(data[key])
  return Number.isFinite(n) ? n : null
}

/** @param {string} statusLabel @param {"positive"|"neutral"|"warning"|"danger"} tone */
function statusWord(statusLabel, tone) {
  if (tone === "danger") return `${statusLabel} 국면`
  if (tone === "warning") return `${statusLabel} 경계`
  if (tone === "positive") return `${statusLabel} 수준`
  return `${statusLabel} 구간`
}

/**
 * @param {object} panicData
 * @returns {{ key: string; name: string; value: number; valueText: string; statusLabel: string; tone: string }[]}
 */
function metricSnapshots(panicData) {
  return METRIC_ORDER.map(({ key, name }) => {
    const value = pick(panicData, key)
    if (value == null) return null
    const ins = interpretPanicMetric(key, value)
    if (!ins) return null
    return {
      key,
      name,
      value,
      valueText: formatMetricValue(key, value),
      statusLabel: ins.statusLabel,
      tone: ins.tone,
    }
  }).filter(Boolean)
}

/** @param {ReturnType<typeof metricSnapshots>} snaps */
function buildSummary(snaps, action) {
  const byKey = Object.fromEntries(snaps.map((s) => [s.key, s]))
  const parts = []

  if (byKey.vix) {
    parts.push(`VIX ${byKey.vix.valueText}로 ${statusWord(byKey.vix.statusLabel, byKey.vix.tone)}`)
  }
  if (byKey.highYield) {
    parts.push(
      `신용시장(OAS ${byKey.highYield.valueText})은 ${statusWord(byKey.highYield.statusLabel, byKey.highYield.tone)}`,
    )
  }
  if (byKey.fearGreed) {
    parts.push(
      `공포탐욕 ${byKey.fearGreed.valueText}은 ${statusWord(byKey.fearGreed.statusLabel, byKey.fearGreed.tone)}`,
    )
  }
  if (byKey.putCall && !byKey.vix) {
    parts.push(`풋콜 ${byKey.putCall.valueText} — ${byKey.putCall.statusLabel}`)
  }

  const line1 = parts.length ? `${parts.join(", ")}.` : "핵심 지표 입력이 제한적입니다."

  let line2 = ""
  switch (action.regime) {
    case "extreme_fear":
      line2 =
        "단기 변동성·헤지 수요가 크므로 추격 매수보다 방어와 유동성 확보가 우선입니다."
      break
    case "fear":
      line2 =
        "단기 과열 신호는 일부 존재할 수 있으나, 시스템 리스크는 아직 통제 가능한 공포 구간으로 해석됩니다."
      break
    case "greed":
      line2 =
        "위험 선호 심리가 살아 있으나, 일부 지표에서 과열·쏠림이 동시에 관측됩니다. 분할 접근이 유효합니다."
      break
    case "extreme_greed":
      line2 =
        "탐욕·과열 신호가 우세합니다. 추격보다 익절·비중 조절로 변동성 확대에 대비하세요."
      break
    default:
      line2 =
        "단기 과열과 방어 신호가 혼재합니다. 이벤트 대응형·범위 매매가 유효한 중립 환경입니다."
  }

  return `${line1}\n\n${line2}`
}

/** @param {object} panicData @returns {string[]} */
function buildRiskBullets(panicData) {
  const candidates = []
  const vix = pick(panicData, "vix")
  const vxn = pick(panicData, "vxn")
  const pc = pick(panicData, "putCall")
  const hy = pick(panicData, "highYield")
  const move = pick(panicData, "move")
  const skew = pick(panicData, "skew")
  const fg = pick(panicData, "fearGreed")
  const bofa = pick(panicData, "bofa")

  if (pc != null && pc >= 0.85) candidates.push({ t: 3, text: `풋콜 ${pc.toFixed(2)} — 옵션 방어·헤지 쏠림` })
  if (pc != null && pc <= 0.55) candidates.push({ t: 2, text: `풋콜 ${pc.toFixed(2)} — 콜 과열·단기 과열` })
  if (hy != null && hy >= 5) candidates.push({ t: 3, text: `하이일드 OAS ${hy.toFixed(2)}% — 신용 스트레스` })
  if (hy != null && hy < 3.2) candidates.push({ t: 1, text: `하이일드 OAS ${hy.toFixed(2)}% — 신용시장 안정` })
  if (vix != null && vix >= 25) candidates.push({ t: 3, text: `VIX ${vix.toFixed(1)} — 변동성 확대` })
  if (vxn != null && vxn >= 26) candidates.push({ t: 2, text: `VXN ${vxn.toFixed(1)} — 나스닥 변동성 부담` })
  if (move != null && move >= 115) candidates.push({ t: 3, text: `MOVE ${Math.round(move)} — 채권 변동성 급등` })
  if (skew != null && skew >= 140) candidates.push({ t: 2, text: `SKEW ${Math.round(skew)} — 꼬리위험 상승` })
  if (fg != null && fg <= 28) candidates.push({ t: 3, text: `공포탐욕 ${Math.round(fg)} — 극단 공포` })
  if (fg != null && fg >= 72) candidates.push({ t: 2, text: `공포탐욕 ${Math.round(fg)} — 탐욕·과열` })
  if (bofa != null && bofa <= 2.5) candidates.push({ t: 2, text: `BofA ${bofa.toFixed(1)} — 투자자 심리 위축` })

  candidates.sort((a, b) => b.t - a.t)
  const uniq = []
  const seen = new Set()
  for (const c of candidates) {
    if (seen.has(c.text)) continue
    seen.add(c.text)
    uniq.push(c.text)
    if (uniq.length >= 3) break
  }
  if (!uniq.length) return ["특이 리스크 신호 제한적 — 지표 중립권"]
  return uniq
}

/** @param {import("./panicMarketActionEngine.js").MarketRegime} regime */
function strategyMid(regime) {
  switch (regime) {
    case "extreme_fear":
      return "현금 확보"
    case "fear":
      return "중립"
    case "greed":
      return "비중 확대"
    case "extreme_greed":
      return "중립"
    default:
      return "중립"
  }
}

/** @param {import("./panicMarketActionEngine.js").MarketRegime} regime */
function strategyLong(regime) {
  switch (regime) {
    case "extreme_fear":
      return "방어"
    case "fear":
      return "중립"
    case "greed":
      return "적립"
    case "extreme_greed":
      return "중립"
    default:
      return "중립"
  }
}

/** @param {string} [tradeDate] */
export function deskReportKey(tradeDate) {
  const d =
    typeof tradeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(tradeDate)
      ? tradeDate
      : new Date().toISOString().slice(0, 10)
  return `desk_market:${d}`
}

/**
 * @param {object | null | undefined} panicData
 * @returns {PanicMarketReport | null}
 */
export function generatePanicMarketReport(panicData) {
  if (!panicData || typeof panicData !== "object") return null
  const action = computeMarketAction(panicData)
  if (!action) return null

  const snaps = metricSnapshots(panicData)
  if (snaps.length < 3) return null

  const risks = buildRiskBullets(panicData)
  const tradeDate =
    typeof panicData.tradeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(panicData.tradeDate)
      ? panicData.tradeDate
      : String(panicData.updatedAt ?? "").slice(0, 10) || undefined

  return {
    summary: buildSummary(snaps, action),
    shortTerm: action.shortTerm,
    midTerm: strategyMid(action.regime),
    longTerm: strategyLong(action.regime),
    risk: risks.join(" · "),
    sector: action.sectors.join(" · "),
    risks,
    actionMode: action.actionMode,
    regimeLabel: action.regimeLabel,
    tradeDate,
  }
}
