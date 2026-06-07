/**
 * Overheat Layer smoke test — node scripts/yds-overheat-layer.test.mjs
 */
import { resolveOverheatLayer } from "../vite-project/src/content/ydsOverheatLayer.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const normal = resolveOverheatLayer({ fearGreed: 55, bofa: 5.8 })
assert(normal?.label === "정상", normal?.label)

const edge = resolveOverheatLayer({ fearGreed: 60, bofa: 6 })
assert(edge?.label === "정상", `edge should be normal got ${edge?.label}`)

const prep = resolveOverheatLayer({ fearGreed: 65, bofa: 6.2 })
assert(prep?.label === "현금 준비", prep?.label)
assert(prep?.summary === "과열권 접근 중", prep?.summary)
assert(prep?.action === "추격매수 금지", prep?.action)

const partial = resolveOverheatLayer({ fearGreed: 75, bofa: 7.3 })
assert(partial?.label === "일부 현금 확보", partial?.label)

const boundary = resolveOverheatLayer({ fearGreed: 85, bofa: 8.5 })
assert(boundary?.label === "과열 경계", boundary?.label)
assert(boundary?.level === "critical", boundary?.level)

console.log("OK overheat layer", {
  normal: normal.label,
  prep: prep.label,
  partial: partial.label,
  boundary: boundary.label,
})
