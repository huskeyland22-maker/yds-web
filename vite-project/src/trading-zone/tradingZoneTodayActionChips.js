/**
 * 오늘 행동 — 터미널 칩 라벨·아이콘
 */

/** @param {string} text */
export function shortenTodayActionLabel(text) {
  const t = String(text ?? "").trim()
  if (!t) return "—"
  return t
    .replace(/분할 추가 가능/g, "분할추가")
    .replace(/분할 익절 우선/g, "분할익절")
    .replace(/눌림 구간 분할 진입 검토/g, "눌림분할")
    .replace(/관심 유지/g, "관심유지")
    .replace(/추격 금지/g, "추격금지")
    .replace(/과열·추격 금지/g, "추격금지")
    .replace(/손절선 이탈 시 대응/g, "손절대응")
    .replace(/비중 축소·손절 우선/g, "손절우선")
    .replace(/\s+/g, "")
    .slice(0, 8)
}

/** @param {string} tone */
export function iconForTodayActionTone(tone) {
  if (tone === "danger") return "🚨"
  if (tone === "warn") return "⚠"
  return "✓"
}

/**
 * @param {ReturnType<import("./marketPolicyEngine.js").buildTodayActionCompact>} compact
 */
export function compactToTodayActionChips(compact) {
  if (!compact) return []

  const chaseBlocked = compact.chase?.value === "금지"
  const sectorLabel =
    compact.sectors && compact.sectors !== "—"
      ? String(compact.sectors).split("/")[0]?.trim().slice(0, 6) || "섹터"
      : "종목탐색"

  const entryDanger = compact.entry?.tone === "danger"
  const entryChip = {
    icon: entryDanger ? "🚨" : compact.entry?.tone === "warn" ? "⚠" : "✓",
    label:
      compact.entry?.value === "금지"
        ? "신규금지"
        : compact.entry?.value === "제한"
          ? "신규제한"
          : "신규가능",
    tone: compact.entry?.tone === "ok" ? "ok" : compact.entry?.tone ?? "neutral",
  }

  return [
    {
      icon: compact.split?.tone === "warn" ? "⚠" : "✓",
      label:
        compact.split?.value === "강화"
          ? "분할강화"
          : compact.split?.value === "가능"
            ? "분할추가"
            : `분할${compact.split?.value ?? "—"}`,
      tone: compact.split?.tone === "ok" ? "ok" : compact.split?.tone ?? "ok",
    },
    {
      icon: chaseBlocked ? "⚠" : "✓",
      label: chaseBlocked ? "추격금지" : "추격허용",
      tone: chaseBlocked ? "warn" : "ok",
    },
    entryChip,
    {
      icon: "✓",
      label: sectorLabel.length > 4 ? shortenTodayActionLabel(sectorLabel) : sectorLabel || "종목탐색",
      tone: "sector",
    },
  ]
}

/**
 * @param {{ icon: string; text: string }[]} items
 */
export function stageActionsToTodayActionChips(items) {
  return items.map((item) => {
    const icon = item.icon === "✅" ? "✓" : item.icon
    let tone = "ok"
    if (icon === "🚨") tone = "danger"
    else if (icon === "⚠") tone = "warn"
    return {
      icon,
      label: shortenTodayActionLabel(item.text),
      tone,
    }
  })
}
