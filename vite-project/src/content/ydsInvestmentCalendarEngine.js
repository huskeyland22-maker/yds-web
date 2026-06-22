/**
 * YDS 투자 캘린더 — 거시·종목 일정 + 시장상태 연동 영향 예상
 */

import calendarSeed from "../data/investmentCalendarSeed.json" with { type: "json" }

/** @typedef {'fomc' | 'cpi' | 'ppi' | 'pce' | 'employment' | 'gdp' | 'other'} MacroCategoryId */
/** @typedef {'earnings' | 'dividend' | 'agm'} StockEventCategoryId */
/** @typedef {'positive' | 'neutral' | 'negative'} MarketImpactId */

/**
 * @typedef {{
 *   id: string
 *   date: string
 *   category: MacroCategoryId
 *   title: string
 *   subtitle?: string
 *   importance: 1 | 2 | 3
 *   region: 'US' | 'KR'
 *   impact: MarketImpactId
 *   impactLabel: string
 *   impactNote: string
 *   importanceStars: string
 *   categoryLabel: string
 *   kind: 'macro'
 * }} MacroCalendarEvent
 */

/**
 * @typedef {{
 *   id: string
 *   date: string
 *   ticker: string
 *   name: string
 *   country: 'US' | 'KR'
 *   category: StockEventCategoryId
 *   importance: 1 | 2 | 3
 *   impact: MarketImpactId
 *   impactLabel: string
 *   impactNote: string
 *   importanceStars: string
 *   categoryLabel: string
 *   kind: 'stock'
 * }} StockCalendarEvent
 */

/** @typedef {MacroCalendarEvent | StockCalendarEvent} CalendarEvent */

export const MACRO_CATEGORY_LABELS = {
  fomc: "FOMC",
  cpi: "CPI",
  ppi: "PPI",
  pce: "PCE",
  employment: "고용",
  gdp: "GDP",
  other: "지표",
}

export const STOCK_CATEGORY_LABELS = {
  earnings: "실적발표",
  dividend: "배당",
  agm: "주주총회",
}

export const IMPACT_LABELS = {
  positive: "긍정",
  neutral: "중립",
  negative: "부정",
}

/** @param {1|2|3} n */
export function importanceStars(n) {
  const c = Math.max(1, Math.min(3, n))
  return "★".repeat(c)
}

/** @param {1|2|3} n */
export function importanceTierLabel(n) {
  const c = Math.max(1, Math.min(3, n))
  if (c >= 3) return "상"
  if (c === 2) return "중"
  return "하"
}

/** @param {CalendarEvent} event */
export function eventBriefLabel(event) {
  if (event.kind === "stock") {
    if (event.category === "earnings") return `${event.name} 실적`
    if (event.category === "dividend") return `${event.name} 배당`
    return event.name
  }

  if (event.category === "fomc") {
    return event.region === "KR" ? "한국은행 금통위" : "FOMC 회의"
  }
  if (event.category === "cpi") return "CPI 발표"
  if (event.category === "pce") return "PCE 발표"
  if (event.category === "ppi") return "PPI 발표"
  if (event.category === "employment") return "고용지표 발표"
  if (event.category === "gdp") return "GDP 발표"
  if (/만기|witching/i.test(event.title)) return "옵션 만기일"

  return String(event.title)
    .replace(/^미국\s+/, "")
    .replace(/^한국\s+/, "")
    .split("(")[0]
    .trim()
}

/** @param {string} dateKey @param {number} days */
function addCalendarDaysLocal(dateKey, days) {
  const d = new Date(`${dateKey}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * @param {Date} [ref]
 * @returns {{ start: string; end: string; label: string }}
 */
export function getWeekRange(ref = new Date()) {
  const d = new Date(ref)
  d.setHours(12, 0, 0, 0)
  const day = d.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)

  const fmt = (/** @type {Date} */ x) => x.toISOString().slice(0, 10)
  const start = fmt(mon)
  const end = fmt(sun)
  const label = `${start.slice(5).replace("-", "/")} – ${end.slice(5).replace("-", "/")}`
  return { start, end, label }
}

/** @param {string} dateKey @param {string} start @param {string} end */
function inRange(dateKey, start, end) {
  return dateKey >= start && dateKey <= end
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} ctx
 * @param {MacroCategoryId} category
 * @param {string} [title]
 */
function deriveMacroImpact(ctx, category, title = "") {
  const defensive = ctx?.isDefensive ?? false
  const macroId = ctx?.macroId ?? "neutral"

  if (category === "fomc") {
    if (macroId === "panicBuy" || macroId === "dca") {
      return { impact: /** @type {const} */ ("positive"), note: "완화 기대·유동성 우호" }
    }
    if (defensive) return { impact: /** @type {const} */ ("negative"), note: "금리·변동성 리스크" }
    return { impact: /** @type {const} */ ("neutral"), note: "방향성 확인 필요" }
  }

  if (category === "cpi" || category === "ppi" || category === "pce") {
    if (defensive) return { impact: /** @type {const} */ ("negative"), note: "인플레 서프라이즈 시 긴축 우려" }
    if (macroId === "dca") return { impact: /** @type {const} */ ("positive"), note: "둔화 시 완화 기대" }
    return { impact: /** @type {const} */ ("neutral"), note: "서프라이즈에 민감" }
  }

  if (category === "employment") {
    if (macroId === "overheat") return { impact: /** @type {const} */ ("negative"), note: "강한 고용·긴축 압력" }
    if (macroId === "panicBuy") return { impact: /** @type {const} */ ("positive"), note: "고용 둔화 시 완화 기대" }
    return { impact: /** @type {const} */ ("neutral"), note: "연준·한은 해석 관건" }
  }

  if (category === "gdp") {
    return { impact: /** @type {const} */ ("neutral"), note: "성장·인플레 동시 확인" }
  }

  if (/만기|witching/i.test(title)) {
    return { impact: /** @type {const} */ ("negative"), note: "만기일 변동성 확대" }
  }

  return { impact: /** @type {const} */ ("neutral"), note: "보조 지표" }
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} ctx
 * @param {StockEventCategoryId} category
 */
function deriveStockImpact(ctx, category) {
  const defensive = ctx?.isDefensive ?? false

  if (category === "earnings") {
    if (defensive) return { impact: /** @type {const} */ ("negative"), note: "실적·가이던스 하향 리스크" }
    return { impact: /** @type {const} */ ("positive"), note: "성장·AI 테마 실적 모멘텀" }
  }
  if (category === "dividend") {
    return { impact: /** @type {const} */ ("neutral"), note: "배당·배당락 일정" }
  }
  return { impact: /** @type {const} */ ("neutral"), note: "주주총회·의결 안건" }
}

/** @param {typeof calendarSeed.macroEvents[0]} row @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} ctx */
function enrichMacro(row, ctx) {
  const { impact, note } = deriveMacroImpact(ctx, row.category, row.title)
  return {
    ...row,
    kind: /** @type {const} */ ("macro"),
    impact,
    impactLabel: IMPACT_LABELS[impact],
    impactNote: note,
    importanceStars: importanceStars(row.importance),
    categoryLabel: MACRO_CATEGORY_LABELS[row.category] ?? row.category,
  }
}

/** @param {typeof calendarSeed.stockEvents[0]} row @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} ctx */
function enrichStock(row, ctx) {
  const { impact, note } = deriveStockImpact(ctx, row.category)
  return {
    ...row,
    kind: /** @type {const} */ ("stock"),
    impact,
    impactLabel: IMPACT_LABELS[impact],
    impactNote: note,
    importanceStars: importanceStars(row.importance),
    categoryLabel: STOCK_CATEGORY_LABELS[row.category] ?? row.category,
  }
}

/** @param {CalendarEvent[]} events */
function sortEvents(events) {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return b.importance - a.importance
  })
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} [marketContext]
 * @param {Date} [refDate]
 */
export function buildInvestmentCalendarReport(marketContext = null, refDate = new Date()) {
  const week = getWeekRange(refDate)
  const macro = (calendarSeed.macroEvents ?? [])
    .filter((e) => inRange(e.date, week.start, week.end))
    .map((e) => enrichMacro(e, marketContext))
  const stock = (calendarSeed.stockEvents ?? [])
    .filter((e) => inRange(e.date, week.start, week.end))
    .map((e) => enrichStock(e, marketContext))

  const thisWeek = sortEvents([...macro, ...stock])
  const macroAll = sortEvents((calendarSeed.macroEvents ?? []).map((e) => enrichMacro(e, marketContext)))
  const stockAll = sortEvents((calendarSeed.stockEvents ?? []).map((e) => enrichStock(e, marketContext)))

  return {
    week,
    thisWeek,
    macroThisWeek: macro,
    stockThisWeek: stock,
    macroUpcoming: macroAll.filter((e) => e.date >= week.start).slice(0, 14),
    stockUpcoming: stockAll.filter((e) => e.date >= week.start).slice(0, 14),
    hasEvents: thisWeek.length > 0,
    marketStage: marketContext?.ready
      ? `${marketContext.strategyEmoji} ${marketContext.strategyLabel}`
      : null,
  }
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} marketContext
 * @param {number} [limit]
 * @param {Date} [refDate]
 */
export function buildWeekEventStrip(marketContext = null, limit = 5, refDate = new Date()) {
  const report = buildInvestmentCalendarReport(marketContext, refDate)
  const today = refDate.toISOString().slice(0, 10)
  const fillEnd = addCalendarDaysLocal(report.week.end, 7)

  /** @type {Set<string>} */
  const seen = new Set()
  /** @type {Array<CalendarEvent & { briefLabel: string; importanceTier: string }>} */
  const stripItems = []

  const push = (/** @type {CalendarEvent} */ event) => {
    if (seen.has(event.id) || stripItems.length >= limit) return
    seen.add(event.id)
    stripItems.push({
      ...event,
      briefLabel: eventBriefLabel(event),
      importanceTier: importanceTierLabel(event.importance),
    })
  }

  for (const event of report.thisWeek) push(event)

  if (stripItems.length < limit) {
    const macroAll = (calendarSeed.macroEvents ?? []).map((e) => enrichMacro(e, marketContext))
    const stockAll = (calendarSeed.stockEvents ?? []).map((e) => enrichStock(e, marketContext))
    const pool = sortEvents([...macroAll, ...stockAll]).filter(
      (e) => e.date >= today && e.date <= fillEnd,
    )
    for (const event of pool) {
      push(event)
      if (stripItems.length >= limit) break
    }
  }

  return {
    ...report,
    stripItems,
    hasEvents: stripItems.length > 0,
  }
}
