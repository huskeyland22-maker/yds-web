export default function MarketSummaryCard({ brief, integrationFlowText = "히스토리 수집 중" }) {
  const safeBrief = brief ?? {}
  const safeSectors = safeBrief.sectors ?? { strong: [], weak: [] }
  const strongList = safeSectors.strong.slice(0, 2).map((s) => s.name).join(" · ") || "-"
  const weakList = safeSectors.weak.slice(0, 2).map((s) => s.name).join(" · ") || "-"
  const integration = safeBrief.integration ?? {
    sentimentScore: "-",
    stateFlow: "-",
    horizon: { short: "-", mid: "-", long: "-" },
  }

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-[#0f172a]/85 p-4 sm:p-6">
      <p className="text-xs font-semibold tracking-wide text-cyan-300">AI MARKET BRIEFING</p>
      <h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">오늘 시장 브리핑</h2>
      <p className="m-0 mt-1 text-base font-semibold text-gray-100">{safeBrief.headline ?? "-"}</p>
      {safeBrief.updateTimestampLine ? (
        <p className="m-0 mt-2 text-[11px] text-slate-500">{safeBrief.updateTimestampLine}</p>
      ) : null}
      {safeBrief.basisLine ? (
        <p className="m-0 mt-0.5 text-[11px] text-slate-500">{safeBrief.basisLine}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
        <span className="rounded-full bg-white/5 px-3 py-1 text-gray-200">
          시장 상태: <span style={{ color: safeBrief.stateColor ?? "#9ca3af" }} className="font-semibold">{safeBrief.state ?? "-"}</span>
        </span>
        <span className="rounded-full bg-white/5 px-3 py-1 text-gray-200">
          위험도: <span className="font-semibold text-amber-300">{safeBrief.risk ?? "-"}</span>
        </span>
        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-cyan-200 ring-1 ring-cyan-500/20">
          시장 심리 점수: <span className="font-semibold text-cyan-300">{integration.sentimentScore}</span>
        </span>
        <span className="rounded-full bg-white/5 px-3 py-1 text-gray-300">
          현재 상태: <span className="font-semibold text-gray-100">{integration.stateFlow}</span>
        </span>
        <span className="rounded-full bg-white/5 px-3 py-1 text-gray-300">
          단기: <span className="font-semibold text-gray-100">{integration.horizon.short}</span> · 중기:{" "}
          <span className="font-semibold text-gray-100">{integration.horizon.mid}</span> · 장기:{" "}
          <span className="font-semibold text-gray-100">{integration.horizon.long}</span>
        </span>
        <span className="rounded-full bg-white/5 px-3 py-1 text-gray-300">
          최근 흐름: <span className="font-semibold text-gray-100">{integrationFlowText}</span>
        </span>
      </div>
      <div className="mt-4 grid gap-1.5">
        {(safeBrief.briefingLines ?? []).map((line) => (
          <p key={line} className="m-0 text-sm text-gray-200">
            {line}
          </p>
        ))}
      </div>
      <div className="mt-4 grid gap-1 text-xs text-gray-300 sm:text-sm">
        <p className="m-0">
          유리한 섹터: <span className="font-semibold text-emerald-300">{strongList}</span>
        </p>
        <p className="m-0">
          주의 섹터: <span className="font-semibold text-rose-300">{weakList}</span>
        </p>
        <p className="m-0">
          단기 전략: <span className="font-semibold text-gray-100">{safeBrief.shortStrategy ?? "-"}</span>
        </p>
        <p className="m-0">
          중기 전략: <span className="font-semibold text-gray-100">{safeBrief.midStrategy ?? "-"}</span>
        </p>
      </div>
    </section>
  )
}
