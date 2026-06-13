/**
 * 패닉 강도(getFinalScore) 계산 감사 · 콘솔 검증용
 */

import { computePanicV2, pickPanicV2Raw } from "../panic-v2/computePanicV2.js"
import {
  buildYdsScoreBreakdown,
  buildYdsScoreDeltaBreakdown,
  historyDataToPanicPayload,
} from "../trading-zone/ydsScoreBreakdown.js"
import { scoreFearGreed } from "../utils/tradingScores.js"
import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"

const AUDIT_LOG_PREFIX = "[panic-intensity-audit]"

/** @param {object | null | undefined} row */
export function pickRowPanicPayload(row) {
  if (!row || typeof row !== "object") return null
  if (row.panicData && typeof row.panicData === "object") return row.panicData
  return row
}

/**
 * CNN Fear&Greed 방향 검증
 * - 입력 CNN ↑ (탐욕↑) → scoreFearGreed ↓ → 패닉 기여 ↓
 * - 입력 CNN ↓ (공포↑) → scoreFearGreed ↑ → 패닉 기여 ↑
 * @param {number | null | undefined} cnn
 */
export function verifyCnnDirection(cnn) {
  const raw = Number(cnn)
  if (!Number.isFinite(raw)) {
    return {
      valid: false,
      cnnInput: null,
      normalizedScore: null,
      directionOk: null,
      formula: "scoreFearGreed(cnn) = 100 - cnn",
      note: "CNN 미입력",
    }
  }

  const normalized = scoreFearGreed(raw)
  const probeUp = scoreFearGreed(raw + 1)
  const probeDown = scoreFearGreed(raw - 1)

  return {
    valid: true,
    cnnInput: raw,
    normalizedScore: normalized,
    directionOk: probeUp < normalized && probeDown > normalized,
    derivativeSign: "d(score)/d(CNN) = -1",
    formula: "scoreFearGreed(cnn) = clamp(100 - cnn, 0, 100)",
    higherCnnRaisesPanic: false,
    probe: {
      cnnPlus1: { cnn: raw + 1, normalized: probeUp },
      cnnMinus1: { cnn: raw - 1, normalized: probeDown },
    },
    note: "CNN 지수가 높을수록(탐욕) 패닉 정규화 점수는 낮아짐 · 공포 증가(CNN↓) 시 점수 증가",
  }
}

/**
 * @param {object | null | undefined} row
 * @param {string} [dateLabel]
 */
export function buildPanicIntensityDayAudit(row, dateLabel = "") {
  const payload = historyDataToPanicPayload({
    vix: row?.vix,
    cnn: row?.fearGreed ?? row?.cnn,
    bofa: row?.bofa,
    putCall: row?.putCall,
    highYield: row?.highYield,
  })

  const breakdown = buildYdsScoreBreakdown({
    vix: payload.vix,
    cnn: payload.fearGreed,
    bofa: payload.bofa,
    putCall: payload.putCall,
    highYield: payload.highYield,
  })

  const v2 = computePanicV2(row ?? {}, { includeLegacy: true })
  const moveMetric = v2.metrics.find((m) => m.key === "move")
  const dxyMetric = v2.metrics.find((m) => m.key === "dxy")

  const cnnVerify = verifyCnnDirection(payload.fearGreed)

  return {
    date: dateLabel || String(row?.date ?? "").slice(0, 10) || null,
    engine: "getFinalScore (패닉 강도)",
    finalScore: breakdown.finalYds,
    shortScore: breakdown.shortScore,
    midScore: breakdown.midScore,
    weights: breakdown.weights,
    weightNote: breakdown.weightNote,
    metrics: {
      cnn: {
        inPanicIntensity: true,
        input: payload.fearGreed,
        normalized: breakdown.componentScores?.cnn ?? null,
        contributionPts: breakdown.contributions?.cnn ?? null,
        path: "중기 40% × 동적 wMid",
        direction: cnnVerify,
      },
      vix: {
        inPanicIntensity: true,
        input: payload.vix,
        normalized: breakdown.componentScores?.vix ?? null,
        contributionPts: breakdown.contributions?.vix ?? null,
        path: "단기 60% × 동적 wShort",
      },
      move: {
        inPanicIntensity: false,
        input: pickPanicV2Raw(row, "move"),
        normalized: moveMetric?.normalized ?? null,
        contributionPts: null,
        panicV2ContributionPts: moveMetric?.contribution ?? null,
        path: "패닉 강도 미포함 · Panic V2 가중 5%",
      },
      dxy: {
        inPanicIntensity: false,
        input: pickPanicV2Raw(row, "dxy"),
        normalized: dxyMetric?.normalized ?? null,
        contributionPts: null,
        panicV2ContributionPts: dxyMetric?.contribution ?? null,
        path: "패닉 강도 미포함 · Panic V2 가중 10%",
      },
      bofa: {
        inPanicIntensity: true,
        input: payload.bofa,
        normalized: breakdown.componentScores?.bofa ?? null,
        contributionPts: breakdown.contributions?.bofa ?? null,
        path: "중기 35% × 동적 wMid",
      },
      putCall: {
        inPanicIntensity: true,
        input: payload.putCall,
        normalized: breakdown.componentScores?.putCall ?? null,
        contributionPts: breakdown.contributions?.putCall ?? null,
        path: "단기 40% × 동적 wShort",
      },
      highYield: {
        inPanicIntensity: true,
        input: payload.highYield,
        normalized: breakdown.componentScores?.highYield ?? null,
        contributionPts: breakdown.contributions?.highYield ?? null,
        path: "중기 25% × 동적 wMid · HY>6 시 wMid↑",
      },
    },
    sumContributions: breakdown.sumContributions,
    panicV2Score: v2.score,
    legacyScore: v2.legacyScore,
  }
}

/**
 * @param {object[]} historyRows
 * @param {number} [days]
 */
export function buildPanicIntensityRecentAudit(historyRows, days = 2) {
  const sorted = sortHistoryRowsAsc(Array.isArray(historyRows) ? historyRows : [])
  const recent = sorted.slice(-days).map((row) => {
    const payload = pickRowPanicPayload(row)
    return buildPanicIntensityDayAudit(payload ?? row, String(row?.date ?? "").slice(0, 10))
  })

  /** @type {object | null} */
  let delta = null
  if (recent.length >= 2) {
    const prevRow = pickRowPanicPayload(sorted[sorted.length - 2])
    const currRow = pickRowPanicPayload(sorted[sorted.length - 1])
    const deltaBreakdown = buildYdsScoreDeltaBreakdown(currRow ?? {}, prevRow ?? {})
    if (deltaBreakdown.computable) {
      delta = {
        prevDate: recent[recent.length - 2]?.date,
        currDate: recent[recent.length - 1]?.date,
        finalScore: {
          prev: deltaBreakdown.prev.finalYds,
          curr: deltaBreakdown.today.finalYds,
          delta: deltaBreakdown.finalDelta,
        },
        inputChanges: {
          cnn: {
            prev: deltaBreakdown.prev.inputs?.fearGreed,
            curr: deltaBreakdown.today.inputs?.fearGreed,
            delta:
              Number(deltaBreakdown.today.inputs?.fearGreed) -
              Number(deltaBreakdown.prev.inputs?.fearGreed),
          },
          vix: {
            prev: deltaBreakdown.prev.inputs?.vix,
            curr: deltaBreakdown.today.inputs?.vix,
            delta: Number(deltaBreakdown.today.inputs?.vix) - Number(deltaBreakdown.prev.inputs?.vix),
          },
          move: {
            prev: pickPanicV2Raw(prevRow, "move"),
            curr: pickPanicV2Raw(currRow, "move"),
          },
          dxy: {
            prev: pickPanicV2Raw(prevRow, "dxy"),
            curr: pickPanicV2Raw(currRow, "dxy"),
          },
        },
        contributionDeltas: deltaBreakdown.contributionDeltas,
        drivers: deltaBreakdown.drivers,
        cnnDirectionCheck: {
          cnnUpShouldLowerPanicContribution: true,
          observed:
            Number(deltaBreakdown.today.inputs?.fearGreed) >
            Number(deltaBreakdown.prev.inputs?.fearGreed)
              ? (deltaBreakdown.contributionDeltas?.cnn ?? 0) <= 0
                ? "OK · CNN↑ → CNN 기여↓"
                : "WARN · CNN↑ 인데 CNN 기여도↑"
              : "N/A · CNN 하락 또는 동일",
          vixDownShouldLowerPanicContribution:
            Number(deltaBreakdown.today.inputs?.vix) <
            Number(deltaBreakdown.prev.inputs?.vix)
              ? (deltaBreakdown.contributionDeltas?.vix ?? 0) <= 0
                ? "OK · VIX↓ → VIX 기여↓"
                : "WARN · VIX↓ 인데 VIX 기여도↑"
              : "N/A · VIX 상승 또는 동일",
          moveNote: "MOVE·DXY는 getFinalScore(패닉 강도)에 미포함",
        },
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    engine: "getFinalScore",
    days: recent,
    delta,
    summary: {
      cnnInFormula:
        "scoreFearGreed = 100 - CNN → CNN 높을수록 패닉 강도 기여는 낮아짐 (공포↑=CNN↓일 때 기여↑)",
      moveDxyInPanicIntensity: false,
      otherDrivers: ["BofA", "Put/Call", "HighYield", "동적 가중(VIX>25, HY>6)"],
    },
  }
}

/**
 * @param {object[]} historyRows
 * @param {{ days?: number }} [opts]
 */
export function logPanicIntensityAudit(historyRows, opts = {}) {
  if (typeof console === "undefined") return null

  const audit = buildPanicIntensityRecentAudit(historyRows, opts.days ?? 2)
  if (!audit.days.length) {
    console.warn(AUDIT_LOG_PREFIX, "히스토리 없음 — 감사 로그 생략")
    return audit
  }

  console.groupCollapsed(`${AUDIT_LOG_PREFIX} 최근 ${audit.days.length}일 패닉 강도 계산 검증`)
  console.info("엔진", audit.engine)
  console.info("CNN 방향", audit.summary.cnnInFormula)
  console.info("MOVE·DXY", "패닉 강도(getFinalScore) 산출식에 미포함 · Panic V2 참고값만 표시")

  for (const day of audit.days) {
    console.group(`📅 ${day.date} · 패닉 강도 ${day.finalScore ?? "—"}`)
    console.table({
      CNN: {
        입력: day.metrics.cnn.input,
        정규화: day.metrics.cnn.normalized,
        "기여(p)": day.metrics.cnn.contributionPts,
        "패닉강도 포함": day.metrics.cnn.inPanicIntensity,
      },
      VIX: {
        입력: day.metrics.vix.input,
        정규화: day.metrics.vix.normalized,
        "기여(p)": day.metrics.vix.contributionPts,
        "패닉강도 포함": day.metrics.vix.inPanicIntensity,
      },
      MOVE: {
        입력: day.metrics.move.input,
        정규화: day.metrics.move.normalized,
        "V2기여(p)": day.metrics.move.panicV2ContributionPts,
        "패닉강도 포함": day.metrics.move.inPanicIntensity,
      },
      DXY: {
        입력: day.metrics.dxy.input,
        정규화: day.metrics.dxy.normalized,
        "V2기여(p)": day.metrics.dxy.panicV2ContributionPts,
        "패닉강도 포함": day.metrics.dxy.inPanicIntensity,
      },
    })
    console.info("단기/중기", {
      short: day.shortScore,
      mid: day.midScore,
      weights: day.weights,
      weightNote: day.weightNote,
    })
    console.info("CNN 방향 검증", day.metrics.cnn.direction)
    console.info("기타 기여", {
      BofA: day.metrics.bofa.contributionPts,
      PutCall: day.metrics.putCall.contributionPts,
      HY: day.metrics.highYield.contributionPts,
      sum: day.sumContributions,
    })
    console.groupEnd()
  }

  if (audit.delta) {
    console.group(
      `Δ ${audit.delta.prevDate} → ${audit.delta.currDate} · ${audit.delta.finalScore.prev} → ${audit.delta.finalScore.curr} (${audit.delta.finalScore.delta >= 0 ? "+" : ""}${audit.delta.finalScore.delta})`,
    )
    console.table(audit.delta.contributionDeltas)
    console.info("입력 변화", audit.delta.inputChanges)
    console.info("방향 검증", audit.delta.cnnDirectionCheck)
    console.info("기여도 변화 드라이버", audit.delta.drivers)
    console.groupEnd()
  }

  console.groupEnd()
  return audit
}
