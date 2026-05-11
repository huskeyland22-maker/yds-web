/**
 * 현재 존재하는 지표를 섹션별로 안전하게 매핑.
 * - nested({ value }) / flat(number) 모두 허용
 * - 없는 지표는 null 유지
 */
export function groupPanicData(data) {
  const d = data && typeof data === "object" ? data : {}
  const pick = (v) => {
    if (v && typeof v === "object" && "value" in v) return v.value
    return v
  }
  return {
    short: {
      vix: pick(d.vix),
      vxn: pick(d.vxn),
      putCall: pick(d.putCall),
    },
    mid: {
      fearGreed: pick(d.fearGreed),
      move: pick(d.move),
      bofa: pick(d.bofa),
    },
    long: {
      skew: pick(d.skew),
      highYield: pick(d.highYield),
      gsBullBear: pick(d.gsBullBear ?? d.gs),
    },
  }
}
