/**
 * Vercel 등 배포 시 빌드 단계에서 주입: API 루트 (끝 슬래시 없음, /panic-data 제외).
 * @see https://vitejs.dev/guide/env-and-mode.html
 */
import { validatePanicData } from "../utils/validatePanicData.js"

export function getApiBase() {
  const raw = import.meta.env.VITE_API_BASE
  if (raw == null || typeof raw !== "string") return ""
  return raw.trim().replace(/\/+$/, "")
}

/** 로딩·안내용 표시 URL (VITE_API_BASE 없으면 빈 문자열) */
export function getPanicDataUrlForDisplay() {
  const base = getApiBase()
  return base ? `${base}/panic-data` : ""
}

/** STEP 16 백테스트용 샘플 시계열 URL */
export function getHistoryUrlForDisplay() {
  const base = getApiBase()
  return base ? `${base}/history` : ""
}

/** 에러 화면에 표시할 시도 URL (실제로는 한 곳만 사용) */
export function listPanicDataUrlAttemptsForDisplay() {
  const u = getPanicDataUrlForDisplay()
  return u ? [u] : []
}

function buildPanicFetchHeaders() {
  const headers = { Accept: "application/json" }
  const key = import.meta.env.VITE_PRO_API_KEY
  if (typeof key === "string" && key.trim()) {
    headers["X-Api-Key"] = key.trim()
  }
  return headers
}

const fetchPanicJsonInit = {
  method: "GET",
  headers: buildPanicFetchHeaders(),
  cache: "no-store",
}

function normalizePanicPayload(data) {
  if (!data || typeof data !== "object") return data
  return {
    ...data,
    vix: data.vix || 20,
    putCall: data.putCall || 1,
    highYield: data.highYield || 4,
    accessTier: data.accessTier ?? "free",
  }
}

/**
 * 패닉 JSON을 네트워크에서 가져옵니다.
 * 항상 `fetch(\`${import.meta.env.VITE_API_BASE}/panic-data\`)` 형태(베이스 trim·끝 슬래시 제거 후).
 * @param {{ debugLog?: boolean }} [options] — true면 STEP 0 운영용 콘솔 로그(기본 true)
 */
export async function fetchPanicDataJson(options = {}) {
  const debugLog = options.debugLog !== false

  if (!import.meta.env.VITE_API_BASE) {
    throw new Error("API 주소 없음")
  }

  const base = String(import.meta.env.VITE_API_BASE).trim().replace(/\/+$/, "")
  if (!base) {
    throw new Error("API 주소 없음")
  }

  const url = `${base}/panic-data`

  try {
    if (debugLog) {
      console.log("📡 API 요청 시작", url)
    }

    const res = await fetch(url, {
      ...fetchPanicJsonInit,
      headers: buildPanicFetchHeaders(),
    })

    if (debugLog) {
      console.log("✅ 응답 상태:", res.status)
    }

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`)
      console.error("❌ HTTP 오류:", res.status, url)
      throw err
    }

    const raw = await res.json()
    const data = normalizePanicPayload(raw)
    if (debugLog) {
      console.log("📦 받은 데이터:", data)
    }
    if (!validatePanicData(data)) {
      throw new Error("데이터 이상 감지")
    }
    return data
  } catch (err) {
    if (debugLog) {
      console.error("❌ 에러 발생:", err)
    } else {
      console.warn("[YDS] API 요청 실패 (조용한 모드):", err)
    }
    throw err
  }
}

/**
 * STEP 16: `/history` 샘플 시계열 (백테스트용). 검증은 하지 않음.
 * @param {{ debugLog?: boolean }} [options]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function fetchHistorySample(options = {}) {
  const debugLog = options.debugLog !== false

  if (!import.meta.env.VITE_API_BASE) {
    throw new Error("API 주소 없음")
  }

  const base = String(import.meta.env.VITE_API_BASE).trim().replace(/\/+$/, "")
  if (!base) {
    throw new Error("API 주소 없음")
  }

  const url = `${base}/history`

  try {
    if (debugLog) {
      console.log("📡 history 요청", url)
    }

    const res = await fetch(url, {
      ...fetchPanicJsonInit,
      headers: buildPanicFetchHeaders(),
    })

    if (debugLog) {
      console.log("✅ history 응답 상태:", res.status)
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const data = await res.json()
    if (!Array.isArray(data)) {
      throw new Error("history 응답이 배열이 아님")
    }
    if (debugLog) {
      console.log("📦 history 데이터:", data)
    }
    return data
  } catch (err) {
    if (debugLog) {
      console.error("❌ history 오류:", err)
    }
    throw err
  }
}

/**
 * STEP 18: 랜덤 탐색 기반 전략 최적화 결과
 * @param {{ debugLog?: boolean }} [options]
 */
export async function fetchOptimizeResult(options = {}) {
  const debugLog = options.debugLog !== false

  if (!import.meta.env.VITE_API_BASE) {
    throw new Error("API 주소 없음")
  }

  const base = String(import.meta.env.VITE_API_BASE).trim().replace(/\/+$/, "")
  if (!base) {
    throw new Error("API 주소 없음")
  }

  const url = `${base}/optimize`
  const res = await fetch(url, {
    ...fetchPanicJsonInit,
    headers: buildPanicFetchHeaders(),
  })
  if (debugLog) {
    console.log("🤖 optimize 상태:", res.status)
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  const data = await res.json()
  if (debugLog) {
    console.log("🤖 optimize 결과:", data)
  }
  return data
}
