/**
 * 장단기 금리차 (10년물 − 2년물) — 클라이언트 해석 전용.
 * @param {Record<string, import('./rawLayer.js').MetricSeries>} raw
 */
export function buildYieldCurve(raw) {
  const us10 = raw.US10Y
  const us2 = raw.US2Y
  const y10 = us10?.current
  const y2 = us2?.current
  if (!Number.isFinite(Number(y10)) || !Number.isFinite(Number(y2))) return null

  const spread = Number((Number(y10) - Number(y2)).toFixed(3))
  const change5D =
    Number.isFinite(Number(us10?.change5D)) && Number.isFinite(Number(us2?.change5D))
      ? Number((Number(us10.change5D) - Number(us2.change5D)).toFixed(3))
      : null
  const change20D =
    Number.isFinite(Number(us10?.change20D)) && Number.isFinite(Number(us2?.change20D))
      ? Number((Number(us10.change20D) - Number(us2.change20D)).toFixed(3))
      : null

  let status = "정상"
  let statusKey = "normal"
  if (spread < 0) {
    status = "역전"
    statusKey = "inversion"
  } else if (
    (change5D != null && change5D > 0.12 && spread < 0.55) ||
    (change20D != null && change20D > 0.22 && spread > 0 && spread < 0.85)
  ) {
    status = "재스티프닝"
    statusKey = "resteepening"
  }

  return {
    spread,
    y10: Number(y10),
    y2: Number(y2),
    change5D,
    change20D,
    status,
    statusKey,
    method: "10년물.current − 2년물.current (시드·market-data 역산)",
  }
}
