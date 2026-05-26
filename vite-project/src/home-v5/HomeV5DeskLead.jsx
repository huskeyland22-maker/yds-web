import { useMemo } from "react"
import PanicDeskSectionHeader from "../components/panic-desk/PanicDeskSectionHeader.jsx"
import { buildHomeV5DeskModel } from "./homeV5DeskModel.js"
import HomeV5CoreIndices from "./HomeV5CoreIndices.jsx"
import HomeV5MarketAnalysis from "./HomeV5MarketAnalysis.jsx"
import HomeV5StrategyHero from "./HomeV5StrategyHero.jsx"

/**
 * 홈 v5 상단 — 핵심지수 · 전략 Hero · 시장 분석
 * @param {{ panicData?: object | null; historyRows?: object[]; className?: string }} props
 */
export default function HomeV5DeskLead({ panicData = null, historyRows = [], className = "" }) {
  const model = useMemo(
    () => buildHomeV5DeskModel(panicData, historyRows),
    [panicData, historyRows],
  )

  return (
    <div
      className={[
        "home-v5-desk-shell",
        "home-v5-preview",
        "home-v5-preview--compact",
        "home-v5-preview--hero",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="home-v5-preview__zone home-v5-preview__zone--core">
        <PanicDeskSectionHeader icon="📊" title="핵심 지수" tone="cyan" compact />
        <HomeV5CoreIndices cards={model.core} />
      </div>

      <div className="home-v5-preview__zone home-v5-preview__zone--strategy">
        {model.strategy ? (
          <HomeV5StrategyHero strategy={model.strategy} />
        ) : (
          <p className="home-v5-preview__placeholder home-v5-preview__placeholder--hero">
            지표 입력 후 전략 엔진 표시
          </p>
        )}
      </div>

      <div className="home-v5-preview__zone home-v5-preview__zone--market">
        <HomeV5MarketAnalysis panicData={panicData} />
      </div>
    </div>
  )
}
