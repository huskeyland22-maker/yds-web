import { useEffect, useState } from "react"
import {
  shouldShowAuthDebugPanel,
  YDS_AUTH_DIAG_WINDOW_KEY,
} from "../content/ydsAuthDiagnostics.js"

/**
 * Preview auth diagnostic overlay — no email/tokens/cookies.
 * @param {{ snapshot: import("../content/ydsAuthDiagnostics.js").YdsAuthDiagSnapshot | null }} props
 */
export default function AuthDebugPanel({ snapshot }) {
  const [visible, setVisible] = useState(() => shouldShowAuthDebugPanel())
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const id = window.setInterval(() => setVisible(shouldShowAuthDebugPanel()), 3000)
    return () => window.clearInterval(id)
  }, [])

  if (!visible || !snapshot) return null

  const rows = [
    ["flowStage", snapshot.flowStage ?? "idle"],
    ["flowStageLabel", snapshot.flowStageLabel ?? "로그인 버튼 클릭 전"],
    ["loginButtonClicked", String(snapshot.loginButtonClicked)],
    ["signInMethod", snapshot.signInMethod ?? "(none)"],
    ["signInCallStarted", String(snapshot.signInCallStarted)],
    ["signInCallCompleted", String(snapshot.signInCallCompleted)],
    ["redirectStarted", String(snapshot.redirectStarted)],
    ["redirectResultChecked", String(snapshot.redirectResultChecked)],
    ["redirectResultPresent", String(snapshot.redirectResultPresent)],
    ["redirectResultHasUser", String(snapshot.redirectResultHasUser)],
    ["redirectErrorCode", snapshot.redirectErrorCode ?? "(none)"],
    ["signInErrorCode", snapshot.signInErrorCode ?? "(none)"],
    ["pendingRedirectKeyPresent", String(snapshot.pendingRedirectKeyPresent)],
    ["pendingRedirectBeforeSettle", String(snapshot.pendingRedirectBeforeSettle)],
    ["pendingRedirectAfterSettle", String(snapshot.pendingRedirectAfterSettle)],
    ["authHandoffMode", snapshot.authHandoffMode ?? "(unknown)"],
    ["currentUserPresent", String(snapshot.currentUserPresent)],
    ["onAuthStateChangedHasUser", String(snapshot.onAuthStateChangedHasUser)],
    ["authInitialized", String(snapshot.authInitialized)],
    ["authBootReady", String(snapshot.authBootReady)],
    ["authLoading", String(snapshot.authLoading)],
    ["redirectSettling", String(snapshot.redirectSettling)],
    ["authDomain", snapshot.authDomain ?? "(unknown)"],
    ["handlerRedirectUri", snapshot.handlerRedirectUri ?? "(unknown)"],
    ["pageHostname", snapshot.pageHostname ?? "(unknown)"],
    ["membershipStatus", snapshot.membershipStatus ?? "(n/a)"],
    ["lastUpdatedAt", snapshot.lastUpdatedAt ?? "(n/a)"],
  ]

  return (
    <aside
      className="fixed bottom-2 left-2 z-[9998] max-w-[min(100vw-1rem,22rem)] rounded-md border border-amber-500/40 bg-slate-950/95 text-[10px] text-amber-50 shadow-lg backdrop-blur-sm"
      data-yds-auth-debug="1"
      aria-label="YDS auth diagnostics"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left font-semibold tracking-wide text-amber-200"
        onClick={() => setOpen((v) => !v)}
      >
        <span>AUTH DIAG</span>
        <span className="font-mono text-[9px] text-amber-200/70">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="max-h-[42vh] overflow-auto border-t border-amber-500/25 px-2.5 py-2">
          <p className="m-0 mb-1.5 text-[9px] leading-snug text-amber-100/70">
            No email / tokens. Console: window.{YDS_AUTH_DIAG_WINDOW_KEY}
          </p>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-amber-200/80">{k}</dt>
                <dd className="m-0 break-all font-mono text-slate-100">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </aside>
  )
}
