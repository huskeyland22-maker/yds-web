/**
 * 81–82 — CORE staging/local bridge (Board snapshot + optional core-latest API).
 * Does not mutate CCI license-safe bridge.
 */

import { adaptCoreRiskSnapshot, loadCoreRiskUiModel } from "./coreRiskBridge.js"

const CORE_API = "/api/credit-cycle-core?mode=core-latest"
const MONITOR_HINTS_URL = "/credit-cycle/core-history/index.json"

/**
 * Prefer API core-latest when available; fall back to public snapshot.
 */
export async function loadCoreRiskProductModel() {
  try {
    const res = await fetch(CORE_API, { cache: "no-store" })
    if (res.ok) {
      const json = await res.json()
      if (json?.ok && json.core_risk) {
        const adapted = adaptCoreRiskSnapshot({
          feed_status: json.feed_status,
          core_risk: json.core_risk,
          research_reference_only: json.research_reference_only,
        })
        return {
          ...adapted,
          transport: "api_core_latest",
          published: Boolean(json.published),
          refresh: buildRefreshMeta(adapted.core_risk, json),
        }
      }
    }
  } catch {
    /* fall through to public snapshot */
  }

  const local = await loadCoreRiskUiModel()
  return {
    ...local,
    transport: "public_snapshot",
    published: local.loadStatus === "VERIFIED_PRODUCT_FEED",
    refresh: buildRefreshMeta(local.core_risk, null),
  }
}

function buildRefreshMeta(cr, apiJson) {
  return {
    last_success_collection: cr?.retrieval_date || apiJson?.retrieval_date || null,
    latest_observation: cr?.as_of || apiJson?.as_of || null,
    observation_vs_retrieval_note:
      cr?.as_of && cr?.retrieval_date
        ? `observation=${cr.as_of} retrieval=${cr.retrieval_date} (do not confuse)`
        : null,
    pit_class: cr?.pit_class || "NON_STRICT_PIT",
    score_computable: cr?.R_core != null && cr?.feed_status === "VERIFIED_PRODUCT_FEED",
    feed_status: cr?.feed_status || "UNKNOWN",
  }
}

export async function loadCoreHistoryIndex() {
  try {
    const res = await fetch(MONITOR_HINTS_URL, { cache: "no-store" })
    if (!res.ok) return { entries: [], error: `http_${res.status}` }
    return await res.json()
  } catch (e) {
    return { entries: [], error: e?.message || "fetch_failed" }
  }
}
