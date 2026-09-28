import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const appPath = fileURLToPath(new URL("./App.jsx", import.meta.url))
const source = readFileSync(appPath, "utf8")

function extractFunction(name) {
  const asyncStart = source.indexOf(`async function ${name}(`)
  const start = source.indexOf(`function ${name}(`)
  const at = asyncStart >= 0 ? asyncStart : start
  assert.ok(at >= 0, `missing ${name}`)
  let depth = 0
  for (let i = source.indexOf("{", at); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1
    else if (source[i] === "}") {
      depth -= 1
      if (depth === 0) return source.slice(at, i + 1)
    }
  }
  throw new Error(`unbalanced ${name}`)
}

const shouldUseGoogleRedirectSignIn = new Function(
  `return (${extractFunction("shouldUseGoogleRedirectSignIn")})`,
)()
const settleGoogleRedirectSignIn = new Function(
  `return (${extractFunction("settleGoogleRedirectSignIn")})`,
)()

function browser(userAgent, extra = {}) {
  return {
    navigator: {
      userAgent,
      standalone: extra.standalone === true,
      platform: extra.platform ?? "Win32",
      maxTouchPoints: extra.maxTouchPoints ?? 0,
    },
    matchMedia: (query) => ({ matches: extra.standaloneQuery === query }),
  }
}

test("desktop browser keeps popup sign-in", () => {
  const desktop = browser(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  )
  assert.equal(shouldUseGoogleRedirectSignIn(desktop), false)
})

test("mobile Safari, Chrome, and standalone PWA use redirect", () => {
  const iphone = browser(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  )
  const android = browser(
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
  )
  const installed = browser(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    { standaloneQuery: "(display-mode: standalone)" },
  )
  const iosHome = browser(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    { standalone: true },
  )
  assert.equal(shouldUseGoogleRedirectSignIn(iphone), true)
  assert.equal(shouldUseGoogleRedirectSignIn(android), true)
  assert.equal(shouldUseGoogleRedirectSignIn(installed), true)
  assert.equal(shouldUseGoogleRedirectSignIn(iosHome), true)
})

test("redirect success returns the user and does not alert", async () => {
  const user = { uid: "google-user" }
  const alerts = []
  const previous = globalThis.alert
  globalThis.alert = (message) => alerts.push(message)
  try {
    const settled = await settleGoogleRedirectSignIn({ app: "auth" }, async () => ({ user }))
    assert.deepEqual(settled, user)
    assert.deepEqual(alerts, [])
  } finally {
    globalThis.alert = previous
  }
})

test("redirect failure is logged without the login alert", async () => {
  const alerts = []
  const errors = []
  const previousAlert = globalThis.alert
  const previousError = console.error
  globalThis.alert = (message) => alerts.push(message)
  console.error = (...args) => errors.push(args)
  try {
    const settled = await settleGoogleRedirectSignIn({ app: "auth" }, async () => {
      const err = new Error("redirect failed")
      err.code = "auth/redirect-cancelled-by-user"
      throw err
    })
    assert.equal(settled, null)
    assert.deepEqual(alerts, [])
    assert.equal(errors.length, 1)
    assert.equal(errors[0][1].code, "auth/redirect-cancelled-by-user")
  } finally {
    globalThis.alert = previousAlert
    console.error = previousError
  }
})

test("login branches popup and redirect without changing the auth listener", () => {
  const loginStart = source.indexOf("const login = async () => {")
  const logoutStart = source.indexOf("const logout = async () => {")
  const login = source.slice(loginStart, logoutStart)
  assert.match(login, /if \(shouldUseGoogleRedirectSignIn\(\)\)/)
  assert.match(login, /signInWithRedirect\(auth, provider\)/)
  assert.match(login, /signInWithPopup\(auth, provider\)/)
  assert.match(login, /window\.alert\("로그인에 실패했습니다"\)/)
  assert.match(
    source,
    /onAuthStateChanged\(auth, \(nextUser\) => \{\s*setUser\(nextUser \|\| null\)/,
  )
  assert.match(source, /void settleGoogleRedirectSignIn\(auth\)/)
  const redirectEffect = source.slice(
    source.indexOf("void settleGoogleRedirectSignIn(auth)"),
    source.indexOf("async function loadBuildVersion"),
  )
  assert.doesNotMatch(redirectEffect, /alert\(/)
})
