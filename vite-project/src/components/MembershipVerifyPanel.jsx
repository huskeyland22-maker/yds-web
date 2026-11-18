import { useMembership } from "../context/MembershipContext.jsx"
import {
  isMembershipVerifyUiEnabled,
  membershipVerifyDisplayModel,
} from "../content/ydsMembership.js"

/**
 * Compact Preview/local membership ledger readout for RC-1 verification.
 * Never renders tokens, Authorization headers, or Firebase UIDs.
 *
 * @param {{ compact?: boolean, className?: string }} [props]
 */
export default function MembershipVerifyPanel({ compact = false, className = "" }) {
  const enabled =
    typeof window !== "undefined" && isMembershipVerifyUiEnabled(window.location.hostname)
  const membership = useMembership()

  if (!enabled) return null

  const model = membershipVerifyDisplayModel({
    isLoggedOut: membership.isLoggedOut,
    isLoading: membership.isLoading,
    isError: membership.isError,
    plan: membership.plan,
    ledgerStatus: membership.ledgerStatus,
    source: membership.source,
    reason: membership.reason,
    audience: membership.audience,
  })

  const shell = compact
    ? "yds-membership-verify inline-flex w-full max-w-full flex-col gap-1 rounded-md border border-white/[0.1] bg-white/[0.03] px-2 py-1.5"
    : "yds-membership-verify rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2.5"

  return (
    <div className={`${shell} ${className}`.trim()} data-testid="membership-verify-panel">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-1.5">
        <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Membership
        </p>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
          {model.showOperatorBadge ? (
            <span
              className="yds-membership-operator-badge shrink-0"
              data-testid="membership-operator-badge"
            >
              OPERATOR
            </span>
          ) : null}
          {model.phase === "loading" ? (
            <span className="text-[10px] text-amber-200/90">Loading</span>
          ) : null}
          {model.phase === "error" ? (
            <span className="text-[10px] text-rose-300">오류</span>
          ) : null}
        </div>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px] leading-snug text-slate-300">
        <dt className="text-slate-500">plan</dt>
        <dd className="m-0 font-mono text-slate-100">{model.planLabel}</dd>
        <dt className="text-slate-500">status</dt>
        <dd className="m-0 font-mono text-slate-100">{model.statusLabel}</dd>
        <dt className="text-slate-500">source</dt>
        <dd className="m-0 truncate font-mono text-slate-100">{model.sourceLabel}</dd>
        <dt className="text-slate-500">reason</dt>
        <dd className="m-0 truncate font-mono text-slate-100">{model.reasonLabel}</dd>
      </dl>
      {model.showRefresh ? (
        <button
          type="button"
          onClick={() => membership.refresh()}
          className="mt-1.5 w-full rounded border border-white/[0.1] bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-slate-200 transition hover:bg-white/[0.08]"
        >
          재조회
        </button>
      ) : null}
    </div>
  )
}
