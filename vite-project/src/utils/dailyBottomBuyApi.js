import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../config/liveDataFetch.js"
import {
  payloadHasProDetails,
  redactDailyBottomBuyPayload,
} from "../../../api/_lib/dailyBottomBuyRedact.js"
import { withOptionalBearerAuth } from "./firebaseIdTokenClient.js"

const API_PATH = "/api/daily-bottom-buy"
const SNAPSHOT_PATH = "/data/daily-bottom-buy-snapshot.json"

/**
 * Apply FREE redaction when the caller is not PRO.
 * Static CDN snapshot is already summary-only; this remains defense in depth for API payloads.
 * @param {object} payload
 * @param {boolean} isPro
 */
export function applyDailyBottomBuyAccess(payload, isPro) {
  if (!payload || typeof payload !== "object") return payload
  if (isPro === true) {
    return payload?.access === "full" ? payload : { ...payload, access: payload.access || "full" }
  }
  if (payload.access === "summary" && !payloadHasProDetails(payload)) return payload
  return redactDailyBottomBuyPayload(payload)
}

/**
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchDailyBottomBuySnapshot({ signal } = {}) {
  const apiUrl = withNoStoreQuery(API_PATH)
  try {
    const headers = await withOptionalBearerAuth(LIVE_JSON_GET_INIT.headers)
    const res = await fetch(apiUrl, { ...LIVE_JSON_GET_INIT, headers, signal })
    if (res.ok) {
      const json = await res.json()
      if (json?.ok && Array.isArray(json.all)) {
        return { ...json, source: "api" }
      }
    }
  } catch {
    /* fall through to static snapshot */
  }

  const snapUrl = withNoStoreQuery(SNAPSHOT_PATH)
  const res2 = await fetch(snapUrl, { ...LIVE_JSON_GET_INIT, signal })
  if (!res2.ok) throw new Error(`daily-bottom-buy unavailable (HTTP ${res2.status})`)
  const json2 = await res2.json()
  // Static CDN snapshot is summary-only; force redact as defense in depth.
  return {
    ...redactDailyBottomBuyPayload({ ...json2, source: json2.source || "snapshot" }),
    source: "snapshot",
  }
}
