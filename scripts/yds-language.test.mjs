/**
 * YDS V1.8 language — node scripts/yds-language.test.mjs
 */
import { MACRO_V1_STATUS_BANDS, resolveMacroV1Status } from "../vite-project/src/panic-v2/panicMacroV1Status.js"
import {
  YDS_CYCLE_RAIL_LABELS,
  YDS_LABEL_PANIC_SCORE,
  YDS_LABEL_PANIC_HISTORY,
  macroStageDisplayLabel,
  resolvePanicBandForMacroStage,
} from "../vite-project/src/content/ydsLanguage.js"
import { YDS_STAGE_RAIL_LABELS } from "../vite-project/src/content/ydsCyclePhilosophy.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(YDS_LABEL_PANIC_SCORE === "패닉 강도", YDS_LABEL_PANIC_SCORE)
assert(YDS_LABEL_PANIC_HISTORY === "패닉 강도 히스토리", YDS_LABEL_PANIC_HISTORY)

const low = resolveMacroV1Status(10)
assert(low?.label === "공포 없음", low?.label)

const high = resolveMacroV1Status(90)
assert(high?.label === "인생 타점", high?.label)

assert(macroStageDisplayLabel("interest") === "관심", macroStageDisplayLabel("interest"))
assert(resolvePanicBandForMacroStage("dca")?.label === "분할매수")

assert(MACRO_V1_STATUS_BANDS.every((b) => !b.label.includes("구간")), "legacy 구간 label")
assert(YDS_STAGE_RAIL_LABELS.includes("인생 타점"), YDS_STAGE_RAIL_LABELS)
assert(!YDS_STAGE_RAIL_LABELS.includes("패닉매수"), YDS_STAGE_RAIL_LABELS)
assert(YDS_CYCLE_RAIL_LABELS.includes("현금 준비"), YDS_CYCLE_RAIL_LABELS)
assert(!YDS_CYCLE_RAIL_LABELS.includes("일부"), YDS_CYCLE_RAIL_LABELS)

console.log("OK yds-language.test.mjs")
