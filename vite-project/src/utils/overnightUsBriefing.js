/**
 * Institutional US macro desk briefing — Yahoo `/api/market-data` + 패닉 보드.
 * 규칙 기반 밀도 문장. OpenAI는 `/api/macro-briefing-ai`에서 선택.
 */

import { getTotalSignalScore } from "./panicMarketSignal.js"

/**
 * @param {unknown} data
 * @param {string} key
 */
function pickPanicN(data, key) {
  if (!data || typeof data !== "object") return NaN
  const v = /** @type {Record<string, unknown>} */ (data)[key]
  if (v != null && typeof v === "object" && "value" in /** @type {object} */ (v)) {
    const n = Number(/** @type {{ value: unknown }} */ (v).value)
    return Number.isFinite(n) ? n : NaN
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/**
 * @param {object | null | undefined} panicData
 */
function panicFlatForScore(panicData) {
  if (!panicData) return null
  return {
    vix: pickPanicN(panicData, "vix"),
    fearGreed: pickPanicN(panicData, "fearGreed"),
    putCall: pickPanicN(panicData, "putCall"),
    bofa: pickPanicN(panicData, "bofa"),
    highYield: pickPanicN(panicData, "highYield"),
  }
}

/**
 * @param {number | null | undefined} x
 * @param {number} digits
 */
function fmtChg(x, digits = 2) {
  if (x == null || !Number.isFinite(Number(x))) return "—"
  const v = Number(x)
  const sign = v > 0 ? "+" : ""
  return `${sign}${v.toFixed(digits)}%`
}

/**
 * @param {{
 *   parsedData?: Record<string, number | null>
 *   changeData?: Record<string, number | null>
 *   updatedAt?: string | null
 *   panicData?: object | null
 * }} input
 */
export function buildInstitutionalMacroBriefing(input) {
  const p = input?.parsedData ?? {}
  const c = input?.changeData ?? {}

  const nas = c.nasdaq
  const sp = c.sp500
  const soxx = c.soxx
  const vix = p.vix
  const vixChg = c.vix
  const tnxChg = c.us10y
  const krwChg = c.usdkrw
  const dxyChg = c.dxy
  const spChg = c.sp500
  const putCall = p.putCall
  const move = p.move

  let score = 0
  if (Number.isFinite(nas)) score += nas > 0.15 ? 1.2 : nas < -0.15 ? -1.2 : nas > 0 ? 0.4 : nas < 0 ? -0.4 : 0
  if (Number.isFinite(sp)) score += sp > 0.12 ? 0.9 : sp < -0.12 ? -0.9 : sp > 0 ? 0.25 : sp < 0 ? -0.25 : 0
  if (Number.isFinite(soxx) && Number.isFinite(spChg)) {
    const rel = soxx - spChg
    if (rel > 0.25) score += 0.5
    if (rel < -0.25) score -= 0.5
  }
  if (Number.isFinite(vixChg)) score += vixChg < -3 ? 0.35 : vixChg > 4 ? -0.55 : 0
  if (Number.isFinite(vix)) score += vix < 17 ? 0.25 : vix > 24 ? -0.45 : 0
  if (Number.isFinite(dxyChg)) score += dxyChg < -0.12 ? 0.2 : dxyChg > 0.18 ? -0.2 : 0
  if (Number.isFinite(tnxChg)) score += tnxChg < -0.5 ? 0.15 : tnxChg > 0.6 ? -0.15 : 0

  /** @type {"risk-on"|"neutral"|"risk-off"} */
  let sentiment = "neutral"
  if (score >= 1.1) sentiment = "risk-on"
  else if (score <= -1.1) sentiment = "risk-off"

  const sentimentLabel =
    sentiment === "risk-on" ? "RISK-ON" : sentiment === "risk-off" ? "RISK-OFF" : "NEUTRAL"

  /** @type {{ key: string; label: string; chg: number | null }[]} */
  const ticks = [
    { key: "nasdaq", label: "NASDAQ", chg: Number.isFinite(Number(nas)) ? Number(nas) : null },
    { key: "sp500", label: "S&P 500", chg: Number.isFinite(Number(sp)) ? Number(sp) : null },
    { key: "soxx", label: "SOXX", chg: Number.isFinite(Number(soxx)) ? Number(soxx) : null },
    { key: "vix", label: "VIX", chg: Number.isFinite(Number(vixChg)) ? Number(vixChg) : null },
    { key: "us10y", label: "US10Y", chg: Number.isFinite(Number(tnxChg)) ? Number(tnxChg) : null },
    { key: "dxy", label: "DXY", chg: Number.isFinite(Number(dxyChg)) ? Number(dxyChg) : null },
    { key: "usdkrw", label: "USD/KRW", chg: Number.isFinite(Number(krwChg)) ? Number(krwChg) : null },
  ]

  /** @type {string[]} */
  const bullets = []

  if (Number.isFinite(nas) && Number.isFinite(sp)) {
    if (nas > 0.12 && sp > 0.12) {
      bullets.push(`EQ · NDX+SPX 동반 상승 마감 · 베타 상향 구간.`)
    } else if (nas < -0.12 && sp < -0.12) {
      bullets.push(`EQ · 광범위 지수 동반 하락 · 위험자산 축소 레짐.`)
    } else if (nas > sp + 0.18) {
      bullets.push(`EQ · 기술주 주도 · NDX vs SPX 상대강도 유지.`)
    } else if (nas < sp - 0.18) {
      bullets.push(`EQ · 가치/광범위 쏠림 · NDX 열위 완화.`)
    } else {
      bullets.push(`EQ · NDX·SPX 소폭 등락 · 방향성 제한적 세션.`)
    }
  } else {
    bullets.push(`EQ · 지수 피드 결손 — 레벨 체크 생략.`)
  }

  if (Number.isFinite(soxx) && Number.isFinite(spChg)) {
    const bps = (soxx - spChg) * 100
    if (bps > 25) bullets.push(`SEMIS · SOXX > SPX · ${bps.toFixed(0)}bps 상대 우위.`)
    else if (bps < -25) bullets.push(`SEMIS · SOXX < SPX · ${Math.abs(bps).toFixed(0)}bps 열위.`)
    else bullets.push(`SEMIS · SOXX·SPX 갭 축소 — 테마 박스권.`)
  } else if (Number.isFinite(soxx)) {
    bullets.push(`SEMIS · SOXX ${soxx >= 0 ? "↑" : "↓"} 단독 시그널.`)
  }

  if (Number.isFinite(tnxChg) && Number.isFinite(vix)) {
    const tr = Math.abs(tnxChg) < 0.35 ? "10Y 박스" : tnxChg > 0 ? "10Y 팔림" : "10Y 커버"
    let vx = ""
    if (vix < 16) vx = "VIX 낮음."
    else if (vix < 22) vx = Number.isFinite(vixChg) && Math.abs(vixChg) >= 4 ? "VIX 중립·변동폭 확대." : "VIX 중립."
    else if (vix < 28) vx = "VIX 상단부."
    else vx = "VIX 스트레스."
    let fx = ""
    if (Number.isFinite(dxyChg)) fx = Math.abs(dxyChg) < 0.12 ? "DXY 보합." : dxyChg > 0 ? "DXY 강세." : "DXY 약세."
    else if (Number.isFinite(krwChg)) fx = Math.abs(krwChg) < 0.1 ? "원화 박스." : krwChg > 0 ? "원화 약세." : "원화 강세."
    bullets.push(`RATES/VOL · ${tr} · ${vx} ${fx}`.trim())
  } else if (Number.isFinite(vix)) {
    bullets.push(`VOL · VIX ${vix.toFixed(2)} 레벨 ${Number.isFinite(vixChg) ? `(${fmtChg(vixChg, 1)})` : ""}`.trim())
  } else if (Number.isFinite(tnxChg)) {
    bullets.push(`RATES · US10Y ${fmtChg(tnxChg)}`)
  }

  if (Number.isFinite(putCall) && Number.isFinite(move)) {
    if (putCall >= 1.02 && move >= 98) bullets.push(`SENTIMENT · PCC↑ + MOVE 고 — 헤지·금리 변동성 동반.`)
    else if (putCall <= 0.85 && move <= 85) bullets.push(`SENTIMENT · PCC↓ · MOVE 억제 — 옵션/국채 스트레스 완화.`)
    else if (putCall >= 1.02) bullets.push(`OPTIONS · Put/Call 방어 쏠림.`)
    else if (move >= 98) bullets.push(`RATES · MOVE 고대 — 금리 옵션 감시.`)
  } else if (Number.isFinite(putCall)) {
    bullets.push(`OPTIONS · PCC ${putCall.toFixed(2)}.`)
  }

  const flat = panicFlatForScore(input?.panicData ?? null)
  const composite = flat ? getTotalSignalScore(flat) : null
  let panicBridge = ""
  if (flat && Number.isFinite(composite)) {
    const v = Number.isFinite(flat.vix) ? flat.vix : null
    const fg = Number.isFinite(flat.fearGreed) ? flat.fearGreed : null
    if (sentiment === "risk-on" && composite >= 1) {
      panicBridge = `PANIC BOARD · 합성 ${composite} · 현물 톤과 정합 (VIX ${v ?? "—"} · F&G ${fg ?? "—"}).`
    } else if (sentiment === "risk-off" && composite <= -1) {
      panicBridge = `PANIC BOARD · 합성 ${composite} · 현물 약세와 정합.`
    } else if (sentiment === "risk-on" && composite <= -1) {
      panicBridge = `PANIC BOARD · 합성 ${composite} · 현물 대비 방어 시그널 과대 — 확인 매수 유효.`
    } else if (sentiment === "risk-off" && composite >= 1) {
      panicBridge = `PANIC BOARD · 합성 ${composite} · 현물 대비 낙관 편차 — 리스크 재평가.`
    } else {
      panicBridge = `PANIC BOARD · 합성 ${composite} · 크로스 체크 유지.`
    }
  } else {
    panicBridge = `PANIC BOARD · 스냅샷 없음 — 사이클 탭에서 갱신.`
  }

  bullets.push(panicBridge)

  const headline = "US SESSION — MACRO DESK"

  const prose = bullets.join(" ")

  return {
    headline,
    bullets: bullets.slice(0, 8),
    prose,
    sentiment,
    sentimentLabel,
    ticks,
    updatedAt: input.updatedAt ?? null,
    composite: Number.isFinite(composite) ? composite : null,
  }
}

/** @deprecated 이름 호환 */
export function buildOvernightUsBriefing(input) {
  const b = buildInstitutionalMacroBriefing(input)
  return { prose: b.prose, updatedAt: b.updatedAt }
}
