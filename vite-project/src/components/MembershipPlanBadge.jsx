import { membershipPlanBadgeLabel } from "../content/ydsMembership.js"
import { useMembership } from "../context/MembershipContext.jsx"

/**
 * Server-backed FREE/PRO badge for logged-in header chrome.
 * Hidden while membership is loading, logged out, or error.
 * @param {{ className?: string }} props
 */
export default function MembershipPlanBadge({ className = "" }) {
  const { status } = useMembership()
  const label = membershipPlanBadgeLabel(status)
  if (!label) return null

  const tone = label === "PRO" ? "pro" : "free"
  return (
    <span
      className={["yds-membership-plan-badge", `yds-membership-plan-badge--${tone}`, className]
        .filter(Boolean)
        .join(" ")}
      title={label === "PRO" ? "PRO 멤버십" : "FREE 멤버십"}
      data-plan={label.toLowerCase()}
    >
      {label}
    </span>
  )
}
