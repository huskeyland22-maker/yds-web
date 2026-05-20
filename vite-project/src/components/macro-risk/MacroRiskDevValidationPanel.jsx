/**
 * DEV ONLY
 * @param {{ rows: import("../../macro-risk/devValidation.js").ReturnType<import("../../macro-risk/devValidation.js").buildDevValidation> }} props
 */
export default function MacroRiskDevValidationPanel({ rows }) {
  if (!rows?.length) return null

  return (
    <section className="rounded-md border border-amber-500/30 bg-amber-950/20 px-2.5 py-2 font-mono text-[9px] text-amber-100/90">
      <p className="m-0 mb-2 text-[10px] font-semibold text-amber-300">DEV · 데이터 검증</p>
      <div className="max-h-[18rem] space-y-2.5 overflow-y-auto">
        {rows.map((r) => (
          <div key={r.key} className="border-b border-amber-500/15 pb-2 last:border-0">
            <p className="m-0 text-[11px] font-bold text-amber-200">{r.key}</p>
            <p className="m-0">
              <span className="text-amber-400/90">source:</span>
              {r.source}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">raw:</span> current={String(r.raw ?? "—")}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">previous1D:</span>
              {String(r.previous1D ?? "—")}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">previous5D:</span>
              {String(r.previous5D ?? "—")}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">previous20D:</span>
              {String(r.previous20D ?? "—")}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">delta:</span> {r.delta}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">method:</span> {r.method}
            </p>
            {r.warning ? <p className="m-0 mt-0.5 text-rose-300/90">⚠ {r.warning}</p> : null}
          </div>
        ))}
      </div>
    </section>
  )
}
