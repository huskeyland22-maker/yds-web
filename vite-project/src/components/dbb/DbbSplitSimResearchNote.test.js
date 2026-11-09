import { describe, expect, it } from "vitest"
import {
  DBB_SPLIT_SIM_FOUR_MISS_RATIO,
  DBB_SPLIT_SIM_POST_FOUR_MAE_RATIO,
  DBB_SPLIT_SIM_RESEARCH_BASIS,
} from "./DbbSplitSimResearchNote.jsx"

describe("DbbSplitSimResearchNote copy", () => {
  it("marks figures as past Test research, not live stats", () => {
    expect(DBB_SPLIT_SIM_RESEARCH_BASIS).toMatch(/과거 Test/)
    expect(DBB_SPLIT_SIM_RESEARCH_BASIS).toMatch(/실시간/)
    expect(DBB_SPLIT_SIM_RESEARCH_BASIS).not.toMatch(/현재 라이브 통계입니다/)
  })

  it("includes mandatory 56.9% (82/144) four-miss ratio", () => {
    expect(DBB_SPLIT_SIM_FOUR_MISS_RATIO).toContain("56.9%")
    expect(DBB_SPLIT_SIM_FOUR_MISS_RATIO).toContain("82/144")
    expect(DBB_SPLIT_SIM_FOUR_MISS_RATIO).toMatch(/과거 Test/)
  })

  it("includes mandatory 18.8% post-four MAE ratio (A)", () => {
    expect(DBB_SPLIT_SIM_POST_FOUR_MAE_RATIO).toContain("18.8%")
    expect(DBB_SPLIT_SIM_POST_FOUR_MAE_RATIO).toMatch(/A 기준/)
    expect(DBB_SPLIT_SIM_POST_FOUR_MAE_RATIO).toMatch(/과거 Test/)
  })
})
