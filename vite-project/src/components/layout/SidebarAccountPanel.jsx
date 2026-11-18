import { LogIn } from "lucide-react"
import { membershipVerifyDisplayModel } from "../../content/ydsMembership.js"
import { useMembership } from "../../context/MembershipContext.jsx"

/**
 * Minimal sidebar/drawer account strip.
 * Membership ledger/refresh live in Account Settings (MembershipVerifyPanel).
 *
 * @param {{
 *   user: object | null
 *   onLogin: () => void
 *   onLogout: () => void
 *   onNavigate?: () => void
 * }} props
 */
export default function SidebarAccountPanel({
  user,
  onLogin,
  onLogout,
  onNavigate,
}) {
  const membership = useMembership()

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

  const planChip =
    model.phase === "ready" && (model.planLabel === "PRO" || model.planLabel === "FREE")
      ? model.planLabel
      : membership.status === "pro"
        ? "PRO"
        : membership.status === "free"
          ? "FREE"
          : null

  const run = (fn) => {
    onNavigate?.()
    fn?.()
  }

  return (
    <div className="yds-sidebar-account" data-testid="sidebar-account-panel">
      <div className="yds-sidebar-account__card">
        <div className="yds-sidebar-account__user-row">
          {user ? (
            <img
              src={user.photoURL || "https://placehold.co/72x72/0f172a/e2e8f0?text=U"}
              alt=""
              className="yds-sidebar-account__avatar"
            />
          ) : (
            <span className="yds-sidebar-account__avatar yds-sidebar-account__avatar--guest" aria-hidden>
              G
            </span>
          )}
          <div className="yds-sidebar-account__user-meta">
            <p className="yds-sidebar-account__name">
              {user ? user.displayName || user.email || "로그인 유저" : "게스트"}
            </p>
            <div className="yds-sidebar-account__badges">
              {model.showOperatorBadge ? (
                <span
                  className="yds-membership-operator-badge"
                  data-testid="membership-operator-badge"
                >
                  OPERATOR
                </span>
              ) : null}
              {planChip ? (
                <span className="yds-sidebar-account__plan" data-testid="sidebar-account-plan">
                  {planChip}
                </span>
              ) : null}
              {model.phase === "loading" ? (
                <span className="yds-sidebar-account__phase">Loading</span>
              ) : null}
              {model.phase === "error" ? (
                <span className="yds-sidebar-account__phase yds-sidebar-account__phase--error">
                  오류
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="yds-sidebar-account__actions">
          {user ? (
            <button
              type="button"
              className="yds-sidebar-account__logout"
              onClick={() => run(onLogout)}
            >
              로그아웃
            </button>
          ) : (
            <button
              type="button"
              className="yds-sidebar-account__login"
              onClick={() => run(onLogin)}
            >
              <LogIn size={13} aria-hidden />
              로그인
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
