import { useCallback, useEffect, useState } from "react"
import { isPanicHubEnabled } from "../../config/api.js"
import { isDevMode } from "../../utils/devMode.js"
import { LIVE_JSON_GET_INIT, withNoStoreQuery } from "../../config/liveDataFetch.js"

function CheckRow({ label, ok, detail }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-white/[0.04] py-1 last:border-0">
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className={`max-w-[58%] text-right font-mono text-[10px] ${ok ? "text-emerald-300" : "text-rose-300"}`}>
        {detail}
      </span>
    </div>
  )
}

/**
 * 설정 > 개발자 — 패닉 히스토리 누적 검증 (/api/supabase/health?panic_verify=1)
 */
export default function PanicHistoryVerifyPanel() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)

  const runVerify = useCallback(async () => {
    if (!isPanicHubEnabled()) {
      setError("PANIC HUB 비활성 — .env 확인")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(withNoStoreQuery("/api/supabase/health?panic_verify=1"), LIVE_JSON_GET_INIT)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      setReport(json)
    } catch (e) {
      setReport(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (open && !report && !busy && !error) void runVerify()
  }, [open, report, busy, error, runVerify])

  const c = report?.checks ?? {}

  if (!isDevMode()) return null

  return (
    <div className="mt-2 border-t border-white/[0.06] pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[12px] font-medium text-slate-400 hover:bg-white/[0.04]"
      >
        <span>히스토리 검증</span>
        <span className="text-[10px] text-slate-600">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="mx-1 mb-1 rounded-md border border-white/[0.06] bg-black/25 px-2.5 py-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runVerify()}
            className="mb-2 w-full rounded border border-cyan-500/30 bg-cyan-500/10 py-1.5 text-[11px] text-cyan-100 disabled:opacity-50"
          >
            {busy ? "검증 중…" : "DB 누적 검증 실행"}
          </button>
          {error ? <p className="m-0 text-[10px] text-rose-300">{error}</p> : null}
          {report ? (
            <>
              <p className={`m-0 mb-2 text-[11px] font-semibold ${report.pass ? "text-emerald-300" : "text-amber-300"}`}>
                {report.pass ? "PASS" : "CHECK 필요"}
              </p>
              <CheckRow
                label="히스토리 샘플"
                ok={c.historySample?.ok}
                detail={`${c.historySample?.rows ?? 0}행 · 최신 ${c.historySample?.newest ?? "—"}`}
              />
              <CheckRow
                label="날짜 중복"
                ok={c.noDuplicateDates?.ok}
                detail={c.noDuplicateDates?.ok ? "0건" : `${c.noDuplicateDates?.duplicateCount ?? "?"}건`}
              />
              <CheckRow
                label="latest = history"
                ok={c.latestMatchesHistoryTop?.ok}
                detail={c.latestMatchesHistoryTop?.reason ?? "—"}
              />
              <CheckRow
                label="market_cycle"
                ok={c.marketCycleHistory?.ok}
                detail={`${c.marketCycleHistory?.rows ?? 0}행`}
              />
              <CheckRow
                label="누적 COUNT"
                ok={c.totalHistoryCount?.ok}
                detail={`${c.totalHistoryCount?.count ?? "—"} / unique ${c.totalHistoryCount?.uniqueDates ?? "—"}`}
              />
              <p className="m-0 mt-2 text-[9px] text-slate-600">
                SQL: supabase/sql/verify_panic_history.sql
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
