import { getFinalScore } from "../utils/tradingScores.js"

export default function StrategyPage({ data, user, onSaveData }) {
  if (!data) return <div>Loading...</div>

  const fallbackScore = getFinalScore(data)
  const score = Number.isFinite(Number(data.score)) ? Number(data.score) : fallbackScore

  let strategy = ""
  let action = ""
  let color = ""

  if (score >= 70) {
    strategy = "과열 구간"
    action = "현금 비중 확대 / 일부 익절"
    color = "#ef4444"
  } else if (score <= 30) {
    strategy = "공포 구간"
    action = "분할 매수 시작"
    color = "#22c55e"
  } else {
    strategy = "중립 구간"
    action = "관망 또는 소액 진입"
    color = "#facc15"
  }

  return (
    <div style={{ padding: "40px" }}>
      <h1 style={{ fontSize: "28px" }}>📊 매매 전략</h1>

      <div
        style={{
          marginTop: "20px",
          padding: "30px",
          borderRadius: "20px",
          background: "#1f2937",
          textAlign: "center",
        }}
      >
        <h2 style={{ color }}>{strategy}</h2>
        <p style={{ marginTop: "10px" }}>{action}</p>
      </div>

      <div style={{ marginTop: "30px" }}>
        <h3>📌 전략 가이드</h3>

        <ul style={{ marginTop: "10px", lineHeight: "1.8" }}>
          <li>자금은 한 번에 넣지 말 것</li>
          <li>분할 매수 원칙 유지</li>
          <li>손절 기준 미리 설정</li>
        </ul>
      </div>

      <div style={{ marginTop: "30px" }}>
        <h3>⚠️ 리스크 관리</h3>
        <p>변동성 확대 구간에서는 비중 조절 필수</p>
      </div>

      <div style={{ marginTop: "30px", display: "flex", gap: "10px", alignItems: "center" }}>
        <button
          type="button"
          onClick={onSaveData}
          style={{
            padding: "10px 16px",
            borderRadius: "10px",
            border: "1px solid #475569",
            background: "#0f172a",
            color: "#e2e8f0",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          💾 내 데이터 저장
        </button>
        <span style={{ fontSize: "12px", color: "#94a3b8" }}>
          {user ? `로그인됨: ${user.displayName || user.email || user.uid}` : "로그인 필요"}
        </span>
      </div>
    </div>
  )
}
