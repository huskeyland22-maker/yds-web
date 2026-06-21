/**
 * Verify Firebase ID token via Identity Toolkit (no firebase-admin dependency).
 * Requires FIREBASE_API_KEY or VITE_FIREBASE_API_KEY on the server.
 */

function getFirebaseApiKey() {
  return String(process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "").trim()
}

/**
 * @param {string} idToken
 * @returns {Promise<string>} Firebase UID
 */
export async function verifyFirebaseIdToken(idToken) {
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

  const uid = json?.users?.[0]?.localId
  if (!uid) throw new Error("invalid_token")
  return String(uid)
}
