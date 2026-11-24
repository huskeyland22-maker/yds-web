/**
 * Browser-facing data providers for Credit Cycle UI.
 * Phase 10C: optional STAGING_API when VITE_CREDIT_CYCLE_USE_STAGING_API is on —
 * local/dev only; never Production. LOCAL_CACHE remains fallback.
 * Does not embed service_role. Does not fall back to VITE_SUPABASE_URL for CC DB.
 */

import {
  adaptEngineResultToUi,
  adaptLocalHistoryBundleToUi,
  adaptResearchSnapshotToUi,
  buildPreparingSnapshot,
  UI_FEED_STATUS,
} from "@yds-credit-cycle/uiAdapter.js"
import {
  isStagingTestSeedPoint,
  STAGING_TEST_SEED_AS_OF,
  STAGING_TEST_SEED_CALC_VERSION,
} from "@yds-credit-cycle/stagingTestSeed.js"
import {
  licenseSafeBundleToEngineShape,
} from "@yds-credit-cycle/licenseSafeSnapshotBuilder.js"
import {
  PRODUCTION_SUPABASE_REF,
  resolveDeployRuntime,
  resolveSupabaseProjectKind,
} from "../utils/ydsRuntimeEnvironment.js"

const LOCAL_BUNDLE_URL = "/credit-cycle/local-history-bundle.json"
const LICENSE_SAFE_SNAPSHOTS_URL = "/credit-cycle/license-safe-snapshots.json"
const RESEARCH_SNAPSHOT_URL = "/credit-cycle/research-snapshot.json"
const STAGING_API_LATEST = "/api/credit-cycle?mode=latest"
const STAGING_API_HISTORY = "/api/credit-cycle?mode=history&limit=500"
const STAGING_API_INDICATORS = "/api/credit-cycle?mode=indicators"

export { isStagingTestSeedPoint, STAGING_TEST_SEED_AS_OF, STAGING_TEST_SEED_CALC_VERSION }

/**
 * Staging UI flag — refused on Production deploy / Production Supabase URL.
 */
export function stagingApiClientEnabled() {
  try {
    const v = String(import.meta.env?.VITE_CREDIT_CYCLE_USE_STAGING_API ?? "")
      .trim()
      .toLowerCase()
    if (v !== "1" && v !== "true") return false

    const deploy = resolveDeployRuntime()
    if (deploy === "production") return false

    const channel = String(import.meta.env?.VITE_APP_RELEASE_CHANNEL ?? "")
      .trim()
      .toLowerCase()
    if (channel === "prod" || channel === "production") return false

    if (import.meta.env?.PROD && deploy !== "local" && deploy !== "preview") return false

    const supabaseUrl = String(import.meta.env?.VITE_SUPABASE_URL ?? "").trim()
    if (supabaseUrl.includes(PRODUCTION_SUPABASE_REF)) return false
    if (resolveSupabaseProjectKind(supabaseUrl) === "production") return false

    return true
  } catch {
    return false
  }
}

/**
 * Optional Staging API → UI model.
 * Test-seed-only responses are marked and must not be shown as live market CCI.
 * @returns {Promise<object | null>}
 */
export async function tryLoadStagingApiModel() {
  if (!stagingApiClientEnabled()) return null
  try {
    const [latestRes, histRes, indRes] = await Promise.all([
      fetch(STAGING_API_LATEST, { cache: "no-store" }),
      fetch(STAGING_API_HISTORY, { cache: "no-store" }),
      fetch(STAGING_API_INDICATORS, { cache: "no-store" }),
    ])
    if (!latestRes.ok) return null
    const latest = await latestRes.json()
    if (!latest?.ok) return null

    const historyJson = histRes.ok ? await histRes.json() : null
    const indJson = indRes.ok ? await indRes.json() : null

    const rawPoints = Array.isArray(historyJson?.points) ? historyJson.points : []
    const marketPoints = rawPoints.filter((p) => !isStagingTestSeedPoint(p))
    const latestIsTest = isStagingTestSeedPoint(latest)
    const testSeedOnly = latestIsTest && marketPoints.length === 0

    if (testSeedOnly) {
      const empty = buildPreparingSnapshot({
        reason: "staging_connected_test_seed_only",
      })
      empty.feedStatus = UI_FEED_STATUS.STAGING_API
      empty.statusLabel = "Staging 연결 · 실제 스냅샷 미적재"
      empty.stagingConnected = true
      empty.testSeedOnly = true
      empty.testSeed = {
        asOf: latest.asOf || STAGING_TEST_SEED_AS_OF,
        cci: latest.cci ?? null,
        calculationVersion: latest.calculationVersion || STAGING_TEST_SEED_CALC_VERSION,
        note: "API 검증용 테스트 시드 — 시장 데이터 아님",
      }
      empty.narrative = [
        "Staging API에 연결되었습니다.",
        "DB에는 API 검증용 테스트 시드만 있습니다 (1900-01-01). 실제 시장 관측이 아닙니다.",
        "실제 license-safe 스냅샷이 적재되면 이 화면에 표시됩니다.",
      ]
      empty.cciPath = []
      return empty
    }

    const displayLatest = latestIsTest
      ? marketPoints.length
        ? marketPoints[marketPoints.length - 1]
        : null
      : latest
    if (!displayLatest) return null

    const cciPath = marketPoints.map((p) => ({
      asOf: p.asOf,
      cci: p.cci,
      coverage: p.coverage,
      pit: p.pitStatus,
      regime: p.regime,
    }))

    const indicators = Array.isArray(indJson?.indicators) ? indJson.indicators : []
    const engineShaped = {
      mode: "license_safe",
      dataAsOfDate: displayLatest.asOf || latest.asOf,
      cci: displayLatest.cci ?? latest.cci ?? null,
      coverage: displayLatest.coverage ?? latest.coverage ?? null,
      confidence: latest.confidence ?? null,
      cciStatus: (displayLatest.cci ?? latest.cci) == null ? "HOLD_OR_UNAVAILABLE" : "OK",
      status: latest.holdReason && !latestIsTest ? "HOLD_LOW_COVERAGE" : "OK",
      pitStatus: latest.pitStatus || "NON_PIT",
      regime: latest.regime
        ? { regime: latest.regime, status: "OK", reasons: [] }
        : { regime: null, status: "NOT_CLASSABLE", reasons: [] },
      indicators: indicators.map((i) => ({
        id: i.id || i.indicator_code,
        score: i.license_restricted ? null : i.riskScore ?? null,
        quality: i.license_restricted
          ? "LICENSE_RESTRICTED"
          : i.qualityStatus === "TEST_SEED"
            ? "MISSING"
            : i.qualityStatus || "VALID",
        lastObservationDate: i.observationDate || null,
        lastValue: i.license_restricted ? null : i.value ?? null,
        detail: null,
      })),
    }

    const dto = adaptEngineResultToUi(engineShaped, {
      feedStatus: UI_FEED_STATUS.STAGING_API,
      updatedAt: latest.updatedAt || null,
      cciPath,
      note: "STAGING_API feed — license-safe product path",
    })
    dto.feedStatus = UI_FEED_STATUS.STAGING_API
    dto.stagingConnected = true
    dto.testSeedOnly = false
    dto.pitLabel = String(latest.pitStatus || displayLatest.pitStatus || "NON_PIT").toUpperCase()
    dto.dataModeLabel = "license_safe"
    dto.statusLabel = dto.hold
      ? "데이터 부족 · 해석 보류"
      : "Staging API · License-safe · NON_PIT"
    // Preserve API observation dates / qualities on rows for analysis UI.
    const apiById = new Map(
      indicators.map((i) => [String(i.id || i.indicator_code || "").toLowerCase(), i]),
    )
    dto.indicators = (dto.indicators || []).map((row) => {
      const api = apiById.get(String(row.id).toLowerCase())
      if (!api || row.licenseRestricted) return row
      return {
        ...row,
        observationDate: api.observationDate || row.asOf || null,
        asOf: api.observationDate || row.asOf || dto.asOf,
        quality: api.qualityStatus === "TEST_SEED" ? row.quality : api.qualityStatus || row.quality,
        statusLabel:
          api.qualityStatus === "STALE"
            ? "지연·오래됨"
            : api.qualityStatus === "VALID"
              ? "정상"
              : row.statusLabel,
        riskScore: api.license_restricted ? null : api.riskScore ?? row.riskScore,
        valueDisplay: api.license_restricted ? null : api.value ?? row.valueDisplay,
        value: api.license_restricted ? null : api.value ?? row.value,
      }
    })
    dto.narrative = [
      "데이터 구분: Staging API license-safe 실관측 (테스트 시드 제외).",
      ...(dto.narrative || []),
    ]
    return dto
  } catch {
    return null
  }
}

async function loadLocalCacheModel() {
  try {
    const res = await fetch(LOCAL_BUNDLE_URL, { cache: "no-store" })
    if (res.ok) {
      const json = await res.json()
      if (json?.meta?.feedStatus === "LOCAL_CACHE" && (json.latestEngine || json.cciPath?.length)) {
        const dto = adaptLocalHistoryBundleToUi(json)
        if (!dto.history) {
          dto.history = await loadResearchHistoryOnly()
        }
        return dto
      }
    }
  } catch {
    /* fall through */
  }
  return null
}

/**
 * Phase 11: real license-safe snapshots from local cache (NON_PIT).
 * Never treats 1900-01-01 test seed as market data.
 * @returns {Promise<object | null>}
 */
export async function loadLicenseSafeLocalModel() {
  try {
    const res = await fetch(LICENSE_SAFE_SNAPSHOTS_URL, { cache: "no-store" })
    if (!res.ok) return null
    const json = await res.json()
    if (json?.meta?.feedStatus === "PREPARING" || json?.meta?.insufficientSources) {
      return null
    }
    if (!json?.latest || isStagingTestSeedPoint({ asOf: json.latest.as_of_date })) {
      return null
    }
    const engineShaped = licenseSafeBundleToEngineShape(json)
    if (!engineShaped) return null

    const cciPath = Array.isArray(json.cciPath)
      ? json.cciPath
          .filter((p) => !isStagingTestSeedPoint(p))
          .map((p) => ({
            asOf: p.asOf,
            cci: p.cci,
            coverage: p.coverage,
            pit: p.pitStatus || "NON_PIT",
            regime: p.regime,
          }))
      : []

    const dto = adaptEngineResultToUi(engineShaped, {
      feedStatus: UI_FEED_STATUS.LICENSE_SAFE_LOCAL,
      updatedAt: json.meta?.builtAt || null,
      cciPath,
      note: json.meta?.note || null,
    })
    dto.feedStatus = UI_FEED_STATUS.LICENSE_SAFE_LOCAL
    dto.statusLabel = dto.hold
      ? "데이터 부족 · 해석 보류"
      : "License-safe 로컬 · NON_PIT"
    dto.dataModeLabel = "license_safe"
    dto.pitLabel = "NON_PIT"
    return dto
  } catch {
    return null
  }
}

/**
 * @returns {Promise<object>} UI DTO
 */
export async function loadCreditCycleUiModel() {
  // 0) Optional Staging API (dev/local flag) — test-seed-only → real local feeds + notice
  if (stagingApiClientEnabled()) {
    const staging = await tryLoadStagingApiModel()
    if (staging?.testSeedOnly) {
      const licenseSafe = await loadLicenseSafeLocalModel()
      if (licenseSafe) {
        licenseSafe.stagingConnected = true
        licenseSafe.testSeedOnly = true
        licenseSafe.testSeed = staging.testSeed
        licenseSafe.stagingApiNote =
          "Staging API 연결됨 · DB 테스트 시드만 있어 License-safe 로컬 스냅샷으로 표시 (시장 데이터는 로컬 캐시)"
        return licenseSafe
      }
      const local = await loadLocalCacheModel()
      if (local) {
        local.stagingConnected = true
        local.testSeedOnly = true
        local.testSeed = staging.testSeed
        local.stagingApiNote =
          "Staging API 연결됨 · DB에 테스트 시드만 있어 로컬 캐시로 표시 (시장 데이터 아님)"
        return local
      }
      return staging
    }
    if (staging) return staging
  }

  // 1) Phase 11 license-safe local snapshots (real cache → CCI structure)
  const licenseSafe = await loadLicenseSafeLocalModel()
  if (licenseSafe) return licenseSafe

  // 2) Local historical cache (Phase 7/9)
  const local = await loadLocalCacheModel()
  if (local) return local

  // 3) Research snapshot fallback — clearly labeled
  try {
    const res = await fetch(RESEARCH_SNAPSHOT_URL, { cache: "no-store" })
    if (res.ok) {
      const json = await res.json()
      if (json?.latest) {
        return adaptResearchSnapshotToUi(json)
      }
    }
  } catch {
    /* fall through */
  }

  return buildPreparingSnapshot({ reason: "no_local_or_research_bundle" })
}

async function loadResearchHistoryOnly() {
  try {
    const res = await fetch(RESEARCH_SNAPSHOT_URL, { cache: "no-store" })
    if (!res.ok) return null
    const json = await res.json()
    return json.history || null
  } catch {
    return null
  }
}

export {
  adaptLocalHistoryBundleToUi,
  adaptResearchSnapshotToUi,
  buildPreparingSnapshot,
  UI_FEED_STATUS,
}
