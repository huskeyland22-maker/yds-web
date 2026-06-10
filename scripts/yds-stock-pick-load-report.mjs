/**
 * 종목추천 실데이터 로드 리포트 — node scripts/yds-stock-pick-load-report.mjs
 * (오프라인: fallback 기준 통계 · API 키 없으면 live 0건)
 */
import { buildStockPickViews } from "../vite-project/src/content/ydsStockPickModel.js"
import { computeStockPickLoadStats } from "../vite-project/src/content/ydsStockPickLoadStats.js"

const views = buildStockPickViews()
const stats = computeStockPickLoadStats(views)

console.log("=== 종목추천 실데이터 리포트 ===")
console.log(`실데이터 성공: ${stats.totalLive}건`)
console.log(`실패/누락: ${stats.totalMissing}건`)
console.log(`fallback 잔존: ${stats.fallbackCount}건 (UI 노출 0건 목표)`)
console.log(`미국: ${stats.live.US} / ${stats.totals.US}`)
console.log(`한국: ${stats.live.KR} / ${stats.totals.KR}`)
if (stats.missingTickers.length) {
  console.log("누락 종목 (최대 10건):")
  for (const row of stats.missingTickers.slice(0, 10)) {
    console.log(`  - ${row.name} (${row.ticker}) [${row.country}]`)
  }
  if (stats.missingTickers.length > 10) {
    console.log(`  … 외 ${stats.missingTickers.length - 10}건`)
  }
}
