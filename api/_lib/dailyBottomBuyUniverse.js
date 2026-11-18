/**
 * Daily Bottom Buy — product ETF universe (config only).
 *
 * Phase I-2 official single source of truth for the product fifteen:
 * ticker, name/theme, sector/industry, and screen order.
 * Frontend re-exports via vite-project/src/content/ydsDailyBottomBuyUniverse.js.
 * Do not duplicate this list elsewhere; add parity tests instead.
 *
 * Kept separate from indicator/threshold engine logic.
 * Research V1 nine stays in dailyBottomBuyEngine.js and must not be rewritten here.
 */

/**
 * @typedef {{
 *   symbol: string
 *   theme: string
 *   themeShort: string
 *   role: string
 *   sector: string
 *   industry: string
 *   legacyCore?: boolean
 * }} DailyBottomBuyEtfMeta
 */

/**
 * Original product six — still the core set inside the expanded fifteen.
 * @type {readonly string[]}
 */
export const DAILY_BOTTOM_BUY_LEGACY_CORE_SIX = Object.freeze([
  "SMH",
  "GRID",
  "IGV",
  "BOTZ",
  "CIBR",
  "VOO",
])

/**
 * Symbols intentionally kept out of the product fifteen (overlap / duplicate mandate).
 * Research artifacts for these tickers are not deleted.
 * @type {readonly string[]}
 */
export const DAILY_BOTTOM_BUY_EXCLUDED_ETFS = Object.freeze([
  "IVV",
  "ITOT",
  "IWF",
  "VUG",
  "SOXX",
  "ROBO",
])

/**
 * Product analysis universe — exactly fifteen ETFs.
 * Order is screen order. Leveraged tickers (FAS/LABU/…) stay off this list.
 * @type {readonly DailyBottomBuyEtfMeta[]}
 */
export const DAILY_BOTTOM_BUY_ETFS = Object.freeze([
  {
    symbol: "SMH",
    theme: "반도체·AI 컴퓨팅",
    themeShort: "반도체·AI",
    role: "AI의 두뇌",
    sector: "기술",
    industry: "반도체",
    legacyCore: true,
  },
  {
    symbol: "GRID",
    theme: "전력망·전기화",
    themeShort: "전력망",
    role: "AI 데이터센터 전력 인프라",
    sector: "유틸리티·인프라",
    industry: "전력망·전기화",
    legacyCore: true,
  },
  {
    symbol: "IGV",
    theme: "소프트웨어·클라우드",
    themeShort: "소프트웨어",
    role: "AI 수익화",
    sector: "기술",
    industry: "소프트웨어·클라우드",
    legacyCore: true,
  },
  {
    symbol: "BOTZ",
    theme: "로봇·자동화",
    themeShort: "로봇",
    role: "Physical AI",
    sector: "산업·자동화",
    industry: "로봇·자동화",
    legacyCore: true,
  },
  {
    symbol: "CIBR",
    theme: "사이버보안",
    themeShort: "사이버",
    role: "AI 시대 보안 인프라",
    sector: "기술",
    industry: "사이버보안",
    legacyCore: true,
  },
  {
    symbol: "VOO",
    theme: "Vanguard S&P 500 ETF",
    themeShort: "S&P 500",
    role: "미국 대형주",
    sector: "광역 시장",
    industry: "미국 대형주",
    legacyCore: true,
  },
  {
    symbol: "QQQM",
    theme: "Nasdaq-100",
    themeShort: "Nasdaq-100",
    role: "미국 성장·빅테크",
    sector: "광역 시장",
    industry: "성장·기술",
  },
  {
    symbol: "SCHD",
    theme: "배당 우량주",
    themeShort: "배당",
    role: "미국 배당 퀄리티",
    sector: "광역 시장",
    industry: "배당·퀄리티",
  },
  {
    symbol: "AVUV",
    theme: "미국 소형 가치",
    themeShort: "소형 가치",
    role: "미국 스몰캡 가치",
    sector: "광역 시장",
    industry: "소형 가치",
  },
  {
    symbol: "VGT",
    theme: "정보기술 섹터",
    themeShort: "정보기술",
    role: "미국 IT 섹터",
    sector: "기술",
    industry: "정보기술",
  },
  {
    symbol: "AIQ",
    theme: "인공지능 테마",
    themeShort: "AI 테마",
    role: "AI 산업 바스켓",
    sector: "기술",
    industry: "인공지능",
  },
  {
    symbol: "XLU",
    theme: "유틸리티 섹터",
    themeShort: "유틸리티",
    role: "방어·전력 수요",
    sector: "유틸리티·인프라",
    industry: "유틸리티",
  },
  {
    symbol: "XLI",
    theme: "산업재 섹터",
    themeShort: "산업재",
    role: "미국 산업·자본재",
    sector: "산업·자동화",
    industry: "산업재",
  },
  {
    symbol: "XLV",
    theme: "헬스케어 섹터",
    themeShort: "헬스케어",
    role: "미국 헬스케어",
    sector: "헬스케어",
    industry: "헬스케어",
  },
  {
    symbol: "XLF",
    theme: "금융 섹터",
    themeShort: "금융",
    role: "미국 금융",
    sector: "금융",
    industry: "금융",
  },
])

/** Screen / API watchlist — identical to the product fifteen. */
export const DAILY_BOTTOM_BUY_WATCHLIST = DAILY_BOTTOM_BUY_ETFS

/**
 * @param {string | null | undefined} symbol
 * @returns {DailyBottomBuyEtfMeta | null}
 */
export function findDailyBottomBuyEtf(symbol) {
  const key = String(symbol ?? "")
    .trim()
    .toUpperCase()
  if (!key) return null
  return DAILY_BOTTOM_BUY_ETFS.find((row) => row.symbol === key) ?? null
}

export {
  ETF_QUALITY_STATUS_PENDING,
  ETF_QUALITY_STATUS_SCORED,
  ETF_QUALITY_LABEL_PENDING,
  resolveEtfQualityEvaluation,
} from "./etfQualityEngine.js"
