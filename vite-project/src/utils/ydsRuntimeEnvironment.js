/**
 * Market-analysis environment banner — deploy runtime + Supabase project ref only.
 * Never invents an environment; mismatches become ENVIRONMENT UNKNOWN.
 * Does not expose URLs, keys, or secrets.
 */

import {
  classifyMetricState,
  classifyPanicScoreState,
  panicAsOfDate,
  readFiniteMetric,
} from "./panicDataFreshness.js"
import { formatMarketBasisKst } from "./marketTimestamp.js"

/** Known project refs (project id only — never full URL on screen). */
export const STAGING_SUPABASE_REF = "qzunuksxwwzusyivaznx"
export const PRODUCTION_SUPABASE_REF = "oausvweyocgynjpeguka"
export const PRODUCTION_APP_HOST = "yds-web-kappa.vercel.app"

/** @typedef {"local" | "production" | "preview" | "unknown"} DeployRuntime */
/** @typedef {"staging" | "production" | "missing" | "other"} SupabaseProjectKind */
/** @typedef {"local" | "production" | "preview" | "unknown"} EnvBannerKey */

/**
 * @param {string | null | undefined} url
 * @returns {SupabaseProjectKind}
 */
export function resolveSupabaseProjectKind(url) {
  const raw = String(url ?? "").trim().toLowerCase()
  if (!raw) return "missing"
  if (raw.includes(STAGING_SUPABASE_REF)) return "staging"
  if (raw.includes(PRODUCTION_SUPABASE_REF)) return "production"
  return "other"
}

/**
 * Deploy runtime from explicit signals only (no hostname guessing when Vercel env is set).
 * @param {{
 *   isDev?: boolean
 *   vercelEnv?: string | null
 *   hostname?: string | null
 * }} [input]
 * @returns {DeployRuntime}
 */
export function resolveDeployRuntime(input = {}) {
  const isDev = input.isDev ?? Boolean(import.meta.env?.DEV)
  if (isDev) return "local"

  const vercelEnv = String(
    input.vercelEnv ?? import.meta.env?.VITE_VERCEL_ENV ?? "",
  )
    .trim()
    .toLowerCase()
  if (vercelEnv === "production") return "production"
  if (vercelEnv === "preview") return "preview"
  if (vercelEnv === "development") return "local"

  const host = String(
    input.hostname ?? (typeof window !== "undefined" ? window.location.hostname : ""),
  )
    .trim()
    .toLowerCase()
  if (!host) return "unknown"
  if (host === "localhost" || host === "127.0.0.1") return "local"
  if (host === PRODUCTION_APP_HOST) return "production"
  if (host.endsWith(".vercel.app")) return "preview"
  return "unknown"
}

/**
 * @param {{
 *   deploy?: DeployRuntime
 *   project?: SupabaseProjectKind
 * }} [input]
 */
export function resolveEnvironmentBanner(input = {}) {
  const deploy = input.deploy ?? resolveDeployRuntime()
  const project =
    input.project ??
    resolveSupabaseProjectKind(String(import.meta.env?.VITE_SUPABASE_URL ?? "").trim())

  if (deploy === "local" && project === "staging") {
    return {
      key: /** @type {EnvBannerKey} */ ("local"),
      label: "LOCAL · STAGING CONNECTED",
      dataSource: "STAGING",
      deploy,
      project,
    }
  }
  if (deploy === "production" && project === "production") {
    return {
      key: /** @type {EnvBannerKey} */ ("production"),
      label: "PRODUCTION · LIVE DATA",
      dataSource: "PRODUCTION",
      deploy,
      project,
    }
  }
  if (deploy === "preview" && (project === "staging" || project === "production")) {
    return {
      key: /** @type {EnvBannerKey} */ ("preview"),
      label: "PREVIEW · TEST DATA",
      dataSource: project === "staging" ? "STAGING" : "PRODUCTION",
      deploy,
      project,
    }
  }

  return {
    key: /** @type {EnvBannerKey} */ ("unknown"),
    label: "ENVIRONMENT UNKNOWN",
    dataSource: "UNKNOWN",
    deploy,
    project,
  }
}

const CORE_METRICS = [
  { id: "vix", key: "vix", label: "VIX" },
  { id: "cnn", key: "fearGreed", label: "CNN" },
  { id: "putCall", key: "putCall", label: "Put/Call" },
]

function dayKeyFrom(value) {
  const text = String(value ?? "")
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null
}

/**
 * Per-core as-of dates from the live panic payload only (no invented dates).
 * Shared snapshot date applies when a metric has a value and no per-metric override.
 * @param {object | null | undefined} panicData
 */
export function resolveCoreMetricAsOfDates(panicData) {
  const shared = panicAsOfDate(panicData)
  return CORE_METRICS.map((metric) => {
    const value = readFiniteMetric(
      metric.id === "cnn" ? panicData?.fearGreed : panicData?.[metric.key],
    )
    const override =
      dayKeyFrom(panicData?.[`${metric.key}Date`]) ??
      dayKeyFrom(panicData?.[`${metric.id}Date`]) ??
      dayKeyFrom(panicData?.metricDates?.[metric.key]) ??
      dayKeyFrom(panicData?.metricDates?.[metric.id])
    const date = value == null ? null : override ?? shared
    return {
      id: metric.id,
      label: metric.label,
      value,
      date,
      state: classifyMetricState(panicData, metric.id),
    }
  })
}

/**
 * Compact as-of summary for the three core metrics.
 * @param {ReturnType<typeof resolveCoreMetricAsOfDates>} metrics
 */
export function formatCoreAsOfSummary(metrics) {
  const present = (metrics || []).filter((m) => m.date)
  if (!present.length) return "기준일 없음"
  const unique = [...new Set(present.map((m) => m.date))]
  if (unique.length === 1) {
    const labels = present.map((m) => m.label).join(" · ")
    return `${labels} 기준일 ${unique[0]}`
  }
  return present.map((m) => `${m.label} ${m.date}`).join(" · ")
}

/**
 * @param {object | null | undefined} panicData
 * @param {{
 *   isDev?: boolean
 *   vercelEnv?: string | null
 *   hostname?: string | null
 *   supabaseUrl?: string | null
 *   now?: Date
 * }} [opts]
 */
export function buildMarketEnvStripModel(panicData, opts = {}) {
  const deploy = resolveDeployRuntime({
    isDev: opts.isDev,
    vercelEnv: opts.vercelEnv,
    hostname: opts.hostname,
  })
  const project = resolveSupabaseProjectKind(
    opts.supabaseUrl ?? String(import.meta.env?.VITE_SUPABASE_URL ?? "").trim(),
  )
  const env = resolveEnvironmentBanner({ deploy, project })
  const scoreState = classifyPanicScoreState(panicData, opts.now ?? new Date())
  const metrics = resolveCoreMetricAsOfDates(panicData)
  const asOfSummary = formatCoreAsOfSummary(metrics)
  const updatedIso = panicData?.updatedAt ?? panicData?.updated_at ?? null
  const updatedLabel = updatedIso ? formatMarketBasisKst(String(updatedIso)) : null

  return {
    ...env,
    scoreState,
    asOfSummary,
    metrics,
    updatedLabel,
    updatedIso: updatedIso ? String(updatedIso) : null,
    sharedAsOf: panicAsOfDate(panicData),
  }
}
