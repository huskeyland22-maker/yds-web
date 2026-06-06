/**
 * YDS Upper Cycle Study — launcher (research only)
 */
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const r = spawnSync("python", [join(dirname(fileURLToPath(import.meta.url)), "yds-upper-cycle-study.py"), "--write-doc"], {
  stdio: "inherit",
  cwd: join(dirname(fileURLToPath(import.meta.url)), ".."),
})
process.exit(r.status ?? 1)
