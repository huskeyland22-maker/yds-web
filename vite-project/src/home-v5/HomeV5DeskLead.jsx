import { useMemo } from "react"
import PanicDeskSectionHeader from "../components/panic-desk/PanicDeskSectionHeader.jsx"
import { useAppDataStore } from "../store/appDataStore.js"
import { mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { buildHomeV5DeskModel } from "./homeV5DeskModel.js"
import HomeV5CoreIndices from "./HomeV5CoreIndices.jsx"
import HomeV5CoreSynthesis from "./HomeV5CoreSynthesis.jsx"
import HomeV5MarketAnalysis from "./HomeV5MarketAnalysis.jsx"
import HomeV5StrategyRationaleBar from "./HomeV5StrategyRationaleBar.jsx"

/**
 * 홈 v5 상단 — 핵심지수 · 전략 Hero · 시장 분석
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string }} props
 */
export default function HomeV5DeskLead({ panicData = null, historyRows = [], className = "" }) {
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
        <PanicDeskSectionHeader
          icon="📊"
          title="핵심지수"
          description="VIX · CNN · BofA · YDS 종합 판단"
          tone="cyan"
          tier="main"
        />
        <HomeV5CoreIndices cards={model.core} />
        <HomeV5CoreSynthesis synthesis={model.synthesis} />
        {model.strategy ? <HomeV5StrategyRationaleBar strategy={model.strategy} /> : null}
      </div>

      <div className="home-v5-preview__zone home-v5-preview__zone--market">
        <HomeV5MarketAnalysis panicData={panicData} />
      </div>
    </div>
  )
}
