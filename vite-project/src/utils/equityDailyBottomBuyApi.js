import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"

const API_PATH = "/api/equity-daily-bottom-buy"

/**
 * @param {string} symbol
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchEquityDailyBottomBuy(symbol, { signal } = {}) {
  const url = withNoStoreQuery(`${API_PATH}?symbol=${encodeURIComponent(symbol)}`)
  const res = await fetch(url, { ...LIVE_JSON_GET_INIT, signal })
  if (!res.ok) {
    return { ok: false, message: "데이터 준비 중", universe: [], view: null }
  }
  return res.json()
}
