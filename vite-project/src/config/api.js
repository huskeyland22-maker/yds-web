/**
 * Vercel 등 배포 시 빌드 단계에서 주입: Render API 루트 (끝 슬래시 없음, /panic-data 제외).
 * @see https://vitejs.dev/guide/env-and-mode.html
 */
export function getApiBase() {
  const raw = import.meta.env.VITE_API_BASE
  if (raw == null || typeof raw !== "string") return ""
  return raw.trim().replace(/\/+$/, "")
}

/** 로딩/안내용: 개발 시 로컬 기본값 포함 */
export function getPanicDataUrlForDisplay() {
  const base = getApiBase()
  if (base) return `${base}/panic-data`
  if (import.meta.env.DEV) return "http://127.0.0.1:5000/panic-data"
  return ""
}

function panicDataUrlFromBase(base) {
  const b = base.replace(/\/+$/, "")
  return `${b}/panic-data`
}

/** 에러 화면·fetch 순회에 쓰는 URL 목록 (프로덕션은 `${VITE_API_BASE}/panic-data` 단일) */
export function listPanicDataUrlAttemptsForDisplay() {
  const base = getApiBase()
  if (import.meta.env.PROD) {
    return base ? [panicDataUrlFromBase(base)] : []
  }
  if (base) {
    return [
      ...new Set([
        panicDataUrlFromBase(base),
        "/panic-data",
        "http://127.0.0.1:5000/panic-data",
        "http://localhost:5000/panic-data",
      ]),
    ]
  }
  return [
    "http://127.0.0.1:5000/panic-data",
    "/panic-data",
    "http://localhost:5000/panic-data",
  ]
}

const fetchPanicJsonInit = {
  method: "GET",
  headers: { Accept: "application/json" },
  cache: "no-store",
}

/**
 * 패닉 JSON을 네트워크에서 가져옵니다.
 * 프로덕션: `fetch(\`${import.meta.env.VITE_API_BASE}/panic-data\`)` 와 동일한 단일 URL.
 */
export async function fetchPanicDataJson() {
  if (import.meta.env.PROD && !getApiBase()) {
    throw new Error(
      "배포 환경에서 API 주소(VITE_API_BASE)가 없습니다. Vercel 환경 변수에 공개 API URL을 넣고 다시 배포하세요.",
    )
  }

  const urls = listPanicDataUrlAttemptsForDisplay()
  let lastErr = null
  for (const url of urls) {
    try {
      const res = await fetch(url, fetchPanicJsonInit)
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`)
        console.error("[YDS panic-data] HTTP 오류", { url, status: res.status })
        continue
      }
      return await res.json()
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      console.error("[YDS panic-data] fetch 실패", { url, error: lastErr.message })
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? "Failed to fetch"))
}
