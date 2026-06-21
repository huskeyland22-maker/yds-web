import assert from "node:assert/strict"
import { auditPortfolioStorage } from "../vite-project/src/content/ydsPortfolioStorageDebug.js"

const audit = auditPortfolioStorage()
assert.equal(audit.storageType, "localStorage")
assert.equal(audit.supabasePortfolio, false)
assert.equal(audit.accountSync, false)
assert.equal(audit.syncMode, "device-local")
assert.equal(audit.accountSync, false)

console.log("yds-portfolio-storage-debug.test.mjs OK")
