/**
 * todayClose / previousClose 분리 (KIS raw 일봉 · Yahoo regularMarket*).
 */

import {
  afterKrxDataConfirmed,
  isKstWeekday,
  kstMinutes,
  ymdKst,
} from "./krxDomesticClose.js"

const KRX_REGULAR_OPEN = 9 * 60
const KRX_REGULAR_CLOSE = 15 * 60 + 30

function num(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function isKrxRegularSession(now = new Date()) {
  if (!isKstWeekday(now)) return false
  const m = kstMinutes(now)
  return m >= KRX_REGULAR_OPEN && m < KRX_REGULAR_CLOSE
}

function isAfterKrxRegularClose(now = new Date()) {
  if (!isKstWeekday(now)) return false
  return kstMinutes(now) >= KRX_REGULAR_CLOSE
}

/** @param {Array<{ date?: string; close: number }>} bars */
function closesFromRawBars(bars, todayYmd) {
  if (!Array.isArray(bars) || bars.length < 1) {
    return { todayClose: null, previousClose: null, todayBarDate: null }
  }
  const last = bars[bars.length - 1]
  const prev = bars.length >= 2 ? bars[bars.length - 2] : null
  const lastDate = last?.date ? String(last.date) : null

  if (lastDate === todayYmd) {
    return {
      todayClose: num(last.close),
      previousClose: num(prev?.close),
      todayBarDate: lastDate,
    }
  }

  return {
    todayClose: num(last.close),
    previousClose: num(prev?.close),
    todayBarDate: lastDate,
  }
}

function calcChange(todayClose, previousClose) {
  if (todayClose == null || previousClose == null || previousClose <= 0) {
    return { changeAmount: null, changePct: null }
  }
  const changeAmount = todayClose - previousClose
  return { changeAmount, changePct: (changeAmount / previousClose) * 100 }
}

function validatePriceMath(todayClose, previousClose, changeAmount) {
  if (todayClose == null || previousClose == null) return null
  const expected = todayClose - previousClose
  if (todayClose !== previousClose && changeAmount != null && Math.abs(changeAmount) < 0.005) {
    return "가격·등락 불일치 — previousClose가 todayClose로 잘못 매핑되었을 수 있습니다"
  }
  if (changeAmount != null && Math.abs(changeAmount - expected) > 0.05) {
    return "등락 계산 불일치 — 데이터 재확인 필요"
  }
  return null
}

/**
 * @param {{
 *   rows: Array<{ date?: string; close: number }>
 *   rawRows?: Array<{ date?: string; close: number }>
 *   dataSource: string
 *   yahooMeta?: object
 *   domesticClose?: object
 *   chartMeta?: object
 * }} opts
 */
export function buildStockPriceSummary({ rows, rawRows, dataSource, yahooMeta, domesticClose, chartMeta }) {
  const now = new Date()
  const todayYmd = ymdKst(now)
  const raw = Array.isArray(rawRows) && rawRows.length ? rawRows : rows
  const { todayClose: rawToday, previousClose: rawPrev, todayBarDate } = closesFromRawBars(raw, todayYmd)

  let sessionBadge = "정규장 마감"
  let sessionBadgeKey = "regular_close"
  let todayClose = rawToday
  let previousClose = rawPrev
  let livePrice = null
  let showLive = false
  let headlineLabel = "오늘 종가"

  if (dataSource === "yahoo") {
    const state = String(yahooMeta?.marketState || yahooMeta?.currentTradingPeriod?.regular?.state || "").toUpperCase()
    const rmPrice = num(yahooMeta?.regularMarketPrice)
    const rmPrev = num(yahooMeta?.regularMarketPreviousClose)

    previousClose = rmPrev ?? rawPrev
    todayClose = rmPrice ?? rawToday

    if (state === "REGULAR") {
      sessionBadge = "장중"
      sessionBadgeKey = "intraday"
      livePrice = rmPrice
      showLive = livePrice != null
      if (showLive) todayClose = livePrice
      headlineLabel = showLive ? "실시간 현재가" : "오늘 종가"
    } else if (state === "POST" || state === "POSTPOST") {
      sessionBadge = "애프터"
      sessionBadgeKey = "after"
      todayClose = rawToday ?? rmPrice
      previousClose = rmPrev ?? rawPrev
      livePrice = rmPrice
      showLive = livePrice != null && todayClose != null && Math.abs(livePrice - todayClose) >= 1
      headlineLabel = "오늘 종가"
    } else if (state === "PRE" || state === "PREPRE") {
      sessionBadge = "프리마켓"
      sessionBadgeKey = "pre"
      previousClose = rmPrev ?? rawPrev
      todayClose = rmPrice ?? rawToday
      livePrice = rmPrice
      showLive = livePrice != null
      headlineLabel = showLive ? "실시간 현재가" : "오늘 종가"
    } else {
      sessionBadge = "정규장 마감"
      sessionBadgeKey = "regular_close"
      todayClose = rawToday ?? rmPrice
      previousClose = rmPrev ?? rawPrev
      headlineLabel = "오늘 종가"
    }

    if (todayBarDate === todayYmd && rawToday != null && state !== "REGULAR") {
      todayClose = rawToday
      previousClose = rmPrev ?? rawPrev
    }
  } else if (dataSource === "kis") {
    const dc = domesticClose || {}
    const inSession = isKrxRegularSession(now)
    const afterRegular = isAfterKrxRegularClose(now)
    const todayInRaw = todayBarDate === todayYmd

    todayClose = rawToday
    previousClose = rawPrev

    if (inSession && todayInRaw) {
      sessionBadge = "장중"
      sessionBadgeKey = "intraday"
      livePrice = rawToday
      showLive = livePrice != null
      headlineLabel = "실시간 현재가"
    } else if (afterRegular && todayInRaw && !dc.confirmReady) {
      sessionBadge = "정규장 마감"
      sessionBadgeKey = "regular_close"
      todayClose = rawToday
      previousClose = rawPrev
      headlineLabel = "오늘 종가"
    } else if (dc.confirmReady && todayInRaw) {
      sessionBadge = "정규장 마감"
      sessionBadgeKey = "regular_close"
      todayClose = rawToday
      previousClose = rawPrev
      headlineLabel = "오늘 종가"
    } else if (dc.dataStale) {
      sessionBadge = "동기화 중"
      sessionBadgeKey = "pending"
      headlineLabel = "오늘 종가"
    } else if (dc.excludedTodayBar && todayInRaw) {
      sessionBadge = "장중"
      sessionBadgeKey = "intraday"
      livePrice = rawToday
      showLive = true
      todayClose = rawToday
      previousClose = rawPrev
      headlineLabel = "실시간 현재가"
    } else if (!todayInRaw) {
      sessionBadge = chartMeta?.sessionKind === "previous_close" ? "전일 기준" : "정규장 마감"
      sessionBadgeKey = chartMeta?.sessionKind === "previous_close" ? "previous_close" : "regular_close"
      todayClose = rawToday
      previousClose = rawPrev
      headlineLabel = "오늘 종가"
    }
  } else {
    todayClose = rawToday
    previousClose = rawPrev
  }

  const priceForChange = showLive && livePrice != null ? livePrice : todayClose
  const { changeAmount, changePct } = calcChange(priceForChange, previousClose)
  const mappingWarning = validatePriceMath(todayClose, previousClose, changeAmount)

  if (mappingWarning) {
    console.warn("[stockPriceSummary]", mappingWarning, {
      dataSource,
      todayClose,
      previousClose,
      changeAmount,
      changePct,
      todayBarDate,
    })
  }

  return {
    todayClose,
    previousClose,
    headlineLabel,
    headlinePrice: todayClose,
    regularClose: todayClose,
    livePrice: showLive ? livePrice : null,
    showLive,
    changeAmount,
    changePct,
    changeBasis: showLive ? "live" : "todayClose",
    sessionBadge,
    sessionBadgeKey,
    mappingWarning,
    todayBarDate,
    regularCloseNote: "한국 정규장 15:30 종가",
  }
}
