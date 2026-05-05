import { initializeApp } from "firebase/app"
import { getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getMessaging, isSupported } from "firebase/messaging"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const maskedApiKey =
  typeof firebaseConfig.apiKey === "string" && firebaseConfig.apiKey.length > 8
    ? `${firebaseConfig.apiKey.slice(0, 4)}...${firebaseConfig.apiKey.slice(-4)}`
    : firebaseConfig.apiKey

console.log("[firebase env check] API KEY:", maskedApiKey)
console.log("[firebase env check] hasConfigFields:", {
  authDomain: Boolean(firebaseConfig.authDomain),
  projectId: Boolean(firebaseConfig.projectId),
  storageBucket: Boolean(firebaseConfig.storageBucket),
  messagingSenderId: Boolean(firebaseConfig.messagingSenderId),
  appId: Boolean(firebaseConfig.appId),
})

const hasFirebaseApiKey =
  typeof firebaseConfig.apiKey === "string" && firebaseConfig.apiKey.trim() !== ""

export function hasFirebaseConfig() {
  return Object.values(firebaseConfig).every((v) => typeof v === "string" && v.trim() !== "")
}

const app = hasFirebaseApiKey ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null

export async function getFirebaseMessagingSafe() {
  if (!app) return null
  const supported = await isSupported()
  if (!supported) return null
  return getMessaging(app)
}
