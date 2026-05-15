/**
 * 일봉 OHLC 기준 시각·장 상태 라벨 (KIS / Yahoo).
 * 국내(KIS): 16:00 KST 이후 확정 OHLC·거래량 반영.
 */

import {
  afterKrxDataConfirmed,
  formatUpdateBasisKst,
  isKstWeekday,
  ymdKst,
} from "./krxDomesticClose.js"

function formatBarDateLabel(ymd) {
  const s = String(ymd || "")
  if (!/^\d{8}$/.test(s)) return "—"
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`
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

/**
 * @param {{
 *   rows: Array<{ date?: string; close: number }>
 *   dataSource: string
 *   yahooMeta?: object
 *   asOfIso?: string
 *   yahooSymbol?: string
 *   domesticClose?: { confirmReady?: boolean; dataStale?: boolean; excludedTodayBar?: boolean; needsReverify?: boolean }
 * }} opts
 */
export function buildChartSessionMeta({
  rows,
  dataSource,
  yahooMeta,
  asOfIso,
  yahooSymbol,
  domesticClose,
}) {
  const now = new Date()
  const todayYmd = ymdKst(now)
  const last = rows?.[rows.length - 1]
  const prev = rows?.length >= 2 ? rows[rows.length - 2] : last
  const lastDate = last?.date ? String(last.date) : null

  let referenceBar = last
  let sessionKind = "regular_close"
  let sessionLabel = "정규장 마감 일봉 기준"
  let delayNote = null
  let needsReverify = false
  let confirmReady = false

  if (dataSource === "kis") {
    const dc = domesticClose || {}
    confirmReady = dc.confirmReady === true
    needsReverify = dc.needsReverify === true

    if (dc.dataStale) {
      sessionKind = "pending_confirm"
      sessionLabel = "16:00 이후 확정 데이터 동기화 중"
      delayNote = "자동 재검증 진행 중"
      referenceBar = prev ?? last
    } else if (dc.excludedTodayBar || (isKstWeekday(now) && !afterKrxDataConfirmed(now))) {
      referenceBar = prev ?? last
      sessionKind = "previous_close"
      sessionLabel = "전일 종가 기준 · 16:00 KST 이후 확정 반영"
      delayNote = isKstWeekday(now) ? "16:00 KST 이후 자동 재검증" : null
      needsReverify = isKstWeekday(now) && !afterKrxDataConfirmed(now)
    } else if (confirmReady) {
      sessionKind = "regular_close"
      sessionLabel = "국내 정규장 마감 데이터 반영 완료"
    } else if (lastDate === todayYmd) {
      sessionKind = "regular_close"
      sessionLabel = "당일 정규장 마감 데이터 반영 완료"
      confirmReady = true
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
    confirmReady = sessionKind === "regular_close"
  }

  const dataSourceLabel =
    dataSource === "kis"
      ? "한국투자증권 일봉 (KIS) · 정규장 OHLC · 16:00 KST 확정"
      : `Yahoo Finance${yahooSymbol ? ` · ${yahooSymbol}` : ""}`

  const refDate = referenceBar?.date ? String(referenceBar.date) : lastDate
  const todayBasis = todayYmd
    ? `${todayYmd.slice(0, 4)}-${todayYmd.slice(4, 6)}-${todayYmd.slice(6, 8)}`
    : formatUpdateBasisKst(now).slice(0, 10)
  const updateBasisLabelKst =
    dataSource === "kis" && confirmReady
      ? formatUpdateBasisKst(now)
      : dataSource === "kis" && isKstWeekday(now) && !afterKrxDataConfirmed(now)
        ? `${todayBasis} 16:00 KST 예정`
        : formatUpdateBasisKst(now)

  const asOfLabelKst =
    dataSource === "kis" && confirmReady
      ? updateBasisLabelKst
      : asOfIso
        ? formatUpdateBasisKst(new Date(asOfIso))
        : refDate && /^\d{8}$/.test(refDate)
          ? `${formatBarDateLabel(refDate)} 장마감`
          : formatUpdateBasisKst(now)

  return {
    lastBarDate: refDate,
    lastClose: referenceBar?.close ?? last?.close ?? null,
    sessionKind,
    sessionLabel,
    delayNote,
    dataSourceLabel,
    dataSource,
    asOfIso: asOfIso || now.toISOString(),
    asOfLabelKst,
    updateBasisLabelKst,
    updatedAtIso: now.toISOString(),
    updatedLabelKst: formatUpdateBasisKst(now),
    confirmReady,
    needsReverify,
    ohlcPriority: "regular_close",
    displayRangeMonths: 3,
    updatePolicy: dataSource === "kis" ? "krx_16:00_kst" : null,
  }
}
