/**
 * DBB practical utility v11 — audit of v10 matching bias & bootstrap (research only).
 * Does not modify v1~v10, engine, trades, or matching rules. No new buy rule.
 */
import { buildRegimeByDate } from "../../vite-project/src/content/etfSignalRegimeV3.js"
import { SAME_DAY_RULE, bootstrapGapMedian, mulberry32 } from "./dbb-chart-quality-v2.mjs"
import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import { FROZEN_THRESHOLDS } from "./daily-bottom-split-buy-sim.mjs"
import {
  HORIZONS,
  PRIMARY_HORIZON,
  MATCH_RULE,
  analyzeSignalVsControl,
  buildControlCandidates,
  featureAt,
  matchPairs,
  sameDayPairedGaps,
} from "./dbb-chart-quality-v10.mjs"
import { benchmarkHorizonReturns, measureNextOpenEntry } from "./dbb-chart-quality-v1.mjs"

export const CHART_QUALITY_V11 = 11
export { HORIZONS, PRIMARY_HORIZON, MATCH_RULE }

/**
 * Fixed before reading audit outcomes / block CIs.
 * Block lengths are pre-specified; do not pick the most favorable after seeing results.
 */
export const AUDIT_RULE = {
  purpose: "v10 매칭 편향·대조 독립성·미래 구간 중첩·부트스트랩 구현을 감사한다. 새 매수 규칙을 찾지 않는다.",
  reproduce: "v10 JSON 핵심 수치를 재계산과 대조한다. 불일치 시 원본을 고치지 않고 원인을 기록한다.",
  matchingBias: "매칭군 vs 미매칭군. 미매칭 미래성과는 사후 진단으로만 표시한다.",
  overlap: "동일 종목 신호·대조 보유구간 중첩, 달력일 공유, 대조 중복, 학습·검증 경계 침범을 집계한다.",
  dateCluster:
    "v10 sameDayPairedGaps: 신호일 단위로 쌍 중앙값 차이를 만든 뒤 bootstrapGapMedian(날짜 gap 벡터) 재표본.",
  blockBootstrap: {
    primaryBlockDates: 60,
    sensitivityBlockDates: [40, 90],
    reason:
      "60거래일 평가와 같은 길이의 신호일 서열 블록을 1차로 둔다. 40·90은 사전 지정 민감도이며 결과 보고 후 선택하지 않는다.",
    method: "정렬된 신호일 gap 시계열에 순환 블록 부트스트랩(길이 B). 날짜 클러스터·쌍 관계는 날짜 gap에 이미 압축됨.",
    reps: SAME_DAY_RULE.bootstrapReps,
    seed: SAME_DAY_RULE.bootstrapSeed,
  },
  noRetune: "캘리퍼·매칭·블록 길이를 결과에 맞춰 바꾸지 않는다.",
  verdictLevels: ["감사 통과, 효용 미입증 유지", "감사상 중대 문제 발견", "추가 검증 불가"],
}

export const VERDICT_LEVELS = AUDIT_RULE.verdictLevels

const V10_EXPECTED = {
  signalsAttempted: 1379,
  matched: 1243,
  unmatched: 136,
  trainMatched: 872,
  validationMatched: 371,
  overallSameDayGapMedian: 1.37,
  overallSameDayCi: { lo: -0.23, hi: 3 },
  validationReturnMedian: 5.36,
  validationSameDayCi: { lo: -0.72, hi: 6.55 },
  balanceAbs: { dd20: 1.3, vol20: 0.3, qqqRet20: 1.17 },
  tolerance: 0.05,
}

function finite(value) {
  return value != null && Number.isFinite(Number(value))
}

function round2(value) {
  if (!finite(value)) return null
  return Math.round(Number(value) * 100) / 100
}

function mean(values) {
  const xs = (values || []).filter(finite).map(Number)
  if (!xs.length) return null
  return round2(xs.reduce((sum, value) => sum + value, 0) / xs.length)
}

function median(values) {
  const xs = (values || []).filter(finite).map(Number).sort((a, b) => a - b)
  if (!xs.length) return null
  const mid = Math.floor(xs.length / 2)
  if (xs.length % 2) return xs[mid]
  return round2((xs[mid - 1] + xs[mid]) / 2)
}

function stdev(values) {
  const xs = (values || []).filter(finite).map(Number)
  if (xs.length < 2) return null
  const avg = xs.reduce((sum, value) => sum + value, 0) / xs.length
  const varSum = xs.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(varSum)
}

function smd(a, b) {
  const xs = (a || []).filter(finite).map(Number)
  const ys = (b || []).filter(finite).map(Number)
  if (!xs.length || !ys.length) return null
  const meanA = xs.reduce((s, v) => s + v, 0) / xs.length
  const meanB = ys.reduce((s, v) => s + v, 0) / ys.length
  const sA = stdev(xs)
  const sB = stdev(ys)
  const pooled = Math.sqrt(((sA ?? 0) ** 2 + (sB ?? 0) ** 2) / 2)
  if (!(pooled > 0)) return null
  return round2((meanA - meanB) / pooled)
}

function near(a, b, tol = V10_EXPECTED.tolerance) {
  if (!finite(a) || !finite(b)) return false
  return Math.abs(Number(a) - Number(b)) <= tol
}

function buildQqqCloseMap(qqqBars) {
  const map = new Map()
  for (const bar of qqqBars || []) {
    const close = Number(bar?.close)
    if (typeof bar?.date === "string" && finite(close) && close > 0) map.set(bar.date, close)
  }
  return map
}

function attachExcess(horizons, qqqByDate, entryDate) {
  const out = {}
  for (const days of HORIZONS) {
    const key = String(days)
    const h = { ...(horizons?.[key] || {}) }
    if (h.priceReturnStatus === "complete" && entryDate && h.endDate) {
      const qqqRet = benchmarkHorizonReturns(qqqByDate, entryDate, h.endDate)
      h.qqqReturnPct = finite(qqqRet) ? round2(qqqRet) : null
      h.excessQqqPct =
        finite(h.priceReturnPct) && finite(qqqRet) ? round2(Number(h.priceReturnPct) - Number(qqqRet)) : null
    } else {
      h.qqqReturnPct = null
      h.excessQqqPct = null
    }
    out[key] = h
  }
  return out
}

function computeScales(features) {
  return {
    dd20: stdev(features.map((f) => f.dd20)) || 1,
    vol20: stdev(features.map((f) => f.vol20)) || 1,
    qqqRet20: stdev(features.map((f) => f.qqqRet20)) || 1,
  }
}

function summarizeFeat(list, key) {
  const xs = (list || []).map((row) => row?.[key]).filter(finite)
  return { n: xs.length, mean: mean(xs), median: median(xs) }
}

function horizonRet(row, side, days) {
  const h = row?.[side === "signal" ? "signalHorizons" : "controlHorizons"]?.[String(days)]
  if (h?.priceReturnStatus !== "complete" || !finite(h.priceReturnPct)) return null
  return Number(h.priceReturnPct)
}

function horizonMae(row, side, days) {
  const h = row?.[side === "signal" ? "signalHorizons" : "controlHorizons"]?.[String(days)]
  if (h?.maxDrawdownStatus !== "complete" || !finite(h.maxDrawdownPct)) return null
  return Number(h.maxDrawdownPct)
}

/**
 * Rebuild v10 match detail for audit (does not write into v10 JSON).
 */
export function rebuildMatchDetail(v1Report, seriesBySymbol, qqqBars) {
  const split = v1Report?.split
  if (!split?.trainEndDate || !split?.validationStartDate) throw new Error("v1 split required")

  const qqqByDate = buildQqqCloseMap(qqqBars)
  const regimeByDate = buildRegimeByDate(qqqBars)
  const signalRows = (v1Report.rows || []).filter((row) => row?.signalDate && row.entryStatus === "confirmed")
  const prepared = []
  const featureFailed = []
  const controlPoolTrain = []
  const controlPoolVal = []

  for (const symbol of Object.keys(seriesBySymbol).sort()) {
    const bars = seriesBySymbol[symbol]
    if (!bars?.length) continue
    const enriched = enrichBarsWithIndicators(bars)
    const { candidates } = buildControlCandidates(enriched, qqqByDate, regimeByDate)
    for (const feat of candidates) {
      const item = { ...feat, symbol }
      if (feat.date <= split.trainEndDate) controlPoolTrain.push(item)
      else if (feat.date >= split.validationStartDate) controlPoolVal.push(item)
    }
    const dateToIdx = new Map(enriched.map((bar, idx) => [bar.date, idx]))
    for (const row of signalRows.filter((r) => r.symbol === symbol)) {
      const idx = dateToIdx.get(row.signalDate)
      if (idx == null) {
        featureFailed.push({ symbol, signalDate: row.signalDate, reason: "signal_date_missing_in_bars", rowId: row.id })
        continue
      }
      const feat = featureAt(enriched, idx, qqqByDate, regimeByDate)
      if (!feat) {
        featureFailed.push({
          symbol,
          signalDate: row.signalDate,
          reason: "feature_unavailable",
          rowId: row.id,
          split: row.signalDate <= split.trainEndDate ? "train" : row.signalDate >= split.validationStartDate ? "validation" : "gap",
          horizons: row.horizons,
        })
        continue
      }
      prepared.push({
        ...feat,
        symbol,
        signalCount: row.signalCount,
        rowId: row.id,
        signalHorizons: row.horizons,
        signalEntryDate: row.entryDate,
        signalEntryPrice: row.entryPrice,
        barsRef: enriched,
        signalIdx: idx,
        splitBucket:
          row.signalDate <= split.trainEndDate ? "train" : row.signalDate >= split.validationStartDate ? "validation" : "gap",
      })
    }
  }

  const trainSignals = prepared.filter((row) => row.date <= split.trainEndDate)
  const valSignals = prepared.filter((row) => row.date >= split.validationStartDate)
  const scales = computeScales([...trainSignals, ...controlPoolTrain])

  function hydrate(signalList, controlList) {
    const raw = matchPairs(signalList, controlList, scales)
    const pairs = []
    for (const pair of raw.pairs) {
      const signal = signalList.find((s) => s.symbol === pair.symbol && s.date === pair.signalDate)
      if (!signal?.barsRef) continue
      const controlIdx = signal.barsRef.findIndex((bar) => bar.date === pair.controlDate)
      if (controlIdx < 0) continue
      const controlEntry = measureNextOpenEntry(signal.barsRef, controlIdx)
      const controlHorizons = attachExcess(controlEntry.horizons, qqqByDate, controlEntry.entryDate)
      const signalHorizons = attachExcess(signal.signalHorizons, qqqByDate, signal.signalEntryDate)
      pairs.push({
        symbol: pair.symbol,
        signalDate: pair.signalDate,
        controlDate: pair.controlDate,
        signalCount: signal.signalCount,
        distance: pair.distance,
        splitBucket: signal.splitBucket,
        signalFeat: {
          dd20: signal.dd20,
          vol20: signal.vol20,
          qqqRet20: signal.qqqRet20,
          regime: signal.regime,
          count: signal.count,
        },
        controlFeat: {
          dd20: pair.controlFeat.dd20,
          vol20: pair.controlFeat.vol20,
          qqqRet20: pair.controlFeat.qqqRet20,
          regime: pair.controlFeat.regime,
          count: pair.controlFeat.count,
        },
        signalEntryDate: signal.signalEntryDate,
        controlEntryDate: controlEntry.entryDate,
        signalHorizons,
        controlHorizons,
        signalIdx: signal.signalIdx,
        controlIdx,
        barsLen: signal.barsRef.length,
      })
    }
    const unmatchedDetailed = raw.unmatched.map((u) => {
      const signal = signalList.find((s) => s.symbol === u.symbol && s.date === u.signalDate)
      return {
        symbol: u.symbol,
        signalDate: u.signalDate,
        reason: u.reason || "no_caliper_match",
        splitBucket: signal?.splitBucket ?? null,
        signalFeat: signal
          ? {
              dd20: signal.dd20,
              vol20: signal.vol20,
              qqqRet20: signal.qqqRet20,
              regime: signal.regime,
              count: signal.count,
            }
          : null,
        signalHorizons: signal?.signalHorizons ?? null,
        signalEntryDate: signal?.signalEntryDate ?? null,
      }
    })
    return { pairs, unmatched: unmatchedDetailed, reusedControls: raw.reusedControls, attempted: signalList.length }
  }

  const train = hydrate(trainSignals, controlPoolTrain)
  const validation = hydrate(valSignals, controlPoolVal)
  return {
    split,
    scales,
    pairs: [...train.pairs, ...validation.pairs],
    unmatched: [...train.unmatched, ...validation.unmatched],
    featureFailed,
    attempted: train.attempted + validation.attempted,
    train,
    validation,
    preparedCount: prepared.length,
  }
}

/**
 * Ordered date-level median gaps (signal − control) for horizon days.
 */
export function orderedDateGaps(pairs, days = PRIMARY_HORIZON) {
  const byDate = new Map()
  for (const pair of pairs || []) {
    if (!pair.signalDate) continue
    if (!byDate.has(pair.signalDate)) byDate.set(pair.signalDate, [])
    byDate.get(pair.signalDate).push(pair)
  }
  const ordered = []
  for (const [date, group] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const gaps = []
    for (const pair of group) {
      const s = horizonRet(pair, "signal", days)
      const c = horizonRet(pair, "control", days)
      if (s == null || c == null) continue
      gaps.push(s - c)
    }
    if (!gaps.length) continue
    ordered.push({ date, gap: median(gaps), n: gaps.length })
  }
  return ordered
}

/**
 * Circular moving-block bootstrap of the date-gap series.
 * Preserves within-date aggregation already done; resamples contiguous date blocks.
 */
export function blockBootstrapDateGaps(orderedGaps, blockLen, reps = AUDIT_RULE.blockBootstrap.reps, seed = AUDIT_RULE.blockBootstrap.seed) {
  const xs = (orderedGaps || []).map((row) => row.gap).filter(finite)
  const n = xs.length
  if (n < SAME_DAY_RULE.smallSampleGroups) {
    return { n, blockLen, status: "표본 부족", mean: null, lo: null, hi: null, excludesZero: false }
  }
  if (!Number.isFinite(blockLen) || blockLen < 1) {
    return { n, blockLen, status: "블록 길이 부적절", mean: null, lo: null, hi: null, excludesZero: false }
  }
  const rng = mulberry32(seed + blockLen * 17)
  const samples = []
  for (let rep = 0; rep < reps; rep++) {
    const drawn = []
    while (drawn.length < n) {
      const start = Math.floor(rng() * n)
      for (let k = 0; k < blockLen && drawn.length < n; k++) {
        drawn.push(xs[(start + k) % n])
      }
    }
    samples.push(median(drawn))
  }
  const ordered = samples.filter(finite).sort((a, b) => a - b)
  const lo = ordered[Math.floor(0.025 * (ordered.length - 1))]
  const hi = ordered[Math.floor(0.975 * (ordered.length - 1))]
  return {
    n,
    blockLen,
    status: "ok",
    mean: mean(samples),
    lo: round2(lo),
    hi: round2(hi),
    excludesZero: finite(lo) && finite(hi) && ((lo > 0 && hi > 0) || (lo < 0 && hi < 0)),
    seed: seed + blockLen * 17,
    reps,
  }
}

/**
 * Audit v10 bootstrap implementation properties (static code facts + runtime checks).
 */
export function auditDateClusterBootstrap(pairs, days = PRIMARY_HORIZON) {
  const ordered = orderedDateGaps(pairs, days)
  const gaps = ordered.map((row) => row.gap)
  const boot = bootstrapGapMedian(gaps)
  const boot2 = bootstrapGapMedian(gaps)
  const sameDay = sameDayPairedGaps(pairs, days)

  // Pair preservation: each date gap is median of (signal-control) for that date only
  let multiSymbolDates = 0
  let maxPerDate = 0
  const byDate = new Map()
  for (const pair of pairs || []) {
    if (!byDate.has(pair.signalDate)) byDate.set(pair.signalDate, [])
    byDate.get(pair.signalDate).push(pair)
  }
  for (const group of byDate.values()) {
    maxPerDate = Math.max(maxPerDate, group.length)
    const symbols = new Set(group.map((p) => p.symbol))
    if (symbols.size > 1) multiSymbolDates += 1
  }

  return {
    unit: "signalDate calendar date (not individual ticker rows)",
    clusterTogether: multiSymbolDates > 0,
    multiSymbolDates,
    maxPairsPerSignalDate: maxPerDate,
    pairDiffPreserved: true,
    notePair:
      "날짜별 gap = 그날 매칭 쌍의 (신호−대조) 수익률 중앙값. 부트스트랩은 이 날짜 gap을 재표본하므로 쌍 관계가 날짜 단위로 보존됨.",
    incompleteHandling: "양쪽 complete가 아닌 쌍은 날짜 gap에서 제외. 0으로 채우지 않음.",
    reps: SAME_DAY_RULE.bootstrapReps,
    seed: SAME_DAY_RULE.bootstrapSeed,
    quantile: "재표본 중앙값의 2.5%·97.5% 분위(정렬 인덱스 floor)",
    reproducible: boot.lo === boot2.lo && boot.hi === boot2.hi,
    sameDayApi: {
      pairedDates: sameDay.pairedDates,
      gapMedian: sameDay.gapMedian,
      bootstrap: sameDay.bootstrap,
    },
    recomputed: { n: ordered.length, gapMedian: median(gaps), bootstrap: boot },
    matchesSameDayApi:
      near(sameDay.gapMedian, median(gaps)) &&
      near(sameDay.bootstrap?.lo, boot.lo) &&
      near(sameDay.bootstrap?.hi, boot.hi),
  }
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false
  return aStart <= bEnd && bStart <= aEnd
}

/**
 * Overlap / independence diagnostics on matched pairs.
 */
export function diagnoseIndependence(pairs, seriesBySymbol, split) {
  const list = pairs || []
  const controlKeys = list.map((p) => `${p.symbol}|${p.controlDate}`)
  const uniqueControls = new Set(controlKeys)
  const duplicateControls = controlKeys.length - uniqueControls.size

  const gapsTrading = []
  const gapsCalendar = []
  let sameSymbolWindowOverlap60 = 0
  let completeForOverlap60 = 0
  const calendarOccupancy = new Map()
  const symbolCounts = new Map()
  let trainSignalValHorizon = 0
  let valSignalTrainHorizon = 0

  for (const pair of list) {
    symbolCounts.set(pair.symbol, (symbolCounts.get(pair.symbol) || 0) + 1)
    const bars = seriesBySymbol[pair.symbol]
    if (!bars?.length) continue

    const sEntry = pair.signalEntryDate
    const cEntry = pair.controlEntryDate
    if (sEntry && cEntry) {
      const sIdx = bars.findIndex((b) => b.date === sEntry)
      const cIdx = bars.findIndex((b) => b.date === cEntry)
      if (sIdx >= 0 && cIdx >= 0) gapsTrading.push(Math.abs(sIdx - cIdx))
      const sT = Date.parse(sEntry)
      const cT = Date.parse(cEntry)
      if (Number.isFinite(sT) && Number.isFinite(cT)) {
        gapsCalendar.push(Math.abs(sT - cT) / 86400000)
      }
    }

    const sEnd60 = pair.signalHorizons?.["60"]?.endDate
    const cEnd60 = pair.controlHorizons?.["60"]?.endDate
    if (sEntry && cEntry && sEnd60 && cEnd60) {
      completeForOverlap60 += 1
      if (intervalsOverlap(sEntry, sEnd60, cEntry, cEnd60)) sameSymbolWindowOverlap60 += 1
      for (const date of [sEntry, sEnd60, cEntry, cEnd60]) {
        if (!date) continue
        // occupancy proxy: mark entry/end (full path would be dense; use month key concentration)
        const month = date.slice(0, 7)
        calendarOccupancy.set(month, (calendarOccupancy.get(month) || 0) + 1)
      }
    }

    // Split boundary: train signal whose 60d end falls on/after validation start
    if (pair.splitBucket === "train" && sEnd60 && split?.validationStartDate && sEnd60 >= split.validationStartDate) {
      trainSignalValHorizon += 1
    }
    if (pair.splitBucket === "validation" && sEnd60 && split?.trainEndDate && sEnd60 <= split.trainEndDate) {
      valSignalTrainHorizon += 1
    }
  }

  // Near-episode concentration: controls within 20 trading days of another signal date (same symbol)
  const signalsBySymbol = new Map()
  for (const pair of list) {
    if (!signalsBySymbol.has(pair.symbol)) signalsBySymbol.set(pair.symbol, [])
    signalsBySymbol.get(pair.symbol).push(pair.signalDate)
  }
  let controlsNearOtherSignal20 = 0
  for (const pair of list) {
    const bars = seriesBySymbol[pair.symbol]
    if (!bars?.length) continue
    const cIdx = bars.findIndex((b) => b.date === pair.controlDate)
    if (cIdx < 0) continue
    const others = (signalsBySymbol.get(pair.symbol) || []).filter((d) => d !== pair.signalDate)
    let nearOther = false
    for (const d of others) {
      const sIdx = bars.findIndex((b) => b.date === d)
      if (sIdx >= 0 && Math.abs(sIdx - cIdx) <= 20) {
        nearOther = true
        break
      }
    }
    if (nearOther) controlsNearOtherSignal20 += 1
  }

  const monthCounts = [...calendarOccupancy.values()]
  return {
    pairs: list.length,
    uniqueControls: uniqueControls.size,
    duplicateControls,
    gapsTrading: {
      median: median(gapsTrading),
      mean: mean(gapsTrading),
      p10: gapsTrading.length ? [...gapsTrading].sort((a, b) => a - b)[Math.floor(gapsTrading.length * 0.1)] : null,
      p90: gapsTrading.length ? [...gapsTrading].sort((a, b) => a - b)[Math.floor(gapsTrading.length * 0.9)] : null,
    },
    gapsCalendarDays: {
      median: median(gapsCalendar),
      mean: mean(gapsCalendar),
    },
    sameSymbolWindowOverlap60: {
      complete: completeForOverlap60,
      overlapping: sameSymbolWindowOverlap60,
      ratePct: completeForOverlap60 ? round2((sameSymbolWindowOverlap60 / completeForOverlap60) * 100) : null,
      note: "동일 종목에서 신호·대조의 진입~60일 종료 달력 구간이 겹치는 비율. 독립 표본으로 취급하면 과신.",
    },
    controlsNearOtherSignal20: {
      count: controlsNearOtherSignal20,
      ratePct: list.length ? round2((controlsNearOtherSignal20 / list.length) * 100) : null,
      note: "대조일이 동일 종목의 다른 신호일 ±20거래일 안에 있는 비율(v10은 ±5일만 제외).",
    },
    splitBoundary: {
      trainSignalHorizonEndsInValidation: trainSignalValHorizon,
      valSignalHorizonEndsInTrain: valSignalTrainHorizon,
      note: "매칭 풀은 신호일로 분리되나, 보유 구간 수익률은 달력상 검증 구간으로 넘어갈 수 있음. 매칭 오염은 아니나 시간 의존성과 별개로 기록.",
    },
    symbolPairCountsTop: [...symbolCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symbol, n]) => ({ symbol, n })),
    monthOccupancyMax: monthCounts.length ? Math.max(...monthCounts) : 0,
    monthOccupancyMedian: median(monthCounts),
  }
}

function compareMatchedUnmatched(matched, unmatched) {
  const mFeat = matched.map((p) => p.signalFeat).filter(Boolean)
  const uFeat = unmatched.map((u) => u.signalFeat).filter(Boolean)
  const postHoc = {
    warning: "미매칭군의 미래 수익률·MAE는 사후 진단이다. 매칭 알고리즘에는 사용되지 않았다.",
  }
  const ret = (rows, days) =>
    rows
      .map((row) => {
        const h = row.signalHorizons?.[String(days)]
        if (h?.priceReturnStatus !== "complete" || !finite(h.priceReturnPct)) return null
        return Number(h.priceReturnPct)
      })
      .filter(finite)

  const mae = (rows, days) =>
    rows
      .map((row) => {
        const h = row.signalHorizons?.[String(days)]
        if (h?.maxDrawdownStatus !== "complete" || !finite(h.maxDrawdownPct)) return null
        return Number(h.maxDrawdownPct)
      })
      .filter(finite)

  const regimeCount = (rows) => {
    const map = new Map()
    for (const row of rows) {
      const key = row.signalFeat?.regime || row.regime || "unknown"
      map.set(key, (map.get(key) || 0) + 1)
    }
    return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1]))
  }

  const symbolCount = (rows) => {
    const map = new Map()
    for (const row of rows) {
      map.set(row.symbol, (map.get(row.symbol) || 0) + 1)
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([symbol, n]) => ({ symbol, n }))
  }

  const splitCount = (rows) => {
    const out = { train: 0, validation: 0, gap: 0, unknown: 0 }
    for (const row of rows) {
      const key = row.splitBucket || "unknown"
      out[key] = (out[key] || 0) + 1
    }
    return out
  }

  const reasonCount = {}
  for (const row of unmatched) {
    reasonCount[row.reason || "unknown"] = (reasonCount[row.reason || "unknown"] || 0) + 1
  }

  return {
    matchedN: matched.length,
    unmatchedN: unmatched.length,
    reasons: reasonCount,
    split: { matched: splitCount(matched), unmatched: splitCount(unmatched) },
    regime: { matched: regimeCount(matched), unmatched: regimeCount(unmatched) },
    symbolsTop: { matched: symbolCount(matched), unmatched: symbolCount(unmatched) },
    covariates: {
      dd20: {
        matched: summarizeFeat(mFeat, "dd20"),
        unmatched: summarizeFeat(uFeat, "dd20"),
        smd: smd(
          mFeat.map((f) => f.dd20),
          uFeat.map((f) => f.dd20),
        ),
      },
      vol20: {
        matched: summarizeFeat(mFeat, "vol20"),
        unmatched: summarizeFeat(uFeat, "vol20"),
        smd: smd(
          mFeat.map((f) => f.vol20),
          uFeat.map((f) => f.vol20),
        ),
      },
      qqqRet20: {
        matched: summarizeFeat(mFeat, "qqqRet20"),
        unmatched: summarizeFeat(uFeat, "qqqRet20"),
        smd: smd(
          mFeat.map((f) => f.qqqRet20),
          uFeat.map((f) => f.qqqRet20),
        ),
      },
    },
    postHocOutcomes: {
      ...postHoc,
      ret60: {
        matched: { n: ret(matched, 60).length, median: median(ret(matched, 60)), mean: mean(ret(matched, 60)) },
        unmatched: { n: ret(unmatched, 60).length, median: median(ret(unmatched, 60)), mean: mean(ret(unmatched, 60)) },
        smd: smd(ret(matched, 60), ret(unmatched, 60)),
      },
      mae60: {
        matched: { n: mae(matched, 60).length, median: median(mae(matched, 60)) },
        unmatched: { n: mae(unmatched, 60).length, median: median(mae(unmatched, 60)) },
        smd: smd(mae(matched, 60), mae(unmatched, 60)),
      },
    },
  }
}

function reproduceChecks(v10, recomputed) {
  const checks = []
  const push = (id, ok, expected, actual, detail) => checks.push({ id, ok, expected, actual, detail })
  push("attempted", v10.counts.signalsAttempted === recomputed.counts.signalsAttempted, v10.counts.signalsAttempted, recomputed.counts.signalsAttempted, "매칭 시도")
  push("matched", v10.counts.matched === recomputed.counts.matched, v10.counts.matched, recomputed.counts.matched, "매칭 수")
  push("unmatched", v10.counts.unmatched === recomputed.counts.unmatched, v10.counts.unmatched, recomputed.counts.unmatched, "미매칭 수")
  push("train", v10.counts.trainMatched === recomputed.counts.trainMatched, v10.counts.trainMatched, recomputed.counts.trainMatched, "학습 매칭")
  push("validation", v10.counts.validationMatched === recomputed.counts.validationMatched, v10.counts.validationMatched, recomputed.counts.validationMatched, "검증 매칭")
  push(
    "overallGap",
    near(v10.tables["60"].sameDay.gapMedian, recomputed.tables["60"].sameDay.gapMedian),
    v10.tables["60"].sameDay.gapMedian,
    recomputed.tables["60"].sameDay.gapMedian,
    "전체 날짜 중앙값 차이",
  )
  push(
    "overallCiLo",
    near(v10.tables["60"].sameDay.bootstrap.lo, recomputed.tables["60"].sameDay.bootstrap.lo),
    v10.tables["60"].sameDay.bootstrap.lo,
    recomputed.tables["60"].sameDay.bootstrap.lo,
    "전체 CI lo",
  )
  push(
    "overallCiHi",
    near(v10.tables["60"].sameDay.bootstrap.hi, recomputed.tables["60"].sameDay.bootstrap.hi),
    v10.tables["60"].sameDay.bootstrap.hi,
    recomputed.tables["60"].sameDay.bootstrap.hi,
    "전체 CI hi",
  )
  push(
    "valMedian",
    near(v10.validation.byHorizon["60"].returnMedian, recomputed.validation.byHorizon["60"].returnMedian),
    v10.validation.byHorizon["60"].returnMedian,
    recomputed.validation.byHorizon["60"].returnMedian,
    "검증 중앙값 차이",
  )
  push(
    "valCiLo",
    near(v10.validation.sameDay60.bootstrap.lo, recomputed.validation.sameDay60.bootstrap.lo),
    v10.validation.sameDay60.bootstrap.lo,
    recomputed.validation.sameDay60.bootstrap.lo,
    "검증 CI lo",
  )
  push(
    "valCiHi",
    near(v10.validation.sameDay60.bootstrap.hi, recomputed.validation.sameDay60.bootstrap.hi),
    v10.validation.sameDay60.bootstrap.hi,
    recomputed.validation.sameDay60.bootstrap.hi,
    "검증 CI hi",
  )
  push(
    "balanceDd",
    near(v10.balance.after.meanAbsGap.dd20, recomputed.balance.after.meanAbsGap.dd20),
    v10.balance.after.meanAbsGap.dd20,
    recomputed.balance.after.meanAbsGap.dd20,
    "매칭 후 |Δdd20|",
  )
  push(
    "balanceVol",
    near(v10.balance.after.meanAbsGap.vol20, recomputed.balance.after.meanAbsGap.vol20),
    v10.balance.after.meanAbsGap.vol20,
    recomputed.balance.after.meanAbsGap.vol20,
    "매칭 후 |Δvol20|",
  )
  push(
    "balanceQqq",
    near(v10.balance.after.meanAbsGap.qqqRet20, recomputed.balance.after.meanAbsGap.qqqRet20),
    v10.balance.after.meanAbsGap.qqqRet20,
    recomputed.balance.after.meanAbsGap.qqqRet20,
    "매칭 후 |Δqqq20|",
  )
  return { ok: checks.every((c) => c.ok), checks }
}

function judgeAudit({ reproduce, bootstrapAudit, independence, blockOverall, blockVal }) {
  const issues = []
  if (!reproduce.ok) issues.push("v10 핵심 수치 재현 실패")
  if (bootstrapAudit && bootstrapAudit.reproducible === false) issues.push("부트스트랩 시드 재현 실패")
  if (bootstrapAudit && bootstrapAudit.matchesSameDayApi === false) issues.push("날짜 클러스터 API와 재계산 불일치")
  if (independence?.duplicateControls > 0) issues.push(`대조 중복 ${independence.duplicateControls}건`)

  // Overlap is a design limitation, not an implementation bug — flag as finding, not critical error
  const findings = []
  if (independence?.sameSymbolWindowOverlap60?.ratePct != null && independence.sameSymbolWindowOverlap60.ratePct > 20) {
    findings.push(`동일 종목 60일 구간 중첩률 ${independence.sameSymbolWindowOverlap60.ratePct}%`)
  }
  if (independence?.controlsNearOtherSignal20?.ratePct != null && independence.controlsNearOtherSignal20.ratePct > 30) {
    findings.push(`대조가 다른 신호 ±20일 내 ${independence.controlsNearOtherSignal20.ratePct}%`)
  }
  if (independence?.splitBoundary?.trainSignalHorizonEndsInValidation > 0) {
    findings.push(
      `학습 신호의 60일 종료가 검증 달력으로 넘어간 건 ${independence.splitBoundary.trainSignalHorizonEndsInValidation}`,
    )
  }
  findings.push("전체·검증 날짜 클러스터 CI가 0 포함(v10과 동일)")
  if (blockOverall?.status === "ok" && !blockOverall.excludesZero) findings.push("시간 블록(60) 전체 CI도 0 포함")
  if (blockVal?.status === "ok" && !blockVal.excludesZero) findings.push("시간 블록(60) 검증 CI도 0 포함")

  if (!reproduce.ok || (bootstrapAudit && (bootstrapAudit.reproducible === false || bootstrapAudit.matchesSameDayApi === false))) {
    return {
      level: "감사상 중대 문제 발견",
      reason: issues.join("; ") || "구현 불일치",
      issues,
      findings,
    }
  }
  if (independence?.duplicateControls > 0) {
    return {
      level: "감사상 중대 문제 발견",
      reason: "1:1 비재사용 규칙과 달리 대조 중복이 관찰됨",
      issues,
      findings,
    }
  }
  return {
    level: "감사 통과, 효용 미입증 유지",
    reason:
      "매칭·날짜 클러스터 부트스트랩 구현 오류는 확인되지 않음. 시간 의존성·CI가 0을 포함해 우위 확정 불가. v10 효용 미입증을 유지.",
    issues,
    findings,
  }
}

/**
 * @param {object} v10Report frozen JSON
 * @param {object} v1Report
 * @param {Record<string, object[]>} seriesBySymbol
 * @param {object[]} qqqBars
 */
export function analyzeV10Audit(v10Report, v1Report, seriesBySymbol, qqqBars) {
  if (!v10Report?.counts || !v1Report?.rows) throw new Error("v10 and v1 required")

  const recomputed = analyzeSignalVsControl(v1Report, seriesBySymbol, qqqBars)
  const reproduce = reproduceChecks(v10Report, recomputed)
  const detail = rebuildMatchDetail(v1Report, seriesBySymbol, qqqBars)

  const matchedUnmatched = compareMatchedUnmatched(detail.pairs, detail.unmatched)
  // include featureFailed as unmatched-like
  if (detail.featureFailed.length) {
    matchedUnmatched.reasons.feature_unavailable =
      (matchedUnmatched.reasons.feature_unavailable || 0) + detail.featureFailed.length
    matchedUnmatched.featureFailedN = detail.featureFailed.length
  }

  const balance = {
    reported: v10Report.balance?.after?.meanAbsGap ?? null,
    recomputed: recomputed.balance?.after?.meanAbsGap ?? null,
    matchesReported:
      near(v10Report.balance?.after?.meanAbsGap?.dd20, recomputed.balance?.after?.meanAbsGap?.dd20) &&
      near(v10Report.balance?.after?.meanAbsGap?.vol20, recomputed.balance?.after?.meanAbsGap?.vol20) &&
      near(v10Report.balance?.after?.meanAbsGap?.qqqRet20, recomputed.balance?.after?.meanAbsGap?.qqqRet20),
    calipers: MATCH_RULE.calipers,
  }

  const independence = diagnoseIndependence(detail.pairs, seriesBySymbol, detail.split)
  const bootstrapAuditOverall = auditDateClusterBootstrap(detail.pairs, 60)
  const bootstrapAuditVal = auditDateClusterBootstrap(detail.validation.pairs, 60)

  const orderedAll = orderedDateGaps(detail.pairs, 60)
  const orderedVal = orderedDateGaps(detail.validation.pairs, 60)
  const orderedTrain = orderedDateGaps(detail.train.pairs, 60)

  const primary = AUDIT_RULE.blockBootstrap.primaryBlockDates
  const blockOverall = {
    primary: blockBootstrapDateGaps(orderedAll, primary),
    sensitivity: Object.fromEntries(
      AUDIT_RULE.blockBootstrap.sensitivityBlockDates.map((len) => [String(len), blockBootstrapDateGaps(orderedAll, len)]),
    ),
  }
  const blockValidation = {
    primary: blockBootstrapDateGaps(orderedVal, primary),
    sensitivity: Object.fromEntries(
      AUDIT_RULE.blockBootstrap.sensitivityBlockDates.map((len) => [String(len), blockBootstrapDateGaps(orderedVal, len)]),
    ),
  }
  const blockTrain = {
    primary: blockBootstrapDateGaps(orderedTrain, primary),
  }

  // Train/val date mixing check: validation same-day should only use val signal dates
  const valDates = new Set(detail.validation.pairs.map((p) => p.signalDate))
  const trainDates = new Set(detail.train.pairs.map((p) => p.signalDate))
  let mixed = 0
  for (const d of valDates) if (trainDates.has(d)) mixed += 1

  const core = {
    overall: {
      completePairs: recomputed.tables["60"].diff.completePairs,
      returnMedian: recomputed.tables["60"].diff.returnMedian,
      returnMean: recomputed.tables["60"].diff.returnMean,
      successRatePp: recomputed.tables["60"].diff.successRatePp,
      maeMedian: recomputed.tables["60"].diff.maeMedian,
      excessMedian: recomputed.tables["60"].diff.excessMedian,
      sameDay: recomputed.tables["60"].sameDay,
    },
    train: {
      n: recomputed.train.n,
      ...recomputed.train.byHorizon["60"],
      sameDay: recomputed.train.sameDay60,
    },
    validation: {
      n: recomputed.validation.n,
      ...recomputed.validation.byHorizon["60"],
      sameDay: recomputed.validation.sameDay60,
      highlight:
        "검증 중앙값 차이 +5.36%p를 말할 때 학습의 약한 결과와 날짜·블록 CI가 0을 포함함을 함께 표시한다.",
    },
    byHorizon: Object.fromEntries(
      HORIZONS.map((days) => [
        String(days),
        {
          completePairs: recomputed.tables[String(days)].diff.completePairs,
          signalMedian: recomputed.tables[String(days)].signal.priceMedian,
          controlMedian: recomputed.tables[String(days)].control.priceMedian,
          returnMedian: recomputed.tables[String(days)].diff.returnMedian,
          returnMean: recomputed.tables[String(days)].diff.returnMean,
          successRatePp: recomputed.tables[String(days)].diff.successRatePp,
          maeMedian: recomputed.tables[String(days)].diff.maeMedian,
          excessMedian: recomputed.tables[String(days)].diff.excessMedian,
        },
      ]),
    ),
  }

  const verdict = judgeAudit({
    reproduce,
    bootstrapAudit: bootstrapAuditOverall,
    independence,
    blockOverall: blockOverall.primary,
    blockVal: blockValidation.primary,
  })

  return {
    version: CHART_QUALITY_V11,
    researchOnly: true,
    source: "audit_of_dbb_chart_quality_v10",
    asOf: v10Report.asOf ?? v1Report.asOf ?? null,
    rule: AUDIT_RULE,
    matchRuleReused: MATCH_RULE,
    thresholds: FROZEN_THRESHOLDS,
    verdictLevels: VERDICT_LEVELS,
    split: v1Report.split,
    v10Expected: V10_EXPECTED,
    reproduce,
    counts: {
      ...recomputed.counts,
      featureFailed: detail.featureFailed.length,
      detailPairs: detail.pairs.length,
      detailUnmatched: detail.unmatched.length,
    },
    matchingBias: matchedUnmatched,
    balance,
    independence,
    bootstrap: {
      dateClusterOverall: bootstrapAuditOverall,
      dateClusterValidation: bootstrapAuditVal,
      blockOverall,
      blockTrain,
      blockValidation,
      trainValDateOverlap: mixed,
      trainValDateOverlapOk: mixed === 0,
    },
    core,
    auxiliaryNote: "3개/4개·국면 보조 분석은 v10 JSON을 참조하며 이번 감사 판정 기준을 바꾸지 않는다.",
    v10Auxiliary: v10Report.auxiliary ?? null,
    verdict,
  }
}
