import TodayActionPanel from "./TodayActionPanel.jsx"

/**
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 *   historyRows?: object[]
 * }} props
 */
export default function RecommendationEnginePanel(props) {
  return <TodayActionPanel {...props} />
}
