import { auth } from "../firebase.js"

/**
 * Optional Firebase ID token for authenticated API calls.
 * Never logs the token value.
 * @returns {Promise<string | null>}
 */
export async function getOptionalFirebaseIdToken() {
  try {
    const user = auth?.currentUser
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
