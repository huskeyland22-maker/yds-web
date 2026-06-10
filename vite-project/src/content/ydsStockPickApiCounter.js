/**
 * 종목추천 관련 HTTP API 호출 카운트 (최초 진입 진단)
 */

/** @type {{ label: string; url: string; at: number; callsite?: string }[]} */
const calls = []

/** @type {Record<string, number>} */
const byCallsite = {}

/**
 * @param {string} url
 * @param {string} [label]
 * @param {string} [callsite]
 */
export function trackStockPickApi(url, label, callsite) {
  calls.push({
    label: label ?? url,
    url,
    at: Date.now(),
    callsite: callsite ?? undefined,
  })
  if (callsite) {
    byCallsite[callsite] = (byCallsite[callsite] ?? 0) + 1
  }
  console.log("[API_COUNT]", calls.length, label ?? url, callsite ? { callsite } : "")
}

export function getStockPickApiCount() {
  return calls.length
}

export function getStockPickApiCalls() {
  return [...calls]
}

export function getStockPickApiByCallsite() {
  return { ...byCallsite }
}

export function resetStockPickApiCounter() {
  calls.length = 0
  for (const key of Object.keys(byCallsite)) delete byCallsite[key]
}

export function logStockPickApiDuplicateAudit() {
  const dupes = Object.entries(byCallsite).filter(([, n]) => n > 1)
  if (dupes.length) {
    console.warn("[stock-pick-fetch] duplicate callsite audit", Object.fromEntries(dupes), calls)
  } else {
    console.log("[stock-pick-fetch] callsite audit OK (no duplicate labels)", byCallsite)
  }
}
