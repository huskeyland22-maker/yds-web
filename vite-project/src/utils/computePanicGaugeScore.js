import { panicMetricNumber } from "./panicMetricValue.js"

/**
 * 패닉 지수 API 응답으로 게이지 점수(0~100)를 추정합니다.
 * 값이 클수록 시장 불안(패닉) 쪽으로 가정합니다.
 */
export function computePanicGaugeScore(d) {
  const fearGreed = panicMetricNumber(d.fearGreed)
  const vix = panicMetricNumber(d.vix)
  const putCall = panicMetricNumber(d.putCall)

  // CNN Fear & Greed: 낮을수록 공포 → 패닉 점수에 반영
  const fromFg = Number.isFinite(fearGreed) ? 100 - fearGreed : 50

  // VIX: 높을수록 변동성·불안 가정 (대략 12~35 구간을 0~100으로 스케일)
  const fromVix = Number.isFinite(vix)
    ? Math.min(100, Math.max(0, ((vix - 12) / (35 - 12)) * 100))
    : 40

  // Put/Call: 1 초과 시 공포 성향 가정 (0.6~1.2 → 0~100)
  const fromPc = Number.isFinite(putCall)
    ? Math.min(100, Math.max(0, ((putCall - 0.6) / (1.2 - 0.6)) * 100))
    : 40

  const raw = fromFg * 0.5 + fromVix * 0.35 + fromPc * 0.15
  return Math.round(Math.min(100, Math.max(0, raw)))
}
