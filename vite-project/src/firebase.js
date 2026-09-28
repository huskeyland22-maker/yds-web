import { initializeApp } from "firebase/app"
import { getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getMessaging, isSupported } from "firebase/messaging"

const PROJECT_AUTH_DOMAIN = "yds-web-fec1e.firebaseapp.com"
const PRODUCTION_APP_HOST = "yds-web-kappa.vercel.app"
const FIREBASE_REDIRECT_SETTLING_KEY = "yds.firebaseRedirectSettling"

function resolveAuthDomain(configured) {
  const projectDomain =
    typeof configured === "string" && configured.trim() ? configured.trim() : PROJECT_AUTH_DOMAIN
  if (typeof window !== "undefined" && window.location.hostname === PRODUCTION_APP_HOST) {
    return PRODUCTION_APP_HOST
  }
  return projectDomain
}

function markPendingFirebaseRedirect() {
  if (typeof window === "undefined") return
  try {
    const storage = window.sessionStorage
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i) || ""
      if (key.startsWith("firebase:pendingRedirect:")) {
        storage.setItem(FIREBASE_REDIRECT_SETTLING_KEY, "1")
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
  authDomain: resolveAuthDomain(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
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

export async function getFirebaseMessagingSafe() {
  if (!app) return null
  const supported = await isSupported()
  if (!supported) return null
  return getMessaging(app)
}
