/**
 * Market position + panic action smoke test
 */
import { resolveMarketPosition, resolveMarketPositionView } from "../vite-project/src/content/ydsMarketPositionEngine.js"
import { resolvePanicActionView } from "../vite-project/src/content/ydsPanicActionView.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const adj = resolveMarketPosition({ fearGreed: 27, vix: 22, bofa: 5.9 })
assert(adj?.id === "adjustment", `expected adjustment got ${adj?.id}`)
assert(adj?.label === "조정", adj?.label)

const view = resolveMarketPositionView({ fearGreed: 27, vix: 22.2, bofa: 5.9 })
assert(view?.nav.next?.id === "fear", `next should be fear got ${view?.nav.next?.id}`)
assert(view?.position.label === "조정", view?.position.label)
assert(view?.rail.find((s) => s.active)?.label === "조정", "active rail")
assert(Number.isFinite(view?.score), "market score required")

const panic = resolvePanicActionView(40)
assert(panic?.score === 40, panic?.score)
assert(panic?.currentLine.includes("관심"), panic?.currentLine)
assert(panic?.nextLine?.includes("분할매수"), panic?.nextLine)
assert(panic?.nextLine?.includes("(+20)"), panic?.nextLine)

console.log("OK market position", {
  position: `${adj.emoji} ${adj.label}`,
  next: view.nav.nextLine,
  panic: panic.currentLine,
  panicNext: panic.nextLine,
})
