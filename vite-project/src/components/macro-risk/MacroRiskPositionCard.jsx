import { useMemo } from "react"
import { getFinalScore } from "../../utils/tradingScores.js"

/**
 * @param {{ snapshot: import("../../macro-risk/engine.js").MacroRiskSnapshot; panicData?: object | null }} props
 */
export default function MacroRiskPositionCard({ snapshot, panicData = null }) {
  const cycleScore = useMemo(() => (panicData ? getFinalScore(panicData) : null), [panicData])
  const cyclePos = resolveCyclePosition(cycleScore)
  const macroPos = resolveMacroPosition(snapshot.score)
  const macroPast = Number(snapshot?.scoreBreakdown?.formula?.base)

  return (
    <section className="trading-card-shell px-3 py-2.5 sm:px-3.5 sm:py-3">
      <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-slate-500">MARKET POSITION</p>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        <PositionBlock
          title="Cycle"
          score={cycleScore}
          positionLabel={cyclePos.position}
          actionLabel={cyclePos.action}
          emoji={cyclePos.emoji}
          bar={buildPositionBar(cycleScore)}
          transitionLabel="공포 → 중립 전환선"
          transitionValue={30}
          pastLabel="과거 위치"
          pastValue={null}
        />
        <PositionBlock
          title="Macro"
          score={snapshot.score}
          positionLabel={macroPos.position}
          actionLabel={macroPos.action}
          emoji={macroPos.emoji}
          bar={buildPositionBar(snapshot.score)}
          transitionLabel="위험 → 쇼크 전환선"
          transitionValue={80}
          pastLabel="과거 위치(이벤트 제외)"
          pastValue={Number.isFinite(macroPast) ? macroPast : null}
        />
      </div>
    </section>
  )
}

function PositionBlock({ title, score, positionLabel, actionLabel, emoji, bar, transitionLabel, transitionValue, pastLabel, pastValue }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-2">
      <p className="m-0 text-[11px] font-semibold text-slate-200">
        {title} {score == null ? "—" : Math.round(score)}
      </p>
      <p className="m-0 mt-0.5 text-[10px] text-slate-300">
        {positionLabel} · {actionLabel} {emoji}
      </p>
      <p className="m-0 mt-1 font-mono text-[10px] text-slate-400">{bar}</p>
      <p className="m-0 mt-0.5 text-[10px] text-slate-500">
        {pastLabel}: {pastValue == null ? "데이터 없음" : Math.round(pastValue)}
      </p>
      <p className="m-0 text-[10px] text-slate-500">
        {transitionLabel}: {transitionValue}
      </p>
    </div>
  )
}

function resolveCyclePosition(score) {
  if (!Number.isFinite(Number(score))) return { position: "데이터 대기", action: "관망", emoji: "⚪" }
  const s = Number(score)
  if (s <= 15) return { position: "극단 공포", action: "인생타점", emoji: "🟢🟢🟢" }
  if (s <= 30) return { position: s >= 22 ? "공포 후반" : "공포", action: "분할매수 구간", emoji: "🟢" }
  if (s <= 45) return { position: "중립", action: "관망", emoji: "🟡" }
  if (s <= 60) return { position: "과열", action: "비중축소", emoji: "🟠" }
  return { position: "극단 과열", action: "방어", emoji: "🔴" }
}

function resolveMacroPosition(score) {
  if (!Number.isFinite(Number(score))) return { position: "데이터 대기", action: "관망", emoji: "⚪" }
  const s = Number(score)
  if (s <= 20) return { position: "유동성 우호", action: "위험자산 우호", emoji: "🟢" }
  if (s <= 40) return { position: "중립", action: "균형 대응", emoji: "🟡" }
  if (s <= 60) return { position: "압박 시작", action: "비중 점검", emoji: "🟠" }
  if (s <= 80) return { position: "위험", action: "보수 접근", emoji: "🔴" }
  return { position: "금리 재평가", action: "성장주 압박", emoji: "🔴🔴" }
}

function buildPositionBar(score) {
  if (!Number.isFinite(Number(score))) return "[🟢==========🔴]"
  const s = Math.min(100, Math.max(0, Number(score)))
  const slots = 12
  const idx = Math.min(slots - 1, Math.max(0, Math.round((s / 100) * (slots - 1))))
  let body = ""
  for (let i = 0; i < slots; i += 1) body += i === idx ? "●" : "="
  return `[🟢${body}🔴]`
}
