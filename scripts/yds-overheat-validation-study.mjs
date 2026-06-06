/**
 * YDS Overheat Validation Study — launcher (research only)
 * Usage: node scripts/yds-overheat-validation-study.mjs
 */
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const py = join(__dirname, "yds-overheat-validation-study.py")
const r = spawnSync("python", [py, "--write-doc"], { stdio: "inherit", cwd: join(__dirname, "..") })
process.exit(r.status ?? 1)
