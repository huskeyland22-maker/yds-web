import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"
import {
  equityPayloadHasProDetails,
  redactEquityDailyBottomBuyPayload,
} from "../../../api/_lib/equityDailyBottomBuyRedact.js"
import { withOptionalBearerAuth } from "./firebaseIdTokenClient.js"

const API_PATH = "/api/equity-daily-bottom-buy"

/**
 * Apply FREE redaction when the caller is not PRO (defense in depth for API payloads).
 * @param {object} payload
 * @param {boolean} isPro
 */
export function applyEquityDailyBottomBuyAccess(payload, isPro) {
  if (!payload || typeof payload !== "object") return payload
  if (isPro === true) {
    return payload?.access === "full" ? payload : { ...payload, access: payload.access || "full" }
  }
  if (payload.access === "summary" && !equityPayloadHasProDetails(payload)) return payload
  return redactEquityDailyBottomBuyPayload(payload)
}

/**
 * @param {string} symbol
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchEquityDailyBottomBuy(symbol, { signal } = {}) {
  const url = withNoStoreQuery(`${API_PATH}?symbol=${encodeURIComponent(symbol)}`)
  const headers = await withOptionalBearerAuth(LIVE_JSON_GET_INIT.headers)
  const res = await fetch(url, { ...LIVE_JSON_GET_INIT, headers, signal })
  if (!res.ok) {
    return { ok: false, access: "summary", message: "데이터 준비 중", universe: [], view: null }
  }
  return res.json()
}
