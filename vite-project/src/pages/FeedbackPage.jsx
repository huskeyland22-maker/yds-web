import { useState } from "react"
import LaunchPageShell from "../components/launch/LaunchPageShell.jsx"
import { FEEDBACK_EMAIL } from "../content/ydsLaunchContent.js"

const FEEDBACK_TYPES = [
  { id: "bug", label: "버그 제보", subject: "[YDS] 버그 제보" },
  { id: "feature", label: "기능 요청", subject: "[YDS] 기능 요청" },
  { id: "opinion", label: "의견 보내기", subject: "[YDS] 의견" },
]

export default function FeedbackPage() {
  const [type, setType] = useState("bug")
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState(false)

  const selected = FEEDBACK_TYPES.find((t) => t.id === type) ?? FEEDBACK_TYPES[0]
  const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(selected.subject)}&body=${encodeURIComponent(message || "(내용을 입력해 주세요)")}`

  return (
    <LaunchPageShell title="피드백" subtitle="버그 · 기능 요청 · 의견">
      <div className="yds-feedback">
        <div className="yds-feedback__types" role="tablist" aria-label="피드백 유형">
          {FEEDBACK_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={type === t.id}
              className={type === t.id ? "is-active" : ""}
              onClick={() => setType(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="yds-feedback__label" htmlFor="feedback-msg">
          내용
        </label>
        <textarea
          id="feedback-msg"
          className="yds-feedback__area"
          rows={6}
          placeholder="재현 방법, 기대 동작, 화면 경로 등을 적어 주세요."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <a href={mailto} className="yds-feedback__send" onClick={() => setSent(true)}>
          메일 앱으로 보내기
        </a>
        {sent ? (
          <p className="yds-feedback__ok" role="status">
            메일 앱이 열리지 않으면 {FEEDBACK_EMAIL} 로 직접 보내 주세요.
          </p>
        ) : null}
        <p className="yds-feedback__note">
          V1에서는 외부 폼 대신 이메일로 수집합니다. 스팸 방지를 위해 제목 접두어를 유지해 주세요.
        </p>
      </div>
    </LaunchPageShell>
  )
}
