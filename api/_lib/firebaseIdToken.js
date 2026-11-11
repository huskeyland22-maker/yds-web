/**
 * Verify Firebase ID token via Identity Toolkit (no firebase-admin dependency).
 * Requires FIREBASE_API_KEY or VITE_FIREBASE_API_KEY on the server.
 */

function getFirebaseApiKey() {
  return String(process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "").trim()
}

/**
 * Custom claims returned by Identity Toolkit `customAttributes`.
 * Not client-supplied. Invalid JSON is treated as no role.
 * @param {unknown} user
 * @returns {Record<string, unknown>}
 */
export function claimsFromLookupUser(user) {
  const raw = user && typeof user === "object" ? user.customAttributes : null
  if (typeof raw !== "string" || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return parsed
  } catch {
    return {}
  }
}

/**
 * @param {string} idToken
 * @returns {Promise<{ uid: string, claims: Record<string, unknown> }>}
 */
export async function verifyFirebaseAuthUser(idToken) {
  const apiKey = getFirebaseApiKey()
  const token = String(idToken ?? "").trim()
  if (!apiKey) throw new Error("firebase_api_key_missing")
  if (!token) throw new Error("missing_id_token")

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      cache: "no-store",
    },
  )

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.error?.message || res.statusText || "token_lookup_failed"
    throw new Error(msg)
  }

  const user = json?.users?.[0]
  const uid = user?.localId
  if (!uid) throw new Error("invalid_token")
  return { uid: String(uid), claims: claimsFromLookupUser(user) }
}

/**
 * @param {string} idToken
 * @returns {Promise<string>} Firebase UID
 */
export async function verifyFirebaseIdToken(idToken) {
  const profile = await verifyFirebaseAuthUser(idToken)
  return profile.uid
}
