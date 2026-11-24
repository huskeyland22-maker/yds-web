import CreditCycleDashboard from "../components/credit-cycle/CreditCycleDashboard.jsx"

/**
 * Credit Cycle service page.
 * HY·BBB 수치는 라이선스 확인 전까지 비공개. Panic 점수와 합산하지 않음.
 */
export default function CreditCyclePage() {
  return (
    <div className="yds-menu-hub yds-menu-hub--credit">
      <CreditCycleDashboard />
    </div>
  )
}
