import { useMemo } from "react"
import PanicDeskSectionHeader from "../components/panic-desk/PanicDeskSectionHeader.jsx"
import { useAppDataStore } from "../store/appDataStore.js"
import { mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { buildHomeV5DeskModel } from "./homeV5DeskModel.js"
import HomeV5CoreIndices from "./HomeV5CoreIndices.jsx"

/**
 * 홈 v5 상단 — 핵심지수 (카드 그리드만)
 * @param {{
 *   panicData?: object | null
 *   historyRows?: object[]
 *   className?: string
 *   hideSectionHeader?: boolean
 *   metricTwoLine?: boolean
 * }} props
 */
export default function HomeV5DeskLead({
  panicData = null,
  historyRows = [],
  className = "",
  hideSectionHeader = false,
  metricTwoLine = false,
}) {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const mergedHistory = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], historyRows ?? [])),
    [storeRows, historyRows],
  )

  const model = useMemo(
    () => buildHomeV5DeskModel(panicData, mergedHistory),
    [panicData, mergedHistory],
  )

  return (
    <div
      className={[
        "home-v5-desk-shell",
        "home-v5-preview",
        "home-v5-preview--compact",
        "home-v5-preview--hero",
        "home-v5-preview--hud",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="home-v5-preview__zone home-v5-preview__zone--core">
        <section
          className={[
            "home-v5-core-section",
            "trading-card-shell",
            "panic-v2-section",
            "panic-desk-section",
            "panic-desk-section--main",
            "overflow-hidden",
            hideSectionHeader ? "home-v5-core-section--desk" : "px-2 pb-2 sm:px-2.5",
          ].join(" ")}
        >
          {hideSectionHeader ? null : (
            <PanicDeskSectionHeader
              icon="📊"
              title="핵심지수"
              description="VIX · CNN · BofA · YDS 종합 판단"
              tone="cyan"
              tier="main"
            />
          )}
          <HomeV5CoreIndices
            cards={model.core}
            strategyBar={model.strategyBar}
            metricTwoLine={metricTwoLine}
          />
        </section>
      </div>
    </div>
  )
}
