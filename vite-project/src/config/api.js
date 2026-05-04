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

/** 에러 화면·개발 fetch 순회에 쓰는 URL 목록 */
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
 * 프로덕션: `console.log("API:", import.meta.env.VITE_API_BASE)` 후
 * `fetch(\`${base}/panic-data\`)` — base는 VITE_API_BASE trim + 끝 슬래시 제거.
 */
export async function fetchPanicDataJson() {
  console.log("API:", import.meta.env.VITE_API_BASE)

  if (import.meta.env.PROD) {
    const raw = import.meta.env.VITE_API_BASE
    if (raw == null || typeof raw !== "string" || !String(raw).trim()) {
      console.error("[YDS] VITE_API_BASE 환경 변수 없음 또는 비어 있음")
      throw new Error(
        "배포 환경에서 API 주소(VITE_API_BASE)가 없습니다. Vercel 환경 변수에 공개 API URL을 넣고 다시 배포하세요.",
      )
    }

    // Vercel 빌드 시 주입된 값 — UI와 동일: fetch(`${import.meta.env.VITE_API_BASE}/panic-data`) 와 동일(트림·끝 / 제거 후)
    const base = String(import.meta.env.VITE_API_BASE).trim().replace(/\/+$/, "")
    const url = `${base}/panic-data`
    try {
      const res = await fetch(url, fetchPanicJsonInit)
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`)
        console.error("[YDS] API 에러:", err, { url, status: res.status })
        throw err
      }
      const data = await res.json()
      console.log("[YDS] 데이터:", data)
      return data
    } catch (err) {
      console.error("[YDS] API 에러:", err)
      throw err
    }
  }

  if (!getApiBase()) {
    console.warn("[YDS] VITE_API_BASE 미설정 — 로컬 후보 URL로 시도합니다.")
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
      const data = await res.json()
      console.log("[YDS] 데이터:", data)
      return data
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      console.error("[YDS panic-data] fetch 실패", { url, error: lastErr.message })
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? "Failed to fetch"))
}
