#!/usr/bin/env node
/**
 * SOXL crash-buy v4 audit (research only).
 *
 *   node scripts/soxl-crash-buy-v4.mjs
 *
 * Reads v2 and v3 result JSON. Writes only
 * scripts/.cache/soxl-crash-buy-v4-result.json.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { SELECTED_STRATEGY } from "./lib/soxl-crash-buy-v1.mjs"
import {
  FROZEN_DRAWDOWN_MAX,
  FROZEN_RETURN5_MAX,
  SEARCH_TARGETS,
  SIMULATION_ASSUMPTIONS,
  USER_DESCRIBED_PRINCIPLES,
  cdSensitivityFromV3,
  surveyResult,
  touchDependence,
} from "./lib/soxl-crash-buy-v4.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const RESULT_PATH = path.join(CACHE, "soxl-crash-buy-v4-result.json")

function assertOwnPath(filePath) {
  const base = path.basename(filePath)
  if (
    base.startsWith("dbb-") ||
    base.includes("etf-sell-backtest") ||
    base.includes("soxl-crash-buy-v1") ||
    base.includes("soxl-crash-buy-v2") ||
    base.includes("soxl-crash-buy-v3")
  ) {
    throw new Error(`refusing to write protected cache ${base}`)
  }
}

export function buildV4Result(v2, v3, inspected) {
  if (v2.thresholds.drawdownMax !== FROZEN_DRAWDOWN_MAX || v2.thresholds.return5Max !== FROZEN_RETURN5_MAX) {
    throw new Error("frozen thresholds do not match v2")
  }
  if (v2.selectedStrategy !== null || v3.selectedStrategy !== null) {
    throw new Error("selectedStrategy must stay null")
  }
  const sensitivity = cdSensitivityFromV3(v3)
  const survey = surveyResult(inspected)
  return {
    researchOnly: true,
    selectedStrategy: SELECTED_STRATEGY,
    adoptsStrategy: false,
    actualOrderLogFound: survey.actualOrderLogFound,
    userDescribedPrinciples: USER_DESCRIBED_PRINCIPLES,
    simulationAssumptions: SIMULATION_ASSUMPTIONS,
    distinction:
      "사용자 설명은 매매 원칙이다. v1~v3 수치는 일봉 시뮬레이션이다. 둘 다 증권사 주문 기록으로 확인된 체결이 아니다.",
    thresholds: {
      trainEnd: v2.thresholds.trainEnd,
      evalStart: v2.thresholds.evalStart,
      drawdownMax: v2.thresholds.drawdownMax,
      return5Max: v2.thresholds.return5Max,
      selectedByReturn: false,
      retuned: false,
    },
    survey,
    cdSensitivity: sensitivity,
    touchDependence: touchDependence(sensitivity),
    limits: [
      "일봉 저가가 지정가 이하인 것은 그 가격에 사용자 주문이 체결됐다는 기록이 아니다.",
      "주문 생성·취소 시각, 호가 대기 순서, 부분 체결은 일봉으로 알 수 없다.",
      "v3의 터치 제외 시나리오는 민감도이며 실제 체결 확률이 아니다.",
      "C/D의 추세·급락 예고 규칙은 2022-09-30까지 고정한 연구 모델이다. 당시 판단 근거 기록은 없다.",
    ],
    nextEvidence: [
      "주문 날짜",
      "주문 당시 직전 종가",
      "주문 지정가와 주문 수량",
      "주문 생성 및 취소 시각",
      "지정가 변경 내역",
      "실제 체결 수량과 평균 체결가",
      "실제 매수 당시 판단 근거",
    ],
  }
}

function main() {
  assertOwnPath(RESULT_PATH)
  const v2 = JSON.parse(fs.readFileSync(path.join(CACHE, "soxl-crash-buy-v2-result.json"), "utf8"))
  const v3 = JSON.parse(fs.readFileSync(path.join(CACHE, "soxl-crash-buy-v3-result.json"), "utf8"))
  const inspected = SEARCH_TARGETS.map((target) => ({
    path: target.path,
    role: target.role,
    reason: target.reason,
    exists: fs.existsSync(path.join(ROOT, target.path)),
  }))
  if (inspected.some((row) => !row.exists)) throw new Error("expected search target is missing")
  const result = buildV4Result(v2, v3, inspected)
  fs.writeFileSync(RESULT_PATH, JSON.stringify(result))
  console.log(JSON.stringify({ wrote: path.basename(RESULT_PATH), actualOrderLogFound: result.actualOrderLogFound }))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
