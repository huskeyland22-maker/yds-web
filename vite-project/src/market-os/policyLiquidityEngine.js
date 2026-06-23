/**
 * 정책 유동성 V2 — 물가·연준·금리 실측 추세 기반 (고정 문구 없음)
 */

import { MACRO_RISK_SEED_HISTORY } from "../macro-risk/staticSeed.js"
import { buildRawLayer } from "../macro-risk/rawLayer.js"
import { lastFinite } from "../macro-risk/seriesMath.js"

/** @typedef {'ok'|'warn'} LiquidityFactorTone */

/**
 * @typedef {{
 *   label: string
 *   detail?: string
 *   tone: LiquidityFactorTone
 * }} PolicyFactorLine
 */

/**
 * @typedef {import("./liquidityDualEngine.js").LiquidityLaneCard & {
 *   scoreExplain: string
 * }} PolicyLiquidityLaneCard
 */

/** @param {number} n @param {number} min @param {number} max */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

/**
 * @param {number[]} values
 * @param {number} [n]
 */
function lastNTrend(values, n = 3) {
  const arr = (Array.isArray(values) ? values : []).map(Number).filter((v) => Number.isFinite(v))
  const slice = arr.slice(-n)
  if (slice.length < 2) {
    return { slope: /** @type {const} */ ("flat"), points: slice }
  }
  const rising = slice.every((v, i) => i === 0 || v >= slice[i - 1]) && slice[slice.length - 1] > slice[0]
  const falling = slice.every((v, i) => i === 0 || v <= slice[i - 1]) && slice[slice.length - 1] < slice[0]
  if (rising) return { slope: /** @type {const} */ ("up"), points: slice }
  if (falling) return { slope: /** @type {const} */ ("down"), points: slice }
  return { slope: /** @type {const} */ ("flat"), points: slice }
}

/** @param {number[]} points @param {'index'|'pct'|'rate'} [fmt] */
function formatTrail(points, fmt = "index") {
  if (!points.length) return "데이터 수집 중"
  return points
    .map((v) => {
      if (fmt === "pct") return `${v.toFixed(1)}%`
      if (fmt === "rate") return `${v.toFixed(2)}%`
      return v >= 100 ? v.toFixed(2) : v.toFixed(2)
    })
    .join(" → ")
}

/** @param {'up'|'down'|'flat'} slope */
function scoreFromTrendSlope(slope) {
  if (slope === "down") return 84
  if (slope === "flat") return 52
  if (slope === "up") return 22
  return 50
}

/** @param {'up'|'down'|'flat'} slope — 물가·금리: 상승=감점 */
function scorePriceOrRateTrend(slope) {
  return scoreFromTrendSlope(slope)
}

/** @param {'up'|'down'|'flat'} slope — 연준: 매파(up rates/hawkish)=감점, 비둘기=가점 */
function scoreFedDovishTrend(slope) {
  return scoreFromTrendSlope(slope)
}

/**
 * @param {Record<string, number[]>} [apiHistory]
 */
function mergePolicyHistory(apiHistory = {}) {
  /** @type {Record<string, number[]>} */
  const merged = { ...MACRO_RISK_SEED_HISTORY }
  for (const [key, values] of Object.entries(apiHistory)) {
    if (Array.isArray(values) && values.length >= 2) merged[key] = values
  }
  return merged
}

/** @param {number | null} score */
function resolvePolicyBand(score) {
  if (score == null) {
    return { id: /** @type {const} */ ("neutral"), label: "중립", tone: /** @type {const} */ ("neutral") }
  }
  if (score >= 80) return { id: "very_favorable", label: "완화 우호", tone: "favorable" }
  if (score >= 60) return { id: "favorable", label: "완화 기조", tone: "favorable" }
  if (score >= 40) return { id: "neutral", label: "중립~긴축", tone: "neutral" }
  if (score >= 20) return { id: "alert", label: "긴축 우려", tone: "alert" }
  return { id: "danger", label: "긴축 강화", tone: "danger" }
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @param {Record<string, number[]>} [apiHistory]
 */
export function buildPolicyLiquidityLane(snapshot, apiHistory = {}) {
  const history = mergePolicyHistory(apiHistory)
  const raw = buildRawLayer(history)

  const cpiHist = history.CPI ?? []
  const coreHist = history.CORE_CPI ?? []
  const ppiHist = history.PPI ?? []
  const pceHist = history.PCE ?? []

  const cpiTrend = lastNTrend(cpiHist, 3)
  const coreTrend = lastNTrend(coreHist, 3)
  const ppiTrend = lastNTrend(ppiHist, 3)
  const pceTrend = lastNTrend(pceHist, 3)

  const cpiScore = scorePriceOrRateTrend(cpiTrend.slope)
  const coreScore = scorePriceOrRateTrend(coreTrend.slope)
  const ppiScore = scorePriceOrRateTrend(ppiTrend.slope)
  const pceScore = scorePriceOrRateTrend(pceTrend.slope)
  const priceBlockScore = Math.round(
    cpiScore * 0.3 + coreScore * 0.25 + ppiScore * 0.2 + pceScore * 0.25,
  )

  const inflResurge =
    cpiTrend.slope === "up" ||
    coreTrend.slope === "up" ||
    ppiTrend.slope === "up" ||
    pceTrend.slope === "up"

  const bei = raw.BEI
  const us2y = raw.US2Y
  const ratePillar = snapshot?.pillars?.find((p) => p.id === "rate")
  const infPillar = snapshot?.pillars?.find((p) => p.id === "inflation")

  let dotScore = 50
  if (bei?.slope === "down" || (bei?.change20D != null && bei.change20D < -0.05)) dotScore = 78
  else if (bei?.slope === "up" || (bei?.change20D != null && bei.change20D > 0.05)) dotScore = 28
  else dotScore = 52

  let fedWatchScore = 50
  if (us2y?.slope === "down") fedWatchScore = 76
  else if (us2y?.slope === "up") fedWatchScore = 26
  else fedWatchScore = 50

  let fomcScore = 50
  const ratePressure = ratePillar?.score ?? 50
  const inflPressure = infPillar?.score ?? 50
  if (ratePressure >= 60 || inflPressure >= 55) fomcScore = 24
  else if (ratePressure <= 40 && inflPressure <= 45) fomcScore = 78
  else fomcScore = 50

  const fedBlockScore = Math.round(dotScore * 0.4 + fedWatchScore * 0.35 + fomcScore * 0.25)

  const us2yScore = scorePriceOrRateTrend(us2y?.slope ?? "flat")
  const us10yScore = scorePriceOrRateTrend(raw.US10Y?.slope ?? "flat")
  const realScore = scorePriceOrRateTrend(raw.REAL_YIELD?.slope ?? "flat")
  const rateBlockScore = Math.round(us2yScore * 0.35 + us10yScore * 0.35 + realScore * 0.3)

  const metrics = [
    { id: "price", weight: 0.4, score: priceBlockScore },
    { id: "fed", weight: 0.3, score: fedBlockScore },
    { id: "rates", weight: 0.3, score: rateBlockScore },
  ]

  let weighted = 0
  let weightSum = 0
  for (const m of metrics) {
    weighted += m.score * m.weight
    weightSum += m.weight
  }
  const score = Math.round(clamp(weighted / weightSum, 0, 100))
  const band = resolvePolicyBand(score)

  const cpiFmt = lastFinite(cpiHist) != null && lastFinite(cpiHist) > 50 ? "index" : "pct"
  const coreFmt = lastFinite(coreHist) != null && lastFinite(coreHist) > 50 ? "index" : "pct"

  /** @type {PolicyFactorLine[]} */
  const environment = []

  const pushTrendLine = (name, trend, fmt) => {
    const detail =
      trend.points.length >= 2
        ? formatTrail(trend.points, fmt)
        : trend.slope === "up"
          ? "최근 3개월 연속 상승"
          : trend.slope === "down"
            ? "최근 3개월 연속 하락"
            : "데이터 부족"

    if (trend.slope === "up") {
      environment.push({
        label: `${name} 상승 추세`,
        detail,
        tone: "warn",
      })
      return
    }
    if (trend.slope === "down") {
      environment.push({
        label: `${name} 둔화 추세`,
        detail,
        tone: "ok",
      })
      return
    }
    environment.push({
      label: `${name} 보합`,
      detail,
      tone: "warn",
    })
  }

  pushTrendLine("CPI", cpiTrend, cpiFmt)
  pushTrendLine("Core CPI", coreTrend, coreFmt)
  pushTrendLine("PPI", ppiTrend, "pct")
  pushTrendLine("PCE", pceTrend, "pct")

  const cutHopeRetreat = inflResurge || dotScore < 45 || fedWatchScore < 45
  environment.push({
    label: cutHopeRetreat ? "금리인하 기대 후퇴" : "금리인하 기대 유지",
    detail: cutHopeRetreat
      ? bei?.current != null
        ? `Fed Watch·BEI ${bei.current.toFixed(2)}% · 연내 인하 기대 감소`
        : "Fed Watch 기준 연내 인하 기대 감소"
      : bei?.current != null
        ? `BEI ${bei.current.toFixed(2)}% · 완화 기대 유지`
        : "시장 금리인하 기대 중립",
    tone: cutHopeRetreat ? "warn" : "ok",
  })

  const longRateBurden = us10yScore < 45 || raw.US10Y?.slope === "up"
  environment.push({
    label: longRateBurden ? "장기금리 부담" : "장기금리 안정",
    detail:
      raw.US10Y?.current != null
        ? `10년물 ${raw.US10Y.current.toFixed(2)}%${raw.US10Y.slope === "up" ? " · 상승 추세" : ""}`
        : "10년물 국채금리 점검",
    tone: longRateBurden ? "warn" : "ok",
  })

  const hawkish = fomcScore < 45
  environment.push({
    label: hawkish ? "연준 매파 경계" : fomcScore > 60 ? "연준 완화 기조" : "연준 신중 기조",
    detail: hawkish
      ? ratePillar?.status
        ? `금리·인플레 압력 ${ratePillar.status} · 점도표 기준`
        : "최근 점도표·FOMC 기준 매파 경계"
      : infPillar?.status ?? "FOMC·점도표 중립",
    tone: hawkish ? "warn" : fomcScore > 60 ? "ok" : "warn",
  })

  const highRatePersist = rateBlockScore < 42
  if (highRatePersist) {
    environment.push({
      label: "고금리 장기화 위험",
      detail:
        raw.REAL_YIELD?.current != null
          ? `실질금리 ${raw.REAL_YIELD.current.toFixed(2)}% · 2Y ${us2y?.current?.toFixed(2) ?? "—"}%`
          : "장기금리·실질금리 동반 부담",
      tone: "warn",
    })
  }

  const contributions = buildPolicyContributions(metrics, score, {
    priceBlockScore,
    fedBlockScore,
    rateBlockScore,
    cpiScore,
    coreScore,
    ppiScore,
    pceScore,
    dotScore,
    fedWatchScore,
    fomcScore,
    us2yScore,
    us10yScore,
    realScore,
  })

  const scoreExplain = buildPolicyScoreExplain(score, band, {
    priceBlockScore,
    fedBlockScore,
    rateBlockScore,
    cpiTrend,
    coreTrend,
    ppiTrend,
    pceTrend,
    inflResurge,
    cutHopeRetreat,
    hawkish,
    longRateBurden,
  })

  return {
    kind: /** @type {const} */ ("policy"),
    title: "정책 유동성",
    score,
    band,
    environmentLabel: "현재 정책 환경",
    environment,
    marketImpacts: buildPolicyImpacts(score),
    investmentLines: [],
    laneActions: [],
    contributions,
    scoreExplain,
  }
}

/** @param {number | null} score */
function buildPolicyImpacts(score) {
  const s = score ?? 50
  if (s >= 60) {
    return ["금리인하 기대 확대", "성장주 멀티플 확장 여지", "장기금리 하락 압력", "밸류에이션 확장 가능"]
  }
  if (s >= 40) {
    return ["성장주 할인율 부담", "장기금리 상승 압력", "밸류에이션 확장 제한"]
  }
  return ["긴축 기조 강화", "성장주 할인율 확대", "장기금리 상승 지속", "밸류에이션 압축"]
}

/**
 * @param {typeof metrics} metrics
 * @param {number} scoreTotal
 */
function buildPolicyContributions(metrics, scoreTotal, detail) {
  const defs = [
    {
      id: "price",
      label: "물가 환경",
      weight: 0.4,
      score: detail.priceBlockScore,
      tooltip: `CPI ${detail.cpiScore} · Core ${detail.coreScore} · PPI ${detail.ppiScore} · PCE ${detail.pceScore}`,
    },
    {
      id: "fed",
      label: "연준 스탠스",
      weight: 0.3,
      score: detail.fedBlockScore,
      tooltip: `Dot·BEI ${detail.dotScore} · FedWatch ${detail.fedWatchScore} · FOMC ${detail.fomcScore}`,
    },
    {
      id: "rates",
      label: "금리 환경",
      weight: 0.3,
      score: detail.rateBlockScore,
      tooltip: `2Y ${detail.us2yScore} · 10Y ${detail.us10yScore} · 실질 ${detail.realScore}`,
    },
  ]

  /** @type {import("./liquidityDualEngine.js").LiquidityContributionRow[]} */
  const rows = defs.map((def) => {
    const contribution = Math.round(def.score * def.weight)
    const tone = def.score >= 60 ? "positive" : def.score >= 40 ? "neutral" : "negative"
    return {
      id: def.id,
      label: def.label,
      contribution,
      metricScore: def.score,
      tone: /** @type {import("./liquidityDualEngine.js").ContributionTone} */ (tone),
      tooltip: def.tooltip,
      barPct: 0,
    }
  })

  const sum = rows.reduce((acc, row) => acc + row.contribution, 0)
  if (rows.length && sum !== scoreTotal) {
    rows[rows.length - 1].contribution += scoreTotal - sum
  }

  const maxContrib = Math.max(...rows.map((row) => row.contribution), 1)
  for (const row of rows) {
    row.barPct = Math.max(8, Math.round((row.contribution / maxContrib) * 100))
  }

  return rows
}

/**
 * @param {number} score
 * @param {import("./liquidityDualEngine.js").LiquidityBand} band
 */
function buildPolicyScoreExplain(score, band, ctx) {
  /** @type {string[]} */
  const drivers = []
  if (ctx.inflResurge) {
    drivers.push("인플레이션 재상승 우려")
  }
  if (ctx.cutHopeRetreat) drivers.push("금리인하 기대 후퇴")
  if (ctx.longRateBurden) drivers.push("장기금리 부담")
  if (ctx.hawkish) drivers.push("연준 매파 경계")

  if (!drivers.length) {
    if (score >= 60 && !ctx.inflResurge) {
      return "물가 둔화와 완화 기대가 정책 유동성을 지원하고 있습니다."
    }
    return `정책 지표가 혼조입니다(${band.label}). 선별적 접근이 필요합니다.`
  }

  const joined =
    drivers.length === 1
      ? drivers[0]
      : drivers.length === 2
        ? `${drivers[0]}와 ${drivers[1]}`
        : `${drivers.slice(0, -1).join(", ")}와 ${drivers[drivers.length - 1]}`

  return `${joined}가 정책 유동성을 제한하고 있습니다.`
}
