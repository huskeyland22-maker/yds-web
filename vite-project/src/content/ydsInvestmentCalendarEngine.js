/**
 * YDS 투자 캘린더 — 거시·종목 일정 + 시장상태 연동 영향 예상
 */

import calendarSeed from "../data/investmentCalendarSeed.json" with { type: "json" }
import stockUniverse from "../data/stockPickUniverse.json" with { type: "json" }
import {
  addCalendarDaysLocal,
  localCalendarDateKey,
} from "../utils/calendarDateUtils.js"

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

/** @typedef {'pick' | 'sector' | 'mega'} StockEventPriorityTier */

/**
 * @typedef {StockCalendarEvent & {
 *   priorityTier: StockEventPriorityTier
 *   priorityRank: number
 *   eventTitle: string
 *   impactLine: string
 * }} PrioritizedStockEvent
 */

/** 추천 섹터별 대표 종목 (YDS 유니버스에 없는 벤치마크 포함) */
export const SECTOR_REPRESENTATIVE_TICKERS = {
  semi: ["MU", "TSM", "ASML"],
  power: ["GEV"],
  ai: ["NVDA"],
  defense: ["LMT", "RTX"],
  nuclear: ["CEG", "OKLO"],
  robot: ["ISRG", "ABB"],
  infra: ["CAT", "DE"],
}

/** 시총 상위·시장 벤치마크 (추천·섹터 대표에 없을 때) */
export const MEGA_CAP_WATCHLIST = [
  { ticker: "AAPL", name: "애플", sectorLabel: "빅테크" },
  { ticker: "MSFT", name: "마이크로소프트", sectorLabel: "빅테크" },
  { ticker: "AMZN", name: "아마존", sectorLabel: "빅테크" },
  { ticker: "GOOGL", name: "구글", sectorLabel: "빅테크" },
  { ticker: "GOOG", name: "구글", sectorLabel: "빅테크" },
  { ticker: "META", name: "메타", sectorLabel: "빅테크" },
  { ticker: "NKE", name: "나이키", sectorLabel: "소비주" },
]

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

/** @typedef {'S' | 'A' | 'B'} MacroMarketTier */

/** @param {string} text */
function normMacroText(text) {
  return String(text ?? "").toLowerCase()
}

/**
 * 시장 영향도 기준 거시 이벤트 등급 (S/A/B)
 * @param {MacroCalendarEvent | { category: MacroCategoryId; title?: string; subtitle?: string }} event
 * @returns {MacroMarketTier | null}
 */
export function classifyMacroMarketTier(event) {
  const blob = normMacroText(`${event.title ?? ""} ${event.subtitle ?? ""}`)
  const cat = event.category

  if (/만기|witching|옵션\s*만기|triple/i.test(blob)) return null
  if (/실업수당|claims|jobless/i.test(blob)) return null

  if (cat === "fomc") return "S"
  if (cat === "cpi") return "S"
  if (cat === "ppi") return "S"
  if (cat === "pce" || /core\s*pce|근원\s*pce/i.test(blob)) return "S"
  if (cat === "gdp") return "S"
  if (cat === "employment" && /nfp|비농업|고용지표|payroll|고용보고/i.test(blob)) return "S"

  if (/소매|retail/i.test(blob)) return "A"
  if (/ism.*(제조|manufacturing)|제조업\s*ism|ism\s*제조/i.test(blob)) return "A"
  if (/ism.*(서비스|services)|서비스업\s*ism|ism\s*서비스/i.test(blob)) return "A"
  if (/소비자\s*신뢰|consumer confidence|미시간/i.test(blob)) return "A"

  return null
}

/** @param {MacroMarketTier} tier */
export function macroMarketTierRank(tier) {
  if (tier === "S") return 0
  if (tier === "A") return 1
  return 2
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
  if (event.category === "cpi") {
    if (/근원|core/i.test(event.title)) return "Core CPI 발표"
    return "CPI 발표"
  }
  if (event.category === "pce") {
    if (/core|근원/i.test(event.title)) return "Core PCE"
    return "PCE"
  }
  if (event.category === "ppi") return "PPI 발표"
  if (event.category === "employment") {
    if (/nfp|비농업|고용지표|payroll|고용보고/i.test(event.title)) return "고용보고서"
    if (/실업/i.test(event.title)) return "실업률"
    return "고용지표 발표"
  }
  if (event.category === "gdp") return "GDP"
  if (/만기|witching/i.test(event.title)) return "옵션 만기일"

  return String(event.title)
    .replace(/^미국\s+/, "")
    .replace(/^한국\s+/, "")
    .split("(")[0]
    .trim()
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

  const start = localCalendarDateKey(mon)
  const end = localCalendarDateKey(sun)
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

/** @param {StockCalendarEvent} event */
export function stockEventDisplayTitle(event) {
  if (event.category === "earnings") return `${event.name} 실적 발표`
  if (event.category === "dividend") return `${event.name} 배당`
  if (event.category === "agm") return `${event.name} 주주총회`
  return event.name
}

/** @returns {Set<string>} */
function buildPickTickerSet() {
  return new Set((stockUniverse.stocks ?? []).map((row) => String(row.ticker).toUpperCase()))
}

/** @returns {Set<string>} */
function buildActiveSectorSet() {
  return new Set((stockUniverse.stocks ?? []).map((row) => row.sector).filter(Boolean))
}

/**
 * @param {string} ticker
 * @param {Set<string>} activeSectors
 * @returns {{ sectorId: string; label: string } | null}
 */
function findSectorRepInfo(ticker, activeSectors) {
  const upper = ticker.toUpperCase()
  for (const [sectorId, tickers] of Object.entries(SECTOR_REPRESENTATIVE_TICKERS)) {
    if (!activeSectors.has(sectorId)) continue
    if (tickers.some((t) => t.toUpperCase() === upper)) {
      const label =
        sectorId === "semi"
          ? "반도체"
          : sectorId === "power"
            ? "전력"
            : sectorId === "ai"
              ? "AI"
              : sectorId === "defense"
                ? "방산"
                : sectorId === "nuclear"
                  ? "원전"
                  : sectorId === "robot"
                    ? "로봇"
                    : sectorId === "infra"
                      ? "인프라"
                      : sectorId
      return { sectorId, label }
    }
  }
  return null
}

/**
 * @param {StockEventPriorityTier} tier
 * @param {number} [relatedPickCount]
 */
export function stockImpactFromRelation(tier, relatedPickCount = 1) {
  if (tier === "pick") {
    const n = Math.max(1, relatedPickCount)
    return {
      stars: "★★★",
      level: 3,
      label: "직접 관련",
      impactLine: `추천종목 직접 관련 · ${n}종목 ★★★`,
    }
  }
  if (tier === "sector") {
    return {
      stars: "★★",
      level: 2,
      label: "간접 관련",
      impactLine: "섹터 간접 관련 ★★",
    }
  }
  return {
    stars: "★",
    level: 1,
    label: "참고",
    impactLine: "참고 수준 ★",
  }
}

/**
 * @param {StockCalendarEvent} event
 * @param {Set<string>} pickTickers
 * @param {Set<string>} activeSectors
 * @returns {PrioritizedStockEvent | null}
 */
export function classifyStockEventPriority(event, pickTickers, activeSectors) {
  const ticker = String(event.ticker).toUpperCase()
  const pickCount = [...pickTickers].filter(Boolean).length

  if (pickTickers.has(ticker)) {
    const impact = stockImpactFromRelation("pick", pickCount)
    return {
      ...event,
      priorityTier: /** @type {const} */ ("pick"),
      priorityRank: 1,
      eventTitle: stockEventDisplayTitle(event),
      impactStars: impact.stars,
      impactLevel: impact.level,
      impactRelation: impact.label,
      impactLine: impact.impactLine,
    }
  }

  const sectorRep = findSectorRepInfo(ticker, activeSectors)
  if (sectorRep) {
    const impact = stockImpactFromRelation("sector")
    return {
      ...event,
      priorityTier: /** @type {const} */ ("sector"),
      priorityRank: 2,
      eventTitle: stockEventDisplayTitle(event),
      impactStars: impact.stars,
      impactLevel: impact.level,
      impactRelation: impact.label,
      impactLine: `${sectorRep.label} ${impact.impactLine}`,
    }
  }

  const mega = MEGA_CAP_WATCHLIST.find((row) => row.ticker.toUpperCase() === ticker)
  if (mega) {
    const impact = stockImpactFromRelation("mega")
    return {
      ...event,
      priorityTier: /** @type {const} */ ("mega"),
      priorityRank: 3,
      eventTitle: stockEventDisplayTitle(event),
      impactStars: impact.stars,
      impactLevel: impact.level,
      impactRelation: impact.label,
      impactLine: `${mega.sectorLabel} ${impact.impactLine}`,
    }
  }

  return null
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} marketContext
 * @param {Date} [refDate]
 * @param {number} [limit]
 * @param {number} [horizonDays]
 */
export function buildPrioritizedStockEvents(
  marketContext = null,
  refDate = new Date(),
  limit = 12,
  horizonDays = 35,
) {
  const today = localCalendarDateKey(refDate)
  const horizonEnd = addCalendarDaysLocal(today, horizonDays)
  const pickTickers = buildPickTickerSet()
  const activeSectors = buildActiveSectorSet()

  const pool = (calendarSeed.stockEvents ?? [])
    .filter((row) => row.date >= today && row.date <= horizonEnd)
    .map((row) => enrichStock(row, marketContext))

  const classified = pool
    .map((event) => classifyStockEventPriority(event, pickTickers, activeSectors))
    .filter(Boolean)

  classified.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.priorityRank - b.priorityRank
  })

  return classified.slice(0, limit)
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

  const prioritizedStockEvents = buildPrioritizedStockEvents(marketContext, refDate, 16, 35)

  const thisWeek = sortEvents([...macro, ...stock])
  const macroAll = sortEvents((calendarSeed.macroEvents ?? []).map((e) => enrichMacro(e, marketContext)))
  const stockAll = sortEvents((calendarSeed.stockEvents ?? []).map((e) => enrichStock(e, marketContext)))

  return {
    week,
    thisWeek,
    macroThisWeek: macro,
    stockThisWeek: stock,
    prioritizedStockEvents,
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
export function buildWeekEventStrip(marketContext = null, limit = 12, refDate = new Date()) {
  const week = getWeekRange(refDate)
  const today = localCalendarDateKey(refDate)
  const horizonEnd = addCalendarDaysLocal(week.end, 45)

  const macroAll = (calendarSeed.macroEvents ?? [])
    .map((e) => enrichMacro(e, marketContext))
    .filter((e) => e.date >= today && e.date <= horizonEnd)

  const stripItems = macroAll
    .map((event) => {
      const marketTier = classifyMacroMarketTier(event)
      if (!marketTier) return null
      return {
        ...event,
        briefLabel: eventBriefLabel(event),
        marketTier,
        importanceTier: marketTier,
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return macroMarketTierRank(a.marketTier) - macroMarketTierRank(b.marketTier)
    })
    .slice(0, limit)

  return {
    week,
    marketStage: marketContext?.ready
      ? `${marketContext.strategyEmoji} ${marketContext.strategyLabel}`
      : null,
    stripItems,
    hasEvents: stripItems.length > 0,
  }
}

/**
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} marketContext
 * @param {number} [limit]
 * @param {Date} [refDate]
 */
export function buildStockWeekEventStrip(marketContext = null, limit = 5, refDate = new Date()) {
  const report = buildInvestmentCalendarReport(marketContext, refDate)
  const stockItems = buildPrioritizedStockEvents(marketContext, refDate, limit, 35)

  return {
    week: report.week,
    marketStage: report.marketStage,
    stockItems,
    hasEvents: stockItems.length > 0,
  }
}

/**
 * 대시보드 통합 이벤트 스트립 — 거시 + 종목/실적 단일 카드
 * @param {import("./ydsMarketAdapter.js").YdsMarketAdapterContext | null | undefined} marketContext
 * @param {{ macroLimit?: number; stockLimit?: number }} [opts]
 * @param {Date} [refDate]
 */
export function buildUnifiedWeekEventStrip(
  marketContext = null,
  opts = {},
  refDate = new Date(),
) {
  const macroLimit = opts.macroLimit ?? 12
  const stockLimit = opts.stockLimit ?? 12
  const previewLimit = opts.previewLimit ?? 3
  const macroPart = buildWeekEventStrip(marketContext, macroLimit, refDate)
  const stockPart = buildStockWeekEventStrip(marketContext, stockLimit, refDate)

  /** @type {Array<{ kind: 'macro' | 'stock'; date: string; id: string } & Record<string, unknown>>} */
  const flatItems = [
    ...macroPart.stripItems.map((event) => ({ ...event, kind: /** @type {const} */ ("macro") })),
    ...stockPart.stockItems.map((event) => ({ ...event, kind: /** @type {const} */ ("stock") })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  return {
    week: macroPart.week,
    marketStage: macroPart.marketStage,
    macroItems: macroPart.stripItems,
    stockItems: stockPart.stockItems,
    flatItems,
    previewLimit,
    hasEvents: flatItems.length > 0,
  }
}
