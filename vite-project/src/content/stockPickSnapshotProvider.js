/**
 * YDS Phase 2-6 — Snapshot Provider 추상 계층
 * UI·점수 엔진은 StockPriceSnapshot 형식만 소비 · Provider만 교체
 */

import { buildStockPriceSnapshot } from "./stockPickSnapshotProfiles.js"

/** @typedef {'US' | 'KR'} SnapshotCountryId */
/** @typedef {'trend' | 'dip' | 'interest' | 'overheat'} SnapshotProfileStatus */

/**
 * @typedef {import("./ydsStockScoreEngine.js").StockPriceSnapshot & {
 *   ticker: string
 *   country: SnapshotCountryId
 *   ma10?: number
 *   price: number
 *   volume: number
 *   avgVolume20: number
 * }} StockMarketSnapshot
 */

/**
 * @typedef {{
 *   ticker: string
 *   country: SnapshotCountryId
 *   status?: SnapshotProfileStatus
 *   basePrice?: number
 * }} SnapshotRequest
 */

/**
 * @typedef {{
 *   id: string
 *   getSnapshot: (request: SnapshotRequest) => StockMarketSnapshot | Promise<StockMarketSnapshot>
 * }} SnapshotProvider
 */

/** @type {'dummy' | 'live'} */
export let SNAPSHOT_PROVIDER_MODE = "dummy"

/** @param {'dummy' | 'live'} mode */
export function setSnapshotProviderMode(mode) {
  SNAPSHOT_PROVIDER_MODE = mode
}

/**
 * @param {import("./ydsStockScoreEngine.js").StockPriceSnapshot} raw
 * @param {SnapshotRequest} request
 * @returns {StockMarketSnapshot}
 */
export function toStockMarketSnapshot(raw, request) {
  return {
    ...raw,
    ticker: request.ticker,
    country: request.country,
    price: raw.close,
    volume: raw.volumeToday,
    avgVolume20: raw.volumeAvg20,
    ma10: raw.close * 0.99,
  }
}

/** @type {SnapshotProvider} */
const dummyProvider = {
  id: "dummy",
  getSnapshot(request) {
    const raw = buildStockPriceSnapshot(
      request.ticker,
      "interest",
      request.basePrice ?? 100,
    )
    return toStockMarketSnapshot(raw, request)
  },
}

/** @type {SnapshotProvider} */
const yahooSnapshotProvider = {
  id: "yahoo",
  getSnapshot(request) {
    return dummyProvider.getSnapshot(request)
  },
}

/** @type {SnapshotProvider} */
const naverSnapshotProvider = {
  id: "naver",
  getSnapshot(request) {
    return dummyProvider.getSnapshot(request)
  },
}

/** @type {Record<SnapshotCountryId, SnapshotProvider>} */
const LIVE_PROVIDERS = {
  US: yahooSnapshotProvider,
  KR: naverSnapshotProvider,
}

/**
 * @param {SnapshotRequest} request
 * @returns {StockMarketSnapshot}
 */
export function getStockSnapshot(request) {
  const provider =
    SNAPSHOT_PROVIDER_MODE === "live"
      ? LIVE_PROVIDERS[request.country] ?? dummyProvider
      : dummyProvider

  const snapshot = provider.getSnapshot(request)
  if (snapshot instanceof Promise) {
    throw new Error("Sync getStockSnapshot cannot resolve async provider yet")
  }
  return snapshot
}

/**
 * 점수 엔진 입력 형식으로 변환 (엔진 필드명 유지)
 * @param {StockMarketSnapshot} snapshot
 * @returns {import("./ydsStockScoreEngine.js").StockPriceSnapshot}
 */
export function toEngineSnapshot(snapshot) {
  return {
    close: snapshot.price ?? snapshot.close,
    ma20: snapshot.ma20,
    ma60: snapshot.ma60,
    ma120: snapshot.ma120,
    high52w: snapshot.high52w,
    recentHigh: snapshot.recentHigh,
    volumeToday: snapshot.volume ?? snapshot.volumeToday,
    volumeAvg20: snapshot.avgVolume20 ?? snapshot.volumeAvg20,
  }
}

export {
  dummyProvider,
  yahooSnapshotProvider,
  naverSnapshotProvider,
}
