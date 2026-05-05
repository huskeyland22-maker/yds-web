import { initializeApp } from "firebase/app"
import { getApps, getApp } from "firebase/app"
import { getMessaging, isSupported } from "firebase/messaging"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export function hasFirebaseConfig() {
  return Object.values(firebaseConfig).every((v) => typeof v === "string" && v.trim() !== "")
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export async function getFirebaseMessagingSafe() {
  if (!hasFirebaseConfig()) return null
  const supported = await isSupported()
  if (!supported) return null
  return getMessaging(app)
}
