/**
 * YDS Backtest Layer v0 — 구조만 (스켈레톤)
 *
 * 목표: 과거 이벤트 검증용 (향후)
 *
 * 금지 (v0):
 * - 백테스트 실행
 * - UI 표시
 * - DB / API 연결
 * - Core·추천 점수 반영
 */

/** 사전 정의 이벤트 키 */
export type BacktestEventId = "covid2020" | "qt2022" | "carry2024"

/** 이벤트별 결과 행 */
export interface BacktestOutputRow {
  date: string
  score: number
  action: string
  marketMove: string
  result: string
}

/** 이벤트 메타 (검증 구간·설명) */
export interface BacktestEventSpec {
  id: BacktestEventId
  label: string
  /** 대략적 검증 구간 YYYY-MM-DD */
  windowStart: string
  windowEnd: string
  notes: string
}

export const BACKTEST_EVENTS: readonly BacktestEventSpec[] = [
  {
    id: "covid2020",
    label: "COVID-19 shock (2020)",
    windowStart: "2020-02-01",
    windowEnd: "2020-04-30",
    notes: "글로벌 리스크오프·VIX 급등 구간",
  },
  {
    id: "qt2022",
    label: "Fed QT / rate shock (2022)",
    windowStart: "2022-01-01",
    windowEnd: "2022-10-31",
    notes: "긴축·채권·성장주 조정",
  },
  {
    id: "carry2024",
    label: "Carry unwind (2024)",
    windowStart: "2024-07-01",
    windowEnd: "2024-08-31",
    notes: "엔 캐리·변동성 급변 (예시 구간)",
  },
] as const

/** v0: 실행 비활성 — 결과 없음 */
export const defaultBacktestOutput: readonly BacktestOutputRow[] = []

export interface BacktestRunConfig {
  eventId: BacktestEventId
  /** v0: 항상 false — 실행 금지 */
  enabled: boolean
}

export const defaultBacktestConfig: BacktestRunConfig = {
  eventId: "covid2020",
  enabled: false,
}

export interface BacktestRunResult {
  eventId: BacktestEventId
  ran: false
  rows: BacktestOutputRow[]
  message: string
}

/**
 * v0: 실행하지 않음. 구조·타입 검증용 스텁만 반환.
 */
export function runBacktest(_config: BacktestRunConfig = defaultBacktestConfig): BacktestRunResult {
  return {
    eventId: _config.eventId,
    ran: false,
    rows: [],
    message: "backtest_v0_disabled",
  }
}

export function getBacktestEvent(id: BacktestEventId): BacktestEventSpec | undefined {
  return BACKTEST_EVENTS.find((e) => e.id === id)
}

export function listBacktestEvents(): BacktestEventSpec[] {
  return [...BACKTEST_EVENTS]
}
