import CreditCycleOverviewBoard from "../components/credit-cycle/CreditCycleOverviewBoard.jsx"

/**
 * Credit Cycle service page — overview board is the primary UX (reference 4-zone).
 * Soft/legacy engine shell stays out of this Preview commit surface.
 * HY·BBB stay cycle-only. Panic is never merged here.
 */
export default function CreditCyclePage() {
  return (
    <div className="yds-menu-hub yds-menu-hub--credit">
      <CreditCycleOverviewBoard />
    </div>
  )
}
