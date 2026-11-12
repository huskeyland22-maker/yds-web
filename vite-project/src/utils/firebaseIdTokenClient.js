import { auth } from "../firebase.js"
import { onAuthStateChanged } from "firebase/auth"

/**
 * Wait until Firebase has restored a persisted user.
 * A signed-out session resolves without a token. The token value is never logged.
 * @returns {Promise<import("firebase/auth").User | null>}
 */
function restoredAuthUser() {
  if (!auth) return Promise.resolve(null)
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  return new Promise((resolve) => {
    let settled = false
    let timer = 0
    let unsubscribe = () => {}
    const finish = (user) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      unsubscribe()
      resolve(user ?? null)
    }
    timer = setTimeout(() => finish(auth.currentUser), 2000)
    unsubscribe = onAuthStateChanged(auth, (user) => finish(user))
  })
}

/**
 * Optional Firebase ID token for authenticated API calls.
 * Never logs the token value.
 * @returns {Promise<string | null>}
 */
export async function getOptionalFirebaseIdToken() {
  try {
    const user = await restoredAuthUser()
    if (!user) return null
    const token = await user.getIdToken()
    return typeof token === "string" && token.trim() ? token.trim() : null
  } catch {
    return null
  }
}

/**
 * @param {HeadersInit | undefined} base
 * @returns {Promise<Record<string, string>>}
 */
export async function withOptionalBearerAuth(base) {
  const headers = { ...(base && typeof base === "object" ? /** @type {Record<string, string>} */ (base) : {}) }
  const token = await getOptionalFirebaseIdToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}
