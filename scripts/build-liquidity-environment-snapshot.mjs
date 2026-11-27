/**
 * Build NY Fed SOFR + ON RRP snapshot for credit-cycle liquidity environment.
 * Rights: CONDITIONAL (NY Fed Terms) — attribution required; not merged into R_core.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.resolve(
  __dirname,
  "../vite-project/public/credit-cycle/liquidity-environment-snapshot.json",
)

const SOFR_SEARCH =
  "https://markets.newyorkfed.org/api/rates/all/search.json?startDate=2025-01-01&endDate=2099-12-31&type=rate"
const RRP_LAST = "https://markets.newyorkfed.org/api/rp/reverserepo/all/results/last/120.json"

async function main() {
  const [sofrRes, rrpRes] = await Promise.all([fetch(SOFR_SEARCH), fetch(RRP_LAST)])
  if (!sofrRes.ok) throw new Error(`sofr_http_${sofrRes.status}`)
  if (!rrpRes.ok) throw new Error(`rrp_http_${rrpRes.status}`)
  const sofrJson = await sofrRes.json()
  const rrpJson = await rrpRes.json()

  const sofr = (sofrJson.refRates || [])
    .filter((r) => r.type === "SOFR" && r.percentRate != null)
    .map((r) => ({
      date: String(r.effectiveDate).slice(0, 10),
      value: Number(r.percentRate),
      volume_billions: r.volumeInBillions != null ? Number(r.volumeInBillions) : null,
      revision_indicator: r.revisionIndicator || "",
    }))
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date))

  const onRrp = (rrpJson.repo?.operations || [])
    .filter((o) => o.term === "Overnight" && o.totalAmtAccepted != null)
    .map((o) => ({
      date: String(o.operationDate || o.settlementDate).slice(0, 10),
      value: Number(o.totalAmtAccepted),
      value_billions: Number(o.totalAmtAccepted) / 1e9,
      accepted_counterparties: o.acceptedCpty ?? null,
    }))
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Dedupe by date (keep last)
  const sofrMap = new Map(sofr.map((p) => [p.date, p]))
  const rrpMap = new Map(onRrp.map((p) => [p.date, p]))

  const snap = {
    schema_version: "liquidity_environment-snapshot-0.1.0",
    generated_at: new Date().toISOString(),
    feed_status: sofrMap.size && rrpMap.size ? "AVAILABLE" : "PARTIAL_COVERAGE",
    rights: {
      sofr: "RIGHTS_CONDITIONAL",
      on_rrp: "RIGHTS_CONDITIONAL",
      note: "NY Fed Markets Terms — attribution required; not Board PD PASS",
      source: "https://markets.newyorkfed.org/",
      attribution:
        "The SOFR is subject to the Terms of Use posted at newyorkfed.org. The New York Fed is not responsible for publication of the SOFR by YDS, does not sanction or endorse any particular republication, and has no liability for your use.",
    },
    lambda: 0,
    r_core_includes_liquidity: false,
    sofr: {
      series: [...sofrMap.values()],
      unit: "percent_annualized",
      producer: "Federal Reserve Bank of New York",
    },
    on_rrp: {
      series: [...rrpMap.values()],
      unit: "usd_accepted",
      producer: "Federal Reserve Bank of New York — Reverse Repo Operations",
    },
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(snap, null, 2))
  console.log(
    JSON.stringify(
      {
        outPath,
        sofr_n: sofrMap.size,
        rrp_n: rrpMap.size,
        sofr_tip: [...sofrMap.values()].at(-1),
        rrp_tip: [...rrpMap.values()].at(-1),
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
