/**
 * DEV ONLY — raw / source / delta / method
 * @param {{ rows: import("../../macro-risk/devValidation.js").ReturnType<import("../../macro-risk/devValidation.js").buildDevValidation> }} props
 */
export default function MacroRiskDevValidationPanel({ rows }) {
  if (!rows?.length) return null

  return (
    <section className="rounded-md border border-amber-500/30 bg-amber-950/20 px-2.5 py-2 font-mono text-[9px] text-amber-100/90">
      <p className="m-0 mb-2 text-[10px] font-semibold text-amber-300">DEV · 데이터 검증</p>
      <div className="max-h-[14rem] space-y-2 overflow-y-auto">
        {rows.map((r) => (
          <div key={r.key} className="border-b border-amber-500/15 pb-1.5 last:border-0">
            <p className="m-0 font-semibold text-amber-200">{r.key}</p>
            <p className="m-0 text-amber-100/80">
              <span className="text-amber-400/90">raw</span> current={String(r.raw.current ?? "—")} · 1D=
              {String(r.raw.change1D ?? "—")} · 5D={String(r.raw.change5D ?? "—")} · 20D=
              {String(r.raw.change20D ?? "—")}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">source</span> {r.source}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">delta</span> {r.delta}
            </p>
            <p className="m-0">
              <span className="text-amber-400/90">method</span> {r.method}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
