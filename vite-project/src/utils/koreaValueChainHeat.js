/** @param {string | undefined} heat @returns {"HOT" | "WARM" | "COOL"} */
export function heatToRadarTemp(heat) {
  const h = String(heat || "").toUpperCase()
  if (h === "VERY HOT" || h === "HOT") return "HOT"
  if (h === "WARM") return "WARM"
  return "COOL"
}

/** @param {"HOT" | "WARM" | "COOL"} temp */
export function radarTempPillClass(temp) {
  if (temp === "HOT") return "border-rose-400/30 bg-rose-500/12 text-rose-200/95"
  if (temp === "WARM") return "border-amber-400/30 bg-amber-500/12 text-amber-200/95"
  return "border-slate-500/25 bg-slate-500/10 text-slate-400"
}
