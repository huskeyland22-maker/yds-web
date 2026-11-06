/**
 * HY / BBB OAS — FRED 신용 스프레드 (Panic Index·DBB/DCA와 분리).
 * 주 2회(화·금 KST) 수집. asOf(FRED 관측일) ≠ collectedAt(수집 시각).
 */

export const FRED_HY_OAS_SERIES = "BAMLH0A0HYM2"
export const FRED_BBB_OAS_SERIES = "BAMLC0A4CBBB"

/** panic_metrics metric_key */
export const CREDIT_SPREAD_KEYS = ["highYield", "bbbOas"]

const CREDIT_KEY_SET = new Set(CREDIT_SPREAD_KEYS)

/**
 * @param {string} key
 */
export function isCreditSpreadMetricKey(key) {
  return CREDIT_KEY_SET.has(String(key || ""))
}

function toNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * KST 기준 화(2)·금(5)인지. Vercel Cron은 UTC로 매일 돌아도 여기서 가드.
 * @param {Date | number | string} [now]
 */
export function isCreditSpreadCollectDayKst(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(d.getTime())) return false
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).formatToParts(d)
  const wd = parts.find((p) => p.type === "weekday")?.value
  return wd === "Tue" || wd === "Fri"
}

/**
 * @param {string} seriesId
 * @returns {Promise<{ value: number | null, delta: number | null, asOf: string | null, error?: string }>}
 */
export async function fetchFredOasSeries(seriesId) {
  const key = String(process.env.FRED_API_KEY || "").trim()
  if (!key) return { value: null, delta: null, asOf: null, error: "fred_key_missing" }
  const id = String(seriesId || "").trim()
  if (!id) return { value: null, delta: null, asOf: null, error: "fred_series_missing" }
  try {
    const url = new URL("https://api.stlouisfed.org/fred/series/observations")
    url.searchParams.set("series_id", id)
    url.searchParams.set("api_key", key)
    url.searchParams.set("file_type", "json")
    url.searchParams.set("sort_order", "desc")
    url.searchParams.set("limit", "5")
    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) return { value: null, delta: null, asOf: null, error: `fred_http_${res.status}` }
    const json = await res.json()
    const raw = Array.isArray(json?.observations) ? json.observations : []
    const parsed = []
    for (const o of raw) {
      const value = toNum(o?.value)
      if (value == null) continue
      const asOf = typeof o?.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(o.date) ? o.date.slice(0, 10) : null
      parsed.push({ value, asOf })
    }
    if (!parsed.length) return { value: null, delta: null, asOf: null, error: "fred_empty" }
    const value = parsed[0].value
    const asOf = parsed[0].asOf
    const delta = parsed.length >= 2 ? value - parsed[1].value : null
    return { value, delta, asOf }
  } catch (e) {
    return {
      value: null,
      delta: null,
      asOf: null,
      error: e instanceof Error ? e.message : "fred_fetch",
    }
  }
}

export async function fetchFredHighYieldOas() {
  return fetchFredOasSeries(FRED_HY_OAS_SERIES)
}

export async function fetchFredBbbOas() {
  return fetchFredOasSeries(FRED_BBB_OAS_SERIES)
}

/**
 * status 필드: asOf:YYYY-MM-DD
 * @param {string | null | undefined} status
 */
export function parseCreditAsOfStatus(status) {
  const s = String(status || "").trim()
  const m = /^asOf:(\d{4}-\d{2}-\d{2})$/.exec(s)
  return m ? m[1] : null
}

/**
 * @param {string | null | undefined} asOf
 */
export function formatCreditAsOfStatus(asOf) {
  if (typeof asOf !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(asOf.slice(0, 10))) return null
  return `asOf:${asOf.slice(0, 10)}`
}

/**
 * @param {{ highYield?: number | null, bbbOas?: number | null, highYieldPrev?: number | null, bbbOasPrev?: number | null, highYieldAsOf?: string | null, bbbOasAsOf?: string | null, collectedAt?: string | null }} input
 */
export function buildCreditRiskAnalysis(input = {}) {
  const hy = toNum(input.highYield)
  const bbb = toNum(input.bbbOas)
  const hyPrev = toNum(input.highYieldPrev)
  const bbbPrev = toNum(input.bbbOasPrev)
  const hyDelta = hy != null && hyPrev != null ? hy - hyPrev : toNum(input.highYieldDelta)
  const bbbDelta = bbb != null && bbbPrev != null ? bbb - bbbPrev : toNum(input.bbbOasDelta)

  const hyDir = directionFromDelta(hyDelta)
  const bbbDir = directionFromDelta(bbbDelta)
  let trend = "insufficient"
  if (hyDir || bbbDir) {
    if (hyDir === "widening" && bbbDir === "widening") trend = "widening"
    else if (hyDir === "easing" && bbbDir === "easing") trend = "easing"
    else if (hyDir === "widening" || bbbDir === "widening") {
      trend = hyDir === "easing" || bbbDir === "easing" ? "mixed" : "widening"
    } else if (hyDir === "easing" || bbbDir === "easing") trend = "easing"
    else trend = "mixed"
  }

  const trendKo =
    trend === "widening"
      ? "확대"
      : trend === "easing"
        ? "완화"
        : trend === "mixed"
          ? "혼조"
          : "판단 유보"

  return {
    axis: "credit_risk",
    highYield: hy,
    bbbOas: bbb,
    highYieldDelta: hyDelta,
    bbbOasDelta: bbbDelta,
    highYieldAsOf: input.highYieldAsOf ?? null,
    bbbOasAsOf: input.bbbOasAsOf ?? null,
    collectedAt: input.collectedAt ?? null,
    trend,
    trendKo,
    summaryKo: buildCreditSummaryKo({ hy, bbb, hyDelta, bbbDelta, trendKo, highYieldAsOf: input.highYieldAsOf, bbbOasAsOf: input.bbbOasAsOf }),
  }
}

function directionFromDelta(delta) {
  if (delta == null || !Number.isFinite(delta)) return null
  if (delta >= 0.05) return "widening"
  if (delta <= -0.05) return "easing"
  return "flat"
}

function buildCreditSummaryKo({ hy, bbb, hyDelta, bbbDelta, trendKo, highYieldAsOf, bbbOasAsOf }) {
  const parts = []
  if (hy != null) {
    parts.push(`HY OAS ${hy.toFixed(2)}${hyDelta != null ? ` (Δ ${fmtDelta(hyDelta)})` : ""}`)
  }
  if (bbb != null) {
    parts.push(`BBB OAS ${bbb.toFixed(2)}${bbbDelta != null ? ` (Δ ${fmtDelta(bbbDelta)})` : ""}`)
  }
  if (!parts.length) return "신용 스프레드 데이터 없음"
  const asOf = highYieldAsOf || bbbOasAsOf
  const asOfBit = asOf ? ` · 기준일 ${asOf}` : ""
  return `${parts.join(" · ")} · 추세 ${trendKo}${asOfBit}`
}

function fmtDelta(d) {
  const n = Number(d)
  if (!Number.isFinite(n)) return "—"
  const sign = n > 0 ? "+" : ""
  return `${sign}${n.toFixed(2)}`
}

/**
 * Live collect HY+BBB. Only successful keys returned in payload.
 * @param {{ preserve?: Record<string, number | null>, force?: boolean, now?: Date }} [opts]
 */
export async function collectCreditSpreadsLive(opts = {}) {
  const force = opts.force === true
  const now = opts.now instanceof Date ? opts.now : new Date()
  const collectedAt = now.toISOString()
  const preserve = opts.preserve && typeof opts.preserve === "object" ? opts.preserve : {}

  if (!force && !isCreditSpreadCollectDayKst(now)) {
    return {
      ok: true,
      skipped: true,
      reason: "not_credit_collect_day_kst",
      collectedAt,
      payload: {},
      meta: {},
      errors: {},
      changes: {},
    }
  }

  const errors = {}
  const changes = {}
  const meta = { collectedAt }
  const payload = {}

  const [hy, bbb] = await Promise.all([fetchFredHighYieldOas(), fetchFredBbbOas()])

  if (hy.error) errors.highYield = hy.error
  if (hy.value != null) {
    payload.highYield = hy.value
    if (hy.delta != null) changes.highYield = hy.delta
    meta.highYieldAsOf = hy.asOf
  } else if (preserve.highYield != null) {
    payload.highYield = preserve.highYield
    meta.highYieldPreserved = true
  }

  if (bbb.error) errors.bbbOas = bbb.error
  if (bbb.value != null) {
    payload.bbbOas = bbb.value
    if (bbb.delta != null) changes.bbbOas = bbb.delta
    meta.bbbOasAsOf = bbb.asOf
  } else if (preserve.bbbOas != null) {
    payload.bbbOas = preserve.bbbOas
    meta.bbbOasPreserved = true
  }

  return {
    ok: true,
    skipped: false,
    collectedAt,
    payload,
    meta,
    errors,
    changes,
    fetchedCount: ["highYield", "bbbOas"].filter((k) => payload[k] != null && !meta[`${k}Preserved`]).length,
  }
}
