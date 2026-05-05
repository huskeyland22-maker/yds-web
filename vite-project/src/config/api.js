/**
 * Vercel 등 배포 시 빌드 단계에서 주입: API 루트 (끝 슬래시 없음, /panic-data 제외).
 * @see https://vitejs.dev/guide/env-and-mode.html
 */
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

/** 에러 화면에 표시할 시도 URL (실제로는 한 곳만 사용) */
export function listPanicDataUrlAttemptsForDisplay() {
  const u = getPanicDataUrlForDisplay()
  return u ? [u] : []
}

const fetchPanicJsonInit = {
  method: "GET",
  headers: { Accept: "application/json" },
  cache: "no-store",
}

function normalizePanicPayload(data) {
  if (!data || typeof data !== "object") return data
  return {
    ...data,
    vix: data.vix || 20,
    putCall: data.putCall || 1,
    highYield: data.highYield || 4,
  }
}

/**
 * 패닉 JSON을 네트워크에서 가져옵니다.
 * 항상 `fetch(\`${import.meta.env.VITE_API_BASE}/panic-data\`)` 형태(베이스 trim·끝 슬래시 제거 후).
 */
export async function fetchPanicDataJson() {
  console.log("API 주소:", import.meta.env.VITE_API_BASE)

  if (!import.meta.env.VITE_API_BASE) {
    throw new Error("API 주소 없음")
  }

  const base = String(import.meta.env.VITE_API_BASE).trim().replace(/\/+$/, "")
  if (!base) {
    throw new Error("API 주소 없음")
  }

  const url = `${base}/panic-data`

  try {
    const res = await fetch(url, fetchPanicJsonInit)
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`)
      console.error("[YDS] API 에러:", err, { url, status: res.status })
      throw err
    }
    const data = normalizePanicPayload(await res.json())
    console.log("[YDS] 데이터:", data)
    return data
  } catch (err) {
    console.error("[YDS] API 에러:", err)
    throw err
  }
}
