/**
 * Liquidity Environment (SOFR + ON RRP) — separate from CORE.
 * λ=0 · never merged into R_core. Rights CONDITIONAL (NY Fed).
 */

import {
  computeSofrLegScore,
  computeOnRrpLegScore,
  computeSofrLiquidityRiskScore,
} from "../../../src/credit-cycle/scores/sofrLiquidity.js"

const SNAPSHOT_URL = "/credit-cycle/liquidity-environment-snapshot.json"
const SOFR_SEARCH =
  "https://markets.newyorkfed.org/api/rates/all/search.json?startDate=2025-01-01&endDate=2099-12-31&type=rate"
const RRP_LAST = "https://markets.newyorkfed.org/api/rp/reverserepo/all/results/last/120.json"

export const LIQUIDITY_LAMBDA = 0

/**
 * @param {{ sofr?: {date:string,value:number}[], onRrp?: {date:string,value:number}[], meta?: object }} input
 */
export function buildLiquidityEnvironment(input = {}) {
  const sofrSeries = normalizeSeries(input.sofr)
  const rrpSeries = normalizeSeries(input.onRrp)
  const sofrValues = sofrSeries.map((p) => p.value)
  const rrpValues = rrpSeries.map((p) => p.value)

  const sofrTip = sofrSeries.at(-1) || null
  const rrpTip = rrpSeries.at(-1) || null
  const sofrPrev = sofrSeries.length >= 6 ? sofrSeries[sofrSeries.length - 6] : sofrSeries[0]
  const rrpPrev = rrpSeries.length >= 6 ? rrpSeries[rrpSeries.length - 6] : rrpSeries[0]

  const sofrDelta =
    sofrTip && sofrPrev && Number.isFinite(sofrTip.value) && Number.isFinite(sofrPrev.value)
      ? sofrTip.value - sofrPrev.value
      : null
  const rrpDelta =
    rrpTip && rrpPrev && Number.isFinite(rrpTip.value) && Number.isFinite(rrpPrev.value)
      ? rrpTip.value - rrpPrev.value
      : null
  const rrpDeltaPct =
    rrpDelta != null && rrpPrev?.value
      ? (rrpDelta / Math.abs(rrpPrev.value)) * 100
      : null

  const sofrLeg = computeSofrLegScore({ sofr: sofrValues, policyRate: [] })
  const rrpLeg = computeOnRrpLegScore({ onRrp: rrpValues })
  const composite = computeSofrLiquidityRiskScore({
    sofr: sofrValues,
    onRrp: rrpValues,
    policyRate: [],
  })

  const coverage =
    sofrSeries.length >= 20 && rrpSeries.length >= 20
      ? "AVAILABLE"
      : sofrSeries.length || rrpSeries.length
        ? "PARTIAL_COVERAGE"
        : "NO_DATA"

  const freshness = resolveFreshness(sofrTip?.date, rrpTip?.date)

  /** Analysis only — not a calibrated risk grade. */
  const D_liquidity =
    composite.score == null
      ? {
          status: "INSUFFICIENT_DATA",
          score: null,
          note: "SOFR/ON RRP 시계열 부족 — 유동성 판단 보류",
        }
      : {
          status: "ANALYTIC_ONLY",
          score: composite.score,
          note:
            "연구 임계 가설 기반 참고 점수. λ=0 · R_core 미합산. 금리 상승·잔액 감소만으로 위기 판정 금지.",
          sofr_leg: sofrLeg.score,
          on_rrp_leg: rrpLeg.score,
          thresholds_are_hypothesis: true,
        }

  const coMove = describeCoMove(sofrDelta, rrpDelta)
  const retrievalDate =
    input.meta?.retrieval_date || new Date().toISOString().slice(0, 10)

  const sofrGuide = buildSofrGuide(sofrTip, sofrDelta)
  const rrpGuide = buildOnRrpGuide(rrpTip, rrpDelta, rrpDeltaPct)

  return {
    namespace: "liquidity_environment",
    schema_version: "liquidity_environment-0.1.1",
    lambda: LIQUIDITY_LAMBDA,
    r_core_includes_liquidity: false,
    as_of: laterDate(sofrTip?.date, rrpTip?.date),
    retrieval_date: retrievalDate,
    quality: coverage,
    coverage,
    freshness,
    rights: input.meta?.rights || {
      sofr: "RIGHTS_CONDITIONAL",
      on_rrp: "RIGHTS_CONDITIONAL",
    },
    attribution:
      input.meta?.rights?.attribution ||
      "The SOFR is subject to the Terms of Use posted at newyorkfed.org. The New York Fed is not responsible for publication of the SOFR by YDS.",
    sofr: {
      latest: sofrTip?.value ?? null,
      as_of: sofrTip?.date ?? null,
      observation_date: sofrTip?.date ?? null,
      retrieval_date: retrievalDate,
      release_date: null,
      delta_approx_5d: sofrDelta,
      unit: "percent",
      series: sofrSeries.slice(-90),
      status: sofrSeries.length ? "AVAILABLE" : "NO_DATA",
      rights_status: "RIGHTS_CONDITIONAL",
      interpretation: sofrGuide.observed,
      guide: sofrGuide,
    },
    on_rrp: {
      latest: rrpTip?.value ?? null,
      latest_billions: rrpTip?.value != null ? rrpTip.value / 1e9 : null,
      as_of: rrpTip?.date ?? null,
      observation_date: rrpTip?.date ?? null,
      retrieval_date: retrievalDate,
      release_date: null,
      delta: rrpDelta,
      delta_pct_approx_5obs: rrpDeltaPct,
      unit: "usd_accepted",
      series: rrpSeries.slice(-90),
      status: rrpSeries.length ? "AVAILABLE" : "NO_DATA",
      rights_status: "RIGHTS_CONDITIONAL",
      interpretation: rrpGuide.observed,
      note: "rrp_decline_alone_does_not_raise_risk",
      guide: rrpGuide,
    },
    D_liquidity,
    co_movement: coMove,
    interpretation_guide: {
      principle: "Liquidity Environment는 CORE와 분리된 참고 영역입니다.",
      sofr: sofrGuide,
      on_rrp: rrpGuide,
      together: {
        means: "단기 자금시장 금리와 연준 ON RRP take-up의 동행·비동행을 관찰합니다.",
        cannot_alone:
          "유동성 변화만으로 신용위기 진입이나 매수·매도 신호를 확정하지 않습니다.",
        next_check: [
          "CORE DS/DQ/DR 방향",
          "은행 준비금·단기 자금시장 여건 (별도 데이터)",
          "국채 발행·현금 수요 등 구조 요인",
        ],
      },
    },
    transport: input.meta?.transport || "unknown",
  }
}

/**
 * Live NY Fed fetch with snapshot fallback. Never throws.
 */
export async function loadLiquidityEnvironment() {
  const retrievalDate = new Date().toISOString().slice(0, 10)
  try {
    const live = await fetchLiveNyFed()
    if (live.sofr.length >= 5 && live.onRrp.length >= 5) {
      return buildLiquidityEnvironment({
        sofr: live.sofr,
        onRrp: live.onRrp,
        meta: {
          transport: "nyfed_live",
          retrieval_date: retrievalDate,
          rights: {
            sofr: "RIGHTS_CONDITIONAL",
            on_rrp: "RIGHTS_CONDITIONAL",
            attribution:
              "The SOFR is subject to the Terms of Use posted at newyorkfed.org. The New York Fed is not responsible for publication of the SOFR by YDS.",
          },
        },
      })
    }
  } catch {
    /* fall through */
  }

  try {
    const res = await fetch(SNAPSHOT_URL, { cache: "no-store" })
    if (!res.ok) throw new Error(`snap_${res.status}`)
    const snap = await res.json()
    return buildLiquidityEnvironment({
      sofr: (snap.sofr?.series || []).map((p) => ({ date: p.date, value: p.value })),
      onRrp: (snap.on_rrp?.series || []).map((p) => ({ date: p.date, value: p.value })),
      meta: {
        transport: "public_snapshot",
        retrieval_date: snap.generated_at?.slice?.(0, 10) || retrievalDate,
        rights: snap.rights,
      },
    })
  } catch (e) {
    return buildLiquidityEnvironment({
      sofr: [],
      onRrp: [],
      meta: {
        transport: "empty",
        retrieval_date: retrievalDate,
        error: e?.message || "load_failed",
      },
    })
  }
}

async function fetchLiveNyFed() {
  const [sofrRes, rrpRes] = await Promise.all([
    fetch(SOFR_SEARCH, { cache: "no-store" }),
    fetch(RRP_LAST, { cache: "no-store" }),
  ])
  if (!sofrRes.ok) throw new Error(`sofr_${sofrRes.status}`)
  if (!rrpRes.ok) throw new Error(`rrp_${rrpRes.status}`)
  const sofrJson = await sofrRes.json()
  const rrpJson = await rrpRes.json()

  const sofr = (sofrJson.refRates || [])
    .filter((r) => r.type === "SOFR" && r.percentRate != null)
    .map((r) => ({ date: String(r.effectiveDate).slice(0, 10), value: Number(r.percentRate) }))

  const onRrp = (rrpJson.repo?.operations || [])
    .filter((o) => o.term === "Overnight" && o.totalAmtAccepted != null)
    .map((o) => ({
      date: String(o.operationDate || o.settlementDate).slice(0, 10),
      value: Number(o.totalAmtAccepted),
    }))

  return { sofr: dedupe(sofr), onRrp: dedupe(onRrp) }
}

function normalizeSeries(rows) {
  if (!Array.isArray(rows)) return []
  return dedupe(
    rows
      .map((p) => ({
        date: String(p?.date || "").slice(0, 10),
        value: Number(p?.value),
      }))
      .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.value)),
  )
}

function dedupe(rows) {
  const map = new Map()
  for (const row of rows) map.set(row.date, row)
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function laterDate(a, b) {
  if (!a) return b || null
  if (!b) return a
  return a >= b ? a : b
}

function resolveFreshness(sofrDate, rrpDate) {
  const tip = laterDate(sofrDate, rrpDate)
  if (!tip) return "NO_DATA"
  const age = (Date.now() - Date.parse(`${tip}T00:00:00Z`)) / 86400000
  if (!Number.isFinite(age)) return "UNKNOWN"
  if (age <= 5) return "AVAILABLE"
  if (age <= 14) return "STALE"
  return "RELEASE_DELAYED"
}

function describeCoMove(sofrDelta, rrpDelta) {
  if (sofrDelta == null || rrpDelta == null) {
    return { status: "INSUFFICIENT_DATA", label: "동행 판정 보류" }
  }
  const sofrUp = sofrDelta > 0.03
  const sofrDown = sofrDelta < -0.03
  const rrpUp = rrpDelta > 0
  const rrpDown = rrpDelta < 0
  if ((sofrUp && rrpUp) || (sofrDown && rrpDown)) {
    return { status: "CO_MOVE", label: "단기 동행 관찰 (확정 국면 아님)" }
  }
  if ((sofrUp && rrpDown) || (sofrDown && rrpUp)) {
    return { status: "DIVERGE", label: "비동행 관찰 — CORE와 분리 해석" }
  }
  return { status: "MUTED", label: "뚜렷한 동행/비동행 없음" }
}

function buildSofrGuide(tip, delta) {
  const observed =
    tip == null
      ? "SOFR 관측값 없음"
      : delta == null
        ? `SOFR ${tip.value}% (관측 ${tip.date}) · 변화 판정 보류`
        : delta > 0.05
          ? `SOFR ${tip.value}% · 단기 상승(+${delta.toFixed(2)}pp)`
          : delta < -0.05
            ? `SOFR ${tip.value}% · 단기 하락(${delta.toFixed(2)}pp)`
            : `SOFR ${tip.value}% · 단기 변동 제한적`
  return {
    observed,
    means: "단기 자금 조달 금리 환경(Secured Overnight Financing Rate)을 나타냅니다.",
    cannot_alone:
      "SOFR 상승만으로 신용위험이 증가했다고 단정하지 않습니다. CORE 부실·공급과 별개입니다.",
    next_check: ["ON RRP take-up 동행 여부", "CORE DR/DS 방향", "정책금리·단기시장 스프레드"],
  }
}

function buildOnRrpGuide(tip, delta, deltaPct) {
  const billions =
    tip?.value != null && Number.isFinite(tip.value) ? (tip.value / 1e9).toFixed(2) : null
  const observed =
    tip == null
      ? "ON RRP 관측값 없음"
      : delta == null
        ? `ON RRP take-up ${billions}B (관측 ${tip.date}) · 변화 판정 보류`
        : delta < 0
          ? `ON RRP take-up ${billions}B · 감소 관찰${
              deltaPct != null ? ` (${deltaPct.toFixed(1)}%)` : ""
            }`
          : delta > 0
            ? `ON RRP take-up ${billions}B · 증가 관찰`
            : `ON RRP take-up ${billions}B · 변화 제한적`
  return {
    observed,
    means:
      "연준 ON RRP(역레포) 이용 잔액(accepted)입니다. 은행 준비금·전체 시스템 유동성과 동일 개념이 아닙니다.",
    cannot_alone:
      "rrp_decline_alone_does_not_raise_risk — 잔액 감소만으로 유동성 악화·신용위험 증가를 단정하지 않습니다.",
    next_check: [
      "준비금·단기 자금시장 여건",
      "국채 발행·현금 수요",
      "SOFR와의 동행/비동행",
      "CORE 신용위험 추이",
    ],
  }
}
