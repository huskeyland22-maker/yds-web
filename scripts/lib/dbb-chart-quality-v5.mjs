/**
 * DBB chart quality v5 — final evidence judgment per component (research only).
 * Reads frozen v1~v4 JSON. Does not retune weights or invent buy rules.
 */

export const CHART_QUALITY_V5 = 5

/** Fixed before writing any verdict. */
export const JUDGE_RULE = {
  purpose:
    "v1~v4 저장 결과만으로 A~E 증거 수준을 정리한다. 새 점수·가중치·매수 규칙은 만들지 않는다.",
  levels: ["추가 검증", "판단 유보", "현재 근거 부족"],
  levelNote:
    "판정은 항목의 절대 가치가 아니라 현재 연구가 뒷받침하는 증거 수준이다. 완료·실전유효 같은 단정 표현은 쓰지 않는다.",
  practical: [
    "현재 연구에서 선별 효과가 충분히 입증되지 않음",
    "추가 연구 대상으로 유지할 가치가 있음",
    "현재 데이터만으로 판정하기 어려움",
  ],
  sources:
    "전체 상관·삼분위는 주로 v3, C·E 위험·동점 보정 상관·희소성은 v4, 동일일 비교는 v3 tableB(및 v4 C·E)를 인용한다. 표본 정의가 다른 수치는 섞어 평균하지 않는다.",
  smallSample: 30,
}

const LEVEL = {
  more: "추가 검증",
  hold: "판단 유보",
  lack: "현재 근거 부족",
}

const PRACTICAL = {
  notProven: "현재 연구에서 선별 효과가 충분히 입증되지 않음",
  keepResearch: "추가 연구 대상으로 유지할 가치가 있음",
  cannotJudge: "현재 데이터만으로 판정하기 어려움",
}

function scoreCorr(component) {
  const row = (component?.correlations || []).find((item) => item.id === "score")
  return row || null
}

/**
 * Build synthesis report from frozen v1~v4 payloads (no recompute).
 * @param {{ v1: object, v2: object, v3: object, v4: object }} reports
 */
export function synthesizeChartQualityJudgment({ v1, v2, v3, v4 }) {
  if (!v1?.rows || !v3?.components || !v4?.c || !v4?.e) {
    throw new Error("v1, v3, and v4 reports are required")
  }

  const asOf = v1.asOf ?? v3.asOf ?? v4.asOf ?? null
  const signals = v1.counts?.signals ?? v1.rows.length
  const split = v1.split
  const components = ["A", "B", "C", "D", "E"]

  const availability = Object.fromEntries(
    components.map((key) => {
      const row = v3.counts?.components?.[key]
      return [key, { available: row?.available ?? null, missing: row?.missing ?? null }]
    }),
  )

  const tableA = []
  const tableB = []
  const judgments = {}

  for (const key of components) {
    const built = buildComponentJudgment(key, { v1, v2, v3, v4 })
    judgments[key] = built
    tableA.push(built.summaryRow)
    tableB.push(built.evidenceRow)
  }

  const tableC = buildReliabilityTable({ v1, v2, v3, v4, availability })
  const tableD = {
    byComponent: components.map((key) => ({
      component: key,
      label: judgments[key].label,
      evidenceLevel: judgments[key].evidenceLevel,
      practical: judgments[key].practical,
      reason: judgments[key].practicalReason,
    })),
    overallScoreSystem: {
      verdict: PRACTICAL.notProven,
      reason:
        "v1~v4에서 A~E 모두 동일 신호일 선별력 또는 시간순 재현이 실전 사용을 뒷받침하지 못했다. 총점 가중치를 바꾸거나 항목을 삭제·추가하는 제안은 하지 않는다.",
      note: "현재 결과만으로 실전 매수 후보 선별 개선이 입증되지 않았다.",
    },
  }

  return {
    version: CHART_QUALITY_V5,
    researchOnly: true,
    source: "synthesis_of_dbb_chart_quality_v1_v2_v3_v4",
    asOf,
    rule: JUDGE_RULE,
    split,
    counts: {
      signals,
      trainSignals: split?.trainCount ?? null,
      validationSignals: split?.validationCount ?? null,
      uniqueDates: v3.counts?.uniqueDates ?? v4.counts?.uniqueDates ?? null,
      components: availability,
      eZero: v4.eConcentration?.zeroCount ?? null,
      eNonzero: v4.eConcentration?.nonzeroCount ?? null,
    },
    sourceVersions: {
      v1: v1.version ?? 1,
      v2: v2?.version ?? 2,
      v3: v3.version ?? 3,
      v4: v4.version ?? 4,
    },
    verification: {
      v3Matched: v3.verification?.matched ?? null,
      v3Mismatched: v3.verification?.mismatched ?? null,
      v4Ok: v4.verification?.ok ?? null,
      v4Matched: v4.verification?.matched ?? null,
    },
    judgments,
    tableA,
    tableB,
    tableC,
    tableD,
  }
}

function buildComponentJudgment(key, { v3, v4 }) {
  const comp = v3.components[key]
  const tableA = (v3.tableA || []).find((row) => row.component === key)
  const sameDay = (v3.tableB || []).find((row) => row.component === key)
  const splitRow = (v3.tableC || []).find((row) => row.component === key)
  const scoreRule = v3.scoreRule?.[key]
  const corr = scoreCorr(comp)
  const label = scoreRule?.label || comp?.label || key

  if (key === "A") return judgeA({ label, scoreRule, tableA, sameDay, splitRow, corr, comp })
  if (key === "B") return judgeB({ label, scoreRule, tableA, sameDay, splitRow, corr, comp })
  if (key === "C") return judgeC({ label, scoreRule, tableA, sameDay, splitRow, corr, comp, v4 })
  if (key === "D") return judgeD({ label, scoreRule, tableA, sameDay, splitRow, corr, comp })
  return judgeE({ label, scoreRule, tableA, sameDay, splitRow, corr, comp, v4 })
}

function baseCitations({ tableA, sameDay, splitRow, corr, scoreRule }) {
  return {
    formula: scoreRule?.detail ?? null,
    weight: scoreRule?.weight ?? null,
    available: tableA?.available ?? null,
    missing: tableA?.missing ?? null,
    scoreReturnRho: corr?.return60?.rho ?? tableA?.scoreReturnRho ?? null,
    scoreReturnN: corr?.return60?.n ?? null,
    scoreDrawdownRho: corr?.drawdown60?.rho ?? null,
    topMedian60: tableA?.topMedian60 ?? null,
    bottomMedian60: tableA?.bottomMedian60 ?? null,
    topDrawdown60: tableA?.topDrawdown60 ?? null,
    sameDayUsable: sameDay?.usableGroups ?? null,
    sameDayGap: sameDay?.gapMedian60 ?? null,
    sameDayGapPositive: sameDay?.gapPositiveRate ?? null,
    sameDayDdGap: sameDay?.gapDrawdownMedian60 ?? null,
    bootstrapLo: sameDay?.bootstrapLo ?? null,
    bootstrapHi: sameDay?.bootstrapHi ?? null,
    bootstrapExcludesZero: sameDay?.bootstrapExcludesZero ?? null,
    sameDaySmall: sameDay?.smallSample ?? null,
    trainRho: splitRow?.trainReturnRho ?? null,
    validationRho: splitRow?.validationReturnRho ?? null,
    correlationMatch: splitRow?.correlationMatch ?? null,
    trainGap: splitRow?.trainGapMedian ?? null,
    validationGap: splitRow?.validationGapMedian ?? null,
    sameDayMatch: splitRow?.sameDayMatch ?? null,
  }
}

function judgeA(ctx) {
  const c = baseCitations(ctx)
  const topSectors = (ctx.comp?.topSectors || []).slice(0, 3)
  const sens = (ctx.comp?.sensitivity || []).slice(0, 2)
  const evidenceLevel = LEVEL.lack
  const practical = PRACTICAL.notProven
  const reason =
    "전체 점수-수익 ρ가 −0.04로 약하고 상위 1/3 60일 중앙값(+9.30%)이 하위(+9.83%)보다 낮다. 동일일 234그룹 수익차 중앙값 0%[−2.82,+2.66]로 0을 포함하며, 학습·검증 동일일 방향이 불일치한다."
  return finalize("A", ctx.label, c, evidenceLevel, practical, reason, {
    supporting: [
      "불리 움직임 ρ −0.13(v3): 점수가 높을수록 불리 움직임이 다소 작은 방향.",
      `동일일 불리차 중앙값 ${fmt(c.sameDayDdGap)}%p(v3 tableB).`,
    ],
    opposing: [
      `점수-수익 ρ ${fmt(c.scoreReturnRho)} (n=${c.scoreReturnN}, v3).`,
      `상위 60일 중앙값 ${fmtPct(c.topMedian60)} vs 하위 ${fmtPct(c.bottomMedian60)} (v3 tableA).`,
      `동일일 수익차 ${fmtPct(c.sameDayGap)}, 재표본 ${fmtPct(c.bootstrapLo)}~${fmtPct(c.bootstrapHi)} (0 포함, v3).`,
      `학습 동일일 ${fmtPct(c.trainGap)} → 검증 ${fmtPct(c.validationGap)} (${c.sameDayMatch}, v3 tableC).`,
    ],
    bias: [
      `상위 업종 집중: ${formatSectors(topSectors)} (v3).`,
      `제외 민감도 예: ${formatSens(sens)} (v3).`,
    ],
    overallRelation: `ρ ${fmt(c.scoreReturnRho)} · 상위 ${fmtPct(c.topMedian60)} / 하위 ${fmtPct(c.bottomMedian60)} (v3)`,
    sameDaySummary: `${c.sameDayUsable}그룹 · 수익차 ${fmtPct(c.sameDayGap)} · CI ${fmtPct(c.bootstrapLo)}~${fmtPct(c.bootstrapHi)} (v3)`,
    reproducibility: `상관 ${c.correlationMatch} · 동일일 ${c.sameDayMatch} (학습 ${fmtPct(c.trainGap)} → 검증 ${fmtPct(c.validationGap)})`,
    riskSummary: `불리 ρ ${fmt(c.scoreDrawdownRho)} · 상위 불리 중앙값 ${fmtDd(c.topDrawdown60)} (v3)`,
  })
}

function judgeB(ctx) {
  const c = baseCitations(ctx)
  const topSectors = (ctx.comp?.topSectors || []).slice(0, 3)
  const sens = (ctx.comp?.sensitivity || []).slice(0, 2)
  const evidenceLevel = LEVEL.lack
  const practical = PRACTICAL.notProven
  const reason =
    "상위 점수가 더 낫다는 가설과 반대로 전체 ρ −0.06, 상위 60일 중앙값(+9.08%) < 하위(+10.46%). 동일일 241그룹 수익차 −3.16%[−4.92,−0.46]로 0을 제외한 음수이며, 학습·검증 동일일도 같은 방향이다."
  return finalize("B", ctx.label, c, evidenceLevel, practical, reason, {
    supporting: [
      "학습·검증 동일일 수익차 방향이 모두 음수로 일치(재현은 되나 가설과 반대).",
      `재표본 CI가 0을 제외(v3 tableB excludesZero=${c.bootstrapExcludesZero}).`,
    ],
    opposing: [
      `점수-수익 ρ ${fmt(c.scoreReturnRho)} (n=${c.scoreReturnN}, v3) — 가설과 반대.`,
      `상위 ${fmtPct(c.topMedian60)} < 하위 ${fmtPct(c.bottomMedian60)} (v3 tableA).`,
      `동일일 수익차 ${fmtPct(c.sameDayGap)} (양수 그룹 ${fmt(c.sameDayGapPositive)}%, v3).`,
      "선별에 'B 고점'을 쓰면 오히려 낮은 성과 쪽과 맞물릴 수 있다는 반대 증거.",
    ],
    bias: [
      `상위 업종: ${formatSectors(topSectors)} (v3).`,
      `제외 민감도 예: ${formatSens(sens)} (v3).`,
    ],
    overallRelation: `ρ ${fmt(c.scoreReturnRho)} · 상위 ${fmtPct(c.topMedian60)} / 하위 ${fmtPct(c.bottomMedian60)} (v3)`,
    sameDaySummary: `${c.sameDayUsable}그룹 · 수익차 ${fmtPct(c.sameDayGap)} · CI ${fmtPct(c.bootstrapLo)}~${fmtPct(c.bootstrapHi)} (0 제외, v3)`,
    reproducibility: `상관 ${c.correlationMatch} · 동일일 ${c.sameDayMatch} (학습 ${fmtPct(c.trainGap)} → 검증 ${fmtPct(c.validationGap)})`,
    riskSummary: `불리 ρ ${fmt(c.scoreDrawdownRho)} · 상위 불리 ${fmtDd(c.topDrawdown60)} · 동일일 불리차 ${fmt(c.sameDayDdGap)}%p (v3)`,
  })
}

function judgeC(ctx) {
  const c = baseCitations(ctx)
  const v4Corr = ctx.v4?.c?.correlations
  const v4Same = ctx.v4?.tableC?.c?.["60"]
  const topSectors = (ctx.comp?.topSectors || []).slice(0, 3)
  const sens = (ctx.comp?.sensitivity || []).slice(0, 3)
  const tsm = (ctx.comp?.sensitivity || []).find((row) => row.symbol === "TSM")
  const evidenceLevel = LEVEL.more
  const practical = PRACTICAL.keepResearch
  const reason =
    "전체 표본에서 상위 1/3 60일 중앙값(+10.81%)이 하위(+8.47%)보다 높고 상관은 약한 양수다. 그러나 동일일 237그룹 수익차 −0.90%의 재표본 CI는 0을 포함하고, 학습 +0.22%→검증 −4.54%로 방향이 바뀌며 TSM 제외 시 동일일 차가 부호를 바꾼다."
  return finalize("C", ctx.label, c, evidenceLevel, practical, reason, {
    supporting: [
      `v3 tableA: 상위 60일 ${fmtPct(c.topMedian60)} · 하위 ${fmtPct(c.bottomMedian60)} · 양수율 ${fmt(ctx.tableA?.topPositive60)}%.`,
      `v3 점수-수익 ρ ${fmt(c.scoreReturnRho)}; v4 동점보정 ρ ${fmt(v4Corr?.return60?.rho)} (같은 n=${v4Corr?.return60?.n ?? c.scoreReturnN}).`,
      `불리 ρ v3 ${fmt(c.scoreDrawdownRho)} / v4 ${fmt(v4Corr?.drawdown60?.rho)} — 수익과 불리 개선이 약한 동시 방향.`,
    ],
    opposing: [
      `동일일 수익차 ${fmtPct(c.sameDayGap)} (237그룹), 재표본 ${fmtPct(c.bootstrapLo)}~${fmtPct(c.bootstrapHi)} (0 포함, v3·v4 일치).`,
      `학습 동일일 ${fmtPct(c.trainGap)} → 검증 ${fmtPct(c.validationGap)} (${c.sameDayMatch}).`,
      tsm
        ? `TSM 제외 시 동일일 수익차 ${fmtPct(tsm.gapMedian)} (Δ ${fmtPct(tsm.deltaGapMedian)}, v3·v4).`
        : "TSM 제외 민감도 미확인.",
      `상위 업종 SMH·XLK 비중 높음: ${formatSectors(topSectors)}.`,
    ],
    bias: [
      `업종 집중: ${formatSectors(topSectors)} (v3/v4).`,
      `제외 민감도: ${formatSens(sens)}.`,
      "동일일 선별력이 전체 삼분위 관찰과 분리됨 — 실전 같은날 비교 근거는 약함.",
    ],
    overallRelation: `v3 ρ ${fmt(c.scoreReturnRho)} · v4 ρ ${fmt(v4Corr?.return60?.rho)} · 상위 ${fmtPct(c.topMedian60)} / 하위 ${fmtPct(c.bottomMedian60)}`,
    sameDaySummary: `${c.sameDayUsable}그룹 · 수익차 ${fmtPct(c.sameDayGap)} · CI 0 포함 (v3/v4)`,
    reproducibility: `상관 ${c.correlationMatch} · 동일일 ${c.sameDayMatch}`,
    riskSummary: `v4 불리 ρ ${fmt(v4Corr?.drawdown60?.rho)} · 동일일 불리차 ${fmt(v4Same?.gapDrawdownMedian ?? c.sameDayDdGap)}%p`,
    extraNotes: [
      "전체 표본의 약한 양의 관계와 동일일·검증 선별력을 분리해 평가한다. 점수를 올리거나 내리지 않는다.",
    ],
  })
}

function judgeD(ctx) {
  const c = baseCitations(ctx)
  const topSectors = (ctx.comp?.topSectors || []).slice(0, 3)
  const sens = (ctx.comp?.sensitivity || []).slice(0, 2)
  const evidenceLevel = LEVEL.more
  const practical = PRACTICAL.keepResearch
  const reason =
    "전체 점수-수익 ρ +0.09로 약한 양수이고 상위 60일 중앙값(+10.43%)이 하위(+9.57%)보다 다소 높다. 동일일 219그룹 수익차 +1.01%의 CI는 0을 포함하며, 학습 +2.31%→검증 −2.02%로 방향이 바뀐다. 불리 ρ도 +0.09로 수익과 위험이 함께 커질 수 있다."
  return finalize("D", ctx.label, c, evidenceLevel, practical, reason, {
    supporting: [
      `점수-수익 ρ ${fmt(c.scoreReturnRho)} (n=${c.scoreReturnN}, v3).`,
      `상위 ${fmtPct(c.topMedian60)} vs 하위 ${fmtPct(c.bottomMedian60)} (v3 tableA).`,
      `동일일 수익차 ${fmtPct(c.sameDayGap)} (양수 그룹 ${fmt(c.sameDayGapPositive)}%).`,
    ],
    opposing: [
      `동일일 재표본 ${fmtPct(c.bootstrapLo)}~${fmtPct(c.bootstrapHi)} (0 포함, v3).`,
      `학습 ${fmtPct(c.trainGap)} → 검증 ${fmtPct(c.validationGap)} (${c.sameDayMatch}).`,
      `불리 ρ ${fmt(c.scoreDrawdownRho)} — 수익 개선과 불리 확대가 같이 관찰됨.`,
      `NVDA 제외 시 동일일 차가 ${fmtPct(sens[0]?.gapMedian)}로 민감 (v3).`,
    ],
    bias: [
      `상위 업종: ${formatSectors(topSectors)}.`,
      `제외 민감도: ${formatSens(sens)}.`,
    ],
    overallRelation: `ρ ${fmt(c.scoreReturnRho)} · 상위 ${fmtPct(c.topMedian60)} / 하위 ${fmtPct(c.bottomMedian60)} (v3)`,
    sameDaySummary: `${c.sameDayUsable}그룹 · 수익차 ${fmtPct(c.sameDayGap)} · CI 0 포함 (v3)`,
    reproducibility: `상관 ${c.correlationMatch} · 동일일 ${c.sameDayMatch}`,
    riskSummary: `불리 ρ ${fmt(c.scoreDrawdownRho)} · 상위 불리 ${fmtDd(c.topDrawdown60)} · 동일일 불리차 ${fmt(c.sameDayDdGap)}%p`,
  })
}

function judgeE(ctx) {
  const c = baseCitations(ctx)
  const conc = ctx.v4?.eConcentration
  const v4Corr = ctx.v4?.e?.correlations
  const buckets = ctx.v4?.eBuckets || ctx.v4?.tableB?.buckets || []
  const evidenceLevel = LEVEL.hold
  const practical = PRACTICAL.cannotJudge
  const reason =
    "E=0이 1380건 중 1362건이고 비0점은 18건뿐이다. v4 동점보정 점수-수익 ρ≈0이며 동일일 비교는 10그룹·재표본 유보다. v3의 ρ 0.48은 동점 많은 간이 Spearman 왜곡으로 v4와 별도 표기한다. 유효성 단정은 하지 않는다."
  return finalize("E", ctx.label, c, evidenceLevel, practical, reason, {
    supporting: [
      "산식·점수 방향은 v1과 동일하게 고정되어 있으며 신호일 종가까지만 사용(v1/v3).",
      buckets.length
        ? `점수별 표본(v4): ${buckets.map((b) => `${b.score}→${b.n}`).join(", ")}.`
        : "점수별 표본은 v4 buckets 참조.",
    ],
    opposing: [
      `E=0 ${conc?.zeroCount ?? "미확인"} · E≠0 ${conc?.nonzeroCount ?? "미확인"} (v4).`,
      `v4 동점보정 ρ 수익 ${fmt(v4Corr?.return60?.rho)} · 불리 ${fmt(v4Corr?.drawdown60?.rho)} (n=${v4Corr?.return60?.n}).`,
      `v3 저장 ρ ${fmt(c.scoreReturnRho)}는 동점 왜곡 가능 — 해석에 쓰지 않고 참고만.`,
      `동일일 ${c.sameDayUsable}그룹 · 수익차 ${fmtPct(c.sameDayGap)} · 재표본 유보 (v3/v4).`,
      "삼분위 비교 불가(v3/v4 tertileEligible=false).",
    ],
    bias: [
      "이산·희소 점수로 종목 간 순위가 거의 생기지 않음.",
      "원시 세부지표 해석은 기존 파일에 있는 범위만 사용; 임의 복원하지 않음.",
    ],
    overallRelation: `v4 ρ ${fmt(v4Corr?.return60?.rho)} (동점보정) · v3 저장 ρ ${fmt(c.scoreReturnRho)} (참고) · 삼분위 불가`,
    sameDaySummary: `${c.sameDayUsable}그룹(주의) · 수익차 ${fmtPct(c.sameDayGap)} · 재표본 유보`,
    reproducibility: `v3 저장 상관표기 ${c.correlationMatch}이나 v4 ρ≈0이라 상관 재현 해석 보류 · 동일일 ${c.sameDayMatch}(표본 부족)`,
    riskSummary: `v4 불리 ρ ${fmt(v4Corr?.drawdown60?.rho)} · 동일일 불리차 ${fmt(c.sameDayDdGap)}%p (표본 부족)`,
    extraNotes: [
      conc?.note || "E 희소성 때문에 상관만으로 판단하지 않는다.",
    ],
  })
}

function finalize(component, label, citations, evidenceLevel, practical, reason, blocks) {
  return {
    component,
    label,
    evidenceLevel,
    practical,
    practicalReason: reason,
    citations,
    summaryRow: {
      component,
      label,
      formula: citations.formula,
      available: citations.available,
      missing: citations.missing,
      overallRelation: blocks.overallRelation,
      sameDay: blocks.sameDaySummary,
      reproducibility: blocks.reproducibility,
      risk: blocks.riskSummary,
      evidenceLevel,
      reason,
    },
    evidenceRow: {
      component,
      label,
      supporting: blocks.supporting,
      opposing: blocks.opposing,
      bias: blocks.bias,
      extraNotes: blocks.extraNotes || [],
    },
  }
}

function buildReliabilityTable({ v1, v3, v4, availability }) {
  const incomplete = v4.counts?.incompleteByHorizon || null
  return [
    {
      topic: "결측",
      detail: componentsMissingLine(availability),
      source: "v3.counts.components",
    },
    {
      topic: "미완성 성과",
      detail: incomplete
        ? `20/60/120거래일 미완성 ${incomplete["20"]}/${incomplete["60"]}/${incomplete["120"]}건 (0으로 채우지 않음)`
        : "v4 incompleteByHorizon 미확인",
      source: "v4.counts.incompleteByHorizon",
    },
    {
      topic: "E 희소성",
      detail: `E=0 ${v4.eConcentration?.zeroCount ?? "미확인"} · E≠0 ${v4.eConcentration?.nonzeroCount ?? "미확인"}`,
      source: "v4.eConcentration",
    },
    {
      topic: "업종 집중",
      detail: "C 상위 1/3에서 SMH·XLK 비중이 높음(v3/v4 topSectors). A·B·D도 SMH·XLK·GRID 편중.",
      source: "v3.components.*.topSectors",
    },
    {
      topic: "종목 민감도",
      detail: "C는 TSM 제외 시 동일일 수익차 부호 변화. D는 NVDA 제외 영향. E는 그룹 10개라 제외에 민감.",
      source: "v3/v4 sensitivity",
    },
    {
      topic: "비독립성",
      detail: "같은 날 여러 종목 신호·같은 종목 반복 신호는 독립이 아님(v1/v2 규칙).",
      source: "v1/v2 rule",
    },
    {
      topic: "시간순 검증",
      detail: `학습 ~${v1.split?.trainEndDate} (${v1.split?.trainCount}) · 검증 ${v1.split?.validationStartDate}~ (${v1.split?.validationCount}). 같은 날짜는 한쪽에만.`,
      source: "v1.split",
    },
    {
      topic: "상관 산식",
      detail: "v3 E ρ 0.48은 동점 많은 간이 Spearman 왜곡 가능. v4는 동점 평균순위 후 피어슨으로 재계산(ρ≈0). 두 값을 섞어 평균하지 않음.",
      source: "v3 vs v4 correlation notes",
    },
  ]
}

function componentsMissingLine(availability) {
  return ["A", "B", "C", "D", "E"]
    .map((key) => {
      const row = availability[key]
      return `${key} ${row.available}/${row.missing}`
    })
    .join(" · ")
}

function fmt(value) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  return String(Number(value))
}

function fmtPct(value) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  const sign = number > 0 ? "+" : ""
  return `${sign}${number.toFixed(2)}%`
}

function fmtDd(value) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  return `-${Number(value).toFixed(2)}%`
}

function formatSectors(rows) {
  if (!rows?.length) return "미확인"
  return rows.map((row) => `${row.sector} ${row.sharePct}%`).join(", ")
}

function formatSens(rows) {
  if (!rows?.length) return "미확인"
  return rows
    .map((row) => `${row.symbol} Δ${fmtPct(row.deltaGapMedian)}`)
    .join(", ")
}

export { LEVEL as EVIDENCE_LEVEL, PRACTICAL as PRACTICAL_LABEL }
