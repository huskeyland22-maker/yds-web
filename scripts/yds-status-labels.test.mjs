/**
 * Status labels smoke test — node scripts/yds-status-labels.test.mjs
 */
import { resolveCycleStatusLabel, resolvePanicStatusLabel, resolveMarketHeadline, resolveMomentumPositionLabel } from "../vite-project/src/content/ydsStatusLabels.js"
import { resolveMomentumLayer } from "../vite-project/src/content/ydsMomentumLayer.js"
import { resolveMomentumStatusLabel } from "../vite-project/src/content/ydsStatusLabels.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const cycle68 = resolveCycleStatusLabel(32)
assert(cycle68?.score === 68 && cycle68.label === "사이클 후반", `cycle68 ${cycle68?.label}`)
assert(cycle68.emoji === "🟠", cycle68.emoji)

const cycle85 = resolveCycleStatusLabel(15)
assert(cycle85?.score === 85 && cycle85.label === "최고 과열", `cycle85 ${cycle85?.label}`)
assert(cycle85.emoji === "🔴", cycle85.emoji)

const panic38 = resolvePanicStatusLabel(38)
assert(panic38?.label === "공포 부족", panic38?.label)

const history = [
  { date: "2026-06-01", fearGreed: 58, bofa: 6.2 },
  { date: "2026-06-03", fearGreed: 50, bofa: 6.1 },
]
const mom = resolveMomentumLayer({ date: "2026-06-05", fearGreed: 42, bofa: 6.0 }, history)
const momStatus = resolveMomentumStatusLabel(mom)
assert(momStatus.label === "투자심리 급랭" || momStatus.label === "투자심리 둔화", momStatus.label)

const momPosition = resolveMomentumPositionLabel(mom)
assert(
  momPosition.title === "단기 악재 포지션" || momPosition.title === "단기 위험 확대",
  momPosition.title,
)

const headline68 = resolveMarketHeadline(cycle68.id, panic38.id)
assert(headline68?.text === "사이클 후반 · 매수기회 부족", headline68?.text)

const cycleOver = resolveCycleStatusLabel(10)
const panicNone = resolvePanicStatusLabel(10)
const headlineOver = resolveMarketHeadline(cycleOver.id, panicNone.id)
assert(headlineOver?.text === "최고 과열 · 현금 확보", headlineOver?.text)

const cycleNeutral = resolveCycleStatusLabel(50)
const panicInterest = resolvePanicStatusLabel(50)
assert(resolveMarketHeadline(cycleNeutral.id, panicInterest.id)?.text === "성장·조정 관찰 · 준비")

const cycleRecovery = resolveCycleStatusLabel(70)
const panicDca = resolvePanicStatusLabel(70)
assert(resolveMarketHeadline(cycleRecovery.id, panicDca.id)?.text === "회복·공포 확대 · 분할매수")

const cycleDep = resolveCycleStatusLabel(95)
const panicLife = resolvePanicStatusLabel(95)
assert(resolveMarketHeadline(cycleDep.id, panicLife.id)?.text === "역사적 침체 · 극단 매수")

console.log("OK status labels", {
  cycle: cycle68.label,
  cycle85: cycle85.label,
  panic: panic38.label,
  momentum: momStatus.label,
  headline: headline68.text,
})
