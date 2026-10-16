/**
 * DBB prospective signal tracking v12 (observation only).
 * Separate from trade records and yds.dailyBottomBuy.episodes.v1.
 * Does not change DBB thresholds/engine. No auto buy/sell.
 */

export const PROSPECTIVE_V12_VERSION = 12
export const PROSPECTIVE_STORAGE_KEY = "yds.dbbProspective.v12"
export const PROSPECTIVE_CHANGED_EVENT = "yds-dbb-prospective-v12-changed"
export const SIGNAL_MIN_COUNT = 3
export const HORIZONS = [20, 60, 120]

/** Fixed before reading prospective outcomes. */
export const PROSPECTIVE_RULE = {
  purpose: "앞으로 새로 관측되는 DBB 신호를 발생 시점에 기록하고 T+20/60/120 결과를 추적한다. 매수 규칙은 바꾸지 않는다.",
  baseline:
    "최초 실행 시 현재 카드로 lastCount만 기준선으로 두고 이벤트는 만들지 않는다. 기준선 이전 신호는 전향적 표본에 넣지 않는다.",
  risingEdge: "같은 종목에서 직전 관측 count < 3 이고 이번 count ≥ 3 이며 asOfDate가 유효할 때만 신규 이벤트.",
  dedupe: "고유 키 = universe|symbol|signalDate. 재실행 시 firstObservedAt·원본 지표를 덮어쓰지 않는다.",
  entry: "진입은 신호 다음 거래일 시가. 확인 전에는 pending. 추정·0 대체 금지.",
  incomplete: "미완성 수익률을 0%나 실패로 채우지 않는다. pending/incomplete로 표시.",
  primaryMetrics: ["t60MedianReturn", "t60PositiveRate", "t60ExcessQqqMedian", "t60MaeMedian"],
  secondaryMetrics: ["t20", "t120", "p10", "loss5", "loss10", "count3vs4", "regime"],
  storage:
    "브라우저 localStorage 전용. 기기·브라우저 간 공유 없음. 삭제·프라이빗 모드 시 소실 가능. 실거래 기록과 분리.",
  noBackfill: "앱 미실행 구간의 신호를 과거 데이터로 소급 생성하지 않는다.",
  noAutoTrade: "자동 매수·매도·규칙 채택 없음.",
}

function finite(value) {
  return value != null && Number.isFinite(Number(value))
}

function round2(value) {
  if (!finite(value)) return null
  return Math.round(Number(value) * 100) / 100
}

function mean(values) {
  const xs = (values || []).filter(finite).map(Number)
  if (!xs.length) return null
  return round2(xs.reduce((sum, value) => sum + value, 0) / xs.length)
}

function median(values) {
  const xs = (values || []).filter(finite).map(Number).sort((a, b) => a - b)
  if (!xs.length) return null
  const mid = Math.floor(xs.length / 2)
  if (xs.length % 2) return xs[mid]
  return round2((xs[mid - 1] + xs[mid]) / 2)
}

function percentile(values, p) {
  const xs = (values || []).filter(finite).map(Number).sort((a, b) => a - b)
  if (!xs.length) return null
  const idx = Math.min(xs.length - 1, Math.max(0, Math.floor((p / 100) * xs.length)))
  return xs[idx]
}

function incompleteHorizon(days) {
  return {
    tradingDays: days,
    priceReturnPct: null,
    priceReturnStatus: "pending",
    maxDrawdownPct: null,
    maxDrawdownStatus: "pending",
    qqqReturnPct: null,
    excessQqqPct: null,
    endDate: null,
  }
}

export function emptyProspectiveState() {
  return {
    version: PROSPECTIVE_V12_VERSION,
    meta: {
      startedAt: null,
      startedDataAsOf: null,
      lastSuccessfulObservationAt: null,
      lastDataAsOf: null,
      lastObservationSource: null,
      baselineEstablished: false,
      lastCountsBySymbol: {},
      gapWarning: null,
    },
    events: [],
    referenceNotes: [],
  }
}

export function eventDedupeKey(universe, symbol, signalDate) {
  return `${universe}|${String(symbol || "").toUpperCase()}|${signalDate}`
}

export function makeEventId(universe, symbol, signalDate) {
  return `p12_${eventDedupeKey(universe, symbol, signalDate)}`
}

/**
 * Build a prospective event from an engine card. Does not invent missing fields.
 */
export function buildProspectiveEventFromCard(card, opts = {}) {
  const {
    universe = "etf",
    observedAt = new Date().toISOString(),
    dataAsOf = null,
    source = null,
    regime = null,
    regimeRule = null,
    priceSource = null,
  } = opts
  if (!card?.ok || !card.symbol || !card.asOfDate) return null
  const count = Number(card.count)
  if (!Number.isFinite(count) || count < SIGNAL_MIN_COUNT) return null
  const symbol = String(card.symbol).toUpperCase()
  const signalDate = card.asOfDate
  return {
    eventId: makeEventId(universe, symbol, signalDate),
    dedupeKey: eventDedupeKey(universe, symbol, signalDate),
    universe,
    symbol,
    name: card.themeShort || card.theme || card.name || symbol,
    episodeId: `${universe}:${symbol}:${signalDate}`,
    signalDate,
    firstObservedAt: observedAt,
    dataAsOf: dataAsOf || signalDate,
    observationSource: source,
    signalCount: count,
    indicators: {
      rsi14: finite(card.rsi14) ? Number(card.rsi14) : null,
      stochK: finite(card.stochK) ? Number(card.stochK) : null,
      bbPctB: finite(card.bbPctB) ? Number(card.bbPctB) : null,
      ma20DevPct: finite(card.ma20DevPct) ? Number(card.ma20DevPct) : null,
      flags: card.flags && typeof card.flags === "object" ? { ...card.flags } : null,
      close: finite(card.close) ? Number(card.close) : null,
    },
    regime: regime ?? null,
    regimeRule: regimeRule ?? null,
    priceSource: priceSource ?? null,
    recordVersion: PROSPECTIVE_V12_VERSION,
    quality: {
      status: "observed",
      notes: [],
    },
    entryStatus: "pending",
    entryDate: null,
    entryPrice: null,
    entryMissingReason: "next_open_not_yet_confirmed",
    horizons: {
      20: incompleteHorizon(20),
      60: incompleteHorizon(60),
      120: incompleteHorizon(120),
    },
  }
}

/**
 * Rising-edge check using previous observation count for the symbol.
 */
export function isRisingEdgeSignal(card, prev = null) {
  if (!card?.ok || !card.asOfDate) return false
  const count = Number(card.count)
  if (!Number.isFinite(count) || count < SIGNAL_MIN_COUNT) return false
  if (!prev) return false // baseline / first sighting after start uses baseline, not event
  const prevCount = Number(prev.count)
  if (!Number.isFinite(prevCount)) return false
  if (prevCount >= SIGNAL_MIN_COUNT) return false
  // New signal day after being below threshold
  if (prev.asOfDate && card.asOfDate < prev.asOfDate) return false
  return true
}

/**
 * Ingest live cards into state. First successful call establishes baseline without events.
 * @returns {{ state: object, created: object[], skipped: object[], baselineJustSet: boolean }}
 */
export function ingestProspectiveCards(state, cards, opts = {}) {
  const {
    universe = "etf",
    observedAt = new Date().toISOString(),
    source = null,
    dataAsOf = null,
  } = opts
  const next = structuredCloneState(state || emptyProspectiveState())
  const created = []
  const skipped = []
  const asOf =
    dataAsOf ||
    (cards || []).map((c) => c?.asOfDate).find((d) => typeof d === "string" && d.trim()) ||
    null

  if (!next.meta.baselineEstablished || !next.meta.startedAt) {
    next.meta.startedAt = observedAt
    next.meta.startedDataAsOf = asOf
    next.meta.baselineEstablished = true
    next.meta.lastSuccessfulObservationAt = observedAt
    next.meta.lastDataAsOf = asOf
    next.meta.lastObservationSource = source
    next.meta.gapWarning = null
    const counts = { ...next.meta.lastCountsBySymbol }
    for (const card of cards || []) {
      if (!card?.ok || !card.symbol) continue
      const symbol = String(card.symbol).toUpperCase()
      counts[`${universe}:${symbol}`] = {
        count: Number(card.count) || 0,
        asOfDate: card.asOfDate || null,
      }
    }
    next.meta.lastCountsBySymbol = counts
    return { state: next, created, skipped, baselineJustSet: true }
  }

  // Gap warning if last observation was > 3 calendar days ago
  if (next.meta.lastSuccessfulObservationAt) {
    const last = Date.parse(next.meta.lastSuccessfulObservationAt)
    const now = Date.parse(observedAt)
    if (Number.isFinite(last) && Number.isFinite(now) && now - last > 3 * 86400000) {
      next.meta.gapWarning =
        "마지막 성공 관측 이후 3일 이상 공백이 있습니다. 그 사이 신호는 전향적 표본에 자동 소급되지 않습니다."
    } else {
      next.meta.gapWarning = null
    }
  }

  const existingKeys = new Set((next.events || []).map((e) => e.dedupeKey))
  const counts = { ...next.meta.lastCountsBySymbol }

  for (const card of cards || []) {
    if (!card?.ok || !card.symbol) continue
    const symbol = String(card.symbol).toUpperCase()
    const key = `${universe}:${symbol}`
    const prev = counts[key] || null
    const rising = isRisingEdgeSignal(card, prev)
    counts[key] = {
      count: Number(card.count) || 0,
      asOfDate: card.asOfDate || null,
    }

    if (!rising) {
      if (Number(card.count) >= SIGNAL_MIN_COUNT) {
        skipped.push({ symbol, signalDate: card.asOfDate, reason: "not_rising_edge_or_already_active" })
      }
      continue
    }

    const event = buildProspectiveEventFromCard(card, {
      universe,
      observedAt,
      dataAsOf: asOf,
      source,
    })
    if (!event) continue
    if (existingKeys.has(event.dedupeKey)) {
      skipped.push({ symbol, signalDate: event.signalDate, reason: "duplicate_dedupe_key" })
      continue
    }
    // Guard: signalDate must be on/after observation start data as-of when known
    if (next.meta.startedDataAsOf && event.signalDate < next.meta.startedDataAsOf) {
      skipped.push({ symbol, signalDate: event.signalDate, reason: "before_prospective_start" })
      continue
    }
    next.events.push(event)
    existingKeys.add(event.dedupeKey)
    created.push(event)
  }

  next.meta.lastCountsBySymbol = counts
  next.meta.lastSuccessfulObservationAt = observedAt
  next.meta.lastDataAsOf = asOf
  next.meta.lastObservationSource = source
  return { state: next, created, skipped, baselineJustSet: false }
}

function structuredCloneState(state) {
  return JSON.parse(JSON.stringify(state || emptyProspectiveState()))
}

/**
 * Apply OHLCV bars to resolve entry (next open) and horizons. Never invents prices.
 */
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

export function applyBarsToEvent(event, bars, qqqBars = null) {
  if (!event?.signalDate) return event
  const out = cloneJson(event)
  const list = Array.isArray(bars) ? bars.filter((b) => b?.date && finite(b.open) && finite(b.close) && finite(b.low)) : []
  const idx = list.findIndex((b) => b.date === event.signalDate)
  if (idx < 0) {
    out.quality = {
      status: "signal_bar_missing",
      notes: ["신호일 봉을 찾지 못함"],
    }
    return out
  }
  const entryIdx = idx + 1
  if (entryIdx >= list.length) {
    out.entryStatus = "pending"
    out.entryMissingReason = "next_session_not_available"
    out.horizons = {
      20: incompleteHorizon(20),
      60: incompleteHorizon(60),
      120: incompleteHorizon(120),
    }
    return out
  }
  const entryPrice = Number(list[entryIdx].open)
  if (!finite(entryPrice) || !(entryPrice > 0)) {
    out.entryStatus = "missing"
    out.entryMissingReason = "invalid_next_open"
    out.entryDate = list[entryIdx].date
    out.entryPrice = null
    return out
  }
  out.entryStatus = "confirmed"
  out.entryDate = list[entryIdx].date
  out.entryPrice = round2(entryPrice)
  out.entryMissingReason = null
  out.priceSource = out.priceSource || "ohlcv_bars"

  const qqqByDate = new Map()
  for (const bar of qqqBars || []) {
    if (bar?.date && finite(bar.close) && bar.close > 0) qqqByDate.set(bar.date, Number(bar.close))
  }

  const horizons = {}
  for (const days of HORIZONS) {
    const endIdx = entryIdx + days
    if (endIdx >= list.length) {
      horizons[String(days)] = incompleteHorizon(days)
      horizons[String(days)].priceReturnStatus = "pending"
      horizons[String(days)].maxDrawdownStatus = "pending"
      continue
    }
    const endClose = Number(list[endIdx].close)
    let minLow = Infinity
    let lowOk = true
    for (let j = entryIdx; j <= endIdx; j++) {
      const low = Number(list[j].low)
      if (!finite(low) || !(low > 0)) {
        lowOk = false
        break
      }
      if (low < minLow) minLow = low
    }
    const priceOk = finite(endClose) && endClose > 0
    const priceReturnPct = priceOk ? round2(((endClose - entryPrice) / entryPrice) * 100) : null
    const maxDrawdownPct = lowOk ? round2(Math.max(0, ((entryPrice - minLow) / entryPrice) * 100)) : null
    const endDate = list[endIdx].date
    let qqqReturnPct = null
    let excessQqqPct = null
    if (priceOk && qqqByDate.size && out.entryDate && endDate) {
      const q0 = qqqByDate.get(out.entryDate)
      const q1 = qqqByDate.get(endDate)
      if (finite(q0) && finite(q1) && q0 > 0) {
        qqqReturnPct = round2(((q1 - q0) / q0) * 100)
        excessQqqPct = round2(priceReturnPct - qqqReturnPct)
      }
    }
    horizons[String(days)] = {
      tradingDays: days,
      priceReturnPct,
      priceReturnStatus: priceOk ? "complete" : "incomplete",
      maxDrawdownPct,
      maxDrawdownStatus: lowOk ? "complete" : "incomplete",
      qqqReturnPct,
      excessQqqPct,
      endDate,
    }
  }
  out.horizons = horizons
  out.quality = { status: "priced", notes: [] }
  return out
}

export function refreshEventsWithBars(state, barsBySymbol, qqqBars = null) {
  const next = structuredCloneState(state)
  next.events = (next.events || []).map((event) => {
    const bars = barsBySymbol?.[event.symbol]
    if (!bars?.length) return event
    return applyBarsToEvent(event, bars, qqqBars)
  })
  return next
}

function horizonComplete(event, days) {
  const h = event?.horizons?.[String(days)]
  if (!h || h.priceReturnStatus !== "complete" || !finite(h.priceReturnPct)) return null
  return h
}

/**
 * Summarize prospective outcomes. Never mixes reference/historical rows.
 */
export function summarizeProspective(state, days = 60) {
  const events = state?.events || []
  const withEntry = events.filter((e) => e.entryStatus === "confirmed" && finite(e.entryPrice))
  const pendingEntry = events.filter((e) => e.entryStatus === "pending" || e.entryStatus === "missing")
  const completes = []
  const maes = []
  const excess = []
  let incomplete = 0
  for (const event of withEntry) {
    const h = horizonComplete(event, days)
    if (!h) {
      incomplete += 1
      continue
    }
    completes.push(Number(h.priceReturnPct))
    if (h.maxDrawdownStatus === "complete" && finite(h.maxDrawdownPct)) maes.push(Number(h.maxDrawdownPct))
    if (finite(h.excessQqqPct)) excess.push(Number(h.excessQqqPct))
  }
  const positive = completes.filter((v) => v > 0)
  return {
    events: events.length,
    withEntry: withEntry.length,
    pendingEntry: pendingEntry.length,
    complete: completes.length,
    incomplete,
    priceMedian: median(completes),
    priceMean: mean(completes),
    positiveRate: completes.length ? round2((positive.length / completes.length) * 100) : null,
    p10: percentile(completes, 10),
    loss5Rate: completes.length
      ? round2((completes.filter((v) => v <= -5).length / completes.length) * 100)
      : null,
    loss10Rate: completes.length
      ? round2((completes.filter((v) => v <= -10).length / completes.length) * 100)
      : null,
    maeMedian: median(maes),
    excessQqqMedian: median(excess),
    byCount: {
      three: summarizeSubset(
        withEntry.filter((e) => Number(e.signalCount) === 3),
        days,
      ),
      four: summarizeSubset(
        withEntry.filter((e) => Number(e.signalCount) === 4),
        days,
      ),
    },
    byRegime: summarizeByRegime(withEntry, days),
    unstable: completes.length < 30,
  }
}

function summarizeSubset(events, days) {
  const completes = []
  for (const event of events || []) {
    const h = horizonComplete(event, days)
    if (h) completes.push(Number(h.priceReturnPct))
  }
  return {
    n: events?.length || 0,
    complete: completes.length,
    priceMedian: median(completes),
    positiveRate: completes.length
      ? round2((completes.filter((v) => v > 0).length / completes.length) * 100)
      : null,
  }
}

function summarizeByRegime(events, days) {
  const map = new Map()
  for (const event of events || []) {
    const key = event.regime || "unclassified"
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(event)
  }
  return Object.fromEntries([...map.entries()].map(([key, list]) => [key, summarizeSubset(list, days)]))
}

export function exportProspectiveJson(state) {
  const payload = {
    exportVersion: PROSPECTIVE_V12_VERSION,
    exportedAt: new Date().toISOString(),
    prospectiveOnly: true,
    note: "전향적 관찰 이벤트만 포함. 과거 연구 JSON과 합산하지 말 것.",
    meta: state?.meta || null,
    events: state?.events || [],
  }
  return JSON.stringify(payload, null, 2)
}

export function exportProspectiveCsv(state) {
  const rows = state?.events || []
  const header = [
    "eventId",
    "symbol",
    "signalDate",
    "signalCount",
    "firstObservedAt",
    "dataAsOf",
    "entryStatus",
    "entryDate",
    "entryPrice",
    "ret20",
    "ret60",
    "ret120",
    "mae60",
    "excessQqq60",
    "regime",
  ]
  const lines = [header.join(",")]
  for (const e of rows) {
    const h20 = e.horizons?.["20"]
    const h60 = e.horizons?.["60"]
    const h120 = e.horizons?.["120"]
    lines.push(
      [
        e.eventId,
        e.symbol,
        e.signalDate,
        e.signalCount,
        e.firstObservedAt,
        e.dataAsOf,
        e.entryStatus,
        e.entryDate ?? "",
        e.entryPrice ?? "",
        h20?.priceReturnStatus === "complete" ? h20.priceReturnPct : "",
        h60?.priceReturnStatus === "complete" ? h60.priceReturnPct : "",
        h120?.priceReturnStatus === "complete" ? h120.priceReturnPct : "",
        h60?.maxDrawdownStatus === "complete" ? h60.maxDrawdownPct : "",
        finite(h60?.excessQqqPct) ? h60.excessQqqPct : "",
        e.regime ?? "",
      ].join(","),
    )
  }
  return lines.join("\n")
}

function notifyChanged() {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(PROSPECTIVE_CHANGED_EVENT))
    }
  } catch {
    /* ignore */
  }
}

export function loadProspectiveState() {
  try {
    const raw = localStorage.getItem(PROSPECTIVE_STORAGE_KEY)
    if (!raw) return emptyProspectiveState()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return emptyProspectiveState()
    return {
      ...emptyProspectiveState(),
      ...parsed,
      meta: { ...emptyProspectiveState().meta, ...(parsed.meta || {}) },
      events: Array.isArray(parsed.events) ? parsed.events : [],
    }
  } catch {
    return emptyProspectiveState()
  }
}

export function saveProspectiveState(state) {
  try {
    localStorage.setItem(PROSPECTIVE_STORAGE_KEY, JSON.stringify(state))
    notifyChanged()
    return true
  } catch {
    return false
  }
}

/**
 * Preserve firstObservedAt and frozen indicators when merging an existing event.
 */
export function mergeWithoutOverwrite(existing, incoming) {
  if (!existing) return incoming
  return {
    ...incoming,
    firstObservedAt: existing.firstObservedAt,
    indicators: existing.indicators,
    signalCount: existing.signalCount,
    signalDate: existing.signalDate,
    episodeId: existing.episodeId,
    eventId: existing.eventId,
    dedupeKey: existing.dedupeKey,
    entryStatus: existing.entryStatus === "confirmed" ? existing.entryStatus : incoming.entryStatus,
    entryDate: existing.entryStatus === "confirmed" ? existing.entryDate : incoming.entryDate,
    entryPrice: existing.entryStatus === "confirmed" ? existing.entryPrice : incoming.entryPrice,
    horizons: existing.entryStatus === "confirmed" ? existing.horizons : incoming.horizons,
  }
}
