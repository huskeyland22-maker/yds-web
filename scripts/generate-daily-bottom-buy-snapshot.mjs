#!/usr/bin/env node
/**
 * Build static fallback snapshot for Daily Bottom Buy UI.
 * Uses scripts/.cache/dbb-*-daily-ohlcv.json when present.
 *
 *   node scripts/generate-daily-bottom-buy-snapshot.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  DAILY_BOTTOM_BUY_ETFS,
  DAILY_BOTTOM_THRESHOLDS,
  SPLIT_BUY_GUIDE,
  evaluateBars,
  buildEtfCard,
  sortCardsByOpportunity,
} from "../api/_lib/dailyBottomBuyEngine.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const OUT = path.join(ROOT, "vite-project", "public", "data", "daily-bottom-buy-snapshot.json")

const cards = []
for (const meta of DAILY_BOTTOM_BUY_ETFS) {
  const cp = path.join(CACHE, `dbb-${meta.symbol.toLowerCase()}-daily-ohlcv.json`)
  if (!fs.existsSync(cp)) {
    cards.push(buildEtfCard(meta, { ok: false, error: "cache_missing" }))
    continue
  }
  const bars = JSON.parse(fs.readFileSync(cp, "utf8")).bars
  cards.push(buildEtfCard(meta, evaluateBars(bars, DAILY_BOTTOM_THRESHOLDS)))
}

const sorted = sortCardsByOpportunity(cards)
const payload = {
  ok: true,
  system: "daily_bottom_buy_v1",
  separateFromPanic: true,
  source: "snapshot",
  updatedAt: new Date().toISOString(),
  thresholds: DAILY_BOTTOM_THRESHOLDS,
  splitBuy: SPLIT_BUY_GUIDE,
  disclaimer: [
    "일상적인 조정 구간에서 분할매수를 검토하기 위한 보조 신호입니다.",
    "3개 충족 = 1차 매수 후보",
    "4개 충족 = 추가 매수 후보",
    "신호 발생 후에도 추가 하락할 수 있습니다.",
    "대형 시장 패닉은 Panic Index를 참고합니다.",
  ],
  counts: {
    opportunity: sorted.filter((c) => c.ok && c.count >= 3).length,
    watch: sorted.filter((c) => c.ok && c.count === 2).length,
    wait: sorted.filter((c) => !c.ok || c.count <= 1).length,
  },
  opportunities: sorted.filter((c) => c.ok && c.count >= 3),
  watch: sorted.filter((c) => c.ok && c.count === 2),
  waiting: sorted.filter((c) => !c.ok || c.count <= 1),
  all: sorted,
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8")
console.log(`Wrote ${OUT} (opp=${payload.counts.opportunity})`)
