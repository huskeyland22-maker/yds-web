import { useEffect, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "../firebase.js"

/**
 * Firebase auth user for portfolio sync and other account features.
 */
export function useFirebaseAuthUser() {
  const [user, setUser] = useState(/** @type {import("firebase/auth").User | null} */ (null))
  const [authReady, setAuthReady] = useState(() => !auth)

  useEffect(() => {
    if (!auth) {
      setAuthReady(true)
      return
    }
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next)
      setAuthReady(true)
    })
    return () => unsub()
  }, [])

  return { user, authReady }
}
