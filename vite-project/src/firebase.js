import { initializeApp } from "firebase/app"
import { getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getMessaging, isSupported } from "firebase/messaging"
import {
  FIREBASE_REDIRECT_SETTLING_KEY,
  markFirebaseRedirectSettling,
  resolveFirebaseAuthDomain,
} from "./content/ydsFirebaseAuthDomain.js"

function markPendingFirebaseRedirect() {
  if (typeof window === "undefined") return
  try {
    const storage = window.sessionStorage
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i) || ""
      if (key.startsWith("firebase:pendingRedirect:")) {
        markFirebaseRedirectSettling(window)
        return
      }
    }
  } catch {
    // ignore
  }
}

markPendingFirebaseRedirect()

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: resolveFirebaseAuthDomain(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, {
    hostname: typeof window !== "undefined" ? window.location.hostname : "",
  }),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const hasFirebaseApiKey =
  typeof firebaseConfig.apiKey === "string" && firebaseConfig.apiKey.trim() !== ""

export function hasFirebaseConfig() {
  return Object.values(firebaseConfig).every((v) => typeof v === "string" && v.trim() !== "")
}

export function getResolvedFirebaseAuthDomainForDebug() {
  return firebaseConfig.authDomain || null
}

let app = null
if (hasFirebaseConfig()) {
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  } catch (e) {
    console.error("[firebase] initializeApp failed — running without Firebase", e)
    app = null
  }
} else if (hasFirebaseApiKey) {
  console.warn("[firebase] partial env (need all VITE_FIREBASE_* keys) — Firebase disabled")
}

export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null

// Re-export settling key for App redirect flow (no secret).
export { FIREBASE_REDIRECT_SETTLING_KEY }

export async function getFirebaseMessagingSafe() {
  if (!app) return null
  const supported = await isSupported()
  if (!supported) return null
  return getMessaging(app)
}
