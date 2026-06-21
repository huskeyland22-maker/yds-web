/**
 * 포트폴리오 로드 시 [portfolio] 콘솔 진단
 */

import { replayPortfolioFromTrades } from "./ydsPortfolioV5Engine.js"
import {
  pickRichestHoldingsKey,
  PORTFOLIO_CANONICAL_KEYS,
  PORTFOLIO_TRADES_KEY,
  scanLocalPortfolioKeys,
} from "./ydsPortfolioKeyRegistry.js"

/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */

/**
 * @typedef {{
 *   sourceKey: string
 *   migratedFrom: string | null
 *   trades: PortfolioTrade[]
 * }} PortfolioLoadResult
 */

/**
 * @param {PortfolioTrade[]} trades
 * @param {PortfolioLoadResult} [loadMeta]
 * @param {{ loggedIn?: boolean, syncMode?: string }} [opts]
 */
export function logPortfolioLoad(trades, loadMeta, opts = {}) {
  const snapshots = scanLocalPortfolioKeys()
  const { lots } = replayPortfolioFromTrades(trades ?? [])
  const holdingCount = lots.filter((l) => l.quantity > 0).length
  const sourceKey = loadMeta?.sourceKey ?? PORTFOLIO_TRADES_KEY
  const loggedIn = Boolean(opts.loggedIn)

  console.info(
    `[portfolio] key=${sourceKey} trades=${trades?.length ?? 0} holdings=${holdingCount}`,
  )

  for (const snap of snapshots) {
    console.info(`[portfolio] storage key=${snap.key} count=${snap.count ?? "?"} bytes=${snap.bytes}`)
  }

  const richest = pickRichestHoldingsKey(snapshots)
  if (richest && richest !== PORTFOLIO_TRADES_KEY && (trades?.length ?? 0) === 0) {
    console.warn(`[portfolio] legacy data on THIS device: key=${richest} — migration attempted`)
  }

  if (loadMeta?.migratedFrom) {
    console.info(`[portfolio] migrated from key=${loadMeta.migratedFrom} → ${PORTFOLIO_TRADES_KEY}`)
  }

  console.info("[portfolio] canonical keys (same on mobile & PC):", PORTFOLIO_CANONICAL_KEYS.join(", "))

  if (!loggedIn && holdingCount === 0 && richest && richest !== sourceKey) {
    console.warn(
      "[portfolio] PC has no holdings; mobile data stays on mobile localStorage until login sync or re-register.",
    )
  } else if (!loggedIn && holdingCount === 0 && !richest) {
    console.warn(
      "[portfolio] no holdings on this device. Keys match mobile but storage is per-device; log in to sync.",
    )
  }
}
