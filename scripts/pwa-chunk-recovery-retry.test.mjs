/**
 * PWA update overlay must not dead-end when yds_chunk_recovery latch is set.
 * node --test scripts/pwa-chunk-recovery-retry.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

describe("pwa chunk recovery retry", () => {
  it("exports forced retry and failed overlay path", () => {
    const src = readFileSync(join(root, "vite-project/src/utils/pwaFreshness.js"), "utf8")
    assert.match(src, /export async function retryChunkRecovery/)
    assert.match(src, /showChunkRecoveryFallback\(\{\s*failed:\s*true\s*\}\)/)
    assert.match(src, /armChunkRecoveryWatchdog/)
    assert.match(src, /options\?\.force === true/)
    assert.match(src, /user-reload\|user-retry/)
    // Must not leave inFlight latch without a user escape hatch
    assert.match(src, /chunkRecoveryInFlight = false/)
  })

  it("overlay button uses retryChunkRecovery instead of latch-blocked recover", () => {
    const src = readFileSync(join(root, "vite-project/src/utils/pwaFreshness.js"), "utf8")
    assert.match(src, /void retryChunkRecovery\("user-reload"\)/)
    assert.doesNotMatch(
      src,
      /btn\.addEventListener\("click", \(\) => \{\s*void recoverFromChunk404\("user-reload"\)/,
    )
  })

  it("bootstrap clears recovery latch after main module load", () => {
    const main = readFileSync(join(root, "vite-project/src/main.jsx"), "utf8")
    assert.match(main, /isChunkRecoveryPending\(\)/)
    assert.match(main, /clearChunkRecoveryFlag\(\)/)
  })

  it("inline HTML recover allows limited retry when latch is set", () => {
    const html = readFileSync(join(root, "vite-project/index.html"), "utf8")
    assert.match(html, /yds_chunk_recovery_attempts/)
    assert.match(html, /localStorage\.removeItem\(RECOVERY_KEY\)/)
  })

  it("SW/cache clear and inline recover cannot hang forever", () => {
    const src = readFileSync(join(root, "vite-project/src/utils/pwaFreshness.js"), "utf8")
    assert.match(src, /function withTimeout\(/)
    assert.match(src, /unregisterAllServiceWorkers/)
    assert.match(src, /clearAllCacheStorage/)
    const html = readFileSync(join(root, "vite-project/index.html"), "utf8")
    assert.match(html, /setTimeout\(finish,\s*4000\)/)
  })
})
