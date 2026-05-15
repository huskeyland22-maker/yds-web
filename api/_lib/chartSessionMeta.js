/**
 * 일봉 OHLC 기준 시각·장 상태 라벨 (KIS / Yahoo).
 */

function ymdKst(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d)
  const y = parts.find((p) => p.type === "year")?.value
  const m = parts.find((p) => p.type === "month")?.value
  const day = parts.find((p) => p.type === "day")?.value
  if (!y || !m || !day) return null
  return `${y}${m}${day}`
}

function formatKstClock(d = new Date()) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d)
}

function formatBarDateLabel(ymd) {
  const s = String(ymd || "")
  if (!/^\d{8}$/.test(s)) return "—"
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`
}

function isKstWeekday(d = new Date()) {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short" }).format(d)
  return wd !== "Sat" && wd !== "Sun"
}

function kstMinutes(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d)
  const h = Number(parts.find((p) => p.type === "hour")?.value)
  const m = Number(parts.find((p) => p.type === "minute")?.value)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return h * 60 + m
}

function afterKrxRegularClose(d = new Date()) {
  return kstMinutes(d) >= 15 * 60 + 30
}

/**
 * @param {{ rows: Array<{ date?: string; close: number }>; dataSource: string; yahooMeta?: object; asOfIso?: string; yahooSymbol?: string }} opts
 */
export function buildChartSessionMeta({ rows, dataSource, yahooMeta, asOfIso, yahooSymbol }) {
  const now = new Date()
  const todayYmd = ymdKst(now)
  const last = rows?.[rows.length - 1]
  const prev = rows?.length >= 2 ? rows[rows.length - 2] : last
  const lastDate = last?.date ? String(last.date) : null

  let referenceBar = last
  let sessionKind = "regular_close"
  let sessionLabel = "정규장 마감 일봉 기준"
  let delayNote = null

  if (dataSource === "kis") {
    const beforeClose = isKstWeekday(now) && !afterKrxRegularClose(now)
    if (lastDate === todayYmd && beforeClose) {
      referenceBar = prev ?? last
      sessionKind = "previous_close"
      sessionLabel = "전일 종가 기준 · 당일 정규장 마감 전"
    } else if (lastDate === todayYmd) {
      sessionKind = "regular_close"
      sessionLabel = "당일 정규장 마감 데이터 반영 완료"
    } else if (lastDate) {
      sessionKind = "regular_close"
      sessionLabel = `${formatBarDateLabel(lastDate)} 정규장 마감 기준`
    }
  } else if (dataSource === "yahoo") {
    const state = String(yahooMeta?.marketState || yahooMeta?.currentTradingPeriod?.regular?.state || "").toUpperCase()
    const rmSec = yahooMeta?.regularMarketTime
    if (state === "REGULAR") {
      sessionKind = "intraday"
      sessionLabel = "장중 · 미완성 일봉 포함 가능"
      delayNote = "실시간·지연 시세 (Yahoo)"
    } else if (state === "POST" || state === "POSTPOST") {
      sessionKind = "regular_close"
      sessionLabel = "정규장 마감 · 애프터마켓 구간"
    } else if (state === "PRE" || state === "PREPRE") {
      referenceBar = prev ?? last
      sessionKind = "previous_close"
      sessionLabel = "전일 종가 기준 · 프리마켓"
    } else if (lastDate === todayYmd) {
      sessionKind = "regular_close"
      sessionLabel = "당일 일봉 반영"
    } else if (lastDate) {
      sessionKind = "regular_close"
      sessionLabel = `${formatBarDateLabel(lastDate)} 종가 기준`
    }
    if (rmSec && Number.isFinite(rmSec)) {
      delayNote = delayNote || `기준 ${formatKstClock(new Date(rmSec * 1000))} KST`
    } else {
      delayNote = delayNote || "Yahoo Finance · 15분 지연 가능"
    }
  }

  const dataSourceLabel =
    dataSource === "kis"
      ? "한국투자증권 일봉 (KIS) · 정규장 OHLC"
      : `Yahoo Finance${yahooSymbol ? ` · ${yahooSymbol}` : ""}`

  const refDate = referenceBar?.date ? String(referenceBar.date) : lastDate
  const asOfLabelKst = asOfIso
    ? `${formatKstClock(new Date(asOfIso))} KST`
    : refDate && /^\d{8}$/.test(refDate)
      ? `${formatBarDateLabel(refDate)} 장마감`
      : `${formatKstClock(now)} KST`

  return {
    lastBarDate: refDate,
    lastClose: referenceBar?.close ?? last?.close ?? null,
    sessionKind,
    sessionLabel,
    delayNote,
    dataSourceLabel,
    asOfIso: asOfIso || now.toISOString(),
    asOfLabelKst,
    updatedAtIso: now.toISOString(),
    updatedLabelKst: `${formatKstClock(now)} KST`,
    ohlcPriority: "regular_close",
    displayRangeMonths: 3,
  }
}
