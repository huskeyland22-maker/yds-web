/**
 * 종가·현재가·등락 분리 (KIS 15:30 정규장 종가 / Yahoo marketState).
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

function calcChange(price, previousClose) {
  if (price == null || previousClose == null || previousClose <= 0) {
    return { changeAmount: null, changePct: null }
  }
  const changeAmount = price - previousClose
  return { changeAmount, changePct: (changeAmount / previousClose) * 100 }
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
  const last = rows?.[rows.length - 1]
  const prev = rows?.length >= 2 ? rows[rows.length - 2] : null
  const raw = Array.isArray(rawRows) && rawRows.length ? rawRows : rows
  const rawLast = raw[raw.length - 1]
  const rawLastDate = rawLast?.date ? String(rawLast.date) : null

  let sessionBadge = "정규장 마감"
  let sessionBadgeKey = "regular_close"
  let regularClose = null
  let previousClose = null
  let livePrice = null
  let showLive = false
  let headlineLabel = "오늘 종가"
  let headlinePrice = null
  let changeBasis = "regular"

  if (dataSource === "yahoo") {
    const state = String(yahooMeta?.marketState || yahooMeta?.currentTradingPeriod?.regular?.state || "").toUpperCase()
    const rmPrice = num(yahooMeta?.regularMarketPrice)
    const rmPrev = num(yahooMeta?.regularMarketPreviousClose)
    const chartPrev = num(yahooMeta?.chartPreviousClose)
    const barClose = num(last?.close)
    const barPrev = num(prev?.close)

    previousClose = rmPrev ?? chartPrev ?? barPrev
    const todayBarClose = rawLastDate === todayYmd ? num(rawLast?.close) : barClose

    if (state === "REGULAR") {
      sessionBadge = "장중"
      sessionBadgeKey = "intraday"
      regularClose = previousClose
      livePrice = rmPrice
      showLive = livePrice != null
      headlineLabel = "실시간 현재가"
      headlinePrice = showLive ? livePrice : regularClose
      changeBasis = showLive ? "live" : "regular"
    } else if (state === "POST" || state === "POSTPOST") {
      sessionBadge = "애프터"
      sessionBadgeKey = "after"
      regularClose = todayBarClose ?? rmPrice ?? barClose
      previousClose = rmPrev ?? barPrev ?? previousClose
      livePrice = rmPrice
      showLive = livePrice != null && regularClose != null && Math.abs(livePrice - regularClose) >= 1
      headlineLabel = "오늘 종가"
      headlinePrice = regularClose
      changeBasis = "regular"
    } else if (state === "PRE" || state === "PREPRE") {
      sessionBadge = "프리마켓"
      sessionBadgeKey = "pre"
      regularClose = barPrev ?? rmPrev
      previousClose = rows.length >= 3 ? num(rows[rows.length - 3]?.close) : regularClose
      livePrice = rmPrice
      showLive = livePrice != null
      headlineLabel = "실시간 현재가"
      headlinePrice = showLive ? livePrice : regularClose
      changeBasis = showLive ? "live" : "regular"
    } else {
      sessionBadge = "정규장 마감"
      sessionBadgeKey = "regular_close"
      regularClose = todayBarClose ?? rmPrice ?? barClose
      previousClose = rmPrev ?? barPrev
      headlineLabel = "오늘 종가"
      headlinePrice = regularClose
      changeBasis = "regular"
    }
  } else if (dataSource === "kis") {
    const dc = domesticClose || {}
    const inSession = isKrxRegularSession(now)
    const afterRegular = isAfterKrxRegularClose(now)
    const todayRaw = rawLastDate === todayYmd ? num(rawLast?.close) : null

    previousClose = num(prev?.close)
    regularClose = num(last?.close)

    if (inSession || (dc.excludedTodayBar && todayRaw != null)) {
      sessionBadge = "장중"
      sessionBadgeKey = "intraday"
      regularClose = previousClose
      livePrice = todayRaw
      showLive = livePrice != null
      headlineLabel = "실시간 현재가"
      headlinePrice = showLive ? livePrice : regularClose
      changeBasis = showLive ? "live" : "regular"
    } else if (afterRegular && todayRaw != null && !dc.confirmReady) {
      sessionBadge = "정규장 마감"
      sessionBadgeKey = "regular_close"
      regularClose = todayRaw
      previousClose = num(prev?.close) ?? previousClose
      headlineLabel = "오늘 종가"
      headlinePrice = regularClose
      changeBasis = "regular"
    } else if (dc.confirmReady || (afterRegular && num(last?.close) && rawLastDate === todayYmd)) {
      sessionBadge = "정규장 마감"
      sessionBadgeKey = "regular_close"
      regularClose = num(last?.close) ?? todayRaw
      previousClose = num(prev?.close)
      headlineLabel = "오늘 종가"
      headlinePrice = regularClose
      changeBasis = "regular"
    } else if (dc.dataStale) {
      sessionBadge = "동기화 중"
      sessionBadgeKey = "pending"
      headlineLabel = "정규장 종가"
      headlinePrice = regularClose
      changeBasis = "regular"
    } else {
      sessionBadge = chartMeta?.sessionKind === "previous_close" ? "전일 기준" : "정규장 마감"
      sessionBadgeKey = chartMeta?.sessionKind === "previous_close" ? "previous_close" : "regular_close"
      headlineLabel = "오늘 종가"
      headlinePrice = regularClose
      changeBasis = "regular"
    }
  } else {
    regularClose = num(last?.close)
    previousClose = num(prev?.close)
    headlinePrice = regularClose
  }

  if (headlinePrice == null) headlinePrice = regularClose
  const priceForChange = changeBasis === "live" && livePrice != null ? livePrice : headlinePrice ?? regularClose
  const { changeAmount, changePct } = calcChange(priceForChange, previousClose)

  return {
    headlineLabel,
    headlinePrice,
    regularClose,
    previousClose,
    livePrice: showLive ? livePrice : null,
    showLive,
    changeAmount,
    changePct,
    changeBasis,
    sessionBadge,
    sessionBadgeKey,
    regularCloseNote: "한국 정규장 15:30 종가",
  }
}
