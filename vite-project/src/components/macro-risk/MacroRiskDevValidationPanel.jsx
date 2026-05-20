import { DATA_BADGE_CLASS } from "../../macro-risk/metricSourceCatalog.js"

/**
 * DEV ONLY — `isDevMode() && isShowDebugPanel()` (SHOW_DEBUG / VITE_SHOW_DEBUG).
 * @param {{ data: import("../../macro-risk/devValidation.js").DevValidationPayload }} props
 */
export default function MacroRiskDevValidationPanel({ data }) {
  const rows = data?.rows
  if (!rows?.length) return null

  return (
    <section className="rounded-md border border-amber-500/30 bg-amber-950/20 px-2.5 py-2 font-mono text-[9px] text-amber-100/90">
      <p className="m-0 mb-2 text-[10px] font-semibold text-amber-300">
        DEV DATA · LIVE 검증 (SHOW_DEBUG)
      </p>
      {data.dataHealth ? (
        <div className="mb-2.5 rounded border border-amber-500/20 bg-black/15 px-2 py-1.5">
          <p className="m-0 text-[10px] font-bold text-amber-200">DATA HEALTH</p>
          <p className="m-0 mt-0.5 text-[9px]">
            <span className="text-amber-400/90">LIVE:</span> {data.dataHealth.live} / {data.dataHealth.total}
          </p>
          <p className="m-0 text-[9px]">
            <span className="text-amber-400/90">MOCK:</span> {data.dataHealth.mock + data.dataHealth.static} / {data.dataHealth.total}
          </p>
          <p className="m-0 text-[9px]">
            <span className="text-amber-400/90">ERROR:</span> {data.dataHealth.error}
          </p>
        </div>
      ) : null}

      {data.realBei ? (
        <div className="mb-2.5 border-b border-amber-500/15 pb-2.5">
          <p className="m-0 text-[10px] font-bold text-amber-200">REAL vs BEI</p>
          <p className="m-0 mt-0.5">
            <span className="text-amber-400/90">correlation:</span>{" "}
            {data.realBei.correlation == null ? "N/A" : String(data.realBei.correlation)}
          </p>
          <p className="m-0">
            <span className="text-amber-400/90">sameSource:</span> {data.realBei.sameSource ? "yes" : "no"}
          </p>
          <p className="m-0">
            <span className="text-amber-400/90">mockReuse:</span> {data.realBei.mockReuse ? "yes (의심)" : "no"}
          </p>
        </div>
      ) : null}

      {data.yieldSpread ? (
        <div className="mb-2.5 border-b border-amber-500/15 pb-2.5">
          <p className="m-0 text-[10px] font-bold text-amber-200">장단기 금리차</p>
          <p className="m-0 mt-0.5">
            <span className="text-amber-400/90">current:</span> {data.yieldSpread.currentLabel}
          </p>
          <p className="m-0">
            <span className="text-amber-400/90">raw:</span> {data.yieldSpread.rawParts}
          </p>
          <p className="m-0">
            <span className="text-amber-400/90">spread:</span>
            {data.yieldSpread.spread == null ? " —" : ` ${data.yieldSpread.spread}`}
          </p>
          <p className="m-0">
            <span className="text-amber-400/90">5D Δ:</span>{" "}
            {data.yieldSpread.delta5D == null ? "N/A" : data.yieldSpread.delta5D}{" "}
            <span className="text-amber-500/80">({data.yieldSpread.method5D})</span>
          </p>
          <p className="m-0">
            <span className="text-amber-400/90">20D Δ:</span>{" "}
            {data.yieldSpread.delta20D == null ? "N/A" : data.yieldSpread.delta20D}{" "}
            <span className="text-amber-500/80">({data.yieldSpread.method20D})</span>
          </p>
        </div>
      ) : null}

      <div className="max-h-[24rem] space-y-2.5 overflow-y-auto">
        {rows.map((r) => (
          <div key={`${r.key}-${r.label}`} className="border-b border-amber-500/15 pb-2 last:border-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="m-0 text-[11px] font-bold text-amber-200">{r.label}</p>
              <span
                className={[
                  "rounded px-1 py-px text-[8px] font-bold tracking-wide",
                  DATA_BADGE_CLASS[r.dataBadge] ?? DATA_BADGE_CLASS.MOCK,
                ].join(" ")}
              >
                {r.dataBadge}
              </span>
            </div>
            <p className="m-0 mt-1">
              <span className="text-amber-400/90">provider:</span> {r.provider}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">series:</span> {r.series}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">lastUpdate:</span> {r.lastUpdate ?? "—"}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">source:</span> {r.source}
              <span className="text-amber-500/70"> ({r.originDetail})</span>
            </p>
            {r.fallbackNote ? (
              <p className="m-0 text-[9px] font-semibold text-amber-300/95">{r.fallbackNote}</p>
            ) : null}
            {r.typeNote ? <p className="m-0 text-[9px] text-amber-500/90">{r.typeNote}</p> : null}
            <p className="m-0">
              <span className="text-amber-400/90">normalize:</span> {r.normalizeType} / {r.normalizeMethod}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">current=</span>
              {String(r.current ?? r.raw ?? "—")}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">prev1D=</span>
              {String(r.previous1D ?? "—")}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">prev5D=</span>
              {String(r.previous5D ?? "—")}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">prev20D=</span>
              {String(r.previous20D ?? "—")}
            </p>
            {r.delta20DLine ? (
              <p className="m-0">
                <span className="text-amber-400/90">{r.delta20DLine}</span>
              </p>
            ) : null}
            <p className="m-0">
              <span className="text-amber-400/90">delta:</span> {r.deltaSummary}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">method:</span> {r.method20D}
            </p>
            {r.warning ? <p className="m-0 mt-0.5 text-rose-300/90">⚠ {r.warning}</p> : null}
          </div>
        ))}
      </div>
    </section>
  )
}
