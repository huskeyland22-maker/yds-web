/**
 * Flat `/panic-data` JSON → 단기(Tactical) / 중기(Strategic) / 장기(Macro) 뷰 모델.
 * 백엔드에 없는 필드(vxn, move, skew, gs)는 undefined로 두고 UI에서 "-" 처리.
 */
export function groupPanicData(data) {
  const d = data && typeof data === "object" ? data : {}
  return {
    short: {
      vix: d.vix,
      putCall: d.putCall,
      vxn: d.vxn,
    },
    mid: {
      fearGreed: d.fearGreed,
      bofa: d.bofa,
      move: d.move,
    },
    long: {
      skew: d.skew,
      highYield: d.highYield,
      gs: d.gs,
    },
  }
}
