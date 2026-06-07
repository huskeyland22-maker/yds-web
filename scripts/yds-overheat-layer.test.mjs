/**
 * Overheat Layer smoke test — node scripts/yds-overheat-layer.test.mjs
 */
import {
  resolveOverheatCardView,
  resolveOverheatLayer,
} from "../vite-project/src/content/ydsOverheatLayer.js"
import { resolveMomentumLayer } from "../vite-project/src/content/ydsMomentumLayer.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const normal = resolveOverheatLayer({ fearGreed: 55, bofa: 5.8 })
assert(normal?.title === "보유 구간", normal?.title)
assert(normal?.cause === "과열 신호 없음", normal?.cause)
assert(normal?.action === "기존 포지션 유지", normal?.action)

const edge = resolveOverheatLayer({ fearGreed: 60, bofa: 6 })
assert(edge?.title === "보유 구간", `edge should be normal got ${edge?.title}`)

const prep = resolveOverheatLayer({ fearGreed: 65, bofa: 6.2 })
assert(prep?.title === "현금 준비", prep?.title)
assert(prep?.cause === "과열권 접근", prep?.cause)
assert(prep?.action === "신규 진입 축소", prep?.action)

const partial = resolveOverheatLayer({ fearGreed: 75, bofa: 7.3 })
assert(partial?.title === "차익실현 구간", partial?.title)
assert(partial?.action === "현금 확보 우선", partial?.action)

const boundary = resolveOverheatLayer({ fearGreed: 85, bofa: 8.5 })
assert(boundary?.title === "차익실현 구간", boundary?.title)
assert(boundary?.level === "critical", boundary?.level)

const unwindHistory = [
  { date: "2026-05-20", fearGreed: 72, bofa: 7.2 },
  { date: "2026-05-25", fearGreed: 68, bofa: 6.8 },
  { date: "2026-06-01", fearGreed: 58, bofa: 6.1 },
]
const unwindPanic = { date: "2026-06-05", fearGreed: 52, bofa: 5.9 }
const unwindMomentum = resolveMomentumLayer(unwindPanic, unwindHistory)
const unwindCard = resolveOverheatCardView(unwindPanic, unwindHistory, unwindMomentum)
assert(unwindCard?.title === "과열 해소 진행", `unwind title ${unwindCard?.title}`)
assert(unwindCard?.cause === "최근 과열권 이탈", unwindCard?.cause)
assert(unwindCard?.action === "추격 매수 금지", unwindCard?.action)

console.log("OK overheat layer", {
  normal: normal.title,
  prep: prep.title,
  partial: partial.title,
  boundary: boundary.title,
  unwind: unwindCard.title,
})
