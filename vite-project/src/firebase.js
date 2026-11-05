import { initializeApp } from "firebase/app"
import { getApps, getApp } from "firebase/app"
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  getRedirectResult,
  initializeAuth,
} from "firebase/auth"
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

/**
 * Persistence + popup/redirect resolver must be set at Auth construction.
 * Never call setPersistence before getRedirectResult on redirect return.
 * Without browserPopupRedirectResolver, getRedirectResult/signInWithRedirect
 * throw auth/argument-error.
 */
function createFirebaseAuth(firebaseApp) {
  if (!firebaseApp) return null
  try {
    return initializeAuth(firebaseApp, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch {
    return getAuth(firebaseApp)
  }
}

export const auth = app ? createFirebaseAuth(app) : null
export const db = app ? getFirestore(app) : null

/**
 * Consume redirect result once at module load (before React effects).
 * App.jsx must await this promise — do not call getRedirectResult again.
 */
export const redirectResultPromise = auth
  ? getRedirectResult(auth)
      .then((result) => ({
        user: result?.user ?? null,
        error: null,
        redirectResultPresent: result != null,
      }))
      .catch((err) => {
        console.error("로그인 실패", err?.code || err, err?.message || err)
        return {
          user: null,
          error: {
            code:
              typeof err?.code === "string" && err.code.trim()
                ? err.code.trim()
                : "redirect_failed",
            message:
              typeof err?.message === "string" ? err.message : String(err ?? "redirect_failed"),
          },
          redirectResultPresent: false,
        }
      })
  : Promise.resolve({ user: null, error: null, redirectResultPresent: false })

/** @deprecated kept for call sites that awaited persistence before settle — now a no-op ready. */
export const authPersistenceReady = Promise.resolve(null)

// Re-export settling key for App redirect flow (no secret).
export { FIREBASE_REDIRECT_SETTLING_KEY }

export async function getFirebaseMessagingSafe() {
  if (!app) return null
  const supported = await isSupported()
  if (!supported) return null
  return getMessaging(app)
}
