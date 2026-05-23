/**
 * Daily Report 문구 정규화 — 중복·장황 표현 제거
 */

/** @param {string} raw */
export function compactPhrase(raw) {
  let s = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
  if (!s || s === "—") return "—"

  const rules = [
    [/장기 적립 구간/g, "장기 보유"],
    [/장기 적립/g, "장기 보유"],
    [/적립 유지/g, "장기 보유"],
    [/비중 확대 가능/g, "비중 조절"],
    [/비중 확대/g, "비중 조절"],
    [/눌림 매수 가능/g, "눌림 매수"],
    [/공포 분할매수/g, "분할매수"],
    [/과열 경계/g, "매수 타점"],
    [/과열 익절/g, "매수 타점"],
    [/익절·조정/g, "매수 타점"],
    [/익절 관리/g, "매수 타점"],
    [/극도 공포/g, "바닥권"],
    [/극단 공포/g, "바닥권"],
    [/공포 후반/g, "저점권"],
    [/^공포$/g, "저점권"],
    [/극도 과열/g, "과열권"],
    [/극단 과열/g, "과열권"],
    [/^과열$/g, "고점권"],
    [/^중립$/g, "전환권"],
    [/추격 매수 자제/g, "추격 금지"],
    [/추격 매수/g, "추격 금지"],
    [/분할 매수/g, "분할매수"],
    [/분할 관심/g, "관심 종목"],
    [/분할 대기/g, "분할 대기"],
  ]

  for (const [re, rep] of rules) {
    s = s.replace(re, rep)
  }

  return s.replace(/\s*·\s*/g, " · ").trim()
}

/** @param {string} a @param {string} b */
export function phrasesEqual(a, b) {
  const na = compactPhrase(a).replace(/\s/g, "")
  const nb = compactPhrase(b).replace(/\s/g, "")
  return na === nb && na !== "—"
}

/**
 * @param {string[]} parts
 * @param {number} [max]
 */
export function uniquePhrases(parts, max = 4) {
  /** @type {string[]} */
  const out = []
  for (const p of parts) {
    const c = compactPhrase(p)
    if (!c || c === "—") continue
    if (out.some((x) => phrasesEqual(x, c))) continue
    out.push(c)
    if (out.length >= max) break
  }
  return out
}
