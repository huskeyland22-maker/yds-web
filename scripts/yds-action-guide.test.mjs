/**
 * Action guide smoke test — node scripts/yds-action-guide.test.mjs
 */
import { resolveTodayActions } from "../vite-project/src/content/ydsActionGuide.js"
import { resolveMomentumLayer } from "../vite-project/src/content/ydsMomentumLayer.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const neutral38 = resolveTodayActions(38)
assert(neutral38?.band.label === "중립", neutral38?.band.label)
assert(neutral38.actions.includes("추격매수 금지"), neutral38.actions.join("|"))
assert(neutral38.actions.some((a) => a.includes("현금 40%")), neutral38.actions.join("|"))
assert(neutral38.actions.includes("관심종목 관찰"), neutral38.actions.join("|"))

const overheat10 = resolveTodayActions(10)
assert(overheat10?.band.label === "과열", overheat10?.band.label)
assert(overheat10.actions.includes("신규 진입 축소"), overheat10.actions.join("|"))

const interest50 = resolveTodayActions(50)
assert(interest50?.band.label === "관심", interest50?.band.label)
assert(interest50.actions.includes("분할 진입 준비"), interest50.actions.join("|"))

const dca70 = resolveTodayActions(70)
assert(dca70?.band.label === "분할매수", dca70?.band.label)
assert(dca70.actions.includes("1차 매수"), dca70.actions.join("|"))

const life95 = resolveTodayActions(95)
assert(life95?.band.label === "인생 타점", life95?.band.label)
assert(life95.actions.includes("역사적 매수 기회") === false, "should use action list not headline")
assert(life95.actions.includes("공격적 분할매수"), life95.actions.join("|"))

const history = [
  { date: "2026-06-01", fearGreed: 58, bofa: 6.2 },
  { date: "2026-06-03", fearGreed: 50, bofa: 6.1 },
]
const mom = resolveMomentumLayer({ date: "2026-06-05", fearGreed: 42, bofa: 6.0 }, history)
const withMom = resolveTodayActions(38, mom)
assert(withMom.momentumHint != null, "momentum hint expected")

console.log("OK action guide", {
  band: neutral38.band.label,
  actions: neutral38.actions,
  momentumHint: withMom.momentumHint,
})
