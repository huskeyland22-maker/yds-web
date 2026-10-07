/**
 * Run the ten-year hold study and write the research JSON.
 * Does not touch production, the database, or sell-research files.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { study } from "./lib/equity-longterm-research-v1.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const source = JSON.parse(readFileSync(join(root, "data/equity-longterm-research-v1-source.json"), "utf8"))
const result = study(source)
const out = join(root, "data/equity-longterm-research-v1.json")
writeFileSync(out, JSON.stringify(result, null, 2))
const grades = Object.fromEntries(Object.entries(result.grades).map(([key, rows]) => [key, rows.length]))
console.log(JSON.stringify({ count: result.count, grades, top: result.ranked[0], selectedStrategy: result.selectedStrategy }))
