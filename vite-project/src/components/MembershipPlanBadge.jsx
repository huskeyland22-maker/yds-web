import { membershipHeaderBadgeState } from "../content/ydsMembership.js"
import { useMembership } from "../context/MembershipContext.jsx"

/**
 * Server-backed FREE/PRO badge for header chrome.
 * Logged-out: hidden. Loading: pending placeholder. Lookup error: FREE (display only).
 * @param {{ className?: string }} props
 */
export default function MembershipPlanBadge({ className = "" }) {
  const { status } = useMembership()
  const state = membershipHeaderBadgeState(status)
  if (state.kind === "hidden" || !state.label) return null

  const tone = state.kind === "pro" ? "pro" : state.kind === "pending" ? "pending" : "free"
  return (
    <span
      className={["yds-membership-plan-badge", `yds-membership-plan-badge--${tone}`, className]
        .filter(Boolean)
        .join(" ")}
      title={
        state.kind === "pro"
          ? "PRO 멤버십"
          : state.kind === "pending"
            ? "회원 등급 확인 중"
            : "FREE 멤버십"
      }
      data-plan={state.kind === "pending" ? "pending" : state.label.toLowerCase()}
      aria-busy={state.kind === "pending" ? "true" : undefined}
    >
      {state.label}
    </span>
  )
}
