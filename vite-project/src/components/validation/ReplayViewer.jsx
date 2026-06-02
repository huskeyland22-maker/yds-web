import { useMemo, useState } from "react"
import { YDS_MILESTONE_ORDER } from "../../trading-zone/ydsHistoricalValidationEvents.js"

const STEP_LABEL = {
  start: "시작",
  rise: "상승",
  fearExpansion: "공포확대",
  climax: "극점",
  recovery: "회복",
}

/**
 * @param {{ eventItem: any }} props
 */
export default function ReplayViewer({ eventItem }) {
  const [idx, setIdx] = useState(0)
  const keys = useMemo(() => YDS_MILESTONE_ORDER.filter((k) => eventItem?.milestones?.[k]), [eventItem])
  if (!eventItem || !keys.length) return null
  const currentKey = keys[Math.max(0, Math.min(idx, keys.length - 1))]
  const current = eventItem.milestones[currentKey]
  const canPrev = idx > 0
  const canNext = idx < keys.length - 1

  return (
    <div className="yds-replay-viewer">
      <p className="m-0 yds-replay-viewer__title">Replay Viewer</p>
      <div className="yds-replay-viewer__controls">
        <button type="button" onClick={() => canPrev && setIdx((v) => v - 1)} disabled={!canPrev}>
          이전 날짜
        </button>
        <button type="button" onClick={() => canNext && setIdx((v) => v + 1)} disabled={!canNext}>
          다음 날짜
        </button>
      </div>
      <p className="m-0 yds-replay-viewer__status">
        현재 단계: {STEP_LABEL[currentKey] ?? currentKey} · {current?.date ?? "—"}
      </p>
    </div>
  )
}

