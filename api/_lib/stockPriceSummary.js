/**
 * todayClose / previousClose 분리 (KIS raw 일봉 · Yahoo regularMarket*).
 */

import { resolveDataSourceBadge } from "./dataSourceBadge.js"
import {
  afterKrxDataConfirmed,
  isKstWeekday,
  kstMinutes,
  ymdKst,
} from "./krxDomesticClose.js"
import { isFreshYahooMeta, pickYahooPreviousClose } from "./yahooChartPick.js"

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

/** @param {Array<{ date?: string; open?: number; high?: number; low?: number; close: number; volume?: number }>} bars */
function ohlcvFromBar(bar) {
  if (!bar) {
    return { open: null, high: null, low: null, close: null, volume: null }
  }
  const close = num(bar.close)
  const open = num(bar.open) ?? close
  const high = num(bar.high) ?? (open != null && close != null ? Math.max(open, close) : close)
  const low = num(bar.low) ?? (open != null && close != null ? Math.min(open, close) : close)
  const volume = num(bar.volume)
  return { open, high, low, close, volume }
}

/** @param {Array<{ date?: string; close: number }>} bars */
function closesFromRawBars(bars, todayYmd) {
  if (!Array.isArray(bars) || bars.length < 1) {
    return { todayClose: null, previousClose: null, todayBarDate: null }
  }
  const last = bars[bars.length - 1]
  const prev = bars.length >= 2 ? bars[bars.length - 2] : null
  const lastDate = last?.date ? String(last.date) : null

  return {
    todayClose: num(last.close),
    previousClose: num(prev?.close),
    todayBarDate: lastDate,
    isTodayBar: lastDate === todayYmd,
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
 * @param {object} yahooMeta
 * @param {Array<{ date?: string; close: number }>} raw
 * @param {string} todayYmd
 */
function resolveYahooCloses(yahooMeta, raw, todayYmd) {
  const closes = raw.map((r) => r.close)
  const { todayClose: rawToday, previousClose: rawPrev, todayBarDate, isTodayBar } = closesFromRawBars(raw, todayYmd)
  const rmPrice = num(yahooMeta?.regularMarketPrice)
  const rmPrev = num(yahooMeta?.regularMarketPreviousClose)
  const metaFresh = isFreshYahooMeta(yahooMeta, 5)

  let todayClose = null
  let previousClose = null

  if (metaFresh && rmPrice != null) {
    todayClose = rmPrice
    previousClose = rmPrev ?? (isTodayBar ? rawPrev : rawToday) ?? pickYahooPreviousClose(yahooMeta, closes)
  } else if (isTodayBar && rawToday != null) {
    todayClose = rmPrice ?? rawToday
    previousClose = rmPrev ?? rawPrev ?? pickYahooPreviousClose(yahooMeta, closes)
  } else {
    todayClose = rmPrice ?? rawToday
    previousClose = rmPrev ?? (rawToday != null && !isTodayBar ? rawToday : rawPrev) ?? pickYahooPreviousClose(yahooMeta, closes)
  }

  if (todayClose == null) todayClose = rawToday
  if (previousClose == null) previousClose = rawPrev

  return { todayClose, previousClose, todayBarDate, metaFresh }
}

/**
 * @param {{
 *   rows: Array<{ date?: string; close: number }>
 *   rawRows?: Array<{ date?: string; close: number }>
 *   dataSource: string
 *   yahooMeta?: object
 *   domesticClose?: object
 *   chartMeta?: object
 *   kisLiveQuote?: { price?: number | null; changeAmount?: number | null; changePct?: number | null; volume?: number | null; prevClose?: number | null } | null
 * }} opts
 */
export function buildStockPriceSummary({ rows, rawRows, dataSource, yahooMeta, domesticClose, chartMeta, kisLiveQuote }) {
  const now = new Date()
  const todayYmd = ymdKst(now)
  const raw = Array.isArray(rawRows) && rawRows.length ? rawRows : rows
  const barInfo = closesFromRawBars(raw, todayYmd)

  let sessionBadge = "정규장 마감"
  let sessionBadgeKey = "regular_close"
  let todayClose = barInfo.todayClose
  let previousClose = barInfo.previousClose
  let todayBarDate = barInfo.todayBarDate
  let livePrice = null
  let showLive = false
  let headlineLabel = "오늘 종가"

  if (dataSource === "yahoo") {
    const state = String(yahooMeta?.marketState || yahooMeta?.currentTradingPeriod?.regular?.state || "").toUpperCase()
    const resolved = resolveYahooCloses(yahooMeta, raw, todayYmd)
    todayClose = resolved.todayClose
    previousClose = resolved.previousClose
    todayBarDate = resolved.todayBarDate

    const rmPrice = num(yahooMeta?.regularMarketPrice)

    if (state === "REGULAR") {
      sessionBadge = "장중"
      sessionBadgeKey = "intraday"
      livePrice = rmPrice
      showLive = livePrice != null
      if (showLive) todayClose = livePrice
      headlineLabel = "실시간 현재가"
    } else if (state === "POST" || state === "POSTPOST") {
      sessionBadge = "애프터"
      sessionBadgeKey = "after"
      livePrice = rmPrice
      showLive = livePrice != null && todayClose != null && Math.abs(livePrice - todayClose) >= 1
    } else if (state === "PRE" || state === "PREPRE") {
      sessionBadge = "프리마켓"
      sessionBadgeKey = "pre"
      livePrice = rmPrice
      showLive = livePrice != null
      headlineLabel = showLive ? "실시간 현재가" : "오늘 종가"
    } else {
      sessionBadge = "정규장 마감"
      sessionBadgeKey = "regular_close"
      headlineLabel = "오늘 종가"
    }
  } else if (dataSource === "kis") {
    const dc = domesticClose || {}
    const inSession = isKrxRegularSession(now)
    const afterRegular = isAfterKrxRegularClose(now)
    const todayInRaw = barInfo.isTodayBar
    const kisPrice = kisLiveQuote?.price != null ? num(kisLiveQuote.price) : null
    const kisPrev = kisLiveQuote?.prevClose != null ? num(kisLiveQuote.prevClose) : null

    todayClose = barInfo.todayClose
    previousClose = barInfo.previousClose
    if (kisPrev != null && kisPrev > 0) previousClose = kisPrev
    else if (kisPrice != null && kisLiveQuote?.changeAmount != null) {
      previousClose = kisPrice - kisLiveQuote.changeAmount
    }

    if (kisPrice != null && (inSession || todayInRaw)) {
      sessionBadge = inSession ? "장중" : sessionBadge
      sessionBadgeKey = inSession ? "intraday" : sessionBadgeKey
      livePrice = kisPrice
      showLive = true
      todayClose = kisPrice
      headlineLabel = "실시간 현재가"
    } else if (inSession && todayInRaw) {
      sessionBadge = "장중"
      sessionBadgeKey = "intraday"
      livePrice = barInfo.todayClose
      showLive = livePrice != null
      headlineLabel = "실시간 현재가"
    } else if ((afterRegular || dc.confirmReady) && todayInRaw) {
      sessionBadge = "정규장 마감"
      sessionBadgeKey = "regular_close"
      headlineLabel = "오늘 종가"
    } else if (dc.dataStale) {
      sessionBadge = "동기화 중"
      sessionBadgeKey = "pending"
    } else if (dc.excludedTodayBar && todayInRaw) {
      sessionBadge = "장중"
      sessionBadgeKey = "intraday"
      livePrice = barInfo.todayClose
      showLive = true
      headlineLabel = "실시간 현재가"
    } else if (!todayInRaw) {
      sessionBadge = chartMeta?.sessionKind === "previous_close" ? "전일 기준" : "정규장 마감"
      sessionBadgeKey = chartMeta?.sessionKind === "previous_close" ? "previous_close" : "regular_close"
    }
  }

  let priceForChange = showLive && livePrice != null ? livePrice : todayClose
  let changeAmount = null
  let changePct = null
  if (dataSource === "kis" && kisLiveQuote?.price != null) {
    priceForChange = num(kisLiveQuote.price) ?? priceForChange
    changeAmount = num(kisLiveQuote.changeAmount)
    changePct = num(kisLiveQuote.changePct)
    if (changeAmount == null && changePct == null) {
      const derived = calcChange(priceForChange, previousClose)
      changeAmount = derived.changeAmount
      changePct = derived.changePct
    }
  } else {
    const derived = calcChange(priceForChange, previousClose)
    changeAmount = derived.changeAmount
    changePct = derived.changePct
  }
  const changeRate = changePct
  const mappingWarning = validatePriceMath(todayClose, previousClose, changeAmount)

  const refBar =
    dataSource === "kis" && barInfo.isTodayBar
      ? raw[raw.length - 1]
      : raw.length >= 2
        ? raw[raw.length - 1]
        : raw[raw.length - 1]
  const ohlcv = ohlcvFromBar(refBar)
  const { dataSourceBadge, dataSourceBadgeKey } = resolveDataSourceBadge({
    dataSource,
    sessionBadgeKey,
    domesticClose,
  })

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
    open: ohlcv.open,
    high: ohlcv.high,
    low: ohlcv.low,
    close: ohlcv.close ?? todayClose,
    volume: ohlcv.volume,
    headlineLabel,
    headlinePrice: todayClose,
    regularClose: todayClose,
    livePrice: showLive ? livePrice : null,
    showLive,
    changeAmount,
    changePct,
    changeRate,
    changeBasis: showLive ? "live" : "todayClose",
    sessionBadge,
    sessionBadgeKey,
    dataSourceBadge,
    dataSourceBadgeKey,
    mappingWarning,
    todayBarDate,
    regularCloseNote: "한국 정규장 15:30 종가",
    updatePolicy: dataSource === "kis" ? "krx_15:30_close · 16:00_kst_refresh" : null,
  }
}
