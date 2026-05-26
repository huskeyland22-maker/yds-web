export {
  buildHomeV5CoreCard as buildCoreIndexCard,
  buildHomeV5StrategyRationale as buildStrategyRationale,
  buildHomeV5DeskModel as buildHomeV5PreviewModel,
} from "../home-v5/homeV5DeskModel.js"

/** 시안 확인용 고정 Mock — /preview/home-v5 전용 */
export const HOME_V5_PREVIEW_MOCK = Object.freeze({
  fearGreed: 78,
  vix: 16,
  highYield: 4.1,
  bofa: 7.2,
  putCall: 0.85,
  move: 98,
  skew: 132,
  gsBullBear: 55,
})

export const HOME_V5_PREVIEW_SCENARIOS = [
  { id: "overheat", label: "과열", panicData: { ...HOME_V5_PREVIEW_MOCK } },
  {
    id: "neutral",
    label: "중립",
    panicData: { fearGreed: 48, vix: 18, highYield: 3.8, bofa: 5, putCall: 0.9, move: 95, skew: 128 },
  },
  {
    id: "panic",
    label: "패닉",
    panicData: { fearGreed: 8, vix: 38, highYield: 6.2, bofa: 1.5, putCall: 1.15, move: 125, skew: 145 },
  },
]
