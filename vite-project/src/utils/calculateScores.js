/**
 * 단기 시그널 점수 (0~100). VIX·Put/Call 기반.
 * VIX가 낮을수록·Put/Call이 낮을수록(상대적 낙관) 점수 상승 가정.
 */
export function calculateShortScore(vix, putCall) {
  const vx = Number(vix)
  const pc = Number(putCall)

  const vixPart = Number.isFinite(vx)
    ? Math.min(100, Math.max(0, 100 - ((vx - 12) / (30 - 12)) * 100))
    : 50

  const pcPart = Number.isFinite(pc)
    ? Math.min(100, Math.max(0, ((1.15 - pc) / (1.15 - 0.75)) * 100))
    : 50

  return Math.round(Math.min(100, Math.max(0, vixPart * 0.55 + pcPart * 0.45)))
}

/**
 * 중기 시그널 점수 (0~100). BofA·High yield 스프레드 기반.
 * 값이 클수록 리스크 가정 → 점수 하향.
 */
export function calculateMidScore(bofa, highYield) {
  const b = Number(bofa)
  const hy = Number(highYield)

  const bPart = Number.isFinite(b) ? Math.min(100, Math.max(0, 100 - (b / 6) * 100)) : 50
  const hyPart = Number.isFinite(hy)
    ? Math.min(100, Math.max(0, 100 - (hy / 8) * 100))
    : 50

  return Math.round(Math.min(100, Math.max(0, (bPart + hyPart) / 2)))
}
