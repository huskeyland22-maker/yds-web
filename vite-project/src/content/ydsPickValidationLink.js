/**
 * 추천 종목 카드 — 성과검증 연동 (7·14·30일)
 */

import { loadValidationPicks } from "./ydsValidationStorage.js"
import {
  classifyPickOutcome,
  resolvePickOutcomeView,
} from "./ydsPickOutcomeEngine.js"

/**
 * @param {string} ticker
 * @param {string} [country]
 */
export function findValidationPickByTicker(ticker, country = "US") {
  const sym = String(ticker ?? "").toUpperCase()
  const picks = loadValidationPicks()
  const matches = picks.filter(
    (p) =>
      String(p.ticker ?? "").toUpperCase() === sym &&
      (country === "KR" ? p.country === "KR" : p.country !== "KR"),
  )
  matches.sort((a, b) => String(b.recommendedAt).localeCompare(String(a.recommendedAt)))
  return matches[0] ?? null
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord | null | undefined} record
 */
export function buildPickValidationPerfView(record) {
  if (!record) return null

  const horizons = [
    { key: "d7", label: "7일" },
    { key: "d14", label: "14일" },
    { key: "d30", label: "30일" },
  ]

  const rows = horizons.map(({ key, label }) => {
    const ret = record.horizons?.[key]
    const outcome = resolvePickOutcomeView(ret)
    return {
      key,
      label,
      returnPct: ret != null && Number.isFinite(ret) ? ret : null,
      outcomeId: classifyPickOutcome(ret),
      outcome,
    }
  })

  const snap = record.recommendSnapshot
  return {
    visible: true,
    recommendedAt: record.recommendedAt,
    recommendedPrice: record.recommendedPrice ?? snap?.recommendedPrice ?? null,
    marketStateLabel: snap?.unifiedMarketStateLabel ?? snap?.marketStateLabel ?? record.strategyLabel,
    panicScore: snap?.panicIntensity ?? null,
    rows,
    hasAnyReturn: rows.some((r) => r.returnPct != null),
  }
}
