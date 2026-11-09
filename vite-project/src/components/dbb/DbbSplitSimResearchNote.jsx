/**
 * ETF Daily Bottom Buy — split-sim 과거 Test 연구 고지 (실시간 통계 아님).
 * 근거: docs/YDS_DAILY_BOTTOM_BUY_SPLIT_SIM.md §5
 */

export const DBB_SPLIT_SIM_RESEARCH_BASIS =
  "아래 수치는 과거 Test 연구 기준이며, 현재 라이브·실시간 통계가 아닙니다."

/** 3신호 후 4 미도달: 82/144 = 56.9% (Test) */
export const DBB_SPLIT_SIM_FOUR_MISS_RATIO =
  "3신호 후 4에 도달하지 못한 비율: 56.9% (82/144, 과거 Test)"

/** 4-fill 이후 20일 MAE≥5%: ≈18.8% (scheme A) */
export const DBB_SPLIT_SIM_POST_FOUR_MAE_RATIO =
  "4-fill 이후 20일 MAE ≥ 5% 비율: 18.8% (A 기준, 과거 Test)"

export default function DbbSplitSimResearchNote() {
  return (
    <div className="yds-dbb-research__split-sim" aria-label="분할매수 과거 Test 연구 고지">
      <p className="yds-dbb-card__hint">{DBB_SPLIT_SIM_RESEARCH_BASIS}</p>
      <p className="yds-dbb-card__hint">{DBB_SPLIT_SIM_FOUR_MISS_RATIO}</p>
      <p className="yds-dbb-card__hint">{DBB_SPLIT_SIM_POST_FOUR_MAE_RATIO}</p>
    </div>
  )
}
